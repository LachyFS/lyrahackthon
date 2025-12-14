"use client";

import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  Brain,
  User,
  Search,
  Github,
  MapPin,
  Star,
  Code2,
  Activity,
  ExternalLink,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { GitSignalLogoWave } from "@/components/gitsignal-logo";
import Link from "next/link";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";

// Types for message parts
interface TextPart {
  type: "text";
  text: string;
}

interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    state: string;
    toolName: string;
    result?: unknown;
  };
}

type MessagePart = TextPart | ToolInvocationPart | { type: string };

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}

function AISearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSubmittedInitialRef = useRef(false);
  const [inputValue, setInputValue] = useState("");

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  // Handle initial query from URL params - only run once on mount
  useEffect(() => {
    if (initialQuery && !hasSubmittedInitialRef.current && status === "ready") {
      hasSubmittedInitialRef.current = true;
      sendMessage({ parts: [{ type: "text", text: initialQuery }] });
    }
  }, [status, initialQuery, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status !== "ready") return;
    sendMessage({ parts: [{ type: "text", text: inputValue }] });
    setInputValue("");
  };

  const isLoading = status === "streaming" || status === "submitted";

  // Helper to get text content from message parts
  const getMessageText = (message: ChatMessage): string => {
    return message.parts
      .filter((part): part is TextPart => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  // Helper to get tool invocations from message parts
  const getToolInvocations = (message: ChatMessage): ToolInvocationPart[] => {
    return message.parts.filter(
      (part): part is ToolInvocationPart => part.type === "tool-invocation"
    );
  };

  const renderToolResult = (toolName: string, result: unknown) => {
    if (toolName === "searchGitHubProfiles") {
      const data = result as {
        query: string;
        profiles: Array<{
          username: string;
          url: string;
          title: string;
          snippet?: string;
        }>;
        total: number;
        error?: string;
      };

      if (data.error) {
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">{data.error}</p>
          </div>
        );
      }

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Found {data.total} profiles for &quot;{data.query}&quot;</span>
          </div>
          <div className="space-y-2">
            {data.profiles.map((profile, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Github className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    {profile.username}
                  </a>
                  {profile.snippet && (
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.snippet}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (toolName === "analyzeGitHubProfile") {
      const data = result as {
        username: string;
        name: string | null;
        bio: string | null;
        location: string | null;
        company: string | null;
        avatar_url: string;
        github_url: string;
        followers: number;
        public_repos: number;
        accountAge: number;
        totalStars: number;
        languages: Array<{ name: string; percentage: number }>;
        activityLevel: string;
        estimatedExperience: string;
        topRepos: Array<{
          name: string;
          description: string | null;
          stars: number;
          language: string | null;
          url: string;
        }>;
        error?: string;
      };

      if (data.error) {
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">{data.error}</p>
          </div>
        );
      }

      const activityColors: Record<string, string> = {
        very_active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        active: "bg-green-500/20 text-green-300 border-green-500/30",
        moderate: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        low: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        inactive: "bg-red-500/20 text-red-300 border-red-500/30",
      };

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          {/* Profile Header */}
          <div className="flex items-center gap-4 p-4 border-b border-white/10">
            <img
              src={data.avatar_url}
              alt={data.username}
              className="w-14 h-14 rounded-full border-2 border-white/20"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{data.name || data.username}</h3>
                <a
                  href={data.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground">@{data.username}</p>
              {data.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {data.location}
                </div>
              )}
            </div>
            <Badge className={activityColors[data.activityLevel] || activityColors.inactive}>
              <Activity className="h-3 w-3 mr-1" />
              {data.activityLevel.replace("_", " ")}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-white/10">
            <div className="text-center">
              <div className="text-lg font-semibold text-white">{data.estimatedExperience.split(" ")[0]}</div>
              <div className="text-xs text-muted-foreground">Experience</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">{data.public_repos}</div>
              <div className="text-xs text-muted-foreground">Repos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">{data.totalStars}</div>
              <div className="text-xs text-muted-foreground">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white">{data.followers}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
          </div>

          {/* Languages */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Code2 className="h-4 w-4" />
              <span>Languages</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.languages.slice(0, 6).map((lang) => (
                <Badge key={lang.name} variant="outline" className="text-xs">
                  {lang.name} ({lang.percentage}%)
                </Badge>
              ))}
            </div>
          </div>

          {/* Top Repos */}
          {data.topRepos.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Star className="h-4 w-4" />
                <span>Top Repositories</span>
              </div>
              <div className="space-y-2">
                {data.topRepos.slice(0, 3).map((repo) => (
                  <a
                    key={repo.name}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-400">{repo.name}</span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-3 w-3" />
                        {repo.stars}
                      </div>
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {repo.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
              <Link
                href={`/analyze/${data.username}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
              >
                View full analysis
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/20 animate-pulse-glow blur-3xl" />
      <div className="fixed top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 animate-pulse-glow blur-3xl delay-200" />

      {/* Header */}
      <SiteHeader
        navLinks={[
          { href: "/", label: "Home" },
        ]}
        showSignIn
      />

      <pre>
      {JSON.stringify(messages, null, 2)}
      </pre>

      {/* Main Chat Area */}
      <main className="relative z-10 flex-1 flex flex-col container mx-auto px-4 md:px-6 pt-8 pb-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Brain className="h-8 w-8 text-emerald-400" />
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                AI Developer Search
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground">
            Find developers using natural language. Try &quot;best React developers in London&quot;
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <GitSignalLogoWave className="h-16 w-16 mx-auto mb-4 text-emerald-400/50" />
              <p className="text-muted-foreground mb-6">
                Ask me to find developers with specific skills, in certain locations, or working on particular technologies.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Find Rust developers in Sydney",
                  "Top React engineers on GitHub",
                  "Machine learning experts in Europe",
                  "Go developers with Kubernetes experience",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputValue(suggestion);
                    }}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(messages as unknown as ChatMessage[]).map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] ${message.role === "user"
                    ? "bg-emerald-600/20 border border-emerald-500/30 rounded-2xl rounded-tr-md px-4 py-3"
                    : "space-y-3"
                  }`}
              >
                {message.role === "user" ? (
                  <p className="text-white">{getMessageText(message)}</p>
                ) : (
                  <>
                    {/* Tool invocations */}
                    {getToolInvocations(message).map((part, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {part.toolInvocation.state === "result" ? (
                            <>
                              <Search className="h-3 w-3" />
                              <span>
                                {part.toolInvocation.toolName === "searchGitHubProfiles"
                                  ? "Searched for profiles"
                                  : "Analyzed profile"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>
                                {part.toolInvocation.toolName === "searchGitHubProfiles"
                                  ? "Searching for profiles..."
                                  : "Analyzing profile..."}
                              </span>
                            </>
                          )}
                        </div>
                        {part.toolInvocation.state === "result" &&
                          renderToolResult(part.toolInvocation.toolName, part.toolInvocation.result)}
                      </div>
                    ))}
                    {/* Text content */}
                    {getMessageText(message) && (
                      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3">
                        <div className="text-white prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-300 prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/10">
                          <ReactMarkdown>{getMessageText(message)}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          id="chat-form"
          onSubmit={handleSubmit}
          className="sticky bottom-4 bg-background/80 backdrop-blur-xl rounded-2xl border border-white/10 p-2"
        >
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me to find developers..."
              className="flex-1 h-12 bg-transparent border-0 focus:ring-0 focus-visible:ring-0 text-white placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function AISearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    }>
      <AISearchContent />
    </Suspense>
  );
}
