"use client";

import { Badge } from "@/components/ui/badge";
import {
  Search,
  Globe,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  Code2,
  MapPin,
  Package,
  Lightbulb,
  Link as LinkIcon,
} from "lucide-react";
import { useState } from "react";
import type { SearchAnalysis, SearchProgress } from "@/lib/actions/search-agent";

interface SearchAgentCardProps {
  analysis: SearchAnalysis;
}

function getRelevanceColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
}

function getRelevanceBg(score: number) {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 60) return "bg-green-500/20 border-green-500/30";
  if (score >= 40) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 20) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}

function getContentTypeIcon(type: string) {
  switch (type) {
    case "article":
      return <FileText className="h-3 w-3" />;
    case "profile":
      return <Users className="h-3 w-3" />;
    case "documentation":
      return <Code2 className="h-3 w-3" />;
    case "forum":
      return <Users className="h-3 w-3" />;
    case "news":
      return <TrendingUp className="h-3 w-3" />;
    default:
      return <Globe className="h-3 w-3" />;
  }
}

function getEntityIcon(type: string) {
  switch (type) {
    case "person":
      return <Users className="h-3.5 w-3.5 text-blue-400" />;
    case "company":
      return <Building2 className="h-3.5 w-3.5 text-purple-400" />;
    case "technology":
      return <Code2 className="h-3.5 w-3.5 text-cyan-400" />;
    case "product":
      return <Package className="h-3.5 w-3.5 text-emerald-400" />;
    case "location":
      return <MapPin className="h-3.5 w-3.5 text-orange-400" />;
    default:
      return <Globe className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getFrequencyColor(frequency: string) {
  switch (frequency) {
    case "high":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    case "low":
      return "bg-white/10 text-white/70 border-white/20";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

export function SearchAgentCard({ analysis }: SearchAgentCardProps) {
  const [showRawResults, setShowRawResults] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden min-w-[400px]">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Search className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold text-white truncate">
                {analysis.query}
              </h3>
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {analysis.totalResultsFound} results
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {analysis.resultsAnalyzed} analyzed
              </span>
              <Badge variant="outline" className="text-xs">
                {analysis.searchType}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-white/10 bg-emerald-500/5">
        <div className="flex items-center gap-2 text-sm text-emerald-400 mb-2">
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">AI Summary</span>
        </div>
        <p className="text-sm text-white leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Key Themes */}
      {analysis.keyThemes.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <TrendingUp className="h-4 w-4" />
            <span>Key Themes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.keyThemes.map((theme, i) => (
              <Badge
                key={i}
                className={`text-xs ${getFrequencyColor(theme.frequency)}`}
              >
                {theme.theme}
                <span className="ml-1 opacity-60">({theme.frequency})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Results */}
      {analysis.topResults.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>Top Results</span>
          </div>
          <div className="space-y-3">
            {analysis.topResults.slice(0, 5).map((result, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium text-sm flex items-center gap-1.5"
                    >
                      {getContentTypeIcon(result.contentType)}
                      <span className="truncate">{result.title}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    {result.snippet && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.snippet}
                      </p>
                    )}
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs font-medium ${getRelevanceBg(result.relevanceScore)}`}>
                    <span className={getRelevanceColor(result.relevanceScore)}>
                      {result.relevanceScore}%
                    </span>
                  </div>
                </div>
                {result.keyInsights.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.keyInsights.slice(0, 2).map((insight, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-white/70">
                        <Lightbulb className="h-3 w-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entities Found */}
      {analysis.entitiesFound.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            <span>Entities Mentioned</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {analysis.entitiesFound.slice(0, 6).map((entity, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-white/5"
              >
                {getEntityIcon(entity.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{entity.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {entity.mentions}x mentioned
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Suggestions */}
      {analysis.followUpSuggestions.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            <span>Suggested Follow-ups</span>
          </div>
          <div className="space-y-1.5">
            {analysis.followUpSuggestions.slice(0, 3).map((suggestion, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-white/70 p-2 rounded bg-white/5"
              >
                <span className="text-yellow-400 mt-0.5">•</span>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Results (Collapsible) */}
      {analysis.rawResults.length > 0 && (
        <div className="border-t border-white/10">
          <button
            onClick={() => setShowRawResults(!showRawResults)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              All Scraped URLs ({analysis.rawResults.length})
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showRawResults ? "rotate-180" : ""}`} />
          </button>
          {showRawResults && (
            <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {analysis.rawResults.map((result, i) => (
                <div key={i} className="p-2 rounded bg-white/5 text-xs">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-mono truncate block"
                  >
                    {result.url}
                  </a>
                  <div className="text-white mt-1">{result.title}</div>
                  {result.contentPreview && (
                    <div className="text-muted-foreground mt-1 line-clamp-2">
                      {result.contentPreview}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Progress display for streaming search agent
export function SearchAgentProgress({ progress }: { progress: SearchProgress }) {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'initializing':
        return <Sparkles className="h-5 w-5 text-cyan-400" />;
      case 'searching':
        return <Search className="h-5 w-5 text-purple-400" />;
      case 'scraping':
        return <Globe className="h-5 w-5 text-emerald-400" />;
      case 'analyzing_result':
        return <FileText className="h-5 w-5 text-yellow-400" />;
      case 'synthesizing':
        return <Sparkles className="h-5 w-5 text-pink-400" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'initializing': return 'border-cyan-500/30 bg-cyan-500/5';
      case 'searching': return 'border-purple-500/30 bg-purple-500/5';
      case 'scraping': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'analyzing_result': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'synthesizing': return 'border-pink-500/30 bg-pink-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-white/10 bg-white/5';
    }
  };

  const getStatusLabel = () => {
    switch (progress.status) {
      case 'initializing': return 'Initializing Search';
      case 'searching': return 'Searching the Web';
      case 'scraping': return 'Scraping Content';
      case 'analyzing_result': return 'Analyzing Result';
      case 'synthesizing': return 'AI Synthesizing';
      case 'error': return 'Error';
      default: return 'Processing...';
    }
  };

  const progressPercentage = progress.totalSteps && progress.currentStep
    ? Math.round((progress.currentStep / progress.totalSteps) * 100)
    : 0;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${getStatusColor()}`}>
      {/* Query header */}
      {progress.query && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-emerald-400">
              {progress.query}
            </span>
          </div>
        </div>
      )}

      {/* Status header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            {getStatusIcon()}
            {progress.status !== 'error' && progress.status !== 'complete' && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">{getStatusLabel()}</span>
              {progress.resultsFound !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {progress.resultsProcessed || 0}/{progress.resultsFound} processed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {progress.message}
            </p>
          </div>
        </div>
      </div>

      {/* Current URL being scraped */}
      {(progress.status === 'scraping' || progress.status === 'analyzing_result') && progress.currentUrl && (
        <div className="p-3 bg-black/30">
          <div className="flex items-start gap-2">
            <Globe className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <a
                href={progress.currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-cyan-300 hover:underline truncate block"
              >
                {progress.currentUrl}
              </a>
              {progress.currentTitle && (
                <p className="text-xs text-white mt-1">
                  {progress.currentTitle}
                </p>
              )}
            </div>
          </div>
          {progress.scrapedContent && (
            <div className="mt-2 p-2 rounded bg-black/40 max-h-20 overflow-auto">
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap break-all">
                {progress.scrapedContent.slice(0, 300)}
                {progress.scrapedContent.length > 300 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">Progress</span>
          <span className="text-[10px] text-muted-foreground">{progressPercentage}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Search</span>
          <span className="text-[10px] text-muted-foreground">Scrape</span>
          <span className="text-[10px] text-muted-foreground">Analyze</span>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton for search agent (fallback when no progress data)
export function SearchAgentSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden animate-pulse">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-sm text-muted-foreground">Searching and analyzing...</span>
        </div>
        <div className="h-6 w-48 bg-white/10 rounded mb-2" />
        <div className="h-4 w-full bg-white/5 rounded" />
      </div>
      <div className="p-4 space-y-4">
        <div className="h-20 bg-white/5 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Error display for search agent
export function SearchAgentError({ error, query }: { error: string; query: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-red-300 mb-1">Search Failed</div>
          <p className="text-xs text-red-300/70 mb-2">{error}</p>
          <p className="text-xs text-red-400">
            Query: &quot;{query}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
