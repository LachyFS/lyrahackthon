import { NextRequest, NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/github-token";
import { getCachedGitHubSearchUsers } from "@/lib/actions/github-analyze";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    const token = await getGitHubToken();
    const users = await getCachedGitHubSearchUsers(query, limit, token);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GitHub search error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("401")) {
      return NextResponse.json(
        { error: "GitHub session expired. Please sign out and sign back in.", code: "GITHUB_TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    if (errorMessage.includes("403")) {
      return NextResponse.json(
        { error: "GitHub API rate limit exceeded" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to search GitHub users" },
      { status: 500 }
    );
  }
}
