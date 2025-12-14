import { xai } from "@ai-sdk/xai";
import { streamText, tool, stepCountIs, convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import Exa from "exa-js";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

// GitHub profile analysis tool
async function analyzeGitHubProfileTool(username: string) {
  const token = process.env.GITHUB_TOKEN || null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Fetch profile, repos, and events in parallel
    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${username}/events?per_page=50`, { headers }),
    ]);

    if (!profileRes.ok) {
      if (profileRes.status === 404) {
        return { error: `User "${username}" not found on GitHub` };
      }
      return { error: `GitHub API error: ${profileRes.status}` };
    }

    const profile = await profileRes.json();
    const repos = await reposRes.json();
    const events = await eventsRes.json();

    // Calculate metrics
    const now = new Date();
    const createdAt = new Date(profile.created_at);
    const accountAge = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;

    const totalStars = repos.reduce((sum: number, r: { stargazers_count: number }) => sum + r.stargazers_count, 0);
    const totalForks = repos.reduce((sum: number, r: { forks_count: number }) => sum + r.forks_count, 0);

    // Calculate languages
    const languageCounts: Record<string, number> = {};
    let total = 0;
    for (const repo of repos) {
      if (repo.language && !repo.fork) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
        total++;
      }
    }
    const languages = Object.entries(languageCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Activity level
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter((e: { created_at: string }) => new Date(e.created_at) > thirtyDaysAgo).length;

    let activityLevel = "inactive";
    if (recentEvents >= 50) activityLevel = "very_active";
    else if (recentEvents >= 20) activityLevel = "active";
    else if (recentEvents >= 5) activityLevel = "moderate";
    else if (recentEvents >= 1) activityLevel = "low";

    // Top repos
    const topRepos = [...repos]
      .filter((r: { fork: boolean }) => !r.fork)
      .sort((a: { stargazers_count: number }, b: { stargazers_count: number }) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r: { name: string; description: string | null; stargazers_count: number; language: string | null; html_url: string }) => ({
        name: r.name,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        url: r.html_url,
      }));

    // Experience estimation
    let estimatedExperience = "Entry-level (0-2 years)";
    if (accountAge >= 8 && repos.length >= 50 && totalStars >= 100) {
      estimatedExperience = "Senior (8+ years)";
    } else if (accountAge >= 5 && repos.length >= 30) {
      estimatedExperience = "Mid-level (5-8 years)";
    } else if (accountAge >= 2 && repos.length >= 10) {
      estimatedExperience = "Junior (2-5 years)";
    }

    return {
      username: profile.login,
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      company: profile.company,
      blog: profile.blog,
      avatar_url: profile.avatar_url,
      github_url: profile.html_url,
      followers: profile.followers,
      following: profile.following,
      public_repos: profile.public_repos,
      created_at: profile.created_at,
      accountAge,
      totalStars,
      totalForks,
      languages,
      activityLevel,
      estimatedExperience,
      topRepos,
      recentEventsCount: recentEvents,
    };
  } catch (error) {
    return { error: `Failed to analyze profile: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Exa search tool for finding GitHub profiles
async function searchGitHubProfiles(query: string) {
  try {
    const result = await exa.searchAndContents(query, {
      numResults: 10,
      includeDomains: ["github.com"],
      text: { maxCharacters: 500 },
    });

    // Filter to only user profiles (not repos, gists, etc.)
    const profiles = result.results
      .filter((r) => {
        const url = r.url;
        // Match github.com/username pattern (not github.com/username/repo)
        const match = url.match(/^https?:\/\/github\.com\/([^\/]+)\/?$/);
        return match && !["orgs", "topics", "trending", "explore", "settings", "notifications", "new", "login", "join"].includes(match[1]);
      })
      .map((r) => {
        const match = r.url.match(/^https?:\/\/github\.com\/([^\/]+)\/?$/);
        return {
          username: match ? match[1] : null,
          url: r.url,
          title: r.title,
          snippet: r.text?.substring(0, 300),
        };
      })
      .filter((r) => r.username !== null);

    return {
      query,
      profiles,
      total: profiles.length,
    };
  } catch (error) {
    return { error: `Search failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: `You are GitSignal AI, a helpful assistant for hiring managers looking to find and evaluate developers.

You have access to two tools:
1. **searchGitHubProfiles**: Use this to search for GitHub profiles based on natural language queries like "rust developers in Sydney" or "machine learning engineers". This uses Exa AI to search the web and find relevant GitHub profiles.

2. **analyzeGitHubProfile**: Use this to get detailed analysis of a specific GitHub user. Provide their username and get back comprehensive information about their experience, activity, languages, top projects, and more.

When users ask you to find developers:
1. First use searchGitHubProfiles to find relevant profiles
2. Then use analyzeGitHubProfile on the most promising candidates to get detailed information
3. Present your findings in a clear, organized way

When presenting developer profiles, include:
- Their name and location (if available)
- Experience level and account age
- Main programming languages
- Top projects with star counts
- Activity level
- A brief assessment of why they might be a good fit

Be conversational and helpful. If the search doesn't return good results, suggest refining the query or trying different terms.`,
    messages: modelMessages,
    stopWhen: stepCountIs(10),
    tools: {
      searchGitHubProfiles: tool({
        description: "Search for GitHub profiles based on a query. Use this to find developers matching specific criteria like location, skills, or expertise areas.",
        inputSchema: z.object({
          query: z.string().describe("The search query to find GitHub profiles, e.g. 'rust developers in Sydney' or 'React frontend engineers'"),
        }),
        execute: async ({ query }) => {
          return searchGitHubProfiles(query);
        },
      }),
      analyzeGitHubProfile: tool({
        description: "Analyze a GitHub profile to get detailed information about a developer including their experience, languages, activity, and top projects.",
        inputSchema: z.object({
          username: z.string().describe("The GitHub username to analyze"),
        }),
        execute: async ({ username }) => {
          return analyzeGitHubProfileTool(username);
        },
      }),
    },
    onFinish: async (output) => {
      console.log(output);
    },
  });

  return result.toUIMessageStreamResponse();
}
