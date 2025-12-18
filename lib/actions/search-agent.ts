"use server";

import Exa from "exa-js";
import { streamText, generateObject, tool } from "ai";
import { z } from "zod";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export interface SearchAgentConfig {
  query: string;
  /**
   * Type of search to perform - influences agent strategy
   */
  searchType?: "general" | "github_profiles" | "linkedin" | "portfolio" | "news" | "technical";
  /**
   * Maximum number of agent steps (tool calls)
   */
  maxSteps?: number;
  /**
   * Domains to include in search
   */
  includeDomains?: string[];
  /**
   * Domains to exclude from search
   */
  excludeDomains?: string[];
  /**
   * Additional context for the search
   */
  context?: string;
}

// Schema for the final structured search output
const searchAnalysisSchema = z.object({
  query: z.string().describe("The original search query"),
  searchType: z.string().describe("Type of search performed"),
  totalResultsFound: z.number().describe("Total number of results found across all searches"),
  resultsAnalyzed: z.number().describe("Number of results that were analyzed in detail"),

  // Summary of findings
  summary: z.string().describe("A comprehensive summary of all findings from the search"),

  // Key themes/topics
  keyThemes: z.array(z.object({
    theme: z.string().describe("The theme or topic"),
    frequency: z.enum(["high", "medium", "low"]).describe("How often this theme appeared"),
    relatedResults: z.array(z.string()).describe("URLs of results related to this theme"),
  })).describe("Key themes that emerged across the search results"),

  // Top results with analysis
  topResults: z.array(z.object({
    url: z.string(),
    title: z.string(),
    relevanceScore: z.number(),
    snippet: z.string().nullable(),
    keyInsights: z.array(z.string()),
    contentType: z.enum(["article", "profile", "documentation", "forum", "news", "other"]).describe("Type of content"),
  })).describe("Top most relevant results with analysis"),

  // Entities found (people, companies, technologies, etc.)
  entitiesFound: z.array(z.object({
    name: z.string(),
    type: z.enum(["person", "company", "technology", "product", "location", "other"]),
    mentions: z.number().describe("Number of times mentioned across results"),
    context: z.string().describe("Brief context about this entity"),
  })).describe("Notable entities found in the search results"),

  // Recommendations for follow-up
  followUpSuggestions: z.array(z.string()).describe("Suggested follow-up searches or actions"),

  // Raw scraped data for reference
  rawResults: z.array(z.object({
    url: z.string(),
    title: z.string(),
    contentPreview: z.string().describe("First 500 chars of content"),
  })).describe("Raw scraped results for reference"),
});

export type SearchAnalysis = z.infer<typeof searchAnalysisSchema>;

// Progress update types for streaming to UI
export type SearchProgressStatus =
  | 'initializing'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'searching'
  | 'scraping'
  | 'analyzing_result'
  | 'synthesizing'
  | 'complete'
  | 'error';

export interface SearchProgress {
  status: SearchProgressStatus;
  message: string;
  query?: string;
  currentStep?: number;
  totalSteps?: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  currentUrl?: string;
  currentTitle?: string;
  scrapedContent?: string;
  resultsFound?: number;
  resultsProcessed?: number;
  result?: SearchAnalysis;
  error?: string;
  // Track all tool calls for visibility
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    resultsCount?: number;
  }>;
}

// ============================================================================
// AGENT TOOLS
// ============================================================================

function createSearchTools(config: SearchAgentConfig) {
  return {
    web_search: tool({
      description: "Search the web for information. Returns scraped content from matching pages. Use this for general queries.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        numResults: z.number().optional().describe("Number of results to return (1-10)"),
        includeDomains: z.array(z.string()).optional().describe("Only include results from these domains"),
        excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
      }),
      execute: async ({ query, numResults, includeDomains, excludeDomains }) => {
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          includeDomains: includeDomains || config.includeDomains,
          excludeDomains: excludeDomains || config.excludeDomains,
          type: "auto",
          text: { maxCharacters: 3000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 2000) || "",
          publishedDate: r.publishedDate,
          author: r.author,
        }));
      },
    }),

    find_similar: tool({
      description: "Find web pages similar to a given URL. Useful for discovering related content, competitors, or alternative sources.",
      inputSchema: z.object({
        url: z.string().describe("URL to find similar pages for"),
        numResults: z.number().optional().describe("Number of similar pages to find"),
      }),
      execute: async ({ url, numResults }) => {
        const result = await exa.findSimilarAndContents(url, {
          numResults: Math.min(numResults || 5, 10),
          text: { maxCharacters: 2000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 1500) || "",
          publishedDate: r.publishedDate,
        }));
      },
    }),

    scrape_urls: tool({
      description: "Scrape and extract full content from specific URLs. Use this when you need more detail from a page you've already found.",
      inputSchema: z.object({
        urls: z.array(z.string()).describe("URLs to scrape (max 5)"),
      }),
      execute: async ({ urls }) => {
        const result = await exa.getContents(urls.slice(0, 5), {
          text: { maxCharacters: 5000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text || "",
          publishedDate: r.publishedDate,
          author: r.author,
        }));
      },
    }),

    search_github: tool({
      description: "Search GitHub specifically for repositories, profiles, or code. Best for finding developers or open source projects.",
      inputSchema: z.object({
        query: z.string().describe("Search query focused on GitHub content"),
        numResults: z.number().optional().describe("Number of results to return"),
      }),
      execute: async ({ query, numResults }) => {
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          includeDomains: ["github.com"],
          type: "auto",
          text: { maxCharacters: 2000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 1500) || "",
          // Parse GitHub-specific info from URL
          isProfile: /^https?:\/\/github\.com\/[^\/]+\/?$/.test(r.url),
          isRepo: /^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(r.url),
        }));
      },
    }),

    search_linkedin: tool({
      description: "Search LinkedIn for professional profiles and company pages.",
      inputSchema: z.object({
        query: z.string().describe("Search query for LinkedIn content"),
        numResults: z.number().optional().describe("Number of results to return"),
      }),
      execute: async ({ query, numResults }) => {
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          includeDomains: ["linkedin.com"],
          type: "neural",
          text: { maxCharacters: 2000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 1500) || "",
          isCompany: r.url.includes("/company/"),
          isProfile: r.url.includes("/in/"),
        }));
      },
    }),

    search_news: tool({
      description: "Search for recent news articles and press coverage.",
      inputSchema: z.object({
        query: z.string().describe("News search query"),
        numResults: z.number().optional().describe("Number of results to return"),
      }),
      execute: async ({ query, numResults }) => {
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          type: "neural",
          text: { maxCharacters: 2000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 1500) || "",
          publishedDate: r.publishedDate,
          author: r.author,
        }));
      },
    }),

    search_technical: tool({
      description: "Search technical resources like Stack Overflow, dev.to, Medium tech blogs, and documentation sites.",
      inputSchema: z.object({
        query: z.string().describe("Technical search query"),
        numResults: z.number().optional().describe("Number of results to return"),
      }),
      execute: async ({ query, numResults }) => {
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          includeDomains: [
            "stackoverflow.com",
            "dev.to",
            "medium.com",
            "hackernoon.com",
            "reddit.com",
            "docs.github.com",
          ],
          type: "auto",
          text: { maxCharacters: 2000 },
        });
        return result.results.map(r => ({
          url: r.url,
          title: r.title,
          content: r.text?.slice(0, 1500) || "",
          source: new URL(r.url).hostname,
        }));
      },
    }),
  };
}

// ============================================================================
// AGENT SYSTEM PROMPT
// ============================================================================

function getAgentSystemPrompt(config: SearchAgentConfig): string {
  const basePrompt = `You are an expert web research agent. Your job is to thoroughly research a topic using the tools available to you.

## YOUR TOOLS

1. **web_search** - General web search with content scraping. Good for broad queries.
2. **find_similar** - Find pages similar to a URL. Great for discovering related content.
3. **scrape_urls** - Get full content from specific URLs when you need more detail.
4. **search_github** - Search GitHub for repos, profiles, and code.
5. **search_linkedin** - Search LinkedIn for professional profiles and companies.
6. **search_news** - Search recent news and press coverage.
7. **search_technical** - Search Stack Overflow, dev.to, Medium, and technical docs.

## RESEARCH STRATEGY

1. **Start broad** - Begin with a general search to understand the landscape
2. **Identify key sources** - Note important URLs, people, companies, technologies
3. **Go deeper** - Use find_similar or targeted searches to explore promising leads
4. **Cross-reference** - Verify information across multiple sources
5. **Fill gaps** - Use scrape_urls to get more detail from important pages

## IMPORTANT GUIDELINES

- Make multiple tool calls to gather comprehensive information
- Don't stop after just one search - explore multiple angles
- Use the right tool for the job (e.g., search_github for developers, search_news for recent events)
- When you find an interesting URL, consider using find_similar to discover related content
- Summarize your findings thoroughly at the end

## OUTPUT FORMAT

After researching, provide a comprehensive summary that includes:
- Key findings and insights
- Important entities (people, companies, technologies)
- Notable patterns or themes
- Relevant URLs and sources
- Suggested follow-up areas`;

  // Add search-type specific guidance
  const typeGuidance: Record<string, string> = {
    github_profiles: `\n\n## FOCUS: GitHub Profiles\nYou're looking for GitHub developer profiles. Use search_github primarily. Look for:\n- Developer expertise and languages\n- Notable repositories and contributions\n- Activity levels and commit history\n- Open source involvement`,

    linkedin: `\n\n## FOCUS: LinkedIn Profiles\nYou're searching for professional profiles. Use search_linkedin primarily. Look for:\n- Work history and experience\n- Skills and endorsements\n- Education and certifications\n- Professional connections and companies`,

    portfolio: `\n\n## FOCUS: Portfolio Sites\nYou're looking for personal portfolio websites. Exclude social media. Look for:\n- Personal projects and case studies\n- Design work and technical skills\n- Contact information\n- Client testimonials`,

    news: `\n\n## FOCUS: News & Recent Events\nYou're searching for recent news. Use search_news primarily. Look for:\n- Recent announcements and developments\n- Press coverage and media mentions\n- Industry trends and analysis\n- Timeline of events`,

    technical: `\n\n## FOCUS: Technical Content\nYou're researching technical topics. Use search_technical primarily. Look for:\n- Code examples and implementations\n- Best practices and patterns\n- Common issues and solutions\n- Documentation and tutorials`,
  };

  const guidance = config.searchType && typeGuidance[config.searchType]
    ? typeGuidance[config.searchType]
    : "";

  return basePrompt + guidance;
}

// ============================================================================
// MAIN AGENTIC SEARCH FUNCTION
// ============================================================================

export async function* searchWithProgress(
  config: SearchAgentConfig
): AsyncGenerator<SearchProgress, SearchProgress, unknown> {
  const {
    query,
    searchType = "general",
    maxSteps = 8,
    context,
  } = config;

  const toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    resultsCount?: number;
  }> = [];

  let totalResultsFound = 0;
  let stepCount = 0;

  // Yield: Initializing
  yield {
    status: 'initializing',
    message: `Starting research agent for: "${query}"`,
    query,
    toolCalls: [],
  };

  // Build the research prompt
  const researchPrompt = context
    ? `Research the following topic:\n\n"${query}"\n\nAdditional context: ${context}`
    : `Research the following topic thoroughly:\n\n"${query}"`;

  // Create tools
  const tools = createSearchTools(config);

  try {
    // Use streamText for the agentic loop
    const result = streamText({
      model: 'anthropic/claude-sonnet-4-20250514',
      system: getAgentSystemPrompt(config),
      prompt: researchPrompt,
      tools,
      maxSteps,
    });

    // Stream the full response to capture tool calls
    for await (const part of result.fullStream) {
      if (part.type === 'tool-call') {
        stepCount++;
        const toolCall = {
          name: part.toolName,
          args: (part as { toolName: string; args?: Record<string, unknown> }).args || {},
        };
        toolCalls.push(toolCall);

        yield {
          status: 'tool_call',
          message: `Calling ${part.toolName}...`,
          query,
          toolName: part.toolName,
          toolArgs: (part as { toolName: string; args?: Record<string, unknown> }).args || {},
          currentStep: stepCount,
          totalSteps: maxSteps,
          toolCalls,
        };
      }

      if (part.type === 'tool-result') {
        // Count results if it's an array
        const resultData = (part as { result?: unknown }).result;
        const resultsCount = Array.isArray(resultData) ? resultData.length : 1;
        totalResultsFound += resultsCount;

        // Update the last tool call with results count
        if (toolCalls.length > 0) {
          toolCalls[toolCalls.length - 1].resultsCount = resultsCount;
        }

        yield {
          status: 'tool_result',
          message: `Got ${resultsCount} results from ${part.toolName}`,
          query,
          toolName: part.toolName,
          resultsFound: totalResultsFound,
          resultsProcessed: toolCalls.length,
          currentStep: stepCount,
          totalSteps: maxSteps,
          toolCalls,
        };
      }
    }

    // Get the final text response
    const finalText = await result.text;

    // Yield: Synthesizing
    yield {
      status: 'synthesizing',
      message: 'Structuring research findings...',
      query,
      resultsFound: totalResultsFound,
      resultsProcessed: toolCalls.length,
      toolCalls,
    };

    // Use generateObject to structure the final output
    let analysis: SearchAnalysis;
    try {
      const structuredResult = await generateObject({
        model: 'anthropic/claude-sonnet-4-20250514',
        schema: searchAnalysisSchema,
        prompt: `Based on the following research findings, create a structured analysis.

Original query: "${query}"
Search type: ${searchType}
Number of searches performed: ${toolCalls.length}
Total results found: ${totalResultsFound}

Research findings:
${finalText}

Create a comprehensive structured analysis of these findings.`,
      });

      analysis = structuredResult.object;
    } catch (structureError) {
      console.error("Failed to structure analysis:", structureError);

      // Fallback analysis
      analysis = {
        query,
        searchType,
        totalResultsFound,
        resultsAnalyzed: toolCalls.length,
        summary: finalText || `Research completed for "${query}" with ${totalResultsFound} results.`,
        keyThemes: [],
        topResults: [],
        entitiesFound: [],
        followUpSuggestions: [`Search for more specific terms related to: ${query}`],
        rawResults: [],
      };
    }

    // Return complete
    const finalProgress: SearchProgress = {
      status: 'complete',
      message: 'Research complete!',
      query,
      result: analysis,
      resultsFound: totalResultsFound,
      resultsProcessed: toolCalls.length,
      toolCalls,
    };
    yield finalProgress;
    return finalProgress;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Search agent error:", error);

    const errorProgress: SearchProgress = {
      status: 'error',
      message: `Research failed: ${errorMsg}`,
      error: errorMsg,
      query,
      toolCalls,
    };
    yield errorProgress;
    return errorProgress;
  }
}

// ============================================================================
// SIMPLE WRAPPER (for backwards compatibility)
// ============================================================================

export async function search(config: SearchAgentConfig): Promise<SearchAnalysis> {
  let lastProgress: SearchProgress | undefined;

  for await (const progress of searchWithProgress(config)) {
    lastProgress = progress;
  }

  if (lastProgress?.status === 'complete' && lastProgress.result) {
    return lastProgress.result;
  }

  if (lastProgress?.status === 'error') {
    throw new Error(lastProgress.error || lastProgress.message);
  }

  throw new Error('Search failed: No result returned');
}
