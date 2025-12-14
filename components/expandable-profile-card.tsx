"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  Star,
  ExternalLink,
  ChevronDown,
  Code2,
  CheckCircle,
  AlertTriangle,
  Users,
  GitFork,
  TrendingUp,
  Loader2,
  Briefcase,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/actions/github-analyze";

// LinkedIn icon
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface CandidateData {
  username: string;
  name: string | null;
  location: string | null;
  bio: string | null;
  score?: number;
  matchReasons?: string[];
  concerns?: string[];
  experience: string;
  activityLevel: string;
  topLanguages: string[];
  topics?: string[];
  totalStars: number;
  followers: number;
  recentlyActiveRepos?: number;
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
}

interface ExpandableProfileCardProps {
  candidate: CandidateData;
}

function AnalysisSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center">
            <div className="h-6 w-12 mx-auto bg-white/10 rounded mb-1" />
            <div className="h-3 w-16 mx-auto bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Languages skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-20 bg-white/10 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-3 w-8 bg-white/5 rounded" />
              </div>
              <div className="h-1.5 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Repos skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="grid gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5">
              <div className="h-4 w-32 bg-white/10 rounded mb-2" />
              <div className="h-3 w-full bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getActivityColor(level: string) {
  switch (level) {
    case "very_active":
      return "text-emerald-400";
    case "active":
      return "text-green-400";
    case "moderate":
      return "text-yellow-400";
    case "low":
      return "text-orange-400";
    case "inactive":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getActivityLabel(level: string) {
  switch (level) {
    case "very_active":
      return "Very Active";
    case "active":
      return "Active";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    case "inactive":
      return "Inactive";
    default:
      return level;
  }
}

function getRecommendationBadge(recommendation: string) {
  switch (recommendation) {
    case "strong":
      return { label: "Strong", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    case "good":
      return { label: "Good", className: "bg-green-500/20 text-green-300 border-green-500/30" };
    case "moderate":
      return { label: "Moderate", className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
    case "weak":
      return { label: "Needs Review", className: "bg-red-500/20 text-red-300 border-red-500/30" };
    default:
      return { label: "Unknown", className: "bg-white/10 text-white/70" };
  }
}

export function ExpandableProfileCard({ candidate }: ExpandableProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!isExpanded && !analysisData && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analyze/${candidate.username}`);
        if (!response.ok) {
          throw new Error("Failed to fetch analysis");
        }
        const data = await response.json();
        setAnalysisData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const badge = analysisData
    ? getRecommendationBadge(analysisData.analysis.recommendation)
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/[0.07] transition-colors">
      {/* Collapsed header - clickable */}
      <button
        onClick={handleToggle}
        className="w-full p-3 flex items-center gap-3 text-left"
      >
        {/* Avatar */}
        <img
          src={`https://github.com/${candidate.username}.png`}
          alt={candidate.username}
          className="w-10 h-10 rounded-full border border-white/20 flex-shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-white">
              {candidate.name || candidate.username}
            </span>
            <span className="text-xs text-muted-foreground">@{candidate.username}</span>
            {candidate.location && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {candidate.location}
              </span>
            )}
          </div>

          {/* Stats & Languages inline */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{candidate.experience.split(" ")[0]}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Star className="h-3 w-3" />
              {candidate.totalStars.toLocaleString()}
            </span>
            {candidate.topLanguages.slice(0, 3).map((lang) => (
              <Badge key={lang} variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                {lang}
              </Badge>
            ))}
            {candidate.signals?.isHireable && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                <Briefcase className="h-3 w-3" />
                Open to work
              </span>
            )}
          </div>
        </div>

        {/* Expand indicator and actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {analysisData && badge && (
            <Badge className={`${badge.className} text-[10px]`}>
              {analysisData.analysis.overallScore}
            </Badge>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-white/10">
          {isLoading ? (
            <AnalysisSkeleton />
          ) : error ? (
            <div className="p-4 text-center text-red-400 text-sm">{error}</div>
          ) : analysisData ? (
            <div className="p-4 space-y-4">
              {/* Score and Recommendation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {analysisData.analysis.overallScore}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Score</div>
                  </div>
                  {badge && (
                    <Badge className={badge.className}>{badge.label} Candidate</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(candidate.name || candidate.username)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 transition-colors"
                    title="Search on LinkedIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LinkedInIcon className="h-4 w-4" />
                  </a>
                  <Link
                    href={`/analyze/${candidate.username}`}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {analysisData.profile.public_repos}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Repos</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">
                    {analysisData.analysis.totalStars}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Stars</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">
                    {analysisData.profile.followers}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Followers</div>
                </div>
                <div>
                  <div className={`text-sm font-medium ${getActivityColor(analysisData.analysis.activityLevel)}`}>
                    {getActivityLabel(analysisData.analysis.activityLevel)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Activity</div>
                </div>
              </div>

              {/* Languages */}
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Code2 className="h-3 w-3" />
                  <span>Languages</span>
                </div>
                <div className="space-y-1.5">
                  {analysisData.analysis.languages.slice(0, 4).map((lang) => (
                    <div key={lang.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-white">{lang.name}</span>
                        <span className="text-muted-foreground">{lang.percentage}%</span>
                      </div>
                      <Progress value={lang.percentage} className="h-1" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Concerns */}
              <div className="grid grid-cols-2 gap-3">
                {analysisData.analysis.strengths.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                      <span>Strengths</span>
                    </div>
                    <ul className="space-y-1">
                      {analysisData.analysis.strengths.slice(0, 3).map((strength, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisData.analysis.concerns.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <span>Considerations</span>
                    </div>
                    <ul className="space-y-1">
                      {analysisData.analysis.concerns.slice(0, 3).map((concern, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                          <span className="text-amber-400 mt-0.5">•</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Top Repos */}
              {analysisData.analysis.topRepos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Star className="h-3 w-3" />
                    <span>Top Repositories</span>
                  </div>
                  <div className="grid gap-2">
                    {analysisData.analysis.topRepos.slice(0, 3).map((repo) => (
                      <a
                        key={repo.id}
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-emerald-400">{repo.name}</span>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {repo.language && (
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <GitFork className="h-2.5 w-2.5" />
                              {repo.forks_count}
                            </span>
                          </div>
                        </div>
                        {repo.description && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                            {repo.description}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* View full analysis link */}
              <Link
                href={`/analyze/${candidate.username}`}
                className="block text-center text-xs text-cyan-400 hover:text-cyan-300 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                View full analysis →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
