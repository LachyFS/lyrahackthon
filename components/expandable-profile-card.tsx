"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Star,
  ExternalLink,
  Briefcase,
} from "lucide-react";

interface CandidateData {
  username: string;
  name: string | null;
  location: string | null;
  bio: string | null;
  score?: number;
  matchReasons?: string[];
  concerns?: string[];
  accountAgeYears: number;
  repoCount: number;
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

export function ExpandableProfileCard({ candidate }: ExpandableProfileCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/[0.07] transition-colors">
      <div className="p-3 flex items-center gap-3">
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
            <span className="text-xs text-muted-foreground">{candidate.accountAgeYears}y on GitHub</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{candidate.repoCount} repos</span>
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

        {/* View Full Analysis button */}
        <div className="flex-shrink-0">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
          >
            <Link
              href={`/analyze/${candidate.username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Full Analysis
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
