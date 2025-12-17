import { NextRequest, NextResponse } from "next/server";
import { analyzeGitHubProfile } from "@/lib/actions/github-analyze";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getCached, setCache } from "@/lib/redis";
import { checkBotId } from "botid/server";

// Cache TTL: 10 minutes for profile analysis results
const ANALYSIS_CACHE_TTL = 10 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  // Vercel BotID Protection - reject requests from bots
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json(
      { error: "Automated requests are not allowed." },
      { status: 403 }
    );
  }

  // Require authentication for AI generation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to use AI features." },
      { status: 401 }
    );
  }

  const { username } = await params;
  const decodedUsername = decodeURIComponent(username).toLowerCase();
  const cacheKey = `analysis:${decodedUsername}`;

  // Check cache first
  try {
    const cached = await getCached<ReturnType<typeof analyzeGitHubProfile>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
        },
      });
    }
  } catch (cacheError) {
    // Log but continue if cache fails
    console.error("Cache read error:", cacheError);
  }

  // Rate limiting: 15 requests per minute per user (more restrictive due to expensive AI analysis)
  const rateLimit = await checkRateLimit(`ai:analyze:${user.id}`, 15, 60);
  if (!rateLimit.success) {
    const resetDate = new Date(rateLimit.reset);
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        limit: rateLimit.limit,
        reset: resetDate.toISOString(),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimit.limit.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": resetDate.toISOString(),
          "Retry-After": Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const result = await analyzeGitHubProfile(decodedUsername);

    // Cache the successful result
    try {
      await setCache(cacheKey, result, ANALYSIS_CACHE_TTL);
    } catch (cacheError) {
      console.error("Cache write error:", cacheError);
    }

    return NextResponse.json(result, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze profile" },
      { status: 500 }
    );
  }
}
