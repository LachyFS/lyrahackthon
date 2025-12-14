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
  Bug,
  X,
  ChevronDown,
  Clock,
  ArrowDown,
} from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { SiteHeader } from "@/components/site-header";
import { GitSignalLogoWave } from "@/components/gitsignal-logo";
import Link from "next/link";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { ExpandableProfileCard } from "@/components/expandable-profile-card";
import { EmailDraft } from "@/components/email-draft";
import { motion, AnimatePresence } from "framer-motion";

// Types for message parts
interface TextPart {
  type: "text";
  text: string;
}

interface ToolPart {
  type: string; // "tool-searchGitHubProfiles", "tool-analyzeGitHubProfile", etc.
  toolCallId: string;
  state: "input-available" | "output-available" | "result";
  input?: Record<string, unknown>;
  result?: unknown;
  output?: unknown; // AI SDK v4 uses 'output' for tool results
}

interface StepStartPart {
  type: "step-start";
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
  state: "thinking" | "done";
}

type MessagePart = TextPart | ToolPart | StepStartPart | ReasoningPart | { type: string };

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
}

interface RecentSearch {
  id: string;
  githubUsername: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubBio: string | null;
  githubLocation: string | null;
  searchQuery: string | null;
  createdAt: string;
}

// Scroll to bottom button that appears when not at bottom
function ScrollToBottomButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;

  return (
    <button
      onClick={() => scrollToBottom()}
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 p-2 rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white shadow-lg transition-all duration-200 backdrop-blur-sm border border-emerald-500/30"
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  );
}

// Collapsible wrapper for tool results with auto-collapse
function CollapsibleToolResult({
  toolName,
  children,
  autoCollapse = true,
}: {
  toolName: string;
  children: React.ReactNode;
  autoCollapse?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasAutoCollapsed = useRef(false);

  // Auto-collapse after 2 seconds (unless disabled)
  useEffect(() => {
    if (autoCollapse && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
        hasAutoCollapsed.current = true;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoCollapse]);

  const getToolLabel = (name: string) => {
    switch (name) {
      case "searchGitHubProfiles":
        return "Search Results";
      case "analyzeGitHubProfile":
        return "Profile Analysis";
      case "getTopCandidates":
        return "Reviewed Candidates";
      case "generateDraftEmail":
        return "Email Draft";
      default:
        return "Tool Result";
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors w-full"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
        />
        <span>{getToolLabel(toolName)}</span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function AISearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const hasSubmittedInitialRef = useRef(false);
  const [inputValue, setInputValue] = useState("");
  const [debugMessageId, setDebugMessageId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  // Fetch user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  // Fetch recent searches on mount
  useEffect(() => {
    async function fetchRecentSearches() {
      try {
        const res = await fetch("/api/search-history?limit=8");
        if (res.ok) {
          const data = await res.json();
          setRecentSearches(data.searches || []);
        }
      } catch (error) {
        console.error("Failed to fetch recent searches:", error);
      } finally {
        setLoadingRecent(false);
      }
    }
    fetchRecentSearches();
  }, []);

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

  // Extract tool name from type (e.g., "tool-searchGitHubProfiles" -> "searchGitHubProfiles")
  const getToolName = (toolType: string): string => {
    return toolType.replace("tool-", "");
  };

  const renderToolResult = (toolName: string, result: unknown): React.ReactNode => {
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

      const maxVisible = 5;
      const visibleProfiles = data.profiles.slice(0, maxVisible);
      const remainingCount = data.profiles.length - maxVisible;

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Found {data.total} profiles for &quot;{data.query}&quot;</span>
          </div>
          <div className="space-y-2">
            {visibleProfiles.map((profile, i) => (
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
            {remainingCount > 0 && (
              <div className="text-xs text-muted-foreground pl-2 pt-1">
                + {remainingCount} more
              </div>
            )}
          </div>
        </div>
      );
    }

    if (toolName === "analyzeGitHubProfile") {
      // Note: avatar_url and github_url are not included in the API response
      // They are constructed from username to avoid sending image URLs to the LLM
      const data = result as {
        username: string;
        name: string | null;
        bio: string | null;
        location: string | null;
        company: string | null;
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
              src={`https://github.com/${data.username}.png`}
              alt={data.username}
              className="w-14 h-14 rounded-full border-2 border-white/20"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{data.name || data.username}</h3>
                <a
                  href={`https://github.com/${data.username}`}
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

    if (toolName === "getTopCandidates") {
      const data = result as {
        candidates?: Array<{
          username: string;
          name: string | null;
          location: string | null;
          bio: string | null;
          score: number;
          matchReasons: string[];
          concerns: string[];
          experience: string;
          activityLevel: string;
          topLanguages: string[];
          topics: string[];
          totalStars: number;
          followers: number;
          recentlyActiveRepos: number;
          signals?: {
            isHireable: boolean;
            hasEmail: boolean;
            hasBio: boolean;
            hasWebsite: boolean;
          };
          topRepos?: Array<{
            name: string;
            description: string | null;
            stars: number;
            language: string | null;
            url: string;
          }>;
        }>;
        brief?: {
          requiredSkills?: string[];
          preferredLocation?: string;
          minExperience?: string;
          projectType?: string;
        };
        error?: string;
        failedProfiles?: Array<{ username: string; error: string }>;
      };

      if (data.error) {
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
            <p className="text-red-400">{data.error}</p>
            {data.failedProfiles && data.failedProfiles.length > 0 && (
              <details className="text-xs text-red-300/70">
                <summary className="cursor-pointer hover:text-red-300">Show failed profiles ({data.failedProfiles.length})</summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {data.failedProfiles.slice(0, 5).map((fp) => (
                    <li key={fp.username}>@{fp.username}: {fp.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      }

      if (!data.candidates || data.candidates.length === 0) {
        return (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400">No candidates could be evaluated. Try searching for more profiles first.</p>
          </div>
        );
      }

      const candidates = data.candidates;

      return (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <ExpandableProfileCard key={candidate.username} candidate={candidate} />
          ))}
        </div>
      );
    }

    if (toolName === "generateDraftEmail") {
      const data = result as {
        candidateUsername: string;
        candidateName: string;
        candidateEmail: string | null;
        subject: string;
        body: string;
        role: string;
        companyName: string;
      };

      return <EmailDraft data={data} />;
    }

    return null;
  };

  return (
    <div className="relative h-screen flex flex-col bg-background overflow-hidden">
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
        user={user}
      />

      {/* Main Chat Area */}
      <main className="relative z-10 flex-1 flex flex-col container mx-auto px-4 md:px-6 pt-8 pb-4 max-w-4xl min-h-0">
        {/* Messages */}
        <StickToBottom className="flex-1 relative mb-4 overflow-auto" resize="smooth" initial="smooth">
          <StickToBottom.Content className="flex flex-col gap-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <GitSignalLogoWave className="h-16 w-16 mx-auto mb-4 text-emerald-400/50" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-muted-foreground mb-6"
              >
                Ask me to find developers with specific skills, in certain locations, or working on particular technologies.
              </motion.p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Find Rust developers in Sydney",
                  "Top React engineers on GitHub",
                  "Machine learning experts in Europe",
                  "Go developers with Kubernetes experience",
                ].map((suggestion, index) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                    onClick={() => {
                      setInputValue(suggestion);
                    }}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>

              {/* Recent Searches Section */}
              {!loadingRecent && recentSearches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                  className="mt-12 text-left max-w-2xl mx-auto"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Clock className="h-4 w-4" />
                    <span>Recently Viewed Profiles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recentSearches.map((search, index) => (
                      <motion.div
                        key={search.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.8 + index * 0.05 }}
                      >
                        <Link
                          href={`/analyze/${search.githubUsername}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors group"
                        >
                          <img
                            src={search.githubAvatarUrl || `https://github.com/${search.githubUsername}.png`}
                            alt={search.githubUsername}
                            className="w-10 h-10 rounded-full border border-white/20"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">
                                {search.githubName || search.githubUsername}
                              </span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-xs text-muted-foreground">@{search.githubUsername}</span>
                            {search.githubLocation && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{search.githubLocation}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <AnimatePresence mode="popLayout">
          {(messages as unknown as ChatMessage[]).map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"
                }`}
            >
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
                    {/* Render parts in original order */}
                    {message.parts.map((part, i) => {
                      // Reasoning parts - only show while thinking
                      if (part.type === "reasoning") {
                        const reasoningPart = part as ReasoningPart;
                        if (reasoningPart.state !== "thinking") return null;
                        return (
                          <div
                            key={`reasoning-${i}`}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                            <span className="truncate">{reasoningPart.text}</span>
                          </div>
                        );
                      }

                      // Tool invocations
                      if (part.type.startsWith("tool-")) {
                        const toolPart = part as ToolPart;
                        const toolName = getToolName(toolPart.type);
                        const hasResult = toolPart.state === "result" || toolPart.state === "output-available";
                        const toolResult = toolPart.output ?? toolPart.result;

                        return (
                          <div key={`tool-${i}`} className="space-y-2">
                            {hasResult ? (
                              <CollapsibleToolResult toolName={toolName} autoCollapse={toolName !== "getTopCandidates" && toolName !== "generateDraftEmail"}>
                                {toolResult != null && renderToolResult(toolName, toolResult)}
                              </CollapsibleToolResult>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>
                                  {toolName === "searchGitHubProfiles"
                                    ? `Searching for "${(toolPart.input as { query?: string })?.query || 'profiles'}"...`
                                    : toolName === "getTopCandidates"
                                    ? `Ranking ${(toolPart.input as { usernames?: string[] })?.usernames?.length || 0} candidates...`
                                    : toolName === "generateDraftEmail"
                                    ? `Drafting email for ${(toolPart.input as { candidateName?: string })?.candidateName || 'candidate'}...`
                                    : `Analyzing ${(toolPart.input as { username?: string })?.username || 'profile'}...`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Text content
                      if (part.type === "text") {
                        const textPart = part as TextPart;
                        if (!textPart.text) return null;
                        return (
                          <div key={`text-${i}`} className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3">
                            <div className="text-white prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-300 prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/10">
                              <ReactMarkdown>{textPart.text}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      }

                      // Skip other part types (step-start, etc.)
                      return null;
                    })}
                  </>
                )}
              </div>
              {/* Per-message debug button - Dev only */}
              {isDev && (
                <button
                  onClick={() => setDebugMessageId(debugMessageId === message.id ? null : message.id)}
                  className="flex-shrink-0 self-start p-1 rounded text-yellow-500/50 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  title="Debug this message"
                >
                  <Bug className="h-3 w-3" />
                </button>
              )}
            </motion.div>
          ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              </div>
            </motion.div>
          )}

        </StickToBottom.Content>
          <ScrollToBottomButton />
        </StickToBottom>

        {/* Input Form */}
        <motion.form
          id="chat-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
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
        </motion.form>
      </main>

      {/* Debug Modal - Dev only */}
      {isDev && debugMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDebugMessageId(null)}>
          <div className="relative w-full max-w-4xl max-h-[80vh] m-4 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bug className="h-5 w-5 text-yellow-400" />
                Debug: Message Parts
              </h2>
              <button
                onClick={() => setDebugMessageId(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(80vh-60px)] custom-scrollbar">
              <pre className="text-xs text-emerald-300 whitespace-pre-wrap font-mono">
                {JSON.stringify(
                  messages.find((m) => m.id === debugMessageId),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
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
