import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { scoutBriefs, scoutResults } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { getGitHubToken } from "@/lib/github-token";
import { checkRateLimit } from "@/lib/redis";
import { addSonarResult, markBriefSearched } from "@/lib/actions/sonar";
import Exa from "exa-js";
import { calculateTopLanguages } from "@/lib/github";

const exa = new Exa(process.env.EXA_API_KEY);

interface GitHubRepo {
  name: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  size: number;
  updated_at: string;
  topics?: string[];
}

interface GitHubEvent {
  type: string;
  created_at: string;
}

function getGitHubHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function analyzeProfile(username: string, token: string | null) {
  const headers = getGitHubHeaders(token);

  try {
    const [profileRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers, next: { revalidate: 300 } }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`, { headers, next: { revalidate: 300 } }),
      fetch(`https://api.github.com/users/${username}/events?per_page=100`, { headers, next: { revalidate: 60 } }),
    ]);

    if (!profileRes.ok) {
      return null;
    }

    const profile = await profileRes.json();
    const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];
    const events: GitHubEvent[] = eventsRes.ok ? await eventsRes.json() : [];

    const now = new Date();
    const createdAt = new Date(profile.created_at);
    const accountAge = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;

    const ownRepos = repos.filter((r) => !r.fork);
    const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);

    const languages = calculateTopLanguages(repos);

    const allTopics = new Set<string>();
    for (const repo of ownRepos) {
      if (repo.topics) {
        repo.topics.forEach((t) => allTopics.add(t));
      }
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents30 = events.filter((e) => new Date(e.created_at) > thirtyDaysAgo).length;

    let activityLevel = "inactive";
    if (recentEvents30 >= 50) activityLevel = "very_active";
    else if (recentEvents30 >= 20) activityLevel = "active";
    else if (recentEvents30 >= 5) activityLevel = "moderate";
    else if (recentEvents30 >= 1) activityLevel = "low";

    const recentlyActiveRepos = ownRepos.filter((r) => new Date(r.updated_at) > thirtyDaysAgo).length;

    return {
      username: profile.login,
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      followers: profile.followers,
      public_repos: profile.public_repos,
      accountAge,
      totalStars,
      languages,
      topics: Array.from(allTopics),
      activityLevel,
      recentlyActiveRepos,
      signals: {
        isHireable: profile.hireable === true,
        hasEmail: !!profile.email,
        hasBio: !!profile.bio,
        hasWebsite: !!profile.blog,
      },
    };
  } catch {
    return null;
  }
}

function scoreCandidate(
  profile: NonNullable<Awaited<ReturnType<typeof analyzeProfile>>>,
  brief: { requiredSkills?: string[] | null; preferredLocation?: string | null; projectType?: string | null }
) {
  let score = 50;
  const matchReasons: string[] = [];
  const concerns: string[] = [];

  // Score based on required skills
  if (brief.requiredSkills && brief.requiredSkills.length > 0) {
    const userLanguages = profile.languages.map((l) => l.name.toLowerCase());
    const userTopics = profile.topics.map((t) => t.toLowerCase());
    const allSkills = [...userLanguages, ...userTopics];

    const matchedSkills = brief.requiredSkills.filter((skill) =>
      allSkills.some((s) => s.includes(skill.toLowerCase()) || skill.toLowerCase().includes(s))
    );

    if (matchedSkills.length > 0) {
      const skillBonus = Math.min(matchedSkills.length * 8, 25);
      score += skillBonus;
      matchReasons.push(`Knows ${matchedSkills.join(", ")}`);

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

  // Score based on account maturity
  if (profile.accountAge >= 5 && profile.public_repos >= 20) {
    score += 12;
    matchReasons.push(`${profile.accountAge}+ years on GitHub with ${profile.public_repos} repos`);
  } else if (profile.accountAge >= 3 && profile.public_repos >= 10) {
    score += 8;
  } else if (profile.accountAge >= 1 && profile.public_repos >= 5) {
    score += 4;
  }

  // Score based on activity level
  switch (profile.activityLevel) {
    case "very_active":
      score += 15;
      matchReasons.push("Very active contributor");
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

  // Score based on stars
  if (profile.totalStars >= 1000) {
    score += 18;
    matchReasons.push(`${profile.totalStars.toLocaleString()} total stars`);
  } else if (profile.totalStars >= 100) {
    score += 10;
    matchReasons.push(`${profile.totalStars} stars on projects`);
  } else if (profile.totalStars >= 10) {
    score += 4;
  }

  // Score based on followers
  if (profile.followers >= 1000) {
    score += 8;
    matchReasons.push(`${profile.followers.toLocaleString()} followers`);
  } else if (profile.followers >= 100) {
    score += 4;
  }

  // Check project type
  if (brief.projectType) {
    const projectTypeLower = brief.projectType.toLowerCase();
    const topicMatch = profile.topics.some((t) => t.toLowerCase().includes(projectTypeLower));

    if (topicMatch) {
      score += 10;
      matchReasons.push(`Has relevant ${brief.projectType} projects`);
    }
  }

  // Hirability signals
  if (profile.signals.isHireable) {
    score += 5;
    matchReasons.push("Open to opportunities");
  }
  if (!profile.signals.hasBio && !profile.signals.hasWebsite) {
    concerns.push("Limited profile information");
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    matchReasons,
    concerns,
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rate limiting: 5 sonar searches per minute
  const rateLimit = await checkRateLimit(`sonar:search:${user.id}`, 5, 60);
  if (!rateLimit.success) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const { briefId } = await req.json();

  if (!briefId) {
    return new Response(
      JSON.stringify({ error: "Brief ID required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get the brief and verify ownership
  const [brief] = await db
    .select()
    .from(scoutBriefs)
    .where(and(eq(scoutBriefs.id, briefId), eq(scoutBriefs.authUserId, user.id)));

  if (!brief) {
    return new Response(
      JSON.stringify({ error: "Brief not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = await getGitHubToken();

  try {
    // Get existing usernames for this brief to avoid duplicates
    const existingResults = await db
      .select({ githubUsername: scoutResults.githubUsername })
      .from(scoutResults)
      .where(eq(scoutResults.briefId, briefId));

    const existingUsernames = new Set(existingResults.map((r) => r.githubUsername.toLowerCase()));

    // Build search queries based on the brief
    const searchQueries: string[] = [];

    // Main query from description
    if (brief.description) {
      searchQueries.push(`${brief.description.slice(0, 200)} site:github.com`);
    }

    // Skills-based queries
    if (brief.requiredSkills && brief.requiredSkills.length > 0) {
      const skills = brief.requiredSkills.slice(0, 3).join(" ");
      const locationPart = brief.preferredLocation ? ` ${brief.preferredLocation}` : "";
      searchQueries.push(`${skills} developer${locationPart} site:github.com`);
    }

    // Location + project type query
    if (brief.preferredLocation && brief.projectType) {
      searchQueries.push(`${brief.projectType} developer ${brief.preferredLocation} site:github.com`);
    }

    // Perform searches
    const allProfiles: string[] = [];

    for (const query of searchQueries.slice(0, 3)) {
      try {
        const result = await exa.search(query, {
          numResults: 20,
          includeDomains: ["github.com"],
        });

        for (const r of result.results) {
          const match = r.url.match(/^https?:\/\/github\.com\/([^\/]+)\/?$/);
          if (match && !["orgs", "topics", "trending", "explore", "settings", "notifications", "new", "login", "join"].includes(match[1])) {
            const username = match[1];
            if (!existingUsernames.has(username.toLowerCase()) && !allProfiles.includes(username)) {
              allProfiles.push(username);
            }
          }
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }

    // Analyze and score profiles
    const candidates: Array<{
      username: string;
      name?: string | null;
      bio?: string | null;
      location?: string | null;
      score: number;
      matchReasons: string[];
      concerns: string[];
      topLanguages: string[];
      totalStars: number;
      followers: number;
      repoCount: number;
    }> = [];

    for (const username of allProfiles.slice(0, 20)) {
      const profile = await analyzeProfile(username, token);
      if (!profile) continue;

      const { score, matchReasons, concerns } = scoreCandidate(profile, brief);

      // Only include candidates with a reasonable score
      if (score >= 35) {
        candidates.push({
          username: profile.username,
          name: profile.name,
          bio: profile.bio,
          location: profile.location,
          score,
          matchReasons,
          concerns,
          topLanguages: profile.languages.slice(0, 5).map((l) => l.name),
          totalStars: profile.totalStars,
          followers: profile.followers,
          repoCount: profile.public_repos,
        });
      }
    }

    // Sort by score and save top results
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, 10);

    for (const candidate of topCandidates) {
      await addSonarResult(briefId, candidate, brief.description || undefined);
    }

    // Mark brief as searched
    await markBriefSearched(briefId);

    return new Response(
      JSON.stringify({
        success: true,
        newCandidates: topCandidates.length,
        searchedProfiles: allProfiles.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sonar search error:", error);
    return new Response(
      JSON.stringify({ error: "Search failed. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
