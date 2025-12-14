"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Brain } from "lucide-react";

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

export function SearchForm() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const isUsername = query.trim() && isGitHubUsernameOrUrl(query);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

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
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="GitHub username, URL, or ask AI (e.g. 'best Rust devs in Sydney')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 pl-12 pr-4 text-lg bg-white/5 border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          size="lg"
          className="h-14 px-8 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isUsername ? (
            <>
              Analyze
              <Search className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Ask AI
              <Brain className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {query.trim() && !isUsername && (
        <p className="mt-2 text-sm text-cyan-400/70 flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI search - will find developers matching your query
        </p>
      )}
    </form>
  );
}
