import { NextRequest, NextResponse } from "next/server";
import { analyzeGitHubProfile } from "@/lib/actions/github-analyze";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/redis";
import { checkBotId } from "botid/server";

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

  const { username } = await params;

  try {
    const result = await analyzeGitHubProfile(decodeURIComponent(username));
    return NextResponse.json(result);
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
