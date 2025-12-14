"use server";

import { Sandbox } from "@vercel/sandbox";
import { streamText, tool, stepCountIs, ToolLoopAgent, streamObject, Output } from "ai";
import { z } from "zod";
import { Writable } from "stream";
import { Octokit } from "octokit";
import { schema } from "@vercel/sandbox/dist/utils/get-credentials";

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export interface RepoAnalysisConfig {
  repoUrl: string;
  /**
   * Maximum time the sandbox can run (default: 5 minutes)
   * Format: ms-compatible string like '5m', '10m', '1h'
   */
  timeout?: string;
  /**
   * Optional hiring brief to contextualize the analysis
   */
  hiringBrief?: string;
  /**
   * Number of vCPUs for the sandbox (default: 2)
   */
  vcpus?: 1 | 2 | 4;
}

// Schema for the final structured analysis output
const repoAnalysisSchema = z.object({
  // Basic repo info
  repoName: z.string().describe("Name of the repository"),
  repoOwner: z.string().describe("Owner/organization of the repository"),
  description: z.string().nullable().describe("Repository description if available"),

  // Technical assessment
  primaryLanguages: z.array(z.string()).describe("Main programming languages used"),
  frameworks: z.array(z.string()).describe("Frameworks and major libraries detected"),
  hasTests: z.boolean().describe("Whether the repo has a test suite"),
  testCoverage: z.string().nullable().describe("Estimated test coverage if determinable"),
  hasCI: z.boolean().describe("Whether CI/CD is configured (GitHub Actions, etc.)"),
  hasDocumentation: z.boolean().describe("Whether meaningful documentation exists"),
  codeQuality: z.enum(["excellent", "good", "average", "below_average", "poor"]).describe("Overall code quality assessment"),

  // Developer skill assessment
  skillLevel: z.enum([
    "beginner",
    "junior",
    "intermediate",
    "senior",
    "expert"
  ]).describe("Estimated skill level of the developer(s)"),

  skillIndicators: z.array(z.object({
    indicator: z.string().describe("What was observed"),
    significance: z.enum(["positive", "neutral", "negative"]).describe("Whether this is a positive or negative signal"),
    explanation: z.string().describe("Why this matters")
  })).describe("Specific indicators that inform the skill assessment"),

  // Professionalism signals
  professionalism: z.object({
    score: z.number().min(1).max(10).describe("Professionalism score from 1-10"),
    commitMessageQuality: z.enum(["excellent", "good", "average", "poor"]).describe("Quality of commit messages"),
    codeOrganization: z.enum(["excellent", "good", "average", "poor"]).describe("How well the code is organized"),
    namingConventions: z.enum(["consistent", "mostly_consistent", "inconsistent"]).describe("Consistency of naming"),
    errorHandling: z.enum(["comprehensive", "adequate", "minimal", "poor"]).describe("How errors are handled"),
  }),

  // Git/collaboration signals
  gitPractices: z.object({
    commitFrequency: z.string().describe("How often commits are made"),
    branchStrategy: z.string().nullable().describe("Branching strategy if detectable"),
    prUsage: z.boolean().describe("Whether PRs are used"),
    collaborationSignals: z.array(z.string()).describe("Signs of collaboration or teamwork"),
  }),

  // Project complexity
  complexity: z.object({
    level: z.enum(["trivial", "simple", "moderate", "complex", "very_complex"]).describe("Overall project complexity"),
    linesOfCode: z.number().nullable().describe("Approximate lines of code"),
    fileCount: z.number().describe("Number of source files"),
    architecturePattern: z.string().nullable().describe("Detected architecture pattern if any"),
  }),

  // Strengths and areas of growth
  strengths: z.array(z.string()).max(6).describe("Key strengths demonstrated in this repo"),
  areasForGrowth: z.array(z.string()).max(4).describe("Areas where the developer could improve (be constructive, not harsh)"),

  // Overall summary
  summary: z.string().max(500).describe("A thoughtful 3-4 sentence summary of the developer's capabilities based on this repo"),

  // Recommendation for hiring
  hiringRecommendation: z.enum([
    "strong_yes",
    "yes",
    "maybe",
    "likely_no",
    "no"
  ]).describe("Hiring recommendation based on the analysis"),

  // Raw data collected during analysis
  rawFindings: z.array(z.object({
    command: z.string(),
    purpose: z.string(),
    keyFindings: z.string()
  })).describe("Summary of commands run and what was discovered"),
});

export type RepoAnalysis = z.infer<typeof repoAnalysisSchema>;

// Progress update types for streaming to UI
export type AnalysisProgressStatus =
  | 'validating'
  | 'spinning_up_sandbox'
  | 'cloning_repository'
  | 'executing_command'
  | 'analyzing'
  | 'generating_report'
  | 'complete'
  | 'error';

export interface AnalysisProgress {
  status: AnalysisProgressStatus;
  message: string;
  repoName?: string;
  repoOwner?: string;
  command?: string;
  purpose?: string;
  commandOutput?: string;
  stepNumber?: number;
  totalSteps?: number;
  result?: RepoAnalysis;
  error?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Parse a time string like '5m', '1h', '30s' into milliseconds
 */
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid timeout format: ${timeout}. Use format like '5m', '1h', '30s'`);
  }
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  switch (unit) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

// ============================================================================
// SANDBOX MANAGEMENT
// ============================================================================

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface StreamingCommandChunk {
  type: 'stdout' | 'stderr';
  data: string;
  accumulated: string;
}

/**
 * Creates a writable stream that calls a callback on each chunk
 */
function createStreamingCollector(
  onChunk: (chunk: string) => void
): { stream: Writable; getData: () => string } {
  let data = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const str = chunk.toString();
      data += str;
      onChunk(str);
      callback();
    },
  });
  return { stream, getData: () => data };
}

/**
 * Streaming version of runSandboxCommand - yields output chunks as they arrive
 */
async function* runSandboxCommandStreaming(
  sandbox: Sandbox,
  command: string,
  options?: { cwd?: string }
): AsyncGenerator<StreamingCommandChunk, CommandResult, unknown> {
  const startTime = Date.now();
  
  if (options?.cwd) {
    
  }

  // Queue to hold chunks that need to be yielded
  const chunkQueue: StreamingCommandChunk[] = [];
  let resolveChunk: (() => void) | null = null;
  let stdoutAccumulated = "";
  let stderrAccumulated = "";

  const stdoutCollector = createStreamingCollector((chunk) => {
    stdoutAccumulated += chunk;
    chunkQueue.push({ type: 'stdout', data: chunk, accumulated: stdoutAccumulated });
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  const stderrCollector = createStreamingCollector((chunk) => {
    stderrAccumulated += chunk;
    chunkQueue.push({ type: 'stderr', data: chunk, accumulated: stderrAccumulated });
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  // Start the command (don't await yet)
  const commandPromise = sandbox.runCommand({
    cmd: "bash",
    args: ["-c", command],
    stdout: stdoutCollector.stream,
    stderr: stderrCollector.stream,
    cwd: options?.cwd,
  });

  let commandDone = false;
  let commandResult: Awaited<typeof commandPromise> | null = null;

  // Handle command completion
  commandPromise.then((result) => {
    commandDone = true;
    commandResult = result;
    // Wake up the generator if it's waiting
    if (resolveChunk) {
      resolveChunk();
      resolveChunk = null;
    }
  });

  // Yield chunks as they arrive
  while (!commandDone || chunkQueue.length > 0) {
    if (chunkQueue.length > 0) {
      yield chunkQueue.shift()!;
    } else if (!commandDone) {
      // Wait for either a new chunk or command completion
      await new Promise<void>((resolve) => {
        resolveChunk = resolve;
      });
    }
  }

  // Ensure command is done
  const result = commandResult || await commandPromise;

  const duration = Date.now() - startTime;
  const stdout = stdoutCollector.getData().trim();
  const stderr = stderrCollector.getData().trim();

  
  if (stdout) {
    
  }
  if (stderr) {
    
  }

  return {
    stdout,
    stderr,
    exitCode: result.exitCode,
  };
}

// ============================================================================
// HTML ENTITY DECODER
// ============================================================================

function decodeHtmlEntities(str: string): string {
  return str
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&tab;/g, '\t')
    .replace(/&newline;/g, '\n')
    // Numeric entities (decimal)
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#38;/g, '&')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#96;/g, '`')
    .replace(/&#124;/g, '|')
    .replace(/&#92;/g, '\\')
    // Numeric entities (hex)
    .replace(/&#x27;/gi, "'")
    .replace(/&#x22;/gi, '"')
    .replace(/&#x26;/gi, '&')
    .replace(/&#x3c;/gi, '<')
    .replace(/&#x3e;/gi, '>')
    .replace(/&#x60;/gi, '`')
    .replace(/&#x7c;/gi, '|')
    .replace(/&#x5c;/gi, '\\')
    // Generic numeric entity decoder for any remaining entities
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

// Security patterns for command sanitization
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  /fork\s*bomb/i,
  />\s*\/dev\/sd/i,
];

// ============================================================================
// MAIN ANALYSIS FUNCTION (Async Generator for streaming progress)
// ============================================================================

export async function* analyzeRepositoryWithProgress(
  config: RepoAnalysisConfig
): AsyncGenerator<AnalysisProgress, AnalysisProgress, unknown> {
  const { repoUrl, timeout = "5m", hiringBrief, vcpus = 2 } = config;

  // Parse repo URL to get owner/name
  const urlMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!urlMatch) {
    yield {
      status: 'error',
      message: 'Invalid GitHub repository URL',
      error: 'Expected format: https://github.com/owner/repo'
    };
    return {
      status: 'error',
      message: 'Invalid GitHub repository URL',
      error: 'Expected format: https://github.com/owner/repo'
    };
  }
  const [, repoOwner, repoName] = urlMatch;

  // Yield: Spinning up sandbox
  yield {
    status: 'spinning_up_sandbox',
    message: `Spinning up virtual sandbox for ${repoOwner}/${repoName}...`,
    repoName,
    repoOwner,
  };

  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.create({
      source: {
        url: repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`,
        type: "git",
      },
      resources: { vcpus },
      timeout: parseTimeout(timeout),
      runtime: "node24",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    yield {
      status: 'error',
      message: 'Failed to create sandbox',
      error: errorMsg
    };
    return {
      status: 'error',
      message: 'Failed to create sandbox',
      error: errorMsg
    };
  }

  // Yield: Repository cloned
  yield {
    status: 'cloning_repository',
    message: `Repository cloned successfully. Starting analysis...`,
    repoName,
    repoOwner,
  };

  try {
    // Track all commands and findings for the final analysis
    const commandHistory: Array<{ command: string; purpose: string; output: string }> = [];
    let stepNumber = 0;

    // Define the bash tool - simple async function, progress is yielded via fullStream events
    const bashTool = tool({
      description: `Execute a bash command in the repository sandbox to analyze the codebase.
The repository has already been cloned to /vercel/sandbox.
You have access to common tools: git, find, grep, wc, head, tail, cat, ls, tree (if installed), etc.
Use this to explore the codebase structure, read files, analyze git history, count lines of code, etc.
Be thorough but efficient - gather the information you need to assess the developer's skill level and professionalism.`,
      inputSchema: z.object({
        command: z.string().describe("The bash command to execute"),
        purpose: z.string().describe("Brief description of why you're running this command"),
      }),
      execute: async ({ command: rawCommand, purpose }) => {
        const command = decodeHtmlEntities(rawCommand);

        
        

        // Security check
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(command)) {
            console.warn(`[BASH TOOL] BLOCKED: Command matched dangerous pattern: ${pattern}`);
            return {
              success: false,
              output: 'Command blocked for security reasons',
              error: 'Potentially dangerous command detected',
            };
          }
        }

        // Execute command in sandbox
        try {
          const streamingCommand = runSandboxCommandStreaming(sandbox, command, { cwd: "/vercel/sandbox" });

          // Consume the streaming generator to get the final result
          let result: CommandResult | undefined;
          let iterResult = await streamingCommand.next();

          while (!iterResult.done) {
            iterResult = await streamingCommand.next();
          }

          // When done=true, value contains the return value
          result = iterResult.value as CommandResult;

          const output = result.stdout || result.stderr || "(no output)";
          const truncatedOutput = output.length > 10000
            ? output.slice(0, 10000) + "\n... (output truncated)"
            : output;

          commandHistory.push({ command, purpose, output: truncatedOutput });

          const success = result.exitCode === 0;
          

          return {
            success,
            output: truncatedOutput,
            exitCode: result.exitCode,
            error: result.exitCode !== 0 ? result.stderr : null,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[BASH TOOL] Exception: ${errorMessage}`);
          return {
            success: false,
            output: "",
            error: errorMessage,
          };
        }
      },
    });

    // Build the system prompt
    const systemPrompt = `You are an expert code reviewer and talent assessor analyzing a GitHub repository to evaluate the developer's skill level and professionalism.

Your goal is to thoroughly analyze the repository "${repoOwner}/${repoName}" and provide a comprehensive assessment of:
1. Technical skill level (beginner to expert)
2. Code quality and organization
3. Professional practices (commit messages, documentation, testing)
4. Collaboration signals (PR usage, code reviews, branching)
5. Overall recommendation for hiring

${hiringBrief ? `\nHIRING CONTEXT:\n${hiringBrief}\n` : ""}

IMPORTANT GUIDELINES:
- Be thorough but fair - don't be overly critical
- Consider that some things might be private or handled elsewhere
- Look for POSITIVE signals, not just problems
- A junior developer with good practices may be more valuable than a senior with sloppy habits
- Consider the PROJECT TYPE when assessing complexity (a simple tool done well is fine)
- Give credit for good practices even if the code itself is simple

SUGGESTED ANALYSIS APPROACH:
1. First, explore the repository structure (ls, find, tree)
2. Check the README and documentation
3. Analyze git history (commits, branches, frequency)
4. Look at code organization and file structure
5. Read some actual code files to assess quality
6. Check for tests, CI/CD configuration
7. Analyze dependencies and build configuration
8. Look at recent commits for commit message quality

Be efficient with commands - you have a limited time in the sandbox. Focus on gathering the most informative data.

After gathering information, provide your complete structured analysis as a JSON object matching the required schema.`;

    // Yield: Starting analysis
    yield {
      status: 'analyzing',
      message: 'AI agent starting codebase analysis...',
      repoName,
      repoOwner,
    };

    const result = streamText({
      model: "xai/grok-4.1-fast-reasoning",
      system: systemPrompt,
      output: Output.object({ schema: repoAnalysisSchema }),
      prompt: `Analyze this repository thoroughly. Use the bash tool to explore the codebase and gather information.

      Start by exploring the repository structure, then dig deeper into areas that reveal developer skill and professionalism.
      Collect evidence for your assessment - specific examples are more valuable than general impressions.

      After gathering enough information, provide your complete structured analysis.`,  
      stopWhen: stepCountIs(25),
      tools: { bash: bashTool },
    });

    // Track pending tool calls to match with results
    const pendingTools: Map<string, { toolName: string; args: { command: string; purpose: string } }> = new Map();

    // Iterate over fullStream and yield on EVERY relevant event
    let finalText = "";
    for await (const part of result.fullStream) {

      

      // Track tool calls when they start - yield immediately
      if (part.type === 'tool-call') {
        // The AI SDK uses 'input' not 'args' for tool call parameters
        const toolCall = part as { toolCallId: string; toolName: string; input?: { command: string; purpose: string } };
        

        if (toolCall.toolName === 'bash' && toolCall.input) {
          pendingTools.set(toolCall.toolCallId, {
            toolName: toolCall.toolName,
            args: toolCall.input,
          });

          // Yield: Command starting
          stepNumber++;
          const progress: AnalysisProgress = {
            status: 'executing_command',
            message: toolCall.input.purpose,
            repoName,
            repoOwner,
            command: toolCall.input.command,
            purpose: toolCall.input.purpose,
            stepNumber,
          };
          yield progress;
        }
      }

      // Yield progress when tool results come in
      if (part.type === 'tool-result') {
        const toolResultPart = part as { toolCallId: string; toolName: string; result?: unknown };
        
        const toolCallInfo = pendingTools.get(toolResultPart.toolCallId);

        if (toolCallInfo && toolResultPart.result) {
          const toolResult = toolResultPart.result as { success?: boolean; output?: string; error?: string };

          // Yield: Command completed with output
          const progress: AnalysisProgress = {
            status: 'executing_command',
            message: `${toolCallInfo.args.purpose} - ${toolResult.success ? 'completed' : 'failed'}`,
            repoName,
            repoOwner,
            command: toolCallInfo.args.command,
            purpose: toolCallInfo.args.purpose,
            commandOutput: (toolResult.output || toolResult.error || '').slice(0, 500),
            stepNumber,
          };
          yield progress;

          pendingTools.delete(toolResultPart.toolCallId);
        }
      }

      // Accumulate final text
      if (part.type === 'text-delta') {
        const textPart = part as { text?: string };
        finalText += textPart.text || '';
      }
    }

    // Try to parse the final text as our structured output
    let output: RepoAnalysis | undefined;
    try {
      // Find JSON in the response (might be wrapped in markdown code blocks)
      const jsonMatch = finalText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        finalText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, finalText];
      const jsonStr = jsonMatch[1] || finalText;

      // Try to parse as JSON
      const parsed = JSON.parse(jsonStr.trim());
      output = repoAnalysisSchema.parse(parsed);
    } catch {
      console.error("Failed to parse structured output from text");
    }

    // Yield: Generating report
    yield {
      status: 'generating_report',
      message: 'Generating final analysis report...',
      repoName,
      repoOwner,
      stepNumber,
      totalSteps: stepNumber,
    };

    // Handle missing output
    if (!output) {
      console.error("Agent returned no output");
      const fallbackResult: RepoAnalysis = {
        repoName,
        repoOwner,
        description: null,
        primaryLanguages: [],
        frameworks: [],
        hasTests: false,
        testCoverage: null,
        hasCI: false,
        hasDocumentation: false,
        codeQuality: "average",
        skillLevel: "intermediate",
        skillIndicators: [{
          indicator: "Analysis completed but output parsing failed",
          significance: "neutral",
          explanation: "The agent completed but didn't return structured output"
        }],
        professionalism: {
          score: 5,
          commitMessageQuality: "average",
          codeOrganization: "average",
          namingConventions: "mostly_consistent",
          errorHandling: "adequate"
        },
        gitPractices: {
          commitFrequency: "unknown",
          branchStrategy: null,
          prUsage: false,
          collaborationSignals: []
        },
        complexity: {
          level: "moderate",
          linesOfCode: null,
          fileCount: 0,
          architecturePattern: null
        },
        strengths: ["Repository was analyzed"],
        areasForGrowth: [],
        summary: "Analysis completed but structured output was not generated.",
        hiringRecommendation: "maybe",
        rawFindings: commandHistory.map(c => ({
          command: c.command,
          purpose: c.purpose,
          keyFindings: c.output.slice(0, 200)
        }))
      };

      const fallbackProgress: AnalysisProgress = {
        status: 'complete',
        message: 'Analysis complete (with fallback)',
        repoName,
        repoOwner,
        result: fallbackResult,
        stepNumber,
        totalSteps: stepNumber,
      };
      yield fallbackProgress;
      return fallbackProgress;
    }

    // Return complete
    const finalProgress: AnalysisProgress = {
      status: 'complete',
      message: 'Analysis complete!',
      repoName,
      repoOwner,
      result: output,
      stepNumber,
      totalSteps: stepNumber,
    };
    yield finalProgress;
    return finalProgress;

  } finally {
    // Always clean up the sandbox
    try {
      await sandbox.stop();
    } catch {
      // Sandbox may have already timed out
    }
  }
}

// ============================================================================
// SIMPLE WRAPPER (for backwards compatibility)
// ============================================================================

export async function analyzeRepository(
  config: RepoAnalysisConfig
): Promise<RepoAnalysis> {
  let lastProgress: AnalysisProgress | undefined;

  for await (const progress of analyzeRepositoryWithProgress(config)) {
    lastProgress = progress;
  }

  if (lastProgress?.status === 'complete' && lastProgress.result) {
    return lastProgress.result;
  }

  if (lastProgress?.status === 'error') {
    throw new Error(lastProgress.error || lastProgress.message);
  }

  throw new Error('Analysis failed: No result returned');
}

// ============================================================================
// LIGHTWEIGHT QUICK ANALYSIS (no sandbox, just git metadata)
// ============================================================================

export async function quickRepoCheck(repoUrl: string, token: string): Promise<{
  isValid: boolean;
  repoInfo: {
    owner: string;
    name: string;
    fullName: string;
  } | null;
  error?: string;
}> {
  const urlMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!urlMatch) {
    return {
      isValid: false,
      repoInfo: null,
      error: "Invalid GitHub repository URL"
    };
  }

  const [, owner, name] = urlMatch;

  // Quick check if repo exists via GitHub API using Octokit
  try {
    const octokit = new Octokit({ auth: token });
    await octokit.rest.repos.get({ owner, repo: name });

    return {
      isValid: true,
      repoInfo: {
        owner,
        name,
        fullName: `${owner}/${name}`
      }
    };
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 404) {
        return {
          isValid: false,
          repoInfo: null,
          error: "Repository not found"
        };
      }
      return {
        isValid: false,
        repoInfo: null,
        error: `GitHub API error: ${status}`
      };
    }
    return {
      isValid: false,
      repoInfo: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
