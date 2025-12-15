"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguageIcon } from "@/components/language-icon";
import {
  Code2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  GitBranch,
  FileCode,
  TestTube,
  BookOpen,
  GitCommit,
  Users,
  Gauge,
  Star,
  ChevronDown,
  Loader2,
  Terminal,
  Server,
  GitFork,
  Cpu,
  FileSearch,
} from "lucide-react";
import { useState } from "react";
import type { RepoAnalysis, AnalysisProgress } from "@/lib/actions/repo-analyze";

interface RepoAnalysisCardProps {
  analysis: RepoAnalysis;
}

function getSkillLevelColor(level: string) {
  switch (level) {
    case "expert":
      return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    case "senior":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "intermediate":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "junior":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    case "beginner":
      return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    default:
      return "bg-white/10 text-white/70";
  }
}

function getRecommendationStyle(recommendation: string) {
  switch (recommendation) {
    case "strong_yes":
      return { label: "Strong Yes", color: "text-emerald-400", bg: "bg-emerald-500/20" };
    case "yes":
      return { label: "Yes", color: "text-green-400", bg: "bg-green-500/20" };
    case "maybe":
      return { label: "Maybe", color: "text-yellow-400", bg: "bg-yellow-500/20" };
    case "likely_no":
      return { label: "Likely No", color: "text-orange-400", bg: "bg-orange-500/20" };
    case "no":
      return { label: "No", color: "text-red-400", bg: "bg-red-500/20" };
    default:
      return { label: "Unknown", color: "text-white/70", bg: "bg-white/10" };
  }
}

function getQualityColor(quality: string) {
  switch (quality) {
    case "excellent":
      return "text-emerald-400";
    case "good":
      return "text-green-400";
    case "average":
      return "text-yellow-400";
    case "below_average":
      return "text-orange-400";
    case "poor":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getComplexityColor(complexity: string) {
  switch (complexity) {
    case "very_complex":
      return "text-purple-400";
    case "complex":
      return "text-blue-400";
    case "moderate":
      return "text-cyan-400";
    case "simple":
      return "text-green-400";
    case "trivial":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function formatComplexity(complexity: string) {
  return complexity.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RepoAnalysisCard({ analysis }: RepoAnalysisCardProps) {
  const [showFindings, setShowFindings] = useState(false);
  const recommendation = getRecommendationStyle(analysis.hiringRecommendation ?? "maybe");

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden min-w-[400px]">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">
                {analysis.repoOwner}/{analysis.repoName}
              </h3>
              <a
                href={`https://github.com/${analysis.repoOwner}/${analysis.repoName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {analysis.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {analysis.description}
              </p>
            )}
          </div>
          {analysis.skillLevel && (
            <Badge className={getSkillLevelColor(analysis.skillLevel)}>
              {analysis.skillLevel.charAt(0).toUpperCase() + analysis.skillLevel.slice(1)}
            </Badge>
          )}
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {analysis.primaryLanguages?.slice(0, 4).map((lang) => (
            <Badge key={lang} variant="outline" className="text-xs inline-flex items-center gap-1.5">
              <LanguageIcon language={lang} size="sm" />
              {lang}
            </Badge>
          ))}
          {analysis.frameworks?.slice(0, 3).map((fw) => (
            <Badge key={fw} variant="outline" className="text-xs bg-white/5">
              {fw}
            </Badge>
          ))}
        </div>
      </div>

      {/* Hiring Recommendation Banner */}
      <div className={`px-4 py-3 ${recommendation.bg} border-b border-white/10`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Hiring Recommendation</span>
          <span className={`text-lg font-bold ${recommendation.color}`}>
            {recommendation.label}
          </span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-white/10">
        <div className="text-center">
          <div className={`text-lg font-semibold ${getQualityColor(analysis.codeQuality ?? "average")}`}>
            {(analysis.codeQuality ?? "average").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Code2 className="h-3 w-3" />
            Code Quality
          </div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-semibold ${getComplexityColor(analysis.complexity?.level ?? "moderate")}`}>
            {formatComplexity(analysis.complexity?.level ?? "moderate")}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Gauge className="h-3 w-3" />
            Complexity
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">
            {analysis.complexity?.fileCount ?? 0}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <FileCode className="h-3 w-3" />
            Files
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-white">
            {analysis.professionalism?.score ?? 0}/10
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Star className="h-3 w-3" />
            Professionalism
          </div>
        </div>
      </div>

      {/* Feature Indicators */}
      <div className="grid grid-cols-4 gap-2 p-4 border-b border-white/10">
        <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${analysis.hasTests ? "bg-emerald-500/10" : "bg-white/5"}`}>
          <TestTube className={`h-5 w-5 ${analysis.hasTests ? "text-emerald-400" : "text-muted-foreground"}`} />
          <span className={`text-xs ${analysis.hasTests ? "text-emerald-300" : "text-muted-foreground"}`}>
            Tests
          </span>
        </div>
        <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${analysis.hasCI ? "bg-blue-500/10" : "bg-white/5"}`}>
          <GitBranch className={`h-5 w-5 ${analysis.hasCI ? "text-blue-400" : "text-muted-foreground"}`} />
          <span className={`text-xs ${analysis.hasCI ? "text-blue-300" : "text-muted-foreground"}`}>
            CI/CD
          </span>
        </div>
        <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${analysis.hasDocumentation ? "bg-purple-500/10" : "bg-white/5"}`}>
          <BookOpen className={`h-5 w-5 ${analysis.hasDocumentation ? "text-purple-400" : "text-muted-foreground"}`} />
          <span className={`text-xs ${analysis.hasDocumentation ? "text-purple-300" : "text-muted-foreground"}`}>
            Docs
          </span>
        </div>
        <div className={`flex flex-col items-center gap-1 p-2 rounded-lg ${analysis.gitPractices?.prUsage ? "bg-cyan-500/10" : "bg-white/5"}`}>
          <Users className={`h-5 w-5 ${analysis.gitPractices?.prUsage ? "text-cyan-400" : "text-muted-foreground"}`} />
          <span className={`text-xs ${analysis.gitPractices?.prUsage ? "text-cyan-300" : "text-muted-foreground"}`}>
            PRs
          </span>
        </div>
      </div>

      {/* Professionalism Details */}
      {analysis.professionalism && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <GitCommit className="h-4 w-4" />
            <span>Professional Practices</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Commit Messages</div>
              <div className={`text-sm font-medium ${getQualityColor(analysis.professionalism.commitMessageQuality ?? "average")}`}>
                {(analysis.professionalism.commitMessageQuality ?? "average").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Code Organization</div>
              <div className={`text-sm font-medium ${getQualityColor(analysis.professionalism.codeOrganization ?? "average")}`}>
                {(analysis.professionalism.codeOrganization ?? "average").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Naming Conventions</div>
              <div className="text-sm font-medium text-white">
                {(analysis.professionalism.namingConventions ?? "consistent").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Error Handling</div>
              <div className={`text-sm font-medium ${getQualityColor(analysis.professionalism.errorHandling === "comprehensive" ? "excellent" : analysis.professionalism.errorHandling === "adequate" ? "good" : analysis.professionalism.errorHandling === "minimal" ? "average" : "poor")}`}>
                {(analysis.professionalism.errorHandling ?? "adequate").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Indicators */}
      {analysis.skillIndicators?.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="text-sm text-muted-foreground mb-3">Skill Indicators</div>
          <div className="space-y-2">
            {analysis.skillIndicators.slice(0, 5).map((indicator, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg ${
                  indicator.significance === "positive"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : indicator.significance === "negative"
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <div className="flex items-start gap-2">
                  {indicator.significance === "positive" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : indicator.significance === "negative" ? (
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-white/20 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-sm text-white">{indicator.indicator}</div>
                    <div className="text-xs text-muted-foreground">{indicator.explanation}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Areas for Growth */}
      <div className="grid grid-cols-2 gap-4 p-4 border-b border-white/10">
        {analysis.strengths?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Strengths</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.strengths.map((strength, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.areasForGrowth?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Areas for Growth</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.areasForGrowth.map((area, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="p-4 border-b border-white/10">
          <div className="text-sm text-muted-foreground mb-2">Summary</div>
          <p className="text-sm text-white leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Raw Findings (Collapsible) */}
      {analysis.rawFindings?.length > 0 && (
        <div className="border-t border-white/10">
          <button
            onClick={() => setShowFindings(!showFindings)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <span>Analysis Details ({analysis.rawFindings.length} commands)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showFindings ? "rotate-180" : ""}`} />
          </button>
          {showFindings && (
            <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {analysis.rawFindings.map((finding, i) => (
                <div key={i} className="p-2 rounded bg-white/5 text-xs">
                  <div className="font-mono text-cyan-400 mb-1">{finding.command}</div>
                  <div className="text-muted-foreground">{finding.purpose}</div>
                  {finding.keyFindings && (
                    <div className="mt-1 text-white/70 line-clamp-2">{finding.keyFindings}</div>
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

// Decode HTML entities in strings (e.g., &amp; -> &, &lt; -> <)
function decodeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39|apos|#x27|#x2F|#47);/g, (match) => entities[match] || match);
}

// Progress display for streaming repo analysis
export function RepoAnalysisProgress({ progress }: { progress: AnalysisProgress }) {
  // Decode HTML entities and clean up sandbox paths in command and output
  const cleanCommand = (cmd: string) => {
    let cleaned = decodeHtmlEntities(cmd);
    // Remove /vercel/sandbox path references
    cleaned = cleaned.replace(/\/vercel\/sandbox\/?/g, '');
    return cleaned;
  };

  const decodedCommand = progress.command ? cleanCommand(progress.command) : undefined;
  const decodedOutput = progress.commandOutput ? decodeHtmlEntities(progress.commandOutput) : undefined;

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'validating':
        return <FileSearch className="h-5 w-5 text-cyan-400" />;
      case 'spinning_up_sandbox':
        return <Server className="h-5 w-5 text-purple-400" />;
      case 'cloning_repository':
        return <GitFork className="h-5 w-5 text-emerald-400" />;
      case 'executing_command':
        return <Terminal className="h-5 w-5 text-yellow-400" />;
      case 'analyzing':
        return <Cpu className="h-5 w-5 text-blue-400" />;
      case 'generating_report':
        return <FileCode className="h-5 w-5 text-pink-400" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-400" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'validating': return 'border-cyan-500/30 bg-cyan-500/5';
      case 'spinning_up_sandbox': return 'border-purple-500/30 bg-purple-500/5';
      case 'cloning_repository': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'executing_command': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'analyzing': return 'border-blue-500/30 bg-blue-500/5';
      case 'generating_report': return 'border-pink-500/30 bg-pink-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-white/10 bg-white/5';
    }
  };

  const getStatusLabel = () => {
    switch (progress.status) {
      case 'validating': return 'Validating Repository';
      case 'spinning_up_sandbox': return 'Setting Up Virtual Environment';
      case 'cloning_repository': return 'Cloning Repository';
      case 'executing_command': return 'Running Analysis';
      case 'analyzing': return 'AI agent analyzing codebase in sandbox';
      case 'generating_report': return 'Generating Report';
      case 'error': return 'Error';
      default: return 'Analyzing...';
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${getStatusColor()}`}>
      {/* Repo name header */}
      {progress.repoOwner && progress.repoName && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <GitFork className="h-4 w-4 text-muted-foreground" />
            <a
              href={`https://github.com/${progress.repoOwner}/${progress.repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              {progress.repoOwner}/{progress.repoName}
            </a>
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
              {progress.stepNumber && (
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/10">
                  Step {progress.stepNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {progress.message}
            </p>
          </div>
        </div>
      </div>

      {/* Command display for executing_command status */}
      {progress.status === 'executing_command' && decodedCommand && (
        <div className="p-3 bg-black/30">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-mono text-xs mt-0.5">$</span>
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-cyan-300 break-all">
                {decodedCommand}
              </code>
              {progress.purpose && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {progress.purpose}
                </p>
              )}
            </div>
          </div>
          {decodedOutput && (
            <div className="mt-2 p-2 rounded bg-black/40 max-h-24 overflow-auto">
              <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap break-all">
                {decodedOutput.slice(0, 300)}
                {decodedOutput.length > 300 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Progress stages visualization */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center justify-between gap-1">
          {['validating', 'spinning_up_sandbox', 'cloning_repository', 'executing_command', 'generating_report'].map((stage, i) => {
            const stages = ['validating', 'spinning_up_sandbox', 'cloning_repository', 'executing_command', 'generating_report'];
            const currentIndex = stages.indexOf(progress.status);
            const isComplete = i < currentIndex;
            const isCurrent = stage === progress.status;

            return (
              <div key={stage} className="flex items-center flex-1">
                <div
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-emerald-500' :
                    isCurrent ? 'bg-emerald-500/50 animate-pulse' :
                    'bg-white/10'
                  }`}
                />
                {i < stages.length - 1 && <div className="w-1" />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Setup</span>
          <span className="text-[10px] text-muted-foreground">Analysis</span>
          <span className="text-[10px] text-muted-foreground">Report</span>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton for repo analysis (fallback when no progress data)
export function RepoAnalysisSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden animate-pulse">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-sm text-muted-foreground">Analyzing repository...</span>
        </div>
        <div className="h-6 w-48 bg-white/10 rounded mb-2" />
        <div className="h-4 w-full bg-white/5 rounded" />
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <div className="h-6 w-12 mx-auto bg-white/10 rounded mb-1" />
              <div className="h-3 w-16 mx-auto bg-white/5 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Error display for repo analysis
export function RepoAnalysisError({ error, repoUrl }: { error: string; repoUrl: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-red-300 mb-1">Repository Analysis Failed</div>
          <p className="text-xs text-red-300/70 mb-2">{error}</p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            View repository on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
