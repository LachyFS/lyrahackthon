import { db } from "@/src/db";
import { profiles } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { getCached, setCache } from "./redis";
import { Octokit } from "octokit";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string;
  location: string | null;
  blog: string | null;
  company: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

interface GitHubRepo {
  name: string;
  language: string | null;
  stargazers_count: number;
  size: number;
}

function createOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const cacheKey = `github:user:${token.slice(-8)}`;
  const cached = await getCached<GitHubUser>(cacheKey);
  if (cached) {
    return cached;
  }

  const octokit = createOctokit(token);
  const { data } = await octokit.rest.users.getAuthenticated();

  const user: GitHubUser = {
    id: data.id,
    login: data.login,
    name: data.name ?? null,
    email: data.email ?? null,
    bio: data.bio ?? null,
    avatar_url: data.avatar_url,
    location: data.location ?? null,
    blog: data.blog ?? null,
    company: data.company ?? null,
    public_repos: data.public_repos,
    followers: data.followers,
    following: data.following,
  };

  await setCache(cacheKey, user);
  return user;
}

export async function fetchGitHubRepos(
  token: string,
  username: string
): Promise<GitHubRepo[]> {
  const cacheKey = `github:repos:${username}`;
  const cached = await getCached<GitHubRepo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.repos.listForUser({
      username,
      per_page: 100,
      sort: "pushed",
    });

    const repos: GitHubRepo[] = data.map((repo) => ({
      name: repo.name,
      language: repo.language ?? null,
      stargazers_count: repo.stargazers_count ?? 0,
      size: repo.size ?? 0,
    }));

    await setCache(cacheKey, repos);
    return repos;
  } catch {
    return [];
  }
}

export function calculateTopLanguages(
  repos: GitHubRepo[]
): { name: string; percentage: number }[] {
  const languageCounts: Record<string, number> = {};
  let totalSize = 0;

  for (const repo of repos) {
    if (repo.language && repo.size > 0) {
      languageCounts[repo.language] =
        (languageCounts[repo.language] || 0) + repo.size;
      totalSize += repo.size;
    }
  }

  if (totalSize === 0) return [];

  const sorted = Object.entries(languageCounts)
    .map(([name, size]) => ({
      name,
      percentage: Math.round((size / totalSize) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8);

  return sorted;
}

export async function syncGitHubProfile(
  user: User,
  providerToken?: string | null
) {
  const githubIdentity = user.identities?.find((i) => i.provider === "github");
  if (!githubIdentity) {
    throw new Error("No GitHub identity found");
  }

  const githubData = githubIdentity.identity_data as {
    avatar_url?: string;
    email?: string;
    full_name?: string;
    name?: string;
    preferred_username?: string;
    user_name?: string;
    sub?: string;
  };

  const githubId = parseInt(githubIdentity.id, 10);
  const githubUsername =
    githubData.preferred_username ||
    githubData.user_name ||
    `user_${githubId}`;

  let topLanguages: { name: string; percentage: number }[] = [];
  let languages: string[] = [];
  let publicRepos = 0;
  let followers = 0;
  let following = 0;
  let bio: string | null = null;
  let location: string | null = null;
  let website: string | null = null;
  let company: string | null = null;

  // Fetch additional data from GitHub API if we have a token
  if (providerToken) {
    try {
      const [githubUser, repos] = await Promise.all([
        fetchGitHubUser(providerToken),
        fetchGitHubRepos(providerToken, githubUsername),
      ]);

      publicRepos = githubUser.public_repos;
      followers = githubUser.followers;
      following = githubUser.following;
      bio = githubUser.bio;
      location = githubUser.location;
      website = githubUser.blog;
      company = githubUser.company;

      topLanguages = calculateTopLanguages(repos);
      languages = [...new Set(repos.map((r) => r.language).filter(Boolean))] as string[];
    } catch (error) {
      console.error("Failed to fetch GitHub data:", error);
    }
  }

  // Check if profile exists
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, user.id),
  });

  const profileData = {
    authUserId: user.id,
    githubId,
    githubUsername,
    email: githubData.email || user.email,
    name: githubData.full_name || githubData.name,
    avatarUrl: githubData.avatar_url,
    bio,
    location,
    website,
    company,
    publicRepos,
    followers,
    following,
    languages,
    topLanguages,
    lastGithubSync: new Date(),
    updatedAt: new Date(),
  };

  if (existingProfile) {
    await db
      .update(profiles)
      .set(profileData)
      .where(eq(profiles.id, existingProfile.id));
    return existingProfile.id;
  } else {
    const [newProfile] = await db
      .insert(profiles)
      .values({
        ...profileData,
        createdAt: new Date(),
      })
      .returning({ id: profiles.id });
    return newProfile.id;
  }
}

export async function getProfileByAuthId(authUserId: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.authUserId, authUserId),
  });
}

export async function getProfileByUsername(username: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.githubUsername, username),
  });
}
