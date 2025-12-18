"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// GitHub App configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

// Supabase admin client for updating user metadata
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
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
 * Refresh a GitHub access token using the refresh token
 * GitHub Apps rotate refresh tokens, so we need to store the new one
 */
async function refreshGitHubToken(refreshToken: string): Promise<GitHubTokenResponse | null> {
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("GitHub token refresh HTTP error:", response.status);
      return null;
    }

    const data: GitHubTokenResponse = await response.json();

    if (data.error) {
      console.error("GitHub token refresh error:", data.error, data.error_description);
      return null;
    }

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
 * Get a valid GitHub access token for the current user
 *
 * For GitHub Apps with token expiration enabled:
 * 1. Try the current provider_token from user metadata
 * 2. If invalid, refresh using provider_refresh_token
 * 3. Update the tokens in Supabase user metadata
 */
export async function getGitHubToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Get tokens from user's app_metadata (set by Supabase OAuth)
    const providerToken = user.app_metadata?.provider_token as string | undefined;
    const providerRefreshToken = user.app_metadata?.provider_refresh_token as string | undefined;

    // Also check user_metadata as fallback (Supabase stores in different places depending on version)
    const userMetaToken = user.user_metadata?.provider_token as string | undefined;
    const userMetaRefreshToken = user.user_metadata?.provider_refresh_token as string | undefined;

    const accessToken = providerToken || userMetaToken;
    const refreshToken = providerRefreshToken || userMetaRefreshToken;

    if (!accessToken) {
      // Try getting from session as last resort
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        const isValid = await validateToken(session.provider_token);
        if (isValid) {
          return session.provider_token;
        }
      }
      console.warn("No GitHub token found in user metadata or session");
      return null;
    }

    // Test if current token is still valid
    const isValid = await validateToken(accessToken);
    if (isValid) {
      return accessToken;
    }

    // Token expired, try to refresh
    if (!refreshToken) {
      console.warn("GitHub token expired but no refresh token available");
      return null;
    }

    console.log("GitHub token expired, attempting refresh...");
    const refreshResult = await refreshGitHubToken(refreshToken);

    if (!refreshResult) {
      console.error("Failed to refresh GitHub token");
      return null;
    }

    // Update the tokens in Supabase using admin client
    try {
      const adminClient = createAdminClient();

      await adminClient.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          provider_token: refreshResult.access_token,
          // GitHub Apps rotate refresh tokens, so always update it
          provider_refresh_token: refreshResult.refresh_token || refreshToken,
        },
      });

      console.log("GitHub token refreshed and stored successfully");
    } catch (updateError) {
      // Log but don't fail - we still have a valid token to return
      console.error("Failed to update user metadata with new tokens:", updateError);
    }

    return refreshResult.access_token;
  } catch (error) {
    console.error("Error getting GitHub token:", error);
    return null;
  }
}

/**
 * Store GitHub OAuth tokens for a user (called from auth callback)
 * This is a no-op now since Supabase handles token storage in user metadata
 */
export async function storeGitHubTokens(
  _authUserId: string,
  _accessToken: string,
  _refreshToken: string | null,
  _expiresIn: number | null
): Promise<void> {
  // Tokens are now stored in Supabase user metadata automatically
  // This function is kept for backwards compatibility but does nothing
}

/**
 * Clear stored GitHub tokens for a user (used on sign out)
 */
export async function clearGitHubTokens(authUserId: string): Promise<void> {
  try {
    const adminClient = createAdminClient();

    const { data: { user } } = await adminClient.auth.admin.getUserById(authUserId);

    if (user) {
      await adminClient.auth.admin.updateUserById(authUserId, {
        app_metadata: {
          ...user.app_metadata,
          provider_token: null,
          provider_refresh_token: null,
        },
      });
    }
  } catch (error) {
    console.error("Error clearing GitHub tokens:", error);
  }
}
