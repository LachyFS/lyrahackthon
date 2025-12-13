"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

export function SearchForm() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);

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
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter GitHub username or profile URL..."
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
          ) : (
            <>
              Analyze
              <Search className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
