import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInWithGitHub } from "@/lib/actions/auth";
import { Code2, Github, Users, Zap, Eye } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Code2 className="h-5 w-5" />
            DevShowcase
          </Link>
          <form action={signInWithGitHub}>
            <Button>
              <Github className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-6 py-24 text-center md:py-32">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Show what you&apos;re building
          </h1>
          <p className="max-w-2xl text-xl text-muted-foreground">
            A visual social platform for software engineers. GitHub-native,
            project-focused, less corporate than LinkedIn.
          </p>
          <form action={signInWithGitHub}>
            <Button size="lg" className="gap-2">
              <Github className="h-5 w-5" />
              Get started with GitHub
            </Button>
          </form>
        </section>

        <section className="border-t bg-muted/50 py-16">
          <div className="container">
            <h2 className="mb-12 text-center text-2xl font-bold">How it works</h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Github className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">Connect GitHub</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in with GitHub and we&apos;ll auto-generate your profile from
                  your repos, languages, and activity.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Eye className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">Share Projects</h3>
                <p className="text-sm text-muted-foreground">
                  Post what you&apos;re building with screenshots, demos, and repo
                  links. Show your work, not your resume.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">Connect with Engineers</h3>
                <p className="text-sm text-muted-foreground">
                  Discover engineers by tech stack, follow interesting people,
                  and find collaborators for your projects.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container">
            <h2 className="mb-12 text-center text-2xl font-bold">
              Built for builders
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border p-6">
                <Zap className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-2 font-semibold">Project-First Profiles</h3>
                <p className="text-sm text-muted-foreground">
                  Your profile showcases your actual work. Languages,
                  contributions, and projects front and center.
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <Users className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-2 font-semibold">Find Collaborators</h3>
                <p className="text-sm text-muted-foreground">
                  Flag your posts when you&apos;re looking for help. Connect with
                  engineers who share your interests.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          Built for the Lyra Hackathon 2025
        </div>
      </footer>
    </div>
  );
}
