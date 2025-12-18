"use client";

import { Badge } from "@/components/ui/badge";
import {
  Search,
  Globe,
  FileText,
  Loader2,
  AlertTriangle,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { SearchAnalysis, SearchProgress } from "@/lib/actions/search-agent";

interface SearchAgentCardProps {
  analysis: SearchAnalysis;
}

export function SearchAgentCard({ analysis }: SearchAgentCardProps) {
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
                <Wrench className="h-3.5 w-3.5" />
                {analysis.toolCalls.length} steps
              </span>
              <Badge variant="outline" className="text-xs">
                {analysis.searchType}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Calls / Steps */}
      {analysis.toolCalls.length > 0 && (
        <div className="p-4 space-y-2">
          {analysis.toolCalls.map((toolCall, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {toolCall.name}
                </Badge>
                {toolCall.resultsCount !== undefined && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {toolCall.resultsCount} results
                  </span>
                )}
              </div>
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <pre className="text-muted-foreground font-mono text-[10px] mt-2 overflow-x-auto">
                  {JSON.stringify(toolCall.args, null, 2)}
                </pre>
              )}
            </div>
          ))}
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
            <div className="mt-2 p-2 rounded bg-black/40 max-h-24 overflow-auto">
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
          <span className="text-[10px] text-muted-foreground">Complete</span>
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
