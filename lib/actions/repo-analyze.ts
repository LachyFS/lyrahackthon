"use server";

import { Sandbox } from "@vercel/sandbox";
import { streamText, tool, stepCountIs, generateObject } from "ai";
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
    score: z.number().min(1).describe("Professionalism score from 1-10"),
    commitMessageQuality: z.enum(["excellent", "good", "average", "poor"]).describe("Quality of commit messages"),
    codeOrganization: z.enum(["excellent", "good", "average", "poor"]).describe("How well the code is organized"),
    namingConventions: z.enum(["consistent", "mostly_consistent", "inconsistent"]).describe("Consistency of naming"),
    errorHandling: z.enum(["comprehensive", "adequate", "minimal", "poor"]).describe("How errors are handled"),
  }),

  // Deep code analysis findings
  codeAnalysis: z.object({
    // Specific code patterns observed
    patternsObserved: z.array(z.object({
      pattern: z.string().describe("Name of the pattern (e.g., 'Repository Pattern', 'Dependency Injection', 'Error Boundaries')"),
      quality: z.enum(["excellent", "good", "average", "poor"]).describe("How well it's implemented"),
      example: z.string().describe("Brief code example or file reference where this was observed"),
    })).describe("Design patterns and architectural patterns found in the code"),

    // Security analysis
    securityPractices: z.object({
      inputValidation: z.enum(["thorough", "partial", "minimal", "none"]).describe("How well user inputs are validated"),
      authHandling: z.string().nullable().describe("How authentication/authorization is handled if present"),
      sensitiveDataHandling: z.enum(["secure", "mostly_secure", "risky", "not_applicable"]).describe("How sensitive data like API keys, tokens are handled"),
      securityIssuesFound: z.array(z.string()).describe("Any potential security issues identified"),
    }),

    // Code quality metrics from actual code review
    codeMetrics: z.object({
      averageFunctionLength: z.enum(["short_focused", "reasonable", "long", "very_long"]).describe("Typical function length"),
      cyclomaticComplexity: z.enum(["low", "moderate", "high", "very_high"]).describe("Estimated code complexity"),
      codeComments: z.enum(["well_documented", "adequately_documented", "sparse", "none"]).describe("Quantity and quality of comments"),
      typeUsage: z.enum(["strict_typing", "good_typing", "partial_typing", "no_typing", "not_applicable"]).describe("How well types are used (for typed languages)"),
      deadCode: z.boolean().describe("Whether dead/unused code was found"),
    }),

    // Specific code examples (positive and negative)
    codeExamples: z.array(z.object({
      type: z.enum(["strength", "concern", "notable"]).describe("Whether this is a positive or negative example"),
      file: z.string().describe("File where this was found"),
      description: z.string().describe("What makes this code good/bad/notable"),
      snippet: z.string().describe("Brief code snippet or description"),
    })).describe("Specific code examples that stood out during review"),

    // API/Architecture analysis
    apiDesign: z.object({
      restfulness: z.enum(["restful", "mostly_restful", "non_restful", "not_applicable"]).describe("REST API adherence if applicable"),
      consistentResponses: z.boolean().describe("Whether API responses follow a consistent format"),
      errorResponses: z.enum(["comprehensive", "adequate", "minimal", "poor", "not_applicable"]).describe("How errors are returned to clients"),
      dataValidation: z.enum(["schema_validated", "basic_validation", "minimal", "none", "not_applicable"]).describe("How request data is validated"),
    }).nullable().describe("API design quality if the project exposes APIs"),

    // Dependency analysis
    dependencyHealth: z.object({
      outdatedDeps: z.boolean().describe("Whether there appear to be outdated dependencies"),
      unusedDeps: z.boolean().describe("Whether there appear to be unused dependencies"),
      securityRisks: z.boolean().describe("Whether any dependencies have known security issues"),
      dependencyCount: z.enum(["minimal", "appropriate", "heavy", "excessive"]).describe("How many dependencies relative to project size"),
    }),
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
  strengths: z.array(z.string()).describe("Key strengths demonstrated in this repo"),
  areasForGrowth: z.array(z.string()).describe("Areas where the developer could improve (be constructive, not harsh)"),

  // Overall summary
  summary: z.string().describe("A thoughtful 3-4 sentence summary of the developer's capabilities based on this repo"),

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
// PARALLEL ANALYSIS TYPES
// ============================================================================

export interface ParallelRepoAnalysisConfig {
  repoUrls: string[];
  /**
   * Maximum time each sandbox can run (default: 5 minutes)
   */
  timeout?: string;
  /**
   * Optional hiring brief to contextualize the analysis
   */
  hiringBrief?: string;
  /**
   * Number of vCPUs for each sandbox (default: 2)
   */
  vcpus?: 1 | 2 | 4;
  /**
   * Maximum number of repos to analyze concurrently (default: 3)
   */
  concurrency?: number;
}

export interface ParallelRepoProgress {
  repoUrl: string;
  repoName: string;
  repoOwner: string;
  status: AnalysisProgressStatus;
  message: string;
  stepNumber?: number;
  totalSteps?: number;
  result?: RepoAnalysis;
  error?: string;
}

export interface ParallelAnalysisProgress {
  type: 'repo_update' | 'overall_update' | 'complete';
  message: string;
  /** Progress for each individual repo */
  repos: ParallelRepoProgress[];
  /** Number of completed repos */
  completedCount: number;
  /** Total number of repos being analyzed */
  totalCount: number;
  /** All final results when complete */
  results?: Array<{
    repoUrl: string;
    repoName: string;
    repoOwner: string;
    result?: RepoAnalysis;
    error?: string;
  }>;
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

CRITICAL: YOU MUST READ AND ANALYZE ACTUAL CODE FILES
Do NOT just look at file names and structure - you MUST read the actual source code to evaluate:
- Code patterns and architecture decisions
- Error handling approaches
- Type safety and validation
- Algorithm implementations
- API design and data flow
- Security considerations
- Performance patterns

REQUIRED ANALYSIS APPROACH (follow ALL steps):

PHASE 1 - REPOSITORY OVERVIEW:
1. List the repository structure: ls -la && find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" | head -50
2. Check README: cat README.md 2>/dev/null || cat readme.md 2>/dev/null
3. Identify main entry points: cat package.json 2>/dev/null | head -50

PHASE 2 - DEEP CODE ANALYSIS (MOST IMPORTANT):
4. READ at least 3-5 main source files in their entirety using cat. Pick the most important/complex files.
5. For each file read, analyze:
   - Function complexity and decomposition
   - Variable naming and clarity
   - Error handling patterns (try/catch, error types, validation)
   - Type usage (if TypeScript/typed language)
   - Comments and documentation quality
   - Import organization
   - Code duplication
   - Security patterns (input validation, sanitization)

6. Search for specific patterns:
   - Error handling: grep -r "catch\|throw\|Error\|try" --include="*.ts" --include="*.tsx" --include="*.js" | head -30
   - Type definitions: grep -r "interface\|type\|enum" --include="*.ts" --include="*.tsx" | head -30
   - Testing: find . -name "*.test.*" -o -name "*.spec.*" | head -20
   - API endpoints: grep -r "app.get\|app.post\|router\.\|fetch\|axios" --include="*.ts" --include="*.tsx" --include="*.js" | head -30
   - Environment/config handling: grep -r "process.env\|dotenv\|config" --include="*.ts" --include="*.tsx" --include="*.js" | head -20
   - Security patterns: grep -r "sanitize\|escape\|validate\|auth\|jwt\|token" --include="*.ts" --include="*.tsx" --include="*.js" | head -20

PHASE 3 - CODE QUALITY METRICS:
7. Count lines of code: find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs wc -l 2>/dev/null | tail -1
8. Check for linting config: cat .eslintrc* eslint.config.* .prettierrc* 2>/dev/null | head -30
9. Check TypeScript config: cat tsconfig.json 2>/dev/null
10. Dependencies analysis: cat package.json 2>/dev/null | grep -A 100 '"dependencies"' | head -50

PHASE 4 - GIT PRACTICES:
11. Recent commits: git log --oneline -20
12. Commit message quality: git log --format="%s%n%b" -10
13. Branch history: git branch -a 2>/dev/null
14. Contributor analysis: git shortlog -sn 2>/dev/null | head -10

PHASE 5 - TESTING & CI:
15. Test files: find . -path ./node_modules -prune -o -name "*.test.*" -print -o -name "*.spec.*" -print | head -20
16. Read a test file if exists: find . -path ./node_modules -prune -o \( -name "*.test.*" -o -name "*.spec.*" \) -print | head -1 | xargs cat 2>/dev/null | head -100
17. CI configuration: cat .github/workflows/*.yml 2>/dev/null | head -50 || cat .gitlab-ci.yml 2>/dev/null | head -50

REMEMBER: The value of this analysis comes from READING AND UNDERSTANDING ACTUAL CODE.
Surface-level analysis (just looking at file names) is NOT acceptable.
You MUST use 'cat' to read multiple source files and provide specific observations about the code quality.

After gathering information, provide your complete structured analysis as a JSON object matching the required schema.`;

    // Yield: Starting analysis
    yield {
      status: 'analyzing',
      message: 'AI agent starting codebase analysis...',
      repoName,
      repoOwner,
    };

    const result = streamText({
      model: "xai/grok-4.1-fast-reasoning" as Parameters<typeof streamText>[0]["model"],
      system: systemPrompt,
      prompt: `Analyze this repository thoroughly. Use the bash tool to explore the codebase and gather information.

Start by exploring the repository structure, then dig deeper into areas that reveal developer skill and professionalism.
Collect evidence for your assessment - specific examples are more valuable than general impressions.

After gathering enough information, provide a detailed summary of your findings. Do NOT output JSON - just provide your analysis in natural language. The structured output will be generated separately.`,
      stopWhen: stepCountIs(40),
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

    // Yield: Generating report (secondary LLM call)
    yield {
      status: 'generating_report',
      message: 'Generating final analysis report...',
      repoName,
      repoOwner,
      stepNumber,
      totalSteps: stepNumber,
    };

    // Build the full context for the secondary LLM call
    const commandHistorySummary = commandHistory.map((c, i) =>
      `### Command ${i + 1}: ${c.purpose}\n\`\`\`bash\n${c.command}\n\`\`\`\n**Output:**\n\`\`\`\n${c.output.slice(0, 3000)}${c.output.length > 3000 ? '\n... (truncated)' : ''}\n\`\`\``
    ).join('\n\n');

    const structuredOutputPrompt = `You are analyzing a GitHub repository "${repoOwner}/${repoName}" based on the exploration data below.

${hiringBrief ? `HIRING CONTEXT:\n${hiringBrief}\n\n` : ''}

## EXPLORATION SUMMARY

The following commands were executed to analyze the repository:

${commandHistorySummary}

## AI AGENT ANALYSIS

${finalText}

---

Based on ALL the information above (command outputs AND the AI agent's analysis), generate a comprehensive structured assessment of this repository and the developer's skills.

Be thorough but fair. Look for positive signals, not just problems. Consider the project type when assessing complexity.`;

    // Secondary LLM call to generate structured output
    let output: RepoAnalysis;
    try {
      const structuredResult = await generateObject({
        model: 'google/gemini-3-pro-preview',
        providerOptions: {
          openai: {
            reasoningEffort: "none",
          }
        },
        schema: repoAnalysisSchema,
        prompt: structuredOutputPrompt,
      });

      output = structuredResult.object;
    } catch (error) {
      console.error("Failed to generate structured output:", error);

      // Fallback result if structured generation fails
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
          indicator: "Analysis completed but structured output generation failed",
          significance: "neutral",
          explanation: "The exploration completed but the final report generation encountered an error"
        }],
        professionalism: {
          score: 5,
          commitMessageQuality: "average",
          codeOrganization: "average",
          namingConventions: "mostly_consistent",
          errorHandling: "adequate"
        },
        codeAnalysis: {
          patternsObserved: [],
          securityPractices: {
            inputValidation: "none",
            authHandling: null,
            sensitiveDataHandling: "not_applicable",
            securityIssuesFound: []
          },
          codeMetrics: {
            averageFunctionLength: "reasonable",
            cyclomaticComplexity: "moderate",
            codeComments: "sparse",
            typeUsage: "not_applicable",
            deadCode: false
          },
          codeExamples: [],
          apiDesign: null,
          dependencyHealth: {
            outdatedDeps: false,
            unusedDeps: false,
            securityRisks: false,
            dependencyCount: "appropriate"
          }
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
        summary: finalText.slice(0, 500) || "Analysis completed but structured output generation failed.",
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

    // Return complete with structured output
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
// PARALLEL REPO ANALYSIS
// ============================================================================

/**
 * Helper to parse repo URL and extract owner/name
 */
function parseRepoUrl(repoUrl: string): { owner: string; name: string } | null {
  const urlMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!urlMatch) return null;
  return { owner: urlMatch[1], name: urlMatch[2] };
}

/**
 * Analyze multiple GitHub repositories in parallel with streaming progress updates.
 *
 * This function manages concurrent sandbox executions and aggregates progress
 * from all repositories into a unified stream.
 *
 * @param config Configuration including array of repo URLs and optional settings
 * @yields ParallelAnalysisProgress updates for each repo and overall progress
 */
export async function* analyzeMultipleRepositoriesWithProgress(
  config: ParallelRepoAnalysisConfig
): AsyncGenerator<ParallelAnalysisProgress, ParallelAnalysisProgress, unknown> {
  const {
    repoUrls,
    timeout = "5m",
    hiringBrief,
    vcpus = 2,
    concurrency = 3
  } = config;

  // Validate and parse all URLs first
  const repoInfos: Array<{ url: string; owner: string; name: string }> = [];
  const invalidUrls: string[] = [];

  for (const url of repoUrls) {
    const parsed = parseRepoUrl(url);
    if (parsed) {
      repoInfos.push({ url, owner: parsed.owner, name: parsed.name });
    } else {
      invalidUrls.push(url);
    }
  }

  // Initialize progress tracking for all repos
  const repoProgress: Map<string, ParallelRepoProgress> = new Map();

  for (const info of repoInfos) {
    repoProgress.set(info.url, {
      repoUrl: info.url,
      repoName: info.name,
      repoOwner: info.owner,
      status: 'validating',
      message: 'Waiting to start...',
    });
  }

  // Add invalid URLs as errors
  for (const url of invalidUrls) {
    repoProgress.set(url, {
      repoUrl: url,
      repoName: 'unknown',
      repoOwner: 'unknown',
      status: 'error',
      message: 'Invalid GitHub repository URL',
      error: 'Expected format: https://github.com/owner/repo',
    });
  }

  const totalCount = repoUrls.length;
  let completedCount = invalidUrls.length; // Invalid URLs are already "complete" (failed)

  // Helper to create current progress snapshot
  const createProgressSnapshot = (
    type: 'repo_update' | 'overall_update' | 'complete',
    message: string
  ): ParallelAnalysisProgress => ({
    type,
    message,
    repos: Array.from(repoProgress.values()),
    completedCount,
    totalCount,
  });

  // Yield initial state
  yield createProgressSnapshot(
    'overall_update',
    `Starting analysis of ${repoInfos.length} repositories...`
  );

  // Results accumulator
  const results: Array<{
    repoUrl: string;
    repoName: string;
    repoOwner: string;
    result?: RepoAnalysis;
    error?: string;
  }> = [];

  // Add invalid URLs to results
  for (const url of invalidUrls) {
    results.push({
      repoUrl: url,
      repoName: 'unknown',
      repoOwner: 'unknown',
      error: 'Invalid GitHub repository URL',
    });
  }

  // Process repos with controlled concurrency
  const validRepos = [...repoInfos];
  const activeAnalyses: Map<string, AsyncGenerator<AnalysisProgress, AnalysisProgress, unknown>> = new Map();
  let repoIndex = 0;

  // Start initial batch of analyses
  while (repoIndex < validRepos.length && activeAnalyses.size < concurrency) {
    const info = validRepos[repoIndex];
    const generator = analyzeRepositoryWithProgress({
      repoUrl: info.url,
      timeout,
      hiringBrief,
      vcpus,
    });
    activeAnalyses.set(info.url, generator);
    repoIndex++;
  }

  // Process all analyses
  while (activeAnalyses.size > 0) {
    // Poll each active analysis for progress
    const pollPromises: Array<Promise<{ url: string; result: IteratorResult<AnalysisProgress, AnalysisProgress> }>> = [];

    for (const [url, generator] of activeAnalyses) {
      pollPromises.push(
        generator.next().then(result => ({ url, result }))
      );
    }

    // Wait for any progress from any repo
    const settled = await Promise.race(
      pollPromises.map(async (promise) => {
        const { url, result } = await promise;
        return { url, result };
      })
    );

    const { url, result } = settled;
    const info = validRepos.find(r => r.url === url)!;

    if (result.done) {
      // This analysis is complete
      activeAnalyses.delete(url);
      const finalProgress = result.value;

      // Update repo progress
      const updatedProgress: ParallelRepoProgress = {
        repoUrl: url,
        repoName: info.name,
        repoOwner: info.owner,
        status: finalProgress.status,
        message: finalProgress.message,
        stepNumber: finalProgress.stepNumber,
        totalSteps: finalProgress.totalSteps,
        result: finalProgress.result,
        error: finalProgress.error,
      };
      repoProgress.set(url, updatedProgress);
      completedCount++;

      // Add to results
      results.push({
        repoUrl: url,
        repoName: info.name,
        repoOwner: info.owner,
        result: finalProgress.result,
        error: finalProgress.error,
      });

      // Yield completion update for this repo
      yield createProgressSnapshot(
        'repo_update',
        `Completed analysis of ${info.owner}/${info.name} (${completedCount}/${totalCount})`
      );

      // Start next repo if available
      if (repoIndex < validRepos.length) {
        const nextInfo = validRepos[repoIndex];
        const nextGenerator = analyzeRepositoryWithProgress({
          repoUrl: nextInfo.url,
          timeout,
          hiringBrief,
          vcpus,
        });
        activeAnalyses.set(nextInfo.url, nextGenerator);
        repoIndex++;

        // Update status for the newly started repo
        repoProgress.set(nextInfo.url, {
          repoUrl: nextInfo.url,
          repoName: nextInfo.name,
          repoOwner: nextInfo.owner,
          status: 'spinning_up_sandbox',
          message: 'Starting analysis...',
        });
      }
    } else {
      // Intermediate progress update
      const progress = result.value;

      const updatedProgress: ParallelRepoProgress = {
        repoUrl: url,
        repoName: progress.repoName || info.name,
        repoOwner: progress.repoOwner || info.owner,
        status: progress.status,
        message: progress.message,
        stepNumber: progress.stepNumber,
        totalSteps: progress.totalSteps,
      };
      repoProgress.set(url, updatedProgress);

      // Yield progress update
      yield createProgressSnapshot(
        'repo_update',
        `[${info.owner}/${info.name}] ${progress.message}`
      );
    }
  }

  // Final complete state
  const finalProgress: ParallelAnalysisProgress = {
    type: 'complete',
    message: `Completed analysis of ${completedCount} repositories`,
    repos: Array.from(repoProgress.values()),
    completedCount,
    totalCount,
    results,
  };

  yield finalProgress;
  return finalProgress;
}

/**
 * Simple wrapper that returns all results without streaming progress
 */
export async function analyzeMultipleRepositories(
  config: ParallelRepoAnalysisConfig
): Promise<Array<{
  repoUrl: string;
  repoName: string;
  repoOwner: string;
  result?: RepoAnalysis;
  error?: string;
}>> {
  let lastProgress: ParallelAnalysisProgress | undefined;

  for await (const progress of analyzeMultipleRepositoriesWithProgress(config)) {
    lastProgress = progress;
  }

  if (lastProgress?.type === 'complete' && lastProgress.results) {
    return lastProgress.results;
  }

  throw new Error('Parallel analysis failed: No results returned');
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
