"use server";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getGitHubToken } from "@/lib/github-token";

export interface GitHubProfile {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  topics: string[];
  fork: boolean;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
  };
  actor?: {
    login: string;
    avatar_url: string;
  };
  payload?: {
    pull_request?: {
      user: {
        login: string;
        avatar_url: string;
      };
    };
    issue?: {
      user: {
        login: string;
        avatar_url: string;
      };
    };
  };
}

export interface Collaborator {
  login: string;
  avatar_url: string;
  type: "contributor" | "org" | "following" | "follower";
  relationship: string;
  repoName?: string;
  degree: number; // 1 = direct connection, 2 = connection of connection
  connectedVia?: string; // For 2nd degree, who they're connected through
}

export interface RepoNode {
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  language: string | null;
  owner: string;
  isFork?: boolean;
}

export interface CollaborationData {
  collaborators: Collaborator[];
  repos: RepoNode[];
  organizations: Array<{
    login: string;
    avatar_url: string;
    description: string | null;
  }>;
  connections: Array<{
    source: string;
    target: string;
    type: "org" | "contributor" | "repo";
  }>;
}

export interface AnalysisResult {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  events: GitHubEvent[];
  collaboration: CollaborationData;
  analysis: {
    accountAge: number; // years
    totalStars: number;
    totalForks: number;
    languages: { name: string; count: number; percentage: number }[];
    topRepos: GitHubRepo[];
    activityLevel: "very_active" | "active" | "moderate" | "low" | "inactive";
    lastActivityDays: number;
    averageRepoAge: number;
    hasReadme: boolean;
    topTopics: string[];
    contributionPattern: string;
    estimatedExperience: string;
    strengths: string[];
    concerns: string[];
    overallScore: number; // 0-100
    recommendation: "strong" | "good" | "moderate" | "weak";
  };
}

async function fetchGitHub<T>(endpoint: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("User not found");
    }
    if (response.status === 401) {
      throw new Error("GitHub session expired. Please sign out and sign back in to refresh your GitHub access.");
    }
    if (response.status === 403) {
      throw new Error("Rate limit exceeded. Please sign in with GitHub for higher limits.");
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

// GraphQL API for efficient batch queries
interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

async function fetchGitHubGraphQL<T>(query: string, variables: Record<string, unknown>, token: string | null): Promise<T> {
  if (!token) {
    throw new Error("GraphQL API requires authentication. Please sign in with GitHub.");
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("GitHub session expired. Please sign out and sign back in to refresh your GitHub access.");
    }
    if (response.status === 403) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(`GitHub GraphQL API error: ${response.status}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

function calculateLanguages(repos: GitHubRepo[]): { name: string; count: number; percentage: number }[] {
  const languageCounts: Record<string, number> = {};
  let total = 0;

  for (const repo of repos) {
    if (repo.language && !repo.fork) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      total++;
    }
  }

  return Object.entries(languageCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function calculateActivityLevel(events: GitHubEvent[], lastPush: Date | null): AnalysisResult["analysis"]["activityLevel"] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentEvents = events.filter(e => new Date(e.created_at) > thirtyDaysAgo).length;

  if (recentEvents >= 50) return "very_active";
  if (recentEvents >= 20) return "active";
  if (recentEvents >= 5) return "moderate";
  if (recentEvents >= 1) return "low";
  return "inactive";
}


// Schema for LLM-based profile analysis
const llmAnalysisSchema = z.object({
  estimatedExperience: z.enum([
    "Entry-level (0-2 years)",
    "Junior (2-5 years)",
    "Mid-level (5-8 years)",
    "Senior (8+ years)"
  ]).describe("Estimated years of professional experience based on account age, project complexity, and contribution patterns"),

  contributionPattern: z.string().describe("A brief description of how this developer typically contributes (e.g., 'Code-focused', 'Collaborative via PRs', 'Community-oriented')"),

  strengths: z.array(z.string()).describe("Key strengths identified from their GitHub activity, projects, and profile. Be specific and evidence-based."),

  concerns: z.array(z.string()).describe("Potential concerns or areas for follow-up during hiring. Only include if there's actual evidence."),

  overallScore: z.number().describe("Overall candidate score from 0-100 based on activity, project quality, experience signals, and profile completeness"),

  recommendation: z.enum(["strong", "good", "moderate", "weak"]).describe("Hiring recommendation based on overall assessment"),

  summary: z.string().describe("A 2-3 sentence summary of this candidate suitable for a hiring manager"),
});

type LLMAnalysis = z.infer<typeof llmAnalysisSchema>;

// Perform LLM-based analysis of a GitHub profile
async function performLLMAnalysis(
  profile: GitHubProfile,
  repos: GitHubRepo[],
  events: GitHubEvent[],
  metrics: {
    accountAge: number;
    totalStars: number;
    totalForks: number;
    languages: { name: string; count: number; percentage: number }[];
    topTopics: string[];
    activityLevel: string;
    lastActivityDays: number;
  }
): Promise<LLMAnalysis> {
  const topRepos = [...repos]
    .filter(r => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 8);

  const recentEvents = events.slice(0, 30);
  const eventTypes = recentEvents.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const prompt = `Analyze this GitHub profile for hiring purposes:

**Profile:**
- Username: ${profile.login}
- Name: ${profile.name || "Not provided"}
- Bio: ${profile.bio || "Not provided"}
- Location: ${profile.location || "Not provided"}
- Company: ${profile.company || "Not provided"}
- Followers: ${profile.followers}
- Following: ${profile.following}
- Public repos: ${profile.public_repos}
- Account created: ${profile.created_at} (${metrics.accountAge.toFixed(1)} years ago)

**Activity Metrics:**
- Activity level: ${metrics.activityLevel}
- Days since last activity: ${metrics.lastActivityDays}
- Total stars across repos: ${metrics.totalStars}
- Total forks: ${metrics.totalForks}
- Recent event breakdown: ${JSON.stringify(eventTypes)}

**Top Languages (by repo count):**
${metrics.languages.slice(0, 6).map(l => `- ${l.name}: ${l.percentage}%`).join("\n")}

**Top Topics/Tags:**
${metrics.topTopics.slice(0, 10).join(", ") || "None"}

**Top Repositories:**
${topRepos.map(r => `- ${r.name}: ${r.description || "No description"} (⭐${r.stargazers_count}, ${r.language || "Unknown lang"})`).join("\n")}

Provide a thorough but fair assessment. Base your analysis on actual evidence from the profile. Don't penalize for things that might just be private (e.g., contributions to private repos won't show).`;

  const { object } = await generateObject({
    model: "grok-4.1-fast-reasoning",
    schema: llmAnalysisSchema,
    prompt,
  });

  return object;
}

// GraphQL query for fetching collaboration data efficiently in a single request
// Note: We don't fetch organizations here as it requires read:org scope
// Organizations are fetched separately via REST API
const COLLABORATION_QUERY = `
  query GetUserCollaboration($username: String!, $repoCount: Int!, $contributorCount: Int!) {
    user(login: $username) {
      login
      avatarUrl
      repositories(first: $repoCount, orderBy: {field: STARGAZERS, direction: DESC}, ownerAffiliations: OWNER) {
        nodes {
          name
          nameWithOwner
          description
          stargazerCount
          forkCount
          isFork
          primaryLanguage {
            name
          }
          mentionableUsers(first: $contributorCount) {
            nodes {
              login
              avatarUrl
            }
          }
        }
      }
      repositoriesContributedTo(first: 30, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE], orderBy: {field: STARGAZERS, direction: DESC}) {
        nodes {
          name
          nameWithOwner
          description
          stargazerCount
          primaryLanguage {
            name
          }
          owner {
            login
            avatarUrl
          }
        }
      }
    }
  }
`;

interface GraphQLCollaborationResponse {
  user: {
    login: string;
    avatarUrl: string;
    repositories: {
      nodes: Array<{
        name: string;
        nameWithOwner: string;
        description: string | null;
        stargazerCount: number;
        forkCount: number;
        isFork: boolean;
        primaryLanguage: { name: string } | null;
        mentionableUsers: {
          nodes: Array<{
            login: string;
            avatarUrl: string;
          }>;
        };
      }>;
    };
    repositoriesContributedTo: {
      nodes: Array<{
        name: string;
        nameWithOwner: string;
        description: string | null;
        stargazerCount: number;
        primaryLanguage: { name: string } | null;
        owner: {
          login: string;
          avatarUrl: string;
        };
      }>;
    };
  };
}

async function fetchCollaborationDataGraphQL(
  username: string,
  token: string
): Promise<CollaborationData> {
  const collaborators: Collaborator[] = [];
  const repoNodes: RepoNode[] = [];
  const connections: CollaborationData["connections"] = [];
  const seenUsers = new Set<string>();
  const seenRepos = new Set<string>();
  seenUsers.add(username.toLowerCase());

  // Fetch GraphQL data and organizations (via REST) in parallel
  const [data, orgsFromRest] = await Promise.all([
    fetchGitHubGraphQL<GraphQLCollaborationResponse>(
      COLLABORATION_QUERY,
      { username, repoCount: 30, contributorCount: 20 },
      token
    ),
    // Fetch orgs via REST since GraphQL requires read:org scope
    fetchGitHub<Array<{ login: string; avatar_url: string; description: string | null }>>(
      `/users/${username}/orgs`,
      token
    ).catch(() => [] as Array<{ login: string; avatar_url: string; description: string | null }>),
  ]);

  const user = data.user;
  const organizations: CollaborationData["organizations"] = [];

  // Process organizations from REST API
  for (const org of orgsFromRest) {
    organizations.push({
      login: org.login,
      avatar_url: org.avatar_url,
      description: org.description,
    });

    if (!seenUsers.has(org.login.toLowerCase())) {
      seenUsers.add(org.login.toLowerCase());
      collaborators.push({
        login: org.login,
        avatar_url: org.avatar_url,
        type: "org",
        relationship: "Member of organization",
        degree: 1,
      });
      connections.push({
        source: username,
        target: org.login,
        type: "org",
      });
    }
  }

  // Process owned repositories and their contributors
  // If > 4 repos, filter out forks and repos with no contributors, sorted by stars
  let ownedRepos = user.repositories.nodes;

  if (ownedRepos.length > 4) {
    // Filter: keep repos that have contributors OR are not forks
    // Then prioritize repos with contributors and sort by stars
    const reposWithContributorInfo = ownedRepos.map(repo => {
      const hasContributors = repo.mentionableUsers.nodes.some(
        c => c.login.toLowerCase() !== username.toLowerCase()
      );
      return { repo, hasContributors };
    });

    // Filter out forks with no contributors
    const filteredRepos = reposWithContributorInfo.filter(
      ({ repo, hasContributors }) => hasContributors || !repo.isFork
    );

    // Sort by: has contributors first, then by stars
    filteredRepos.sort((a, b) => {
      // Repos with contributors come first
      if (a.hasContributors && !b.hasContributors) return -1;
      if (!a.hasContributors && b.hasContributors) return 1;
      // Then sort by stars
      return b.repo.stargazerCount - a.repo.stargazerCount;
    });

    ownedRepos = filteredRepos.map(({ repo }) => repo);
  }

  for (const repo of ownedRepos) {
    if (seenRepos.has(repo.nameWithOwner.toLowerCase())) continue;
    seenRepos.add(repo.nameWithOwner.toLowerCase());

    // Add all repos, not just those with collaborators
    repoNodes.push({
      name: repo.name,
      full_name: repo.nameWithOwner,
      description: repo.description,
      stars: repo.stargazerCount,
      language: repo.primaryLanguage?.name || null,
      owner: username,
      isFork: repo.isFork,
    });

    connections.push({
      source: username,
      target: `repo:${repo.nameWithOwner}`,
      type: "repo",
    });

    // Add contributors if any
    const otherContributors = repo.mentionableUsers.nodes.filter(
      c => c.login.toLowerCase() !== username.toLowerCase()
    );

    for (const contributor of otherContributors) {
      connections.push({
        source: `repo:${repo.nameWithOwner}`,
        target: contributor.login,
        type: "contributor",
      });

      if (!seenUsers.has(contributor.login.toLowerCase())) {
        seenUsers.add(contributor.login.toLowerCase());
        collaborators.push({
          login: contributor.login,
          avatar_url: contributor.avatarUrl,
          type: "contributor",
          relationship: `Contributed to ${repo.name}`,
          repoName: repo.name,
          degree: 1,
        });
      }
    }
  }

  // Process repositories the user contributed to (external collaborations)
  for (const repo of user.repositoriesContributedTo.nodes) {
    if (repo.owner.login.toLowerCase() === username.toLowerCase()) continue;
    if (seenRepos.has(repo.nameWithOwner.toLowerCase())) continue;

    seenRepos.add(repo.nameWithOwner.toLowerCase());

    repoNodes.push({
      name: repo.name,
      full_name: repo.nameWithOwner,
      description: repo.description,
      stars: repo.stargazerCount,
      language: repo.primaryLanguage?.name || null,
      owner: repo.owner.login,
    });

    connections.push({
      source: username,
      target: `repo:${repo.nameWithOwner}`,
      type: "contributor",
    });

    // Add repo owner as collaborator
    if (!seenUsers.has(repo.owner.login.toLowerCase())) {
      seenUsers.add(repo.owner.login.toLowerCase());
      collaborators.push({
        login: repo.owner.login,
        avatar_url: repo.owner.avatarUrl,
        type: "contributor",
        relationship: `Owner of ${repo.name}`,
        repoName: repo.name,
        degree: 1,
      });
    }

    connections.push({
      source: `repo:${repo.nameWithOwner}`,
      target: repo.owner.login,
      type: "repo",
    });
  }

  return {
    collaborators,
    repos: repoNodes,
    organizations,
    connections,
  };
}

// Fallback REST API implementation for unauthenticated users
async function fetchCollaborationDataREST(
  username: string,
  repos: GitHubRepo[],
  token: string | null
): Promise<CollaborationData> {
  const collaborators: Collaborator[] = [];
  const repoNodes: RepoNode[] = [];
  const connections: CollaborationData["connections"] = [];
  const seenUsers = new Set<string>();
  const seenRepos = new Set<string>();
  seenUsers.add(username.toLowerCase());

  // Fetch organizations
  let organizations: CollaborationData["organizations"] = [];
  try {
    organizations = await fetchGitHub<CollaborationData["organizations"]>(
      `/users/${username}/orgs`,
      token
    );
  } catch {
    // Orgs may not be accessible
  }

  // Add orgs as 1st degree collaborators
  for (const org of organizations) {
    if (!seenUsers.has(org.login.toLowerCase())) {
      seenUsers.add(org.login.toLowerCase());
      collaborators.push({
        login: org.login,
        avatar_url: org.avatar_url,
        type: "org",
        relationship: "Member of organization",
        degree: 1,
      });
      connections.push({
        source: username,
        target: org.login,
        type: "org",
      });
    }
  }

  // Get repos sorted by stars
  const sortedRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);

  // Fetch contributors from repos in parallel - increased to 15 per repo
  const contributorPromises = sortedRepos.slice(0, 30).map(async (repo) => {
    try {
      const contributors = await fetchGitHub<Array<{ login: string; avatar_url: string; contributions: number }>>(
        `/repos/${repo.full_name}/contributors?per_page=15`,
        token
      );
      return { repo, contributors };
    } catch {
      return { repo, contributors: [] };
    }
  });

  const repoContributors = await Promise.all(contributorPromises);

  // If > 4 repos, filter out forks and repos with no contributors, sorted by stars
  let filteredRepoContributors = repoContributors;

  if (repoContributors.length > 4) {
    // Annotate with contributor info
    const annotated = repoContributors.map(({ repo, contributors }) => {
      const hasContributors = contributors.some(
        c => c.login.toLowerCase() !== username.toLowerCase() && c.contributions >= 1
      );
      return { repo, contributors, hasContributors };
    });

    // Filter out forks with no contributors
    const filtered = annotated.filter(
      ({ repo, hasContributors }) => hasContributors || !repo.fork
    );

    // Sort by: has contributors first, then by stars
    filtered.sort((a, b) => {
      if (a.hasContributors && !b.hasContributors) return -1;
      if (!a.hasContributors && b.hasContributors) return 1;
      return b.repo.stargazers_count - a.repo.stargazers_count;
    });

    filteredRepoContributors = filtered;
  }

  // Process repos and their contributors
  for (const { repo, contributors } of filteredRepoContributors) {
    const otherContributors = contributors.filter(
      c => c.login.toLowerCase() !== username.toLowerCase() && c.contributions >= 1
    );

    if (otherContributors.length > 0 && !seenRepos.has(repo.full_name.toLowerCase())) {
      seenRepos.add(repo.full_name.toLowerCase());

      repoNodes.push({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        owner: username,
        isFork: repo.fork,
      });

      connections.push({
        source: username,
        target: `repo:${repo.full_name}`,
        type: "repo",
      });

      // Increased limit to 10 contributors per repo
      for (const contributor of otherContributors.slice(0, 10)) {
        connections.push({
          source: `repo:${repo.full_name}`,
          target: contributor.login,
          type: "contributor",
        });

        if (!seenUsers.has(contributor.login.toLowerCase())) {
          seenUsers.add(contributor.login.toLowerCase());
          collaborators.push({
            login: contributor.login,
            avatar_url: contributor.avatar_url,
            type: "contributor",
            relationship: `Contributed to ${repo.name}`,
            repoName: repo.name,
            degree: 1,
          });
        }
      }
    }
  }

  return {
    collaborators,
    repos: repoNodes,
    organizations,
    connections,
  };
}

// Main function that chooses GraphQL or REST based on token availability
async function fetchCollaborationData(
  username: string,
  repos: GitHubRepo[],
  token: string | null
): Promise<CollaborationData> {
  // Use GraphQL API if authenticated (more efficient - single request)
  if (token) {
    try {
      return await fetchCollaborationDataGraphQL(username, token);
    } catch (error) {
      // Fall back to REST if GraphQL fails (e.g., missing scopes like read:org)
      // Only log non-scope related errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("required scopes")) {
        console.warn("GraphQL failed, falling back to REST:", error);
      }
    }
  }

  // Fall back to REST API for unauthenticated users or if GraphQL fails
  return fetchCollaborationDataREST(username, repos, token);
}

export async function analyzeGitHubProfile(username: string): Promise<AnalysisResult> {
  const token = await getGitHubToken();

  // Fetch basic data in parallel
  const [profile, repos, events] = await Promise.all([
    fetchGitHub<GitHubProfile>(`/users/${username}`, token),
    fetchGitHub<GitHubRepo[]>(`/users/${username}/repos?per_page=100&sort=updated`, token),
    fetchGitHub<GitHubEvent[]>(`/users/${username}/events?per_page=100`, token),
  ]);

  // Fetch collaboration data (depends on repos)
  const collaboration = await fetchCollaborationData(username, repos, token);

  // Calculate metrics
  const now = new Date();
  const createdAt = new Date(profile.created_at);
  const accountAge = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365);

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForks = repos.reduce((sum, r) => sum + r.forks_count, 0);

  const languages = calculateLanguages(repos);

  const topRepos = [...repos]
    .filter(r => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);

  const lastPush = repos[0] ? new Date(repos[0].pushed_at) : null;
  const activityLevel = calculateActivityLevel(events, lastPush);

  const lastEvent = events[0] ? new Date(events[0].created_at) : null;
  const lastActivityDays = lastEvent
    ? Math.floor((now.getTime() - lastEvent.getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const repoAges = repos.map(r => (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365));
  const averageRepoAge = repoAges.length > 0 ? repoAges.reduce((a, b) => a + b, 0) / repoAges.length : 0;

  const allTopics = repos.flatMap(r => r.topics || []);
  const topicCounts: Record<string, number> = {};
  allTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic]) => topic);

  // Perform LLM-based analysis
  const llmAnalysis = await performLLMAnalysis(profile, repos, events, {
    accountAge,
    totalStars,
    totalForks,
    languages,
    topTopics,
    activityLevel,
    lastActivityDays,
  });

  return {
    profile,
    repos,
    events,
    collaboration,
    analysis: {
      accountAge: Math.round(accountAge * 10) / 10,
      totalStars,
      totalForks,
      languages,
      topRepos,
      activityLevel,
      lastActivityDays,
      averageRepoAge: Math.round(averageRepoAge * 10) / 10,
      hasReadme: repos.some(r => r.description && r.description.length > 0),
      topTopics,
      contributionPattern: llmAnalysis.contributionPattern,
      estimatedExperience: llmAnalysis.estimatedExperience,
      strengths: llmAnalysis.strengths,
      concerns: llmAnalysis.concerns,
      overallScore: llmAnalysis.overallScore,
      recommendation: llmAnalysis.recommendation,
    },
  };
}

// Lightweight function to fetch just collaboration data for network graph navigation
export async function fetchUserCollaboration(username: string): Promise<{
  profile: GitHubProfile;
  collaboration: CollaborationData;
}> {
  const token = await getGitHubToken();

  // Fetch profile and repos in parallel
  const [profile, repos] = await Promise.all([
    fetchGitHub<GitHubProfile>(`/users/${username}`, token),
    fetchGitHub<GitHubRepo[]>(`/users/${username}/repos?per_page=50&sort=updated`, token),
  ]);

  // Fetch collaboration data
  const collaboration = await fetchCollaborationData(username, repos, token);

  return { profile, collaboration };
}
