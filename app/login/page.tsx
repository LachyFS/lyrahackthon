import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, BarChart3 } from "lucide-react";
import Link from "next/link";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      <Card className="relative w-full max-w-md bg-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <BarChart3 className="h-8 w-8 text-emerald-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Git Radar
            </span>
          </Link>
          <CardTitle className="text-2xl text-white">Welcome to Git Radar</CardTitle>
          <CardDescription>
            Sign in with GitHub for higher API rate limits and to save your analyzed profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGitHub}>
            <Button className="w-full bg-white text-black hover:bg-white/90" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            You can also analyze profiles without signing in
          </p>
          <Button variant="ghost" asChild className="w-full mt-2">
            <Link href="/">
              Search without signing in
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
