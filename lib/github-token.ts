"use server";

import { db } from "@/src/db";
import { profiles } from "@/src/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

// Token expiration buffer (refresh 5 minutes before expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// Default token lifetime if not provided by GitHub (1 hour)
const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/**
 * Store GitHub OAuth tokens for a user
 */
export async function storeGitHubTokens(
  authUserId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null
): Promise<void> {
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : new Date(Date.now() + DEFAULT_TOKEN_LIFETIME_MS);

  await db
    .update(profiles)
    .set({
      githubAccessToken: accessToken,
      githubRefreshToken: refreshToken,
      githubTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(profiles.authUserId, authUserId));
}

/**
 * Get stored GitHub tokens for a user
 */
async function getStoredTokens(authUserId: string): Promise<StoredTokens | null> {
  const [profile] = await db
    .select({
      accessToken: profiles.githubAccessToken,
      refreshToken: profiles.githubRefreshToken,
      expiresAt: profiles.githubTokenExpiresAt,
    })
    .from(profiles)
    .where(eq(profiles.authUserId, authUserId))
    .limit(1);

  if (!profile?.accessToken) {
    return null;
  }

  return {
    accessToken: profile.accessToken,
    refreshToken: profile.refreshToken,
    expiresAt: profile.expiresAt,
  };
}

/**
 * Check if a token is expired or about to expire
 */
function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    // If no expiration, assume it might be expired after default lifetime
    return true;
  }
  return Date.now() >= expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Refresh a GitHub access token using the refresh token
 */
async function refreshGitHubToken(refreshToken: string): Promise<GitHubTokenResponse | null> {
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("GitHub token refresh failed:", response.status);
      return null;
    }

    const data: GitHubTokenResponse = await response.json();

    if (!data.access_token) {
      console.error("GitHub token refresh returned no access_token");
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error refreshing GitHub token:", error);
    return null;
  }
}

/**
 * Validate a GitHub access token by making a lightweight API call
 */
async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get a valid GitHub access token for the current user
 * This will:
 * 1. Try to get the token from Supabase session (provider_token)
 * 2. If that fails or is expired, try to get stored token from DB
 * 3. If stored token is expired, try to refresh it
 * 4. Return null if all methods fail
 */
export async function getGitHubToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // First, try the session's provider_token (freshest)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token) {
      // Validate it's still working
      const isValid = await validateToken(session.provider_token);
      if (isValid) {
        // Store it for future use (in case session expires before token)
        // We don't have refresh_token from session, so only store access_token
        await storeGitHubTokens(
          user.id,
          session.provider_token,
          null,
          null // Will use default expiry
        );
        return session.provider_token;
      }
    }

    // Session token failed, try stored tokens
    const storedTokens = await getStoredTokens(user.id);

    if (!storedTokens) {
      console.warn("No stored GitHub tokens found for user");
      return null;
    }

    // Check if stored token is still valid
    if (!isTokenExpired(storedTokens.expiresAt)) {
      const isValid = await validateToken(storedTokens.accessToken);
      if (isValid) {
        return storedTokens.accessToken;
      }
    }

    // Token is expired, try to refresh
    if (storedTokens.refreshToken) {
      console.log("Attempting to refresh GitHub token...");
      const refreshResult = await refreshGitHubToken(storedTokens.refreshToken);

      if (refreshResult) {
        // Store the new tokens
        await storeGitHubTokens(
          user.id,
          refreshResult.access_token,
          refreshResult.refresh_token || storedTokens.refreshToken,
          refreshResult.expires_in || null
        );

        console.log("GitHub token refreshed successfully");
        return refreshResult.access_token;
      }
    }

    console.warn("GitHub token expired and could not be refreshed");
    return null;
  } catch (error) {
    console.error("Error getting GitHub token:", error);
    return null;
  }
}

/**
 * Clear stored GitHub tokens for a user (used on sign out)
 */
export async function clearGitHubTokens(authUserId: string): Promise<void> {
  await db
    .update(profiles)
    .set({
      githubAccessToken: null,
      githubRefreshToken: null,
      githubTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.authUserId, authUserId));
}
