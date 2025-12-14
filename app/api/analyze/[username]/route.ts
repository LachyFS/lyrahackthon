import { NextRequest, NextResponse } from "next/server";
import { analyzeGitHubProfile } from "@/lib/actions/github-analyze";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
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
