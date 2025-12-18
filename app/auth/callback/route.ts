import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { storeGitHubTokens } from "@/lib/github-token";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Store the GitHub OAuth tokens for future use
      // This allows us to refresh tokens even after the Supabase session loses them
      if (data.session.provider_token && data.session.user) {
        try {
          await storeGitHubTokens(
            data.session.user.id,
            data.session.provider_token,
            data.session.provider_refresh_token || null,
            // GitHub tokens typically expire in 8 hours, but Supabase doesn't always provide this
            // We'll use a conservative 1 hour estimate
            3600
          );
        } catch (tokenError) {
          // Don't block login if token storage fails
          console.error("Failed to store GitHub tokens:", tokenError);
        }
      }

      const host = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${host}${next}`);
      } else if (host) {
        return NextResponse.redirect(`${host}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
