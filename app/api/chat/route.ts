import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { calculateTopLanguages } from "@/lib/github";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { searchHistory } from "@/src/db/schema";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

// Get GitHub token from user's OAuth session or environment variable
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

  // Fall back to environment variable for unauthenticated requests
  return process.env.GITHUB_TOKEN || null;
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

    // Experience estimation - improved heuristics
    let estimatedExperience = "Entry-level (0-2 years)";
    const hasSignificantProjects = totalStars >= 50 || ownRepos.some((r) => r.stargazers_count >= 20);
    const hasVariedLanguages = languages.length >= 3;

    if (accountAge >= 8 && ownRepos.length >= 40 && hasSignificantProjects) {
      estimatedExperience = "Senior (8+ years)";
    } else if (accountAge >= 5 && ownRepos.length >= 25 && hasVariedLanguages) {
      estimatedExperience = "Mid-level (5-8 years)";
    } else if (accountAge >= 2 && ownRepos.length >= 10) {
      estimatedExperience = "Junior (2-5 years)";
    }

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
      estimatedExperience,
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

// Exa search tool for finding GitHub profiles
async function searchGitHubProfiles(query: string) {
  try {
    const result = await exa.searchAndContents(query, {
      numResults: 20,
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
  experience: string;
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
    minExperience?: string;
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
          profile.recentlyActiveRepos === undefined || !profile.estimatedExperience ||
          !profile.activityLevel) {
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

      // Score based on experience
      if (brief.minExperience) {
        const expLevels = ["Entry-level", "Junior", "Mid-level", "Senior"];
        const requiredLevel = expLevels.findIndex((l) => brief.minExperience?.toLowerCase().includes(l.toLowerCase()));
        const actualLevel = expLevels.findIndex((l) => profile.estimatedExperience.includes(l));

        if (actualLevel >= requiredLevel) {
          score += 12;
          matchReasons.push(`${profile.estimatedExperience}`);
        } else if (actualLevel === requiredLevel - 1) {
          // Close to requirement
          concerns.push(`Experience slightly below requirement (${profile.estimatedExperience})`);
        } else {
          score -= 10;
          concerns.push(`Experience level below requirement`);
        }
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
        experience: profile.estimatedExperience,
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
  const { messages } = await req.json();

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  const result = streamText({
    model: 'xai/grok-4.1-fast-reasoning',
    system: `You are GitSignal AI, a helpful assistant for hiring managers looking to find and evaluate developers.

You have access to three tools:
1. **searchGitHubProfiles**: Search for GitHub profiles based on natural language queries like "rust developers in Sydney" or "machine learning engineers". Uses Exa AI to find relevant GitHub profiles.

2. **analyzeGitHubProfile**: Get detailed analysis of a specific GitHub user by username.

3. **getTopCandidates**: Rank and score multiple GitHub profiles against a hiring brief. This displays a rich UI card for each candidate showing their score, match reasons, concerns, languages, and top repos.

IMPORTANT - Tool-based Results Display:
- When finding developers, ALWAYS use getTopCandidates to display results. The tool renders a beautiful UI with all candidate details.
- Do NOT write text summaries of candidates after the tool call. The tool output IS the presentation.
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

Be conversational but concise. Let the tool UI do the heavy lifting for displaying data.`,
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
            minExperience: z.string().optional().describe("Minimum experience level: 'Entry-level', 'Junior', 'Mid-level', or 'Senior'"),
            projectType: z.string().optional().describe("Type of projects to look for, e.g. 'web', 'machine learning', 'blockchain'"),
          }).describe("The hiring brief with requirements to match candidates against"),
          searchQuery: z.string().optional().describe("The original search query used to find these candidates, for tracking purposes"),
        }),
        execute: async ({ usernames, brief, searchQuery }) => {
          return getTopCandidates(usernames, brief, searchQuery);
        },
      }),
    },
    onFinish: async (output) => {
      console.log(output);
    },
  });

  return result.toUIMessageStreamResponse();
}
