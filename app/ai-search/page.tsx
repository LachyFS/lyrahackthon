"use client";

import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense, useCallback } from "react";
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
  Flame,
  Globe,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { AppLayout } from "@/components/app-layout";
import { GitRadarLogoWave, GitRoastLogo } from "@/components/gitradar-logo";
import Link from "next/link";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { ExpandableProfileCard } from "@/components/expandable-profile-card";
import { EmailDraft } from "@/components/email-draft";
import { RepoAnalysisCard, RepoAnalysisError, RepoAnalysisSkeleton, RepoAnalysisProgress, ParallelRepoAnalysisProgress, ParallelRepoAnalysisResults } from "@/components/repo-analysis-card";
import { SearchAgentCard, SearchAgentError, SearchAgentSkeleton, SearchAgentProgress } from "@/components/search-agent-card";
import { motion, AnimatePresence } from "framer-motion";
import type { RepoAnalysis, AnalysisProgress, ParallelAnalysisProgress } from "@/lib/actions/repo-analyze";
import { useSearchHistory, useGitHubUserSearch } from "@/hooks/use-queries";
import type { SearchAnalysis, SearchProgress } from "@/lib/actions/search-agent";

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
  preliminary?: boolean; // True when this is a streaming/preliminary result
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

interface GitHubUserSuggestion {
  login: string;
  avatar_url: string;
  name?: string;
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
  hasFollowingTool = false,
}: {
  toolName: string;
  children: React.ReactNode;
  autoCollapse?: boolean;
  hasFollowingTool?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasAutoCollapsed = useRef(false);

  // Auto-collapse when there's a following tool (takes priority over time-based)
  useEffect(() => {
    if (autoCollapse && hasFollowingTool && !hasAutoCollapsed.current) {
      setIsExpanded(false);
      hasAutoCollapsed.current = true;
    }
  }, [autoCollapse, hasFollowingTool]);

  const getToolLabel = (name: string) => {
    switch (name) {
      case "searchGitHubProfiles":
        return "Search Results";
      case "searchGitHubUsers":
        return "GitHub User Search";
      case "analyzeGitHubProfile":
        return "Profile Analysis";
      case "getTopCandidates":
        return "Reviewed Candidates";
      case "generateDraftEmail":
        return "Email Draft";
      case "analyzeGitHubRepository":
        return "Repository Analysis";
      case "webSearch":
        return "Web Search Results";
      case "scrapeUrls":
        return "Scraped Content";
      case "deepWebSearch":
        return "Deep Search Analysis";
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const roastMode = searchParams.get("roast") === "true";
  const isDev = process.env.NODE_ENV === "development";

  // Autocomplete state
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // React Query hooks for data fetching
  const { data: recentSearches = [], isLoading: loadingRecent } = useSearchHistory(8);
  const { data: suggestions = [] } = useGitHubUserSearch(mentionQuery, {
    enabled: showSuggestions && mentionQuery.length >= 2,
  });

  // Fetch user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { roastMode },
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
    setShowSuggestions(false);
    sendMessage({ parts: [{ type: "text", text: inputValue }] });
    setInputValue("");
  };

  const isLoading = status === "streaming" || status === "submitted";

  // Handle input change with @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || value.length;
    setInputValue(value);

    // Find if we're currently typing a @mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const start = textBeforeCursor.lastIndexOf("@");
      setMentionStart(start);
      const query = mentionMatch[1];

      // Update mention query for React Query to fetch suggestions
      setMentionQuery(query);
      setShowSuggestions(true);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setMentionStart(null);
      setMentionQuery("");
    }
  };

  // Apply a suggestion to the input
  const applySuggestion = (username: string) => {
    if (mentionStart === null) return;

    const beforeMention = inputValue.slice(0, mentionStart);
    const afterCursor = inputValue.slice(
      mentionStart + (inputValue.slice(mentionStart).match(/@\w*/)?.length || 0)
    );
    const newValue = `${beforeMention}@${username}${afterCursor}`;

    setInputValue(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    setMentionStart(null);
    inputRef.current?.focus();
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestionIndex].login);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    // Don't render anything if there's an error in the result
    if (result && typeof result === 'object' && 'error' in result && (result as { error?: string }).error) {
      return null;
    }

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
      };

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

    if (toolName === "searchGitHubUsers") {
      const data = result as {
        query: string;
        total_count: number;
        users: Array<{
          username: string;
          name: string | null;
          bio: string | null;
          location: string | null;
          company: string | null;
          public_repos: number | null;
          followers: number | null;
        }>;
      };

      const maxVisible = 5;
      const visibleUsers = data.users.slice(0, maxVisible);
      const remainingCount = data.users.length - maxVisible;

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Found {data.total_count} users for &quot;{data.query}&quot;</span>
          </div>
          <div className="space-y-2">
            {visibleUsers.map((user, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <img
                  src={`https://github.com/${user.username}.png`}
                  alt={user.username}
                  className="w-8 h-8 rounded-full border border-white/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${user.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      {user.name || user.username}
                    </a>
                    <span className="text-xs text-muted-foreground">@{user.username}</span>
                  </div>
                  {user.bio && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.bio}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {user.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.location}
                      </span>
                    )}
                    {user.followers != null && (
                      <span>{user.followers} followers</span>
                    )}
                    {user.public_repos != null && (
                      <span>{user.public_repos} repos</span>
                    )}
                  </div>
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
      };

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
              <div className="text-lg font-semibold text-white">{data.estimatedExperience?.split(" ")[0] ?? "N/A"}</div>
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
          accountAgeYears: number;
          repoCount: number;
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
          projectType?: string;
        };
      };

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

    if (toolName === "analyzeGitHubRepository") {
      // The result can be either:
      // 1. An AnalysisProgress object (with status, result, etc.) - this is what the streaming returns
      // 2. A direct RepoAnalysis object
      // 3. An error object
      const data = result as AnalysisProgress | RepoAnalysis | { error: string; repoUrl: string };

      // Check if it's an error response
      if ("error" in data && data.error && !("status" in data)) {
        return <RepoAnalysisError error={data.error} repoUrl={(data as { error: string; repoUrl: string }).repoUrl || ""} />;
      }

      // Check if it's an AnalysisProgress wrapper (has status and result fields)
      if ("status" in data && "result" in data) {
        const progressData = data as AnalysisProgress;

        // If there's an error in the progress
        if (progressData.status === "error") {
          return <RepoAnalysisError
            error={progressData.error || progressData.message}
            repoUrl={`https://github.com/${progressData.repoOwner}/${progressData.repoName}`}
          />;
        }

        // Extract the actual RepoAnalysis from the result
        if (progressData.result) {
          return <RepoAnalysisCard analysis={progressData.result} />;
        }

        // Fallback: show skeleton if result is missing
        return <RepoAnalysisSkeleton />;
      }

      // It's a direct RepoAnalysis object
      return <RepoAnalysisCard analysis={data as RepoAnalysis} />;
    }

    if (toolName === "analyzeGitHubRepositories") {
      // Result types for parallel analysis:
      // 1. ParallelAnalysisProgress (streaming progress with repos array)
      // 2. Array of results (final results)
      // 3. Error object
      type ParallelResult = ParallelAnalysisProgress | Array<{
        repoUrl: string;
        repoName: string;
        repoOwner: string;
        result?: RepoAnalysis;
        error?: string;
      }> | { error: string };

      const data = result as ParallelResult;

      // Check if it's an error response
      if ("error" in data && !Array.isArray(data) && !("type" in data)) {
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Bug className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-300 mb-1">Parallel Analysis Failed</div>
                <p className="text-xs text-red-300/70">{(data as { error: string }).error}</p>
              </div>
            </div>
          </div>
        );
      }

      // Check if it's a ParallelAnalysisProgress (streaming update)
      if ("type" in data && "repos" in data) {
        const progressData = data as ParallelAnalysisProgress;

        // If complete, show final results
        if (progressData.type === 'complete' && progressData.results) {
          return <ParallelRepoAnalysisResults results={progressData.results} />;
        }

        // Show progress
        return <ParallelRepoAnalysisProgress progress={progressData} />;
      }

      // It's a direct array of results
      if (Array.isArray(data)) {
        return <ParallelRepoAnalysisResults results={data} />;
      }

      // Fallback
      return <RepoAnalysisSkeleton />;
    }

    if (toolName === "webSearch") {
      const data = result as {
        query?: string;
        results?: Array<{
          title: string;
          url: string;
          snippet?: string;
        }>;
      };

      const results = data.results || [];

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Web Search</span>
          </div>
          {data.query && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <Search className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-white">{data.query}</span>
            </div>
          )}
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.slice(0, 5).map((result, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-medium text-sm flex items-center gap-1"
                  >
                    {result.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {result.snippet && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {result.snippet}
                    </p>
                  )}
                </div>
              ))}
              {results.length > 5 && (
                <div className="text-xs text-muted-foreground pl-2 pt-1">
                  + {results.length - 5} more results
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No results found</p>
          )}
        </div>
      );
    }

    if (toolName === "scrapeUrls") {
      const data = result as {
        results?: Array<{
          url: string;
          title?: string;
          content?: string;
          error?: string;
        }>;
      };

      const results = data.results || [];

      return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Scraped {results.length} URL{results.length !== 1 ? 's' : ''}</span>
          </div>
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline font-medium text-sm truncate flex-1"
                    >
                      {result.title || result.url}
                    </a>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </div>
                  {result.error ? (
                    <p className="text-xs text-red-400 mt-1">{result.error}</p>
                  ) : result.content ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {result.content.slice(0, 200)}{result.content.length > 200 ? '...' : ''}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No URLs scraped</p>
          )}
        </div>
      );
    }

    if (toolName === "deepWebSearch") {
      // The result can be either:
      // 1. A SearchProgress object (with status, result, etc.) - this is what the streaming returns
      // 2. A direct SearchAnalysis object
      // 3. An error object
      const data = result as SearchProgress | SearchAnalysis | { error: string; query: string };

      // Check if it's an error response
      if ("error" in data && data.error && !("status" in data)) {
        return <SearchAgentError error={data.error} query={(data as { error: string; query: string }).query || ""} />;
      }

      // Check if it's a SearchProgress wrapper (has status and result fields)
      if ("status" in data && "result" in data) {
        const progressData = data as SearchProgress;

        // If there's an error in the progress
        if (progressData.status === "error") {
          return <SearchAgentError
            error={progressData.error || progressData.message}
            query={progressData.query || ""}
          />;
        }

        // Extract the actual SearchAnalysis from the result
        if (progressData.result) {
          return <SearchAgentCard analysis={progressData.result} />;
        }

        // Fallback: show skeleton if result is missing
        return <SearchAgentSkeleton />;
      }

      // It's a direct SearchAnalysis object
      return <SearchAgentCard analysis={data as SearchAnalysis} />;
    }

    return null;
  };

  return (
    <AppLayout user={user}>
    <div className={`relative flex-1 flex flex-col overflow-hidden min-h-0 transition-colors duration-500 ${roastMode ? 'bg-zinc-950' : 'bg-background'}`}>
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Roast mode flame gradient from bottom */}
      {roastMode && (
        <div className="absolute inset-0 bg-gradient-to-t from-red-950/40 via-orange-950/20 via-40% to-transparent pointer-events-none" />
      )}

      {/* Animated gradient orbs */}
      <div className={`absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl transition-all duration-700 ${roastMode ? 'opacity-0' : 'bg-emerald-600/20 animate-pulse-glow'}`} />
      <div className={`absolute top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-700 delay-200 ${roastMode ? 'opacity-0' : 'bg-cyan-500/15 animate-pulse-glow'}`} />

      {/* Main Chat Area */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <StickToBottom className="flex-1 relative overflow-auto" resize="smooth" initial="smooth">
          <StickToBottom.Content className="flex flex-col gap-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent container mx-auto px-4 md:px-6 pt-8 pb-8 max-w-4xl">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {roastMode ? (
                  <div className="relative">
                    <GitRoastLogo className="h-16 w-16 mx-auto mb-4 animate-pulse" />
                    <motion.span
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="absolute -top-2 -right-2 text-2xl"
                    >
                      🔥
                    </motion.span>
                  </div>
                ) : (
                  <GitRadarLogoWave className="h-16 w-16 mx-auto mb-4 text-emerald-400/50" />
                )}
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className={`mb-6 ${roastMode ? 'text-red-400/80' : 'text-muted-foreground'}`}
              >
                {roastMode
                  ? "Ready to absolutely demolish some GitHub profiles? Let's see who's been committing crimes against code. 💀"
                  : "Ask me to find developers with specific skills, in certain locations, or working on particular technologies."}
              </motion.p>
              <div className="flex flex-wrap justify-center gap-2">
                {(roastMode
                  ? [
                      "Roast @torvalds",
                      "Roast my profile",
                      "Roast a React dev",
                    ]
                  : [
                      "Rust devs in Sydney",
                      "React engineers",
                      "ML experts in Europe",
                    ]
                ).map((suggestion, index) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                    onClick={() => setInputValue(suggestion)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      roastMode
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>

              {/* Recent Searches Section */}
              {!roastMode && !loadingRecent && recentSearches.length > 0 && (
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
                    {recentSearches.slice(0, 4).map((search, index) => (
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
                    {message.parts.map((part, i, allParts) => {
                      // Check if there's a following tool part after this one
                      const hasFollowingTool = allParts.slice(i + 1).some(p => p.type.startsWith("tool-"));
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

                        // For analyzeGitHubRepository and deepWebSearch, check preliminary FIRST before hasResult
                        const isPreliminaryRepo = toolName === "analyzeGitHubRepository" && toolPart.preliminary;
                        const isPreliminarySearch = toolName === "deepWebSearch" && toolPart.preliminary;
                        const isPreliminary = isPreliminaryRepo || isPreliminarySearch;
                        const showFinalResult = hasResult && !isPreliminary;

                        return (
                          <div key={`tool-${i}`} className="space-y-2">
                            {isPreliminaryRepo && toolResult ? (
                              // Show streaming progress for repo analysis
                              <RepoAnalysisProgress progress={toolResult as AnalysisProgress} />
                            ) : isPreliminarySearch && toolResult ? (
                              // Show streaming progress for deep web search
                              <SearchAgentProgress progress={toolResult as SearchProgress} />
                            ) : showFinalResult ? (
                              <CollapsibleToolResult toolName={toolName} autoCollapse={toolName !== "getTopCandidates" && toolName !== "generateDraftEmail" && toolName !== "analyzeGitHubRepository" && toolName !== "analyzeGitHubProfile" && toolName !== "deepWebSearch"} hasFollowingTool={hasFollowingTool}>
                                {toolResult != null && renderToolResult(toolName, toolResult)}
                              </CollapsibleToolResult>
                            ) : toolName === "analyzeGitHubRepository" ? (
                              // Fallback skeleton for repo analysis
                              <RepoAnalysisSkeleton />
                            ) : toolName === "deepWebSearch" ? (
                              // Fallback skeleton for deep web search
                              <SearchAgentSkeleton />
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>
                                  {toolName === "searchGitHubProfiles"
                                    ? `Searching for "${(toolPart.input as { query?: string })?.query || 'profiles'}"...`
                                    : toolName === "searchGitHubUsers"
                                    ? `Searching GitHub users for "${(toolPart.input as { query?: string })?.query || 'users'}"...`
                                    : toolName === "getTopCandidates"
                                    ? `Ranking ${(toolPart.input as { usernames?: string[] })?.usernames?.length || 0} candidates...`
                                    : toolName === "generateDraftEmail"
                                    ? `Drafting email for ${(toolPart.input as { candidateName?: string })?.candidateName || 'candidate'}...`
                                    : toolName === "webSearch"
                                    ? `Searching the web for "${(toolPart.input as { query?: string })?.query || 'information'}"...`
                                    : toolName === "scrapeUrls"
                                    ? `Scraping ${(toolPart.input as { urls?: string[] })?.urls?.length || ''} URL${((toolPart.input as { urls?: string[] })?.urls?.length || 0) !== 1 ? 's' : ''}...`
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
                              <ReactMarkdown
                                components={{
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-4">
                                      <table className="w-full border-collapse border border-white/20 text-sm">
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  thead: ({ children }) => (
                                    <thead className="bg-white/10">{children}</thead>
                                  ),
                                  th: ({ children }) => (
                                    <th className="border border-white/20 px-3 py-2 text-left font-semibold text-white">
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="border border-white/20 px-3 py-2 text-white/90">
                                      {children}
                                    </td>
                                  ),
                                  tr: ({ children }) => (
                                    <tr className="hover:bg-white/5 transition-colors">{children}</tr>
                                  ),
                                }}
                              >
                                {textPart.text}
                              </ReactMarkdown>
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
          className={`relative sticky bottom-4 backdrop-blur-xl rounded-2xl border p-2 transition-all duration-500 container mx-auto px-4 md:px-6 max-w-4xl ${
            roastMode
              ? 'bg-zinc-900/90 border-red-500/30 shadow-lg shadow-red-500/10'
              : 'bg-background/80 border-white/10'
          }`}
        >
          {/* Autocomplete suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl"
              >
                <div className="p-1">
                  <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Github className="h-3 w-3" />
                    <span>GitHub Users</span>
                    <span className="ml-auto text-[10px] opacity-60">Tab to select</span>
                  </div>
                  {suggestions.map((user, index) => (
                    <button
                      key={user.login}
                      type="button"
                      onClick={() => applySuggestion(user.login)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        index === selectedSuggestionIndex
                          ? 'bg-emerald-500/20 text-white'
                          : 'hover:bg-white/5 text-white/80'
                      }`}
                    >
                      <img
                        src={user.avatar_url}
                        alt={user.login}
                        className="w-7 h-7 rounded-full border border-white/20"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium text-sm truncate">@{user.login}</div>
                        {user.name && (
                          <div className="text-xs text-muted-foreground truncate">{user.name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={roastMode ? "Who's getting roasted today? 🔥" : "Ask me to find developers... (type @ for users)"}
              className={`flex-1 h-12 bg-transparent border-0 focus:ring-0 focus-visible:ring-0 text-white transition-colors duration-300 ${
                roastMode ? 'placeholder:text-red-400/60' : 'placeholder:text-muted-foreground'
              }`}
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className={`h-12 w-12 transition-all duration-300 ${
                roastMode
                  ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400'
                  : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500'
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : roastMode ? (
                <Flame className="h-5 w-5" />
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
    </AppLayout>
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
