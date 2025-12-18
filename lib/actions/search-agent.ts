"use server";

import Exa from "exa-js";
import { streamText, tool } from "ai";
import { z } from "zod";
import {
  scrapeLinkedInProfile,
  searchLinkedInProfiles,
  type LinkedInProfile,
  type LinkedInSearchOptions,
} from "../linkedin";

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

// Type for the final search output (raw agent results, no summarization)
export interface SearchAnalysis {
  query: string;
  searchType: string;
  totalResultsFound: number;
  resultsAnalyzed: number;
  // Raw agent response text (the agent's final summary/findings)
  agentResponse: string;
  // Tool calls made by the agent
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    resultsCount?: number;
  }>;
}

// Progress update types for streaming to UI
export type SearchProgressStatus =
  | 'initializing'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'searching'
  | 'scraping'
  | 'analyzing_result'
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
      description: `Search the web for information. Returns scraped content from matching pages.

Use includeDomains/excludeDomains to focus your search:
- For GitHub profiles/repos: includeDomains: ["github.com"]
- For LinkedIn profiles: includeDomains: ["linkedin.com"]
- For technical content: includeDomains: ["stackoverflow.com", "dev.to", "medium.com", "hackernoon.com", "reddit.com", "news.ycombinator.com"]
- For news: excludeDomains: ["github.com", "stackoverflow.com"] (to avoid code results)
- For portfolios: excludeDomains: ["linkedin.com", "github.com", "twitter.com", "facebook.com"]`,
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        numResults: z.number().optional().describe("Number of results to return (1-10, default 5)"),
        includeDomains: z.array(z.string()).optional().describe("Only include results from these domains (e.g. ['github.com', 'linkedin.com'])"),
        excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
      }),
      execute: async ({ query, numResults, includeDomains, excludeDomains }) => {
        console.log("Searching the web for:", query, "with numResults:", numResults, "includeDomains:", includeDomains, "excludeDomains:", excludeDomains);
        const result = await exa.searchAndContents(query, {
          numResults: Math.min(numResults || 5, 10),
          includeDomains: includeDomains || config.includeDomains,
          excludeDomains: excludeDomains || config.excludeDomains,
          type: "auto",
          text: { maxCharacters: 3000 },
        });
        console.log("Search results:", result.results);
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
        numResults: z.number().optional().describe("Number of similar pages to find (default 5)"),
      }),
      execute: async ({ url, numResults }) => {
        console.log("Finding similar pages for:", url, "with numResults:", numResults);
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
        console.log("Scraping URLs:", urls);
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

    linkedin_profile: tool({
      description: `Scrape detailed information from a LinkedIn profile. Use this when you have a LinkedIn profile URL or username and need comprehensive professional information including work history, education, skills, and certifications.

IMPORTANT: This tool requires a LinkedIn profile URL or username. To find LinkedIn profiles first, use web_search with includeDomains: ["linkedin.com"] or use the query pattern "site:linkedin.com/in/ <person name>"`,
      inputSchema: z.object({
        profileUrlOrUsername: z.string().describe("LinkedIn profile URL (e.g., 'https://linkedin.com/in/johndoe') or just the username (e.g., 'johndoe')"),
      }),
      execute: async ({ profileUrlOrUsername }): Promise<LinkedInProfile | { error: string; profileUrl: string }> => {
        console.log("Scraping LinkedIn profile:", profileUrlOrUsername);
        try {
          const profile = await scrapeLinkedInProfile(profileUrlOrUsername);
          return profile;
        } catch (error) {
          console.error("LinkedIn scrape error:", error);
          return {
            error: error instanceof Error ? error.message : "Failed to scrape LinkedIn profile",
            profileUrl: profileUrlOrUsername,
          };
        }
      },
    }),

    linkedin_search: tool({
      description: `Search for LinkedIn profiles using advanced filters. This searches LinkedIn directly and returns detailed profile data.

Search options:
- searchQuery: General fuzzy search (e.g., "Machine Learning Engineer", "John Doe")
- currentJobTitles: Exact job title match (e.g., ["Software Engineer", "Data Scientist"])
- locations: Filter by location (e.g., ["Sydney", "San Francisco"])
- currentCompanies: LinkedIn company slugs (e.g., ["google", "meta"])

Returns full profile data including work history, education, and skills.`,
      inputSchema: z.object({
        searchQuery: z.string().optional().describe("General search query (fuzzy search)"),
        currentJobTitles: z.array(z.string()).optional().describe("List of exact job titles to search for"),
        locations: z.array(z.string()).optional().describe("List of locations"),
        currentCompanies: z.array(z.string()).optional().describe("List of LinkedIn company URL slugs"),
        maxResults: z.number().optional().describe("Maximum results (default 10, max 25)"),
      }),
      execute: async ({ searchQuery, currentJobTitles, locations, currentCompanies, maxResults }) => {
        console.log("Searching LinkedIn profiles:", { searchQuery, currentJobTitles, locations });

        const options: LinkedInSearchOptions = {
          profileScraperMode: "Full",
          maxItems: Math.min(maxResults || 10, 25),
          takePages: 1,
        };

        if (searchQuery) options.searchQuery = searchQuery;
        if (currentJobTitles?.length) options.currentJobTitles = currentJobTitles;
        if (locations?.length) options.locations = locations;
        if (currentCompanies?.length) options.currentCompanies = currentCompanies;

        const profiles = await searchLinkedInProfiles(options);

        return profiles.map(p => ({
          name: p.name,
          headline: p.headline,
          location: p.location,
          profileUrl: p.profileUrl,
          currentCompany: p.currentCompany,
          currentRole: p.currentRole,
          about: p.about?.slice(0, 300),
          openToWork: p.openToWork,
          skills: p.skills.slice(0, 10),
          experience: p.experience.slice(0, 3).map(e => ({
            title: e.title,
            company: e.company,
            duration: e.duration,
          })),
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

1. **web_search** - Search the web with optional domain filtering. Use includeDomains/excludeDomains to focus:
   - GitHub: includeDomains: ["github.com"]
   - LinkedIn: includeDomains: ["linkedin.com"]
   - Technical: includeDomains: ["stackoverflow.com", "dev.to", "medium.com", "reddit.com", "news.ycombinator.com"]
   - News: excludeDomains: ["github.com", "stackoverflow.com"]
   - Portfolios: excludeDomains: ["linkedin.com", "github.com", "twitter.com"]

2. **find_similar** - Find pages similar to a URL. Great for discovering related content.

3. **scrape_urls** - Get full content from specific URLs when you need more detail.

4. **linkedin_search** - Search specifically for LinkedIn profiles by name, title, company, or skills. Returns profile URLs that can be scraped for details.

5. **linkedin_profile** - Scrape detailed information from a LinkedIn profile URL or username. Returns comprehensive professional data including work history, education, skills, certifications, and more. Use this after finding profiles with linkedin_search or web_search.

## RESEARCH STRATEGY

1. **Start broad** - Begin with a general search to understand the landscape
2. **Focus with domains** - Use includeDomains/excludeDomains to target specific sources
3. **Go deeper** - Use find_similar or targeted searches to explore promising leads
4. **Cross-reference** - Verify information across multiple sources
5. **Fill gaps** - Use scrape_urls to get more detail from important pages
6. **For people research** - Use linkedin_search to find profiles, then linkedin_profile to get detailed professional info

## IMPORTANT GUIDELINES

- Make multiple tool calls to gather comprehensive information
- Don't stop after just one search - explore multiple angles
- Use domain filtering strategically (e.g., includeDomains: ["github.com"] for developers)
- When you find an interesting URL, consider using find_similar to discover related content
- For researching professionals, use linkedin_search + linkedin_profile for detailed career information
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
    github_profiles: `\n\n## FOCUS: GitHub Profiles\nYou're looking for GitHub developer profiles. Use includeDomains: ["github.com"]. Look for:\n- Developer expertise and languages\n- Notable repositories and contributions\n- Activity levels and commit history\n- Open source involvement`,

    linkedin: `\n\n## FOCUS: LinkedIn Profiles\nYou're searching for professional profiles. Use the linkedin_search tool to find profiles, then linkedin_profile to get detailed information. Look for:\n- Work history and experience\n- Skills and endorsements\n- Education and certifications\n- Professional connections and companies\n- Current role and company`,

    portfolio: `\n\n## FOCUS: Portfolio Sites\nYou're looking for personal portfolio websites. Use excludeDomains: ["linkedin.com", "github.com", "twitter.com", "facebook.com"]. Look for:\n- Personal projects and case studies\n- Design work and technical skills\n- Contact information\n- Client testimonials`,

    news: `\n\n## FOCUS: News & Recent Events\nYou're searching for recent news. Use excludeDomains: ["github.com", "stackoverflow.com"]. Look for:\n- Recent announcements and developments\n- Press coverage and media mentions\n- Industry trends and analysis\n- Timeline of events`,

    technical: `\n\n## FOCUS: Technical Content\nYou're researching technical topics. Use includeDomains: ["stackoverflow.com", "dev.to", "medium.com", "hackernoon.com", "reddit.com", "news.ycombinator.com"]. Look for:\n- Code examples and implementations\n- Best practices and patterns\n- Common issues and solutions\n- Documentation and tutorials`,
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

    // Build the analysis directly from raw results (no summarization step)
    const analysis: SearchAnalysis = {
      query,
      searchType,
      totalResultsFound,
      resultsAnalyzed: toolCalls.length,
      agentResponse: finalText || `Research completed for "${query}" with ${totalResultsFound} results.`,
      toolCalls,
    };

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
