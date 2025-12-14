"use server";

import { createClient } from "@/lib/supabase/server";

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

async function getGitHubToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.provider_token) {
    return session.provider_token;
  }

  // Fall back to environment variable for unauthenticated requests
  return process.env.GITHUB_TOKEN || null;
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
      throw new Error("Authentication required for GraphQL API.");
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

function estimateExperience(accountAge: number, repos: GitHubRepo[], profile: GitHubProfile): string {
  const factors = {
    accountAge,
    repoCount: repos.length,
    totalStars: repos.reduce((sum, r) => sum + r.stargazers_count, 0),
    followers: profile.followers,
  };

  if (factors.accountAge >= 8 && factors.repoCount >= 50 && factors.totalStars >= 100) {
    return "Senior (8+ years)";
  }
  if (factors.accountAge >= 5 && factors.repoCount >= 30) {
    return "Mid-level (5-8 years)";
  }
  if (factors.accountAge >= 2 && factors.repoCount >= 10) {
    return "Junior (2-5 years)";
  }
  return "Entry-level (0-2 years)";
}

function identifyStrengths(repos: GitHubRepo[], languages: { name: string; percentage: number }[], profile: GitHubProfile): string[] {
  const strengths: string[] = [];

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  if (totalStars >= 100) strengths.push("Popular open source projects");
  if (totalStars >= 10) strengths.push("Community recognition (starred projects)");

  if (profile.followers >= 100) strengths.push("Strong developer following");
  if (profile.followers >= 20) strengths.push("Active community presence");

  if (languages.length >= 5) strengths.push("Versatile (multiple languages)");
  if (languages.some(l => ["TypeScript", "Rust", "Go"].includes(l.name))) {
    strengths.push("Modern language adoption");
  }

  const originalRepos = repos.filter(r => !r.fork);
  if (originalRepos.length >= 20) strengths.push("Prolific project creator");

  const documentedRepos = repos.filter(r => r.description && r.description.length > 20);
  if (documentedRepos.length >= repos.length * 0.5) {
    strengths.push("Good documentation practices");
  }

  const topicRepos = repos.filter(r => r.topics && r.topics.length > 0);
  if (topicRepos.length >= repos.length * 0.3) {
    strengths.push("Well-organized repositories");
  }

  return strengths.slice(0, 5);
}

function identifyConcerns(repos: GitHubRepo[], events: GitHubEvent[], profile: GitHubProfile, accountAge: number): string[] {
  const concerns: string[] = [];

  // Check for inactivity
  const now = new Date();
  const lastEvent = events[0] ? new Date(events[0].created_at) : null;
  if (lastEvent) {
    const daysSinceActivity = Math.floor((now.getTime() - lastEvent.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity > 180) concerns.push("No activity in 6+ months");
    else if (daysSinceActivity > 90) concerns.push("Limited recent activity (90+ days)");
  }

  // Check for mostly forks
  const forkRatio = repos.filter(r => r.fork).length / repos.length;
  if (forkRatio > 0.7) concerns.push("Mostly forked repositories (limited original work)");

  // Check for empty/abandoned repos
  const abandonedRepos = repos.filter(r => {
    const lastPush = new Date(r.pushed_at);
    const repoAge = (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365);
    return repoAge > 1 && r.stargazers_count === 0 && !r.description;
  });
  if (abandonedRepos.length > repos.length * 0.5) {
    concerns.push("Many incomplete/abandoned projects");
  }

  // Check for lack of documentation
  const undocumented = repos.filter(r => !r.description);
  if (undocumented.length > repos.length * 0.7) {
    concerns.push("Poor documentation habits");
  }

  // Very new account
  if (accountAge < 1) {
    concerns.push("New GitHub account (less than 1 year)");
  }

  return concerns.slice(0, 4);
}

function calculateOverallScore(
  profile: GitHubProfile,
  repos: GitHubRepo[],
  activityLevel: AnalysisResult["analysis"]["activityLevel"],
  strengths: string[],
  concerns: string[]
): number {
  let score = 50; // Base score

  // Activity bonus
  const activityBonus = {
    very_active: 20,
    active: 15,
    moderate: 10,
    low: 5,
    inactive: 0,
  };
  score += activityBonus[activityLevel];

  // Stars bonus
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  score += Math.min(15, totalStars / 10);

  // Followers bonus
  score += Math.min(10, profile.followers / 20);

  // Repo count bonus
  const originalRepos = repos.filter(r => !r.fork).length;
  score += Math.min(10, originalRepos / 5);

  // Strengths bonus
  score += strengths.length * 2;

  // Concerns penalty
  score -= concerns.length * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRecommendation(score: number): AnalysisResult["analysis"]["recommendation"] {
  if (score >= 75) return "strong";
  if (score >= 55) return "good";
  if (score >= 35) return "moderate";
  return "weak";
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
  for (const repo of user.repositories.nodes) {
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

  // Get repos sorted by activity and stars - increased limit to 30
  const activeRepos = repos
    .sort((a, b) => {
      const aScore = a.stargazers_count * 2 + a.forks_count;
      const bScore = b.stargazers_count * 2 + b.forks_count;
      return bScore - aScore;
    })
    .slice(0, 30);

  // Fetch contributors from repos in parallel - increased to 15 per repo
  const contributorPromises = activeRepos.map(async (repo) => {
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

  // Process repos and their contributors
  for (const { repo, contributors } of repoContributors) {
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

  const estimatedExperience = estimateExperience(accountAge, repos, profile);

  const languagesForStrengths = languages.map(l => ({ name: l.name, percentage: l.percentage }));
  const strengths = identifyStrengths(repos, languagesForStrengths, profile);
  const concerns = identifyConcerns(repos, events, profile, accountAge);

  const overallScore = calculateOverallScore(profile, repos, activityLevel, strengths, concerns);
  const recommendation = getRecommendation(overallScore);

  // Determine contribution pattern
  let contributionPattern = "Balanced";
  const pushEvents = events.filter(e => e.type === "PushEvent").length;
  const prEvents = events.filter(e => e.type === "PullRequestEvent").length;
  const issueEvents = events.filter(e => e.type === "IssuesEvent").length;

  if (pushEvents > prEvents * 2 && pushEvents > issueEvents * 2) {
    contributionPattern = "Code-focused (mostly direct commits)";
  } else if (prEvents > pushEvents) {
    contributionPattern = "Collaborative (mostly pull requests)";
  } else if (issueEvents > pushEvents && issueEvents > prEvents) {
    contributionPattern = "Community-oriented (issue discussions)";
  }

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
      contributionPattern,
      estimatedExperience,
      strengths,
      concerns,
      overallScore,
      recommendation,
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
