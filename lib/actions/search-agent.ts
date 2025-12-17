"use server";

import Exa from "exa-js";
import { generateObject } from "ai";
import { z } from "zod";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export interface SearchAgentConfig {
  query: string;
  /**
   * Type of search to perform
   */
  searchType?: "general" | "github_profiles" | "linkedin" | "portfolio" | "news" | "technical";
  /**
   * Maximum number of results to fetch
   */
  maxResults?: number;
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
  totalResultsFound: z.number().describe("Total number of results found"),
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
  currentUrl?: string;
  currentTitle?: string;
  scrapedContent?: string;
  resultsFound?: number;
  resultsProcessed?: number;
  result?: SearchAnalysis;
  error?: string;
}

// ============================================================================
// MAIN SEARCH AGENT FUNCTION (Async Generator for streaming progress)
// ============================================================================

export async function* searchWithProgress(
  config: SearchAgentConfig
): AsyncGenerator<SearchProgress, SearchProgress, unknown> {
  const {
    query,
    searchType = "general",
    maxResults = 10,
    includeDomains,
    excludeDomains,
    context,
  } = config;

  // Yield: Initializing
  yield {
    status: 'initializing',
    message: `Initializing search for: "${query}"`,
    query,
  };

  // Configure search based on type
  const searchConfig: {
    includeDomains?: string[];
    excludeDomains?: string[];
    type?: "keyword" | "neural" | "auto";
  } = {
    type: "auto",
  };

  // Set domain filters based on search type
  switch (searchType) {
    case "github_profiles":
      searchConfig.includeDomains = ["github.com"];
      break;
    case "linkedin":
      searchConfig.includeDomains = ["linkedin.com"];
      break;
    case "portfolio":
      searchConfig.excludeDomains = ["github.com", "linkedin.com", "twitter.com", "facebook.com"];
      break;
    case "news":
      searchConfig.type = "neural";
      break;
    case "technical":
      searchConfig.includeDomains = [
        "stackoverflow.com",
        "dev.to",
        "medium.com",
        "hackernews.com",
        "reddit.com/r/programming",
        "github.com",
      ];
      break;
  }

  // Override with user-specified domains
  if (includeDomains?.length) {
    searchConfig.includeDomains = includeDomains;
  }
  if (excludeDomains?.length) {
    searchConfig.excludeDomains = excludeDomains;
  }

  // Yield: Starting search
  yield {
    status: 'searching',
    message: `Searching the web for "${query}"...`,
    query,
    currentStep: 1,
    totalSteps: maxResults + 2, // search + N scrapes + synthesis
  };

  let searchResults: Exa.SearchResult<{ text: true }>[];

  try {
    const result = await exa.searchAndContents(query, {
      numResults: maxResults,
      includeDomains: searchConfig.includeDomains,
      excludeDomains: searchConfig.excludeDomains,
      type: searchConfig.type || "auto",
      text: { maxCharacters: 3000 },
    });
    searchResults = result.results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    yield {
      status: 'error',
      message: `Search failed: ${errorMsg}`,
      error: errorMsg,
      query,
    };
    return {
      status: 'error',
      message: `Search failed: ${errorMsg}`,
      error: errorMsg,
      query,
    };
  }

  if (!searchResults || searchResults.length === 0) {
    yield {
      status: 'error',
      message: 'No results found for this query',
      error: 'No results found',
      query,
    };
    return {
      status: 'error',
      message: 'No results found for this query',
      error: 'No results found',
      query,
    };
  }

  // Yield: Results found
  yield {
    status: 'searching',
    message: `Found ${searchResults.length} results. Starting to analyze...`,
    query,
    resultsFound: searchResults.length,
    currentStep: 1,
    totalSteps: searchResults.length + 2,
  };

  // Process each result - scrape and yield progress
  const processedResults: Array<{
    url: string;
    title: string;
    content: string;
    publishedDate?: string;
    author?: string;
  }> = [];

  for (let i = 0; i < searchResults.length; i++) {
    const result = searchResults[i];
    const url = result.url;
    const title = result.title || "Untitled";

    // Yield: Scraping this result
    yield {
      status: 'scraping',
      message: `Scraping result ${i + 1}/${searchResults.length}`,
      query,
      currentUrl: url,
      currentTitle: title,
      resultsFound: searchResults.length,
      resultsProcessed: i,
      currentStep: i + 2,
      totalSteps: searchResults.length + 2,
    };

    // Get content from the result (already scraped by searchAndContents)
    const content = result.text || "";
    const contentPreview = content.slice(0, 500);

    // Yield: Show scraped content preview
    yield {
      status: 'analyzing_result',
      message: `Analyzing: ${title}`,
      query,
      currentUrl: url,
      currentTitle: title,
      scrapedContent: contentPreview,
      resultsFound: searchResults.length,
      resultsProcessed: i + 1,
      currentStep: i + 2,
      totalSteps: searchResults.length + 2,
    };

    processedResults.push({
      url,
      title,
      content,
      publishedDate: result.publishedDate || undefined,
      author: result.author || undefined,
    });
  }

  // Yield: Synthesizing results
  yield {
    status: 'synthesizing',
    message: 'AI is synthesizing all scraped content into a comprehensive analysis...',
    query,
    resultsFound: searchResults.length,
    resultsProcessed: searchResults.length,
    currentStep: searchResults.length + 1,
    totalSteps: searchResults.length + 2,
  };

  // Build the context for analysis
  const resultsContext = processedResults.map((r, i) =>
    `### Result ${i + 1}: ${r.title}\nURL: ${r.url}\n${r.publishedDate ? `Published: ${r.publishedDate}\n` : ''}${r.author ? `Author: ${r.author}\n` : ''}\nContent:\n${r.content.slice(0, 2000)}${r.content.length > 2000 ? '\n... (truncated)' : ''}`
  ).join('\n\n---\n\n');

  const analysisPrompt = `You are analyzing web search results for the query: "${query}"
${context ? `\nContext: ${context}\n` : ''}
Search type: ${searchType}

Here are ${processedResults.length} search results that were scraped:

${resultsContext}

---

Based on ALL the search results above, provide a comprehensive analysis. Extract key insights, identify patterns, and synthesize the information into a useful summary. Score each result's relevance to the original query.`;

  // Generate structured analysis
  let analysis: SearchAnalysis;
  try {
    const structuredResult = await generateObject({
      model: 'google/gemini-2.5-flash-preview-05-20',
      schema: searchAnalysisSchema,
      prompt: analysisPrompt,
    });

    analysis = structuredResult.object;
  } catch (error) {
    console.error("Failed to generate structured analysis:", error);

    // Fallback analysis
    const fallbackAnalysis: SearchAnalysis = {
      query,
      searchType,
      totalResultsFound: searchResults.length,
      resultsAnalyzed: processedResults.length,
      summary: `Found ${searchResults.length} results for "${query}". Analysis generation encountered an error.`,
      keyThemes: [],
      topResults: processedResults.slice(0, 5).map((r, i) => ({
        url: r.url,
        title: r.title,
        relevanceScore: 80 - (i * 10),
        snippet: r.content.slice(0, 200),
        keyInsights: ["Result found but detailed analysis unavailable"],
        contentType: "other" as const,
      })),
      entitiesFound: [],
      followUpSuggestions: [`Refine search: "${query}" with more specific terms`],
      rawResults: processedResults.map(r => ({
        url: r.url,
        title: r.title,
        contentPreview: r.content.slice(0, 500),
      })),
    };

    const fallbackProgress: SearchProgress = {
      status: 'complete',
      message: 'Search complete (with fallback analysis)',
      query,
      result: fallbackAnalysis,
      resultsFound: searchResults.length,
      resultsProcessed: processedResults.length,
      currentStep: searchResults.length + 2,
      totalSteps: searchResults.length + 2,
    };
    yield fallbackProgress;
    return fallbackProgress;
  }

  // Return complete with structured output
  const finalProgress: SearchProgress = {
    status: 'complete',
    message: 'Search and analysis complete!',
    query,
    result: analysis,
    resultsFound: searchResults.length,
    resultsProcessed: processedResults.length,
    currentStep: searchResults.length + 2,
    totalSteps: searchResults.length + 2,
  };
  yield finalProgress;
  return finalProgress;
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
