import { NextRequest, NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";

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
      if (res.status === 401) {
        return NextResponse.json(
          { error: "GitHub session expired. Please sign out and sign back in.", code: "GITHUB_TOKEN_EXPIRED" },
          { status: 401 }
        );
      }
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
