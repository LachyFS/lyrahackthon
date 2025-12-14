import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { searchHistory } from "@/src/db/schema";
import { desc, eq, and } from "drizzle-orm";

// GET - Retrieve recent search history for the current user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

    // Get recent searches, ordered by most recent, with deduplication
    const recentSearches = await db
      .selectDistinctOn([searchHistory.githubUsername], {
        id: searchHistory.id,
        githubUsername: searchHistory.githubUsername,
        githubName: searchHistory.githubName,
        githubAvatarUrl: searchHistory.githubAvatarUrl,
        githubBio: searchHistory.githubBio,
        githubLocation: searchHistory.githubLocation,
        searchQuery: searchHistory.searchQuery,
        searchType: searchHistory.searchType,
        createdAt: searchHistory.createdAt,
      })
      .from(searchHistory)
      .where(eq(searchHistory.authUserId, user.id))
      .orderBy(searchHistory.githubUsername, desc(searchHistory.createdAt))
      .limit(limit * 2); // Get extra to account for potential duplicates

    // Re-sort by createdAt and limit
    const sorted = recentSearches
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({ searches: sorted });
  } catch (error) {
    console.error("Error fetching search history:", error);
    return NextResponse.json(
      { error: "Failed to fetch search history" },
      { status: 500 }
    );
  }
}

// POST - Save a new search to history
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { profiles, searchQuery, searchType = "ai_search" } = body;

    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      return NextResponse.json(
        { error: "profiles array is required" },
        { status: 400 }
      );
    }

    // Insert all profiles into search history
    const inserts = profiles.map((profile: {
      username: string;
      name?: string | null;
      avatarUrl?: string | null;
      bio?: string | null;
      location?: string | null;
    }) => ({
      authUserId: user.id,
      githubUsername: profile.username,
      githubName: profile.name || null,
      githubAvatarUrl: profile.avatarUrl || `https://github.com/${profile.username}.png`,
      githubBio: profile.bio || null,
      githubLocation: profile.location || null,
      searchQuery: searchQuery || null,
      searchType,
    }));

    await db.insert(searchHistory).values(inserts);

    return NextResponse.json({ success: true, count: inserts.length });
  } catch (error) {
    console.error("Error saving search history:", error);
    return NextResponse.json(
      { error: "Failed to save search history" },
      { status: 500 }
    );
  }
}
