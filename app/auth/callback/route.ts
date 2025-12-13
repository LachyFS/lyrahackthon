import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { syncGitHubProfile } from "@/lib/github";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/feed";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Sync GitHub profile to our database
      try {
        await syncGitHubProfile(data.user, data.session?.provider_token);
      } catch (syncError) {
        console.error("Failed to sync GitHub profile:", syncError);
      }

      const host = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${host}${next}`);
      } else if (host) {
        return NextResponse.redirect(`https://${host}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
