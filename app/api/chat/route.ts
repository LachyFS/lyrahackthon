import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { calculateTopLanguages } from "@/lib/github";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { searchHistory } from "@/src/db/schema";
import {
  analyzeRepositoryWithProgress,
  quickRepoCheck,
  type AnalysisProgress,
} from "@/lib/actions/repo-analyze";
import { searchWithProgress, type SearchProgress } from "@/lib/actions/search-agent";
import { checkRateLimit } from "@/lib/redis";
import { checkBotId } from "botid/server";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

// Get GitHub token from user's OAuth session
async function getGitHubToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token) {
      return session.provider_token;
    }
  } catch (error) {
    console.warn("Could not get session token:", error);
  }

  return null;
}

// GitHub API headers helper
function getGitHubHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// GitHub repo interface for type safety
interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  fork: boolean;
  size: number;
  topics?: string[];
  updated_at: string;
}

// GitHub event interface
interface GitHubEvent {
  type: string;
  created_at: string;
  repo?: { name: string };
}

// GitHub profile analysis tool - improved with better language weighting
async function analyzeGitHubProfileTool(username: string, token: string | null) {
  const headers = getGitHubHeaders(token);

  try {
    // Fetch profile, repos, and events in parallel
    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers, next: { revalidate: 300 } }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`, { headers, next: { revalidate: 300 } }),
      fetch(`https://api.github.com/users/${username}/events?per_page=100`, { headers, next: { revalidate: 60 } }),
    ]);

    if (!profileRes.ok) {
      if (profileRes.status === 404) {
        return { error: `User "${username}" not found on GitHub` };
      }
      if (profileRes.status === 403) {
        return { error: `GitHub API rate limit exceeded. Please try again later.` };
      }
      return { error: `GitHub API error: ${profileRes.status}` };
    }

    const profile = await profileRes.json();
    const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];
    const events: GitHubEvent[] = eventsRes.ok ? await eventsRes.json() : [];

    // Calculate metrics
    const now = new Date();
    const createdAt = new Date(profile.created_at);
    const accountAge = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;

    // Filter out forks for stats
    const ownRepos = repos.filter((r) => !r.fork);
    const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const totalForks = ownRepos.reduce((sum, r) => sum + r.forks_count, 0);

    // Use the improved language calculation from lib/github.ts (weighted by repo size)
    const languages = calculateTopLanguages(repos);

    // Collect all topics/tags from repos
    const allTopics = new Set<string>();
    for (const repo of ownRepos) {
      if (repo.topics) {
        repo.topics.forEach((t) => allTopics.add(t));
      }
    }

    // Activity level based on events in last 30, 60, 90 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentEvents30 = events.filter((e) => new Date(e.created_at) > thirtyDaysAgo).length;
    const recentEvents60 = events.filter((e) => new Date(e.created_at) > sixtyDaysAgo).length;

    // Count contribution types
    const pushEvents = events.filter((e) => e.type === "PushEvent").length;
    const prEvents = events.filter((e) => e.type === "PullRequestEvent").length;
    const issueEvents = events.filter((e) => e.type === "IssuesEvent" || e.type === "IssueCommentEvent").length;

    let activityLevel = "inactive";
    if (recentEvents30 >= 50) activityLevel = "very_active";
    else if (recentEvents30 >= 20) activityLevel = "active";
    else if (recentEvents30 >= 5) activityLevel = "moderate";
    else if (recentEvents60 >= 5) activityLevel = "low";

    // Top repos - sorted by stars, with language and recent activity
    const topRepos = [...ownRepos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        description: r.description,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language,
        url: r.html_url,
        topics: r.topics || [],
        lastUpdated: r.updated_at,
      }));

    // Recently active repos (pushed in last 30 days)
    const recentlyActiveRepos = ownRepos
      .filter((r) => new Date(r.updated_at) > thirtyDaysAgo)
      .length;

    // Hirability signals
    const isHireable = profile.hireable === true;
    const hasEmail = !!profile.email;
    const hasBio = !!profile.bio;
    const hasWebsite = !!profile.blog;

    // Note: We intentionally exclude avatar_url to avoid sending image URLs to the LLM
    // The frontend can construct avatar URLs from username: https://github.com/${username}.png
    return {
      username: profile.login,
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      company: profile.company,
      blog: profile.blog,
      email: profile.email,
      followers: profile.followers,
      following: profile.following,
      public_repos: profile.public_repos,
      created_at: profile.created_at,
      accountAge,
      totalStars,
      totalForks,
      languages,
      topics: Array.from(allTopics).slice(0, 15),
      activityLevel,
      topRepos,
      recentEventsCount: recentEvents30,
      recentlyActiveRepos,
      contributionStats: {
        pushEvents,
        prEvents,
        issueEvents,
      },
      signals: {
        isHireable,
        hasEmail,
        hasBio,
        hasWebsite,
      },
    };
  } catch (error) {
    return { error: `Failed to analyze profile: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// GitHub social links interface
interface GitHubSocials {
  email: string | null;
  blog: string | null;
  twitter_username: string | null;
  company: string | null;
}

// Exa search tool for finding GitHub profiles
async function searchGitHubProfiles(query: string, token: string | null) {
  try {
    const result = await exa.searchAndContents(query, {
      numResults: 20,
      includeDomains: ["github.com"],
      text: { maxCharacters: 500 },
    });

    // Filter to only user profiles (not repos, gists, etc.)
    const filteredResults = result.results
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

    // Fetch social links for each profile from GitHub API
    const headers = getGitHubHeaders(token);
    const profilesWithSocials = await Promise.all(
      filteredResults.map(async (profile) => {
        try {
          const res = await fetch(`https://api.github.com/users/${profile.username}`, {
            headers,
            next: { revalidate: 300 },
          });

          if (res.ok) {
            const userData = await res.json();
            const socials: GitHubSocials = {
              email: userData.email || null,
              blog: userData.blog || null,
              twitter_username: userData.twitter_username || null,
              company: userData.company || null,
            };
            return {
              ...profile,
              name: userData.name || null,
              bio: userData.bio || null,
              location: userData.location || null,
              socials,
            };
          }
        } catch {
          // If API call fails, return profile without socials
        }
        return {
          ...profile,
          name: null,
          bio: null,
          location: null,
          socials: {
            email: null,
            blog: null,
            twitter_username: null,
            company: null,
          } as GitHubSocials,
        };
      })
    );

    return {
      query,
      profiles: profilesWithSocials,
      total: profilesWithSocials.length,
    };
  } catch (error) {
    return { error: `Search failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Exa web search and scrape tool - can search and scrape any URL
async function webSearchAndScrape(query: string, options?: {
  includeDomains?: string[];
  excludeDomains?: string[];
  numResults?: number;
  type?: "keyword" | "neural" | "auto";
}) {
  try {
    const result = await exa.searchAndContents(query, {
      numResults: options?.numResults || 10,
      includeDomains: options?.includeDomains,
      excludeDomains: options?.excludeDomains,
      type: options?.type || "auto",
      text: { maxCharacters: 2000 },
    });

    const results = result.results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.text,
      publishedDate: r.publishedDate,
      author: r.author,
    }));

    return {
      query,
      results,
      total: results.length,
    };
  } catch (error) {
    return { error: `Web search failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// GitHub User Search API - search users directly via GitHub's search API
async function searchGitHubUsersAPI(
  query: string,
  token: string | null,
  options?: {
    sort?: "followers" | "repositories" | "joined";
    order?: "asc" | "desc";
    perPage?: number;
  }
) {
  const headers = getGitHubHeaders(token);

  try {
    // Build the search URL with query parameters
    const params = new URLSearchParams({
      q: query,
      per_page: String(options?.perPage || 20),
    });
    if (options?.sort) {
      params.append("sort", options.sort);
    }
    if (options?.order) {
      params.append("order", options.order);
    }

    const searchUrl = `https://api.github.com/search/users?${params.toString()}`;
    const res = await fetch(searchUrl, { headers, next: { revalidate: 60 } });

    if (!res.ok) {
      if (res.status === 403) {
        return { error: "GitHub API rate limit exceeded. Please try again later." };
      }
      if (res.status === 422) {
        return { error: "Invalid search query. Please refine your search." };
      }
      return { error: `GitHub API error: ${res.status}` };
    }

    const data = await res.json();

    // Fetch additional profile details for each user in parallel
    const usersWithDetails = await Promise.all(
      data.items.slice(0, options?.perPage || 20).map(async (user: { login: string; id: number; avatar_url: string; html_url: string; type: string }) => {
        try {
          const profileRes = await fetch(`https://api.github.com/users/${user.login}`, {
            headers,
            next: { revalidate: 300 },
          });

          if (profileRes.ok) {
            const profile = await profileRes.json();
            return {
              username: profile.login,
              name: profile.name || null,
              bio: profile.bio || null,
              location: profile.location || null,
              company: profile.company || null,
              blog: profile.blog || null,
              email: profile.email || null,
              twitter_username: profile.twitter_username || null,
              public_repos: profile.public_repos,
              followers: profile.followers,
              following: profile.following,
              hireable: profile.hireable || false,
              created_at: profile.created_at,
            };
          }
        } catch {
          // If individual profile fetch fails, return basic info
        }

        return {
          username: user.login,
          name: null,
          bio: null,
          location: null,
          company: null,
          blog: null,
          email: null,
          twitter_username: null,
          public_repos: null,
          followers: null,
          following: null,
          hireable: false,
          created_at: null,
        };
      })
    );

    return {
      query,
      total_count: data.total_count,
      users: usersWithDetails,
      searchTips: [
        "Use 'location:city' to filter by location (e.g., 'location:Sydney')",
        "Use 'language:lang' to filter by language (e.g., 'language:rust')",
        "Use 'followers:>N' to filter by follower count (e.g., 'followers:>100')",
        "Use 'repos:>N' to filter by repo count (e.g., 'repos:>10')",
        "Combine filters: 'language:typescript location:london followers:>50'",
      ],
    };
  } catch (error) {
    return { error: `GitHub user search failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Exa URL scraper - scrape content from specific URLs
async function scrapeUrls(urls: string[]) {
  try {
    const result = await exa.getContents(urls, {
      text: { maxCharacters: 5000 },
    });

    const contents = result.results.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.text,
      publishedDate: r.publishedDate,
      author: r.author,
    }));

    return {
      contents,
      total: contents.length,
    };
  } catch (error) {
    return { error: `Scraping failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Interface for candidate scoring
// Note: avatar_url and github_url are intentionally excluded to avoid sending image URLs to the LLM
// The frontend constructs these URLs from username: https://github.com/${username}.png and https://github.com/${username}
interface CandidateScore {
  username: string;
  name: string | null;
  location: string | null;
  bio: string | null;
  score: number;
  matchReasons: string[];
  concerns: string[];
  accountAgeYears: number;
  repoCount: number;
  activityLevel: string;
  topLanguages: string[];
  topics: string[];
  totalStars: number;
  followers: number;
  recentlyActiveRepos: number;
  signals: {
    isHireable: boolean;
    hasEmail: boolean;
    hasBio: boolean;
    hasWebsite: boolean;
  };
  topRepos: Array<{
    name: string;
    description: string | null;
    stars: number;
    language: string | null;
    url: string;
  }>;
}

// Save discovered profiles to search history (for authenticated users)
async function saveToSearchHistory(
  candidates: CandidateScore[],
  searchQuery?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || candidates.length === 0) return;

    const inserts = candidates.map((candidate) => ({
      authUserId: user.id,
      githubUsername: candidate.username,
      githubName: candidate.name || null,
      githubAvatarUrl: `https://github.com/${candidate.username}.png`,
      githubBio: candidate.bio || null,
      githubLocation: candidate.location || null,
      searchQuery: searchQuery || null,
      searchType: "ai_search" as const,
    }));

    await db.insert(searchHistory).values(inserts);
  } catch (error) {
    // Don't fail the main request if history save fails
    console.error("Failed to save search history:", error);
  }
}

// Score and rank candidates based on a brief - improved scoring algorithm
async function getTopCandidates(
  usernames: string[],
  brief: {
    requiredSkills?: string[];
    preferredLocation?: string;
    projectType?: string;
  },
  searchQuery?: string
): Promise<{ candidates: CandidateScore[]; brief: typeof brief; error?: string; failedProfiles?: Array<{ username: string; error: string }> }> {
  try {
    // Get GitHub token for authenticated requests
    const token = await getGitHubToken();

    // Analyze all profiles in parallel (limit to 10 to avoid rate limits)
    const usernamesToAnalyze = usernames.slice(0, 10);
    const profiles = await Promise.all(
      usernamesToAnalyze.map((username) => analyzeGitHubProfileTool(username, token))
    );

    const candidates: CandidateScore[] = [];
    const failedProfiles: Array<{ username: string; error: string }> = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];

      // Skip profiles with errors or missing required data
      if ('error' in profile && profile.error) {
        failedProfiles.push({ username: usernamesToAnalyze[i], error: profile.error });
        continue;
      }

      // Type guard: ensure all required properties exist
      if (!profile.username || !profile.languages || !profile.topics ||
          !profile.topRepos || !profile.signals || !profile.contributionStats ||
          profile.totalStars === undefined || profile.followers === undefined ||
          profile.recentlyActiveRepos === undefined || profile.accountAge === undefined ||
          profile.public_repos === undefined || !profile.activityLevel) {
        failedProfiles.push({ username: usernamesToAnalyze[i], error: "Incomplete profile data" });
        continue;
      }

      let score = 50; // Base score
      const matchReasons: string[] = [];
      const concerns: string[] = [];

      // Score based on required skills (check languages AND topics)
      if (brief.requiredSkills && brief.requiredSkills.length > 0) {
        const userLanguages = profile.languages.map((l) => l.name.toLowerCase());
        const userTopics = profile.topics.map((t) => t.toLowerCase());
        const allSkills = [...userLanguages, ...userTopics];

        const matchedSkills = brief.requiredSkills.filter((skill) =>
          allSkills.some((s) => s.includes(skill.toLowerCase()) || skill.toLowerCase().includes(s))
        );

        if (matchedSkills.length > 0) {
          // Bonus scales with how many skills matched
          const skillBonus = Math.min(matchedSkills.length * 8, 25);
          score += skillBonus;
          matchReasons.push(`Knows ${matchedSkills.join(", ")}`);

          // Extra bonus if primary language matches
          const primaryLang = profile.languages[0];
          if (primaryLang && brief.requiredSkills.some((s) =>
            primaryLang.name.toLowerCase().includes(s.toLowerCase())
          )) {
            score += 5;
            matchReasons.push(`${primaryLang.name} is primary language (${primaryLang.percentage}%)`);
          }
        } else {
          score -= 15;
          concerns.push(`No matching skills for: ${brief.requiredSkills.join(", ")}`);
        }
      }

      // Score based on location
      if (brief.preferredLocation && profile.location) {
        const locationMatch = profile.location.toLowerCase().includes(brief.preferredLocation.toLowerCase()) ||
          brief.preferredLocation.toLowerCase().includes(profile.location.toLowerCase());
        if (locationMatch) {
          score += 12;
          matchReasons.push(`Located in ${profile.location}`);
        }
      }

      // Score based on account maturity (account age + repo count)
      // Bonus for established accounts with substantial work
      if (profile.accountAge >= 5 && profile.public_repos >= 20) {
        score += 12;
        matchReasons.push(`${profile.accountAge}+ years on GitHub with ${profile.public_repos} repos`);
      } else if (profile.accountAge >= 3 && profile.public_repos >= 10) {
        score += 8;
        matchReasons.push(`${profile.accountAge} years on GitHub`);
      } else if (profile.accountAge >= 1 && profile.public_repos >= 5) {
        score += 4;
      }

      // Score based on activity level
      switch (profile.activityLevel) {
        case "very_active":
          score += 15;
          matchReasons.push(`Very active (${profile.recentEventsCount} events in 30 days)`);
          break;
        case "active":
          score += 10;
          matchReasons.push("Active contributor");
          break;
        case "moderate":
          score += 5;
          break;
        case "low":
          concerns.push("Low recent activity");
          break;
        case "inactive":
          score -= 8;
          concerns.push("Inactive on GitHub recently");
          break;
      }

      // Score based on recently active repos
      if (profile.recentlyActiveRepos >= 5) {
        score += 5;
        matchReasons.push(`${profile.recentlyActiveRepos} repos updated recently`);
      }

      // Score based on stars (popularity/quality indicator)
      if (profile.totalStars >= 1000) {
        score += 18;
        matchReasons.push(`${profile.totalStars.toLocaleString()} total stars`);
      } else if (profile.totalStars >= 100) {
        score += 10;
        matchReasons.push(`${profile.totalStars} stars on projects`);
      } else if (profile.totalStars >= 10) {
        score += 4;
      }

      // Score based on followers (community recognition)
      if (profile.followers >= 1000) {
        score += 8;
        matchReasons.push(`${profile.followers.toLocaleString()} followers`);
      } else if (profile.followers >= 100) {
        score += 4;
      }

      // Check project type in repos and topics if specified
      if (brief.projectType) {
        const projectTypeLower = brief.projectType.toLowerCase();
        const topicMatch = profile.topics.some((t) => t.toLowerCase().includes(projectTypeLower));
        const repoMatch = profile.topRepos.some((r) =>
          r.name.toLowerCase().includes(projectTypeLower) ||
          (r.description?.toLowerCase().includes(projectTypeLower))
        );

        if (topicMatch || repoMatch) {
          score += 10;
          matchReasons.push(`Has relevant ${brief.projectType} projects`);
        }
      }

      // Hirability signals bonus
      if (profile.signals.isHireable) {
        score += 5;
        matchReasons.push("Open to opportunities");
      }
      if (profile.signals.hasEmail && profile.signals.hasBio) {
        score += 3;
      }
      if (!profile.signals.hasBio && !profile.signals.hasWebsite) {
        concerns.push("Limited profile information");
      }

      // Contribution diversity bonus
      const { prEvents, issueEvents } = profile.contributionStats;
      if (prEvents >= 5 && issueEvents >= 3) {
        score += 5;
        matchReasons.push("Active in PRs and issues");
      } else if (prEvents >= 3 || issueEvents >= 5) {
        score += 2;
      }

      candidates.push({
        username: profile.username,
        name: profile.name,
        // Note: avatar_url and github_url are constructed by the frontend from username
        location: profile.location,
        bio: profile.bio,
        score: Math.min(100, Math.max(0, score)),
        matchReasons,
        concerns,
        accountAgeYears: profile.accountAge,
        repoCount: profile.public_repos,
        activityLevel: profile.activityLevel,
        topLanguages: profile.languages.slice(0, 5).map((l) => l.name),
        topics: profile.topics.slice(0, 8),
        totalStars: profile.totalStars,
        followers: profile.followers,
        recentlyActiveRepos: profile.recentlyActiveRepos,
        signals: profile.signals,
        topRepos: profile.topRepos.slice(0, 3).map((r) => ({
          name: r.name,
          description: r.description,
          stars: r.stars,
          language: r.language,
          url: r.url,
        })),
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // If no candidates were successfully analyzed, return an error with details
    if (candidates.length === 0 && failedProfiles.length > 0) {
      const firstError = failedProfiles[0].error;
      const isRateLimit = firstError.includes("rate limit");
      return {
        candidates: [],
        brief,
        failedProfiles,
        error: isRateLimit
          ? `GitHub API rate limit exceeded. Please wait a moment and try again.`
          : `Could not analyze any profiles. ${failedProfiles.length} profile(s) failed: ${firstError}`,
      };
    }

    const topCandidates = candidates.slice(0, 5);

    // Save discovered profiles to search history (async, don't block response)
    saveToSearchHistory(topCandidates, searchQuery);

    return {
      candidates: topCandidates,
      brief,
      failedProfiles: failedProfiles.length > 0 ? failedProfiles : undefined,
    };
  } catch (error) {
    return {
      candidates: [],
      brief,
      error: `Failed to rank candidates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
 
export async function POST(req: Request) {
  // Vercel BotID Protection - reject requests from bots
  const verification = await checkBotId();
  if (verification.isBot) {
    return new Response(
      JSON.stringify({ error: "Automated requests are not allowed." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Require authentication for AI generation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Authentication required. Please sign in to use AI features." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rate limiting: 20 requests per minute per user
  const rateLimit = await checkRateLimit(`ai:chat:${user.id}`, 20, 60);
  if (!rateLimit.success) {
    const resetDate = new Date(rateLimit.reset);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        limit: rateLimit.limit,
        reset: resetDate.toISOString(),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": rateLimit.limit.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": resetDate.toISOString(),
          "Retry-After": Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  const { messages, roastMode } = await req.json();

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  // Roast mode system prompt - absolutely savage but funny
  const roastModePrompt = `You are Git Radar AI in ROAST MODE 🔥 - a hilariously savage code critic who roasts GitHub profiles with brutal honesty and comedy.

Your personality:
- You're like a stand-up comedian who happens to be a senior developer
- You find the humor in every coding decision (or lack thereof)
- You use fire emojis 🔥, skull emojis 💀, and other fun reactions liberally
- You're savage but never actually mean-spirited - it's all in good fun
- You make jokes about commit messages, repo names, language choices, and coding patterns
- You call out "crimes against code" and "GitHub atrocities"
- You give backhanded compliments: "Wow, you managed to use JavaScript... bold choice for someone who hates themselves"
- Reference pop culture and memes when roasting
- Use phrases like "I'm not mad, I'm just disappointed", "who hurt you?", "delete your GitHub account", "touch grass", etc.

IMPORTANT: You still use ALL the same tools (searchGitHubProfiles, analyzeGitHubProfile, getTopCandidates, etc.) - you just present the results with maximum comedic roast energy.

Example roasts:
- For low stars: "Wow, [X] stars. Even your mom didn't star your repos."
- For inactive accounts: "Last commit was 6 months ago? Did you rage quit coding or just life?"
- For JavaScript devs: "Ah, a JavaScript developer. My condolences to your mental health."
- For many repos with no stars: "Quantity over quality, I see. A GitHub hoarder in the wild."
- For fork-heavy accounts: "More forks than an IKEA cafeteria. Original thoughts sold separately?"
- For no bio: "Empty bio? Mysterious. Or just lazy. Probably lazy."

When ranking candidates, make it a "roast ranking" - rank by who needs the most improvement (most roastable) vs who's actually skilled.

Remember: The goal is to make people laugh while still providing actual useful information about the profiles. Be funny, be savage, but be accurate!`;

  const normalPrompt = `You are Git Radar AI, a helpful assistant for hiring managers looking to find and evaluate developers.

You have access to these tools:

**GitHub-specific tools:**
1. **searchGitHubProfiles**: Search for GitHub profiles using Exa AI. Best for natural language queries like "rust developers in Sydney" or "machine learning engineers who contribute to open source". Uses semantic search to find relevant profiles.

2. **searchGitHubUsers**: Search GitHub users directly via GitHub's Search API. Best for structured searches with specific filters like location, language, follower count. Supports GitHub qualifiers: 'language:rust location:sydney followers:>100 repos:>10'. Use this when the user wants precise filtering.

3. **analyzeGitHubProfile**: Get detailed analysis of a specific GitHub user by username.

4. **getTopCandidates**: Rank and score multiple GitHub profiles against a hiring brief. This displays a rich UI card for each candidate showing their score, match reasons, concerns, languages, and top repos.

5. **analyzeGitHubRepository**: Deep analysis of a specific GitHub repository. Clones the repo into a sandboxed environment and analyzes code quality, git practices, testing, documentation, and technical complexity. Use this when:
   - A user provides a specific repo URL to analyze
   - You want to evaluate actual code quality (not just profile stats)
   - Assessing technical professionalism of a candidate's work
   - NOTE: This takes 1-3 minutes to run as it performs deep analysis.

**General web tools:**
6. **webSearch**: Search the entire web for any content - articles, blog posts, portfolio sites, LinkedIn profiles, personal websites, documentation, etc. Can filter to specific domains or exclude domains. Use this to gather additional information about candidates beyond GitHub.

7. **scrapeUrls**: Scrape and extract content from specific URLs. Use this when you have a candidate's personal website, portfolio, blog, or any other URL you want to analyze.

8. **deepWebSearch**: Multi-step deep web search with AI analysis. Use this for thorough research that requires:
   - Scraping multiple pages
   - AI-synthesized summaries
   - Key themes and entity extraction
   - Follow-up suggestions
   Search types: general, github_profiles, linkedin, portfolio, news, technical.
   NOTE: Takes 30-60 seconds but provides comprehensive analysis.

**Outreach tools:**
9. **generateDraftEmail**: Generate a professional outreach email draft for a candidate. Use this when the user wants to reach out to a candidate. The tool renders an editable email draft UI that the user can customize before sending. IMPORTANT: Do NOT repeat the email draft in text after using this tool - the tool UI displays the draft.

IMPORTANT - Tool-based Results Display:
- When finding developers, ALWAYS use getTopCandidates to display results. The tool renders a beautiful UI with all candidate details.
- Do NOT write text summaries of candidates after the tool call. The tool output IS the presentation.
- When drafting emails, ALWAYS use generateDraftEmail to display the draft. The tool renders an editable email UI. Do NOT repeat the email subject, body, or any email content in text after the tool call.
- Only add brief conversational messages before tool calls (e.g., "Let me search for React developers in London...") or after if needed to clarify or suggest next steps.
- NEVER include image URLs, avatar URLs, or any image markdown in your text responses. The UI handles all visual elements.

Workflow for finding developers:
1. Acknowledge the request briefly
2. Use searchGitHubProfiles to find profiles
3. Immediately use getTopCandidates with the found usernames and requirements extracted from the query
4. After the tool displays results, you may add a brief follow-up like "Would you like me to look into any of these candidates in more detail?" - but do NOT repeat the candidate information in text.

For single profile analysis:
- Use analyzeGitHubProfile - the tool renders a detailed profile card
- Do NOT summarize the profile in text after the tool call

For repository deep-dive analysis:
- When user provides a GitHub repo URL (e.g., "analyze https://github.com/user/repo"), use analyzeGitHubRepository
- Warn the user it takes 1-3 minutes before starting
- The tool renders a comprehensive analysis card with skill level, code quality, and professionalism metrics
- Do NOT repeat the analysis in text after the tool call

For additional research on candidates:
- Use webSearch to find their LinkedIn, personal sites, blog posts, talks, etc.
- Use scrapeUrls to get content from specific URLs mentioned in their GitHub profile or found via webSearch

Be conversational but concise. Let the tool UI do the heavy lifting for displaying data.`;

  const result = streamText({
    model: 'grok-4.1-fast-reasoning',
    system: roastMode ? roastModePrompt : normalPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(10),
    tools: {
      searchGitHubProfiles: tool({
        description: "Search for GitHub profiles using Exa AI. Good for natural language queries like 'rust developers in Sydney'. Use this when you want semantic/natural language search.",
        inputSchema: z.object({
          query: z.string().describe("The search query to find GitHub profiles, e.g. 'rust developers in Sydney' or 'React frontend engineers'"),
        }),
        execute: async ({ query }) => {
          const token = await getGitHubToken();
          return searchGitHubProfiles(query, token);
        },
      }),
      searchGitHubUsers: tool({
        description: "Search GitHub users directly via GitHub's Search API. Supports GitHub's search qualifiers for precise filtering: location:city, language:lang, followers:>N, repos:>N. Use this for structured searches with specific filters.",
        inputSchema: z.object({
          query: z.string().describe("GitHub search query with optional qualifiers, e.g. 'language:rust location:sydney' or 'fullstack developer language:typescript followers:>100'"),
          sort: z.enum(["followers", "repositories", "joined"]).optional().describe("Sort results by: 'followers' (most followed), 'repositories' (most repos), or 'joined' (newest accounts)"),
          order: z.enum(["asc", "desc"]).optional().describe("Sort order: 'desc' for descending (default), 'asc' for ascending"),
          perPage: z.number().optional().describe("Number of results to return (default 20, max 30)"),
        }),
        execute: async ({ query, sort, order, perPage }) => {
          const token = await getGitHubToken();
          return searchGitHubUsersAPI(query, token, { sort, order, perPage });
        },
      }),
      analyzeGitHubProfile: tool({
        description: "Analyze a GitHub profile to get detailed information about a developer including their experience, languages, activity, and top projects.",
        inputSchema: z.object({
          username: z.string().describe("The GitHub username to analyze"),
        }),
        execute: async ({ username }) => {
          const token = await getGitHubToken();
          return analyzeGitHubProfileTool(username, token);
        },
      }),
      getTopCandidates: tool({
        description: "Rank and score multiple GitHub profiles against a hiring brief. Use this after searching to get a ranked list of top candidates with match scores and reasons. Returns the top 5 candidates sorted by score.",
        inputSchema: z.object({
          usernames: z.array(z.string()).describe("Array of GitHub usernames to evaluate"),
          brief: z.object({
            requiredSkills: z.array(z.string()).optional().describe("Required programming languages or technologies, e.g. ['Rust', 'Python', 'TypeScript']"),
            preferredLocation: z.string().optional().describe("Preferred location or region, e.g. 'Sydney' or 'Europe'"),
            projectType: z.string().optional().describe("Type of projects to look for, e.g. 'web', 'machine learning', 'blockchain'"),
          }).describe("The hiring brief with requirements to match candidates against"),
          searchQuery: z.string().optional().describe("The original search query used to find these candidates, for tracking purposes"),
        }),
        execute: async ({ usernames, brief, searchQuery }) => {
          return getTopCandidates(usernames, brief, searchQuery);
        },
      }),
      webSearch: tool({
        description: "Search the web for any content and get scraped results. Use this to find information from any website - articles, documentation, blog posts, portfolio sites, LinkedIn profiles, personal websites, etc. Can filter to specific domains or exclude domains.",
        inputSchema: z.object({
          query: z.string().describe("The search query, e.g. 'best practices for React performance' or 'John Smith software engineer portfolio'"),
          includeDomains: z.array(z.string()).optional().describe("Only include results from these domains, e.g. ['linkedin.com', 'medium.com']"),
          excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains, e.g. ['pinterest.com']"),
          numResults: z.number().optional().describe("Number of results to return (default 10, max 20)"),
          type: z.enum(["keyword", "neural", "auto"]).optional().describe("Search type: 'keyword' for exact matches, 'neural' for semantic search, 'auto' to let Exa decide (default)"),
        }),
        execute: async ({ query, includeDomains, excludeDomains, numResults, type }) => {
          return webSearchAndScrape(query, { includeDomains, excludeDomains, numResults, type });
        },
      }),
      scrapeUrls: tool({
        description: "Scrape and extract content from specific URLs. Use this when you have specific URLs you want to get content from, such as a candidate's personal website, portfolio, blog post, or any other web page.",
        inputSchema: z.object({
          urls: z.array(z.string()).describe("Array of URLs to scrape, e.g. ['https://johndoe.com', 'https://medium.com/@johndoe/my-article']"),
        }),
        execute: async ({ urls }) => {
          return scrapeUrls(urls);
        },
      }),
      generateDraftEmail: tool({
        description: "Generate a professional outreach email draft for a candidate. Use this when the user wants to reach out to, contact, or email a candidate. Returns an editable email that the user can customize before sending via mailto.",
        inputSchema: z.object({
          candidateUsername: z.string().describe("The GitHub username of the candidate"),
          candidateName: z.string().optional().describe("The candidate's display name if known"),
          candidateEmail: z.string().optional().describe("The candidate's email if known from their GitHub profile"),
          role: z.string().describe("The role or position being offered, e.g. 'Senior React Developer'"),
          companyName: z.string().describe("The name of the hiring company"),
          keySkills: z.array(z.string()).optional().describe("Key skills that matched the candidate, e.g. ['React', 'TypeScript', 'Node.js']"),
          personalizedNote: z.string().optional().describe("A personalized note about why this candidate stood out, e.g. mentioning a specific project they worked on"),
          senderName: z.string().optional().describe("The name of the person sending the email"),
          senderTitle: z.string().optional().describe("The title of the person sending the email, e.g. 'Engineering Manager'"),
        }),
        execute: async ({ candidateUsername, candidateName, candidateEmail, role, companyName, keySkills, personalizedNote, senderName, senderTitle }) => {
          const name = candidateName || candidateUsername;
          const firstName = name.split(" ")[0];

          const skillsText = keySkills && keySkills.length > 0
            ? `Your expertise in ${keySkills.slice(0, 3).join(", ")} caught our attention.`
            : "";

          const personalizedText = personalizedNote
            ? `${personalizedNote} `
            : "";

          const senderSignature = senderName
            ? `${senderName}${senderTitle ? `\n${senderTitle}` : ""}\n${companyName}`
            : `The ${companyName} Team`;

          const subject = `Exciting ${role} Opportunity at ${companyName}`;

          const body = `Hi ${firstName},

I came across your GitHub profile and was impressed by your work. ${personalizedText}${skillsText}

We're currently looking for a ${role} to join our team at ${companyName}, and I think you could be a great fit.

I'd love to learn more about your experience and share what we're building. Would you be open to a quick chat?

Looking forward to hearing from you!

Best regards,
${senderSignature}`;

          return {
            candidateUsername,
            candidateName: name,
            candidateEmail: candidateEmail || null,
            subject,
            body,
            role,
            companyName,
          };
        },
      }),
      analyzeGitHubRepository: tool({
        description: `Perform a deep analysis of a GitHub repository to assess the developer's skill level and professionalism. This tool clones the repo into a sandboxed environment and uses AI to analyze:
- Code quality and organization
- Git practices (commit messages, branching)
- Testing and CI/CD setup
- Documentation quality
- Technical complexity
- Skill indicators (positive and negative signals)

Use this when you want to deeply evaluate a candidate's actual code quality, not just their GitHub profile stats. This is especially useful when:
- A candidate has a portfolio repo they want reviewed
- You want to assess code quality beyond star counts
- You need to evaluate technical professionalism
- The user provides a specific repo URL to analyze

NOTE: This analysis takes 1-3 minutes as it runs in a sandboxed environment.`,
        inputSchema: z.object({
          repoUrl: z.string().describe("The GitHub repository URL to analyze, e.g. 'https://github.com/owner/repo'"),
          hiringBrief: z.string().optional().describe("Optional context about what role/skills you're hiring for, to contextualize the analysis"),
        }),
        // Generator function for streaming progress updates to UI
        async *execute({ repoUrl, hiringBrief }): AsyncGenerator<AnalysisProgress, import("@/lib/actions/repo-analyze").RepoAnalysis | { error: string; repoUrl: string }> {
          // Validate authentication first
          const token = await getGitHubToken();
          if (!token) {
            const errorResult = { error: "Authentication required. Please sign in with GitHub.", repoUrl };
            yield { status: 'error' as const, message: errorResult.error, error: errorResult.error };
            return errorResult;
          }

          // Yield: Validating repository
          yield {
            status: 'validating' as const,
            message: `Validating repository URL: ${repoUrl}`,
          };

          // Quick check if the repo exists
          const check = await quickRepoCheck(repoUrl, token);
          if (!check.isValid) {
            const errorResult = { error: check.error || "Invalid repository", repoUrl };
            yield { status: 'error' as const, message: errorResult.error, error: errorResult.error };
            return errorResult;
          }

          // Stream progress from the analysis generator
          try {
            let lastProgress: AnalysisProgress | undefined;

            for await (const progress of analyzeRepositoryWithProgress({
              repoUrl,
              hiringBrief,
              timeout: "5m",
              vcpus: 2,
            })) {
              lastProgress = progress;
              yield progress;
            }

            // Return the final result (just the RepoAnalysis, not the full AnalysisProgress)
            if (lastProgress?.status === 'complete' && lastProgress.result) {
              return lastProgress.result;
            }

            if (lastProgress?.status === 'error') {
              return { error: lastProgress.error || lastProgress.message, repoUrl };
            }

            return { error: 'Analysis failed: No result returned', repoUrl };

          } catch (error) {
            const errorMsg = `Analysis failed: ${error instanceof Error ? error.message : String(error)}`;
            yield { status: 'error' as const, message: errorMsg, error: errorMsg };
            return { error: errorMsg, repoUrl };
          }
        },
      }),
      deepWebSearch: tool({
        description: `Perform a multi-step deep web search with AI-powered analysis. This tool:
1. Searches the web using multiple strategies
2. Scrapes and extracts content from each result
3. Uses AI to analyze and synthesize findings
4. Provides a comprehensive summary with key themes, entities, and insights

Use this instead of the basic webSearch tool when you need:
- Thorough research on a topic
- Analysis of multiple sources
- Extraction of key themes and entities
- AI-synthesized summaries
- Follow-up suggestions

Search types available:
- general: General web search (default)
- github_profiles: Search GitHub profiles only
- linkedin: Search LinkedIn profiles
- portfolio: Search personal websites/portfolios (excludes social media)
- news: Search news articles
- technical: Search technical content (StackOverflow, dev.to, etc.)

NOTE: This search takes 30-60 seconds as it scrapes and analyzes multiple pages.`,
        inputSchema: z.object({
          query: z.string().describe("The search query to research"),
          searchType: z.enum(["general", "github_profiles", "linkedin", "portfolio", "news", "technical"]).optional().describe("Type of search to perform (default: general)"),
          maxResults: z.number().optional().describe("Maximum number of results to analyze (default: 10, max: 15)"),
          includeDomains: z.array(z.string()).optional().describe("Only search these domains"),
          excludeDomains: z.array(z.string()).optional().describe("Exclude these domains from search"),
          context: z.string().optional().describe("Additional context to help the AI understand the search intent"),
        }),
        // Generator function for streaming progress updates to UI
        async *execute({ query, searchType, maxResults, includeDomains, excludeDomains, context }): AsyncGenerator<SearchProgress, import("@/lib/actions/search-agent").SearchAnalysis | { error: string; query: string }> {
          // Stream progress from the search generator
          try {
            let lastProgress: SearchProgress | undefined;

            for await (const progress of searchWithProgress({
              query,
              searchType: searchType || "general",
              maxResults: Math.min(maxResults || 10, 15),
              includeDomains,
              excludeDomains,
              context,
            })) {
              lastProgress = progress;
              yield progress;
            }

            // Return the final result
            if (lastProgress?.status === 'complete' && lastProgress.result) {
              return lastProgress.result;
            }

            if (lastProgress?.status === 'error') {
              return { error: lastProgress.error || lastProgress.message, query };
            }

            return { error: 'Search failed: No result returned', query };

          } catch (error) {
            const errorMsg = `Search failed: ${error instanceof Error ? error.message : String(error)}`;
            yield { status: 'error' as const, message: errorMsg, error: errorMsg, query };
            return { error: errorMsg, query };
          }
        },
      }),
    },
    // onFinish: async (output) => {
    //   console.log(output);
    // },
  });

  return result.toUIMessageStreamResponse();
}
