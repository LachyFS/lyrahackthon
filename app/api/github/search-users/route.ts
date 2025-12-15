import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    const token = await getGitHubToken();

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=${limit}`,
      {
        headers,
        next: { revalidate: 60 } // Cache for 1 minute
      }
    );

    if (!res.ok) {
      if (res.status === 403) {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded" },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "GitHub API error" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Return simplified user data
    const users = data.items?.map((user: { login: string; avatar_url: string; name?: string }) => ({
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name,
    })) || [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GitHub search error:", error);
    return NextResponse.json(
      { error: "Failed to search GitHub users" },
      { status: 500 }
    );
  }
}
