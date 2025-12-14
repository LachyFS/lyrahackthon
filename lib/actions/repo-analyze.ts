"use server";

import { Sandbox } from "@vercel/sandbox";
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { Writable } from "stream";

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

/**
 * Creates a writable stream that collects data into a string
 */
function createCollectorStream(): { stream: Writable; getData: () => string } {
  let data = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      data += chunk.toString();
      callback();
    },
  });
  return { stream, getData: () => data };
}

async function runSandboxCommand(
  sandbox: Sandbox,
  command: string,
  options?: { cwd?: string }
): Promise<CommandResult> {
  const stdoutCollector = createCollectorStream();
  const stderrCollector = createCollectorStream();

  const result = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", command],
    stdout: stdoutCollector.stream,
    stderr: stderrCollector.stream,
    cwd: options?.cwd,
  });

  return {
    stdout: stdoutCollector.getData().trim(),
    stderr: stderrCollector.getData().trim(),
    exitCode: result.exitCode,
  };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeRepository(
  config: RepoAnalysisConfig
): Promise<RepoAnalysis> {
  const { repoUrl, timeout = "5m", hiringBrief, vcpus = 2 } = config;

  // Parse repo URL to get owner/name
  const urlMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!urlMatch) {
    throw new Error("Invalid GitHub repository URL. Expected format: https://github.com/owner/repo");
  }
  const [, repoOwner, repoName] = urlMatch;

  // Create the sandbox
  const sandbox = await Sandbox.create({
    source: {
      url: repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`,
      type: "git",
    },
    resources: { vcpus },
    timeout: parseTimeout(timeout),
    runtime: "node24",
  });

  try {
    // Track all commands and findings for the final analysis
    const commandHistory: Array<{ command: string; purpose: string; output: string }> = [];

    // Define the bash tool for the LLM to use
    const bashTool = tool({
      description: `Execute a bash command in the repository sandbox to analyze the codebase.
The repository has already been cloned to /vercel/sandbox.
You have access to common tools: git, find, grep, wc, head, tail, cat, ls, tree (if installed), etc.
Use this to explore the codebase structure, read files, analyze git history, count lines of code, etc.
Be thorough but efficient - gather the information you need to assess the developer's skill level and professionalism.`,
      parameters: z.object({
        command: z.string().describe("The bash command to execute"),
        purpose: z.string().describe("Brief description of why you're running this command"),
      }),
      execute: async ({ command, purpose }) => {
        // Security: basic command sanitization
        const dangerousPatterns = [
          /rm\s+-rf/i,
          /mkfs/i,
          /dd\s+if=/i,
          /:(){ :|:& };:/,
          /fork\s*bomb/i,
          />\s*\/dev\/sd/i,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            return {
              success: false,
              output: "Command blocked for security reasons",
              error: "Potentially dangerous command detected",
            };
          }
        }

        try {
          // Execute command in sandbox
          const result = await runSandboxCommand(
            sandbox,
            command,
            { cwd: "/vercel/sandbox" }
          );

          const output = result.stdout || result.stderr || "(no output)";

          // Truncate very long outputs
          const truncatedOutput = output.length > 10000
            ? output.slice(0, 10000) + "\n... (output truncated)"
            : output;

          commandHistory.push({
            command,
            purpose,
            output: truncatedOutput,
          });

          return {
            success: result.exitCode === 0,
            output: truncatedOutput,
            exitCode: result.exitCode,
            error: result.exitCode !== 0 ? result.stderr : null,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
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

Be efficient with commands - you have a limited time in the sandbox. Focus on gathering the most informative data.`;

    // Run the analysis using the LLM with tool calling
    const { text: analysisNotes } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      prompt: `Analyze this repository thoroughly. Use the bash tool to explore the codebase and gather information.
After you've gathered enough information, provide your analysis.

Start by exploring the repository structure, then dig deeper into areas that reveal developer skill and professionalism.
Collect evidence for your assessment - specific examples are more valuable than general impressions.`,
      tools: { bash: bashTool },
      maxSteps: 25, // Allow up to 25 tool calls for thorough analysis
      maxRetries: 2,
    } as Parameters<typeof generateText>[0]);

    // Now generate the structured analysis based on the findings
    const { text: structuredJson } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are generating a structured JSON analysis of a code repository.
Based on the analysis notes and command outputs provided, generate a comprehensive assessment.

IMPORTANT:
- Output ONLY valid JSON matching the schema
- Be fair and balanced in your assessment
- Use the evidence from the command outputs to support your conclusions
- If you couldn't determine something, use null or reasonable defaults
- The 'rawFindings' should summarize key discoveries from commands run`,
      prompt: `Based on this analysis of ${repoOwner}/${repoName}:

ANALYSIS NOTES:
${analysisNotes}

COMMAND HISTORY:
${commandHistory.map(c => `Command: ${c.command}\nPurpose: ${c.purpose}\nOutput (excerpt): ${c.output.slice(0, 500)}...`).join("\n\n")}

Generate a structured JSON analysis following this schema:
${JSON.stringify(repoAnalysisSchema.shape, null, 2)}

Output ONLY the JSON object, no markdown or explanation.`,
    });

    // Parse and validate the structured output
    let parsedAnalysis: RepoAnalysis;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = structuredJson.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, structuredJson];
      const jsonStr = jsonMatch[1] || structuredJson;
      const parsed = JSON.parse(jsonStr.trim());
      parsedAnalysis = repoAnalysisSchema.parse(parsed);
    } catch (parseError) {
      // If parsing fails, create a basic analysis from what we have
      console.error("Failed to parse structured analysis:", parseError);
      parsedAnalysis = {
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
          indicator: "Analysis completed with limited parsing",
          significance: "neutral",
          explanation: "The structured analysis couldn't be fully parsed"
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
        strengths: ["Repository was successfully analyzed"],
        areasForGrowth: [],
        summary: analysisNotes.slice(0, 500),
        hiringRecommendation: "maybe",
        rawFindings: commandHistory.map(c => ({
          command: c.command,
          purpose: c.purpose,
          keyFindings: c.output.slice(0, 200)
        }))
      };
    }

    return parsedAnalysis;
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
// LIGHTWEIGHT QUICK ANALYSIS (no sandbox, just git metadata)
// ============================================================================

export async function quickRepoCheck(repoUrl: string): Promise<{
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

  // Quick check if repo exists via GitHub API
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          isValid: false,
          repoInfo: null,
          error: "Repository not found"
        };
      }
      return {
        isValid: false,
        repoInfo: null,
        error: `GitHub API error: ${response.status}`
      };
    }

    return {
      isValid: true,
      repoInfo: {
        owner,
        name,
        fullName: `${owner}/${name}`
      }
    };
  } catch (error) {
    return {
      isValid: false,
      repoInfo: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
