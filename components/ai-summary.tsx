"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, MessageSquare, Users, Code2, Briefcase } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AnalysisResult, GitHubProfile } from "@/lib/actions/github-analyze";

interface AISummaryProps {
  analysis: AnalysisResult["analysis"];
  profile: GitHubProfile;
}

export function AISummary({ analysis, profile }: AISummaryProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSummary() {
      setIsLoading(true);
      setDisplayedText("");
      setError(null);

      try {
        const response = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis, profile }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to generate summary");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let text = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          text += chunk;
          setDisplayedText(text);
        }

        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsLoading(false);
      }
    }

    fetchSummary();

    return () => controller.abort();
  }, [analysis, profile]);

  const topLanguages = analysis.languages.slice(0, 3).map(l => l.name).join(", ");
  const username = profile.login;
  const name = profile.name || username;

  // Follow-up questions that link to AI search with context
  const followUpQuestions = [
    {
      icon: Users,
      label: "Find similar candidates",
      query: `Find developers similar to @${username} with skills in ${topLanguages}${profile.location ? ` near ${profile.location}` : ""}`,
    },
    {
      icon: Code2,
      label: "Analyze their top repo",
      query: analysis.topRepos[0]
        ? `Analyze the repository https://github.com/${username}/${analysis.topRepos[0].name} to assess code quality`
        : `What repositories does @${username} have?`,
    },
    {
      icon: Briefcase,
      label: "Draft outreach email",
      query: `Draft a recruiting email to ${name} (@${username}) for a ${analysis.estimatedExperience.includes("Senior") ? "Senior" : "Mid-level"} ${topLanguages.split(",")[0]} developer role`,
    },
    {
      icon: MessageSquare,
      label: "Interview questions",
      query: `Based on @${username}'s GitHub profile showing expertise in ${topLanguages}, suggest technical interview questions that would help assess their skills`,
    },
  ];

  const handleFollowUp = (query: string) => {
    router.push(`/ai-search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-950/30 to-emerald-950/30 p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Brain className="h-5 w-5 text-cyan-400" />
        Summary
      </h2>

      {error ? (
        <p className="text-red-400">{error}</p>
      ) : isLoading && !displayedText ? (
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-4/5" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
        </div>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-emerald-300 prose-a:text-cyan-400">
          <ReactMarkdown>
            {displayedText}
          </ReactMarkdown>
          {isLoading && <span className="animate-pulse text-cyan-400">|</span>}
        </div>
      )}

      {/* Follow-up Questions */}
      {!isLoading && !error && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-muted-foreground mb-3">Continue with AI Assistant</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleFollowUp(q.query)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 transition-colors group"
              >
                <q.icon className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                <span className="text-muted-foreground group-hover:text-white transition-colors truncate">
                  {q.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
