"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, GithubIcon, Lock } from "lucide-react";
import { signInWithGitHub } from "@/lib/actions/auth";

// Detect if input looks like a GitHub username/URL or a natural language query
function isGitHubUsernameOrUrl(input: string): boolean {
  const trimmed = input.trim();

  // If it's a GitHub URL, definitely a username lookup
  if (trimmed.includes("github.com/")) {
    return true;
  }

  // If it starts with @, treat as username
  if (trimmed.startsWith("@")) {
    return true;
  }

  // If it's a single word with no spaces and looks like a username
  // (alphanumeric with hyphens, max 39 chars - GitHub username rules)
  const usernamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  if (usernamePattern.test(trimmed)) {
    return true;
  }

  // Otherwise, treat as natural language query
  return false;
}

interface SearchFormProps {
  isSignedIn?: boolean;
}

export function SearchForm({ isSignedIn = false }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (!isSignedIn) {
      setShowSignInPrompt(true);
      return;
    }

    setIsLoading(true);

    if (isGitHubUsernameOrUrl(query)) {
      // Extract username from GitHub URL or use as-is
      let username = query.trim();

      // Handle GitHub URLs
      const githubUrlMatch = username.match(/github\.com\/([^\/\s]+)/);
      if (githubUrlMatch) {
        username = githubUrlMatch[1];
      }

      // Remove @ if present
      if (username.startsWith("@")) {
        username = username.slice(1);
      }

      router.push(`/analyze/${encodeURIComponent(username)}`);
    } else {
      // Natural language query - go to AI search
      router.push(`/ai-search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search developers or enter a username..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSignInPrompt(false);
            }}
            className="h-14 pl-12 pr-28 text-lg bg-white/5 border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
          />
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
      </form>

      {/* Sign-in modal */}
      <Dialog open={showSignInPrompt} onOpenChange={setShowSignInPrompt}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-white/10">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Lock className="h-6 w-6 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl">Sign in to search</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Sign in with GitHub to search developers and access AI-powered analysis of any developer&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <form action={signInWithGitHub}>
              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-white/90 font-medium h-11"
              >
                <GithubIcon className="mr-2 h-5 w-5" />
                Sign in with GitHub
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground">
              We only request read access to your public profile.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
