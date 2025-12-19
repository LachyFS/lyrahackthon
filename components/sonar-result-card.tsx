"use client";

import { useState } from "react";
import { ScoutResult } from "@/src/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Github,
  MapPin,
  Star,
  Users,
  Code2,
  MoreVertical,
  ExternalLink,
  Bookmark,
  Mail,
  EyeOff,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { updateSonarResultStatus } from "@/lib/actions/sonar";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface SonarResultCardProps {
  result: ScoutResult;
  onStatusChange?: (resultId: string, status: string) => void;
}

const statusConfig = {
  new: { label: "New", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: Clock },
  viewed: { label: "Viewed", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Check },
  saved: { label: "Saved", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Bookmark },
  contacted: { label: "Contacted", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: Mail },
  dismissed: { label: "Dismissed", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: EyeOff },
};

export function SonarResultCard({ result, onStatusChange }: SonarResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const status = (result.status as keyof typeof statusConfig) || "new";
  const StatusIcon = statusConfig[status]?.icon || Clock;

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await updateSonarResultStatus(
        result.id,
        newStatus as "new" | "viewed" | "saved" | "contacted" | "dismissed"
      );
      onStatusChange?.(result.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const scoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-cyan-400";
    if (score >= 40) return "text-yellow-400";
    return "text-orange-400";
  };

  return (
    <Card className={`bg-white/[0.02] border-white/10 hover:border-white/20 transition-all duration-300 ${status === 'dismissed' ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <img
            src={result.githubAvatarUrl || `https://github.com/${result.githubUsername}.png`}
            alt={result.githubUsername}
            className="w-12 h-12 rounded-full border-2 border-white/20 flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">
                    {result.githubName || result.githubUsername}
                  </h3>
                  <a
                    href={`https://github.com/${result.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">@{result.githubUsername}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {result.matchScore && (
                  <div className={`text-lg font-bold ${scoreColor(result.matchScore)}`}>
                    {result.matchScore}
                  </div>
                )}
                <Badge className={statusConfig[status]?.color || statusConfig.new.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[status]?.label || "New"}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" disabled={isUpdating}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                    <DropdownMenuItem onClick={() => handleStatusChange("saved")} className="cursor-pointer">
                      <Bookmark className="h-4 w-4 mr-2" />
                      Save
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("contacted")} className="cursor-pointer">
                      <Mail className="h-4 w-4 mr-2" />
                      Mark as Contacted
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => handleStatusChange("dismissed")} className="cursor-pointer text-muted-foreground">
                      <EyeOff className="h-4 w-4 mr-2" />
                      Dismiss
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {result.githubBio && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {result.githubBio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
              {result.githubLocation && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{result.githubLocation}</span>
                </div>
              )}
              {result.totalStars !== null && result.totalStars > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />
                  <span>{result.totalStars}</span>
                </div>
              )}
              {result.followers !== null && result.followers > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{result.followers}</span>
                </div>
              )}
              {result.repoCount !== null && result.repoCount > 0 && (
                <div className="flex items-center gap-1">
                  <Github className="h-3.5 w-3.5" />
                  <span>{result.repoCount} repos</span>
                </div>
              )}
            </div>

            {result.topLanguages && result.topLanguages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {result.topLanguages.slice(0, 5).map((lang) => (
                  <Badge key={lang} variant="outline" className="text-xs border-white/10 text-muted-foreground">
                    <Code2 className="h-3 w-3 mr-1" />
                    {lang}
                  </Badge>
                ))}
              </div>
            )}

            {/* Expandable section for match reasons and concerns */}
            {((result.matchReasons && result.matchReasons.length > 0) || (result.concerns && result.concerns.length > 0)) && (
              <div className="mt-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {isExpanded ? "Hide details" : "Show match details"}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-3 pt-3 border-t border-white/5">
                        {result.matchReasons && result.matchReasons.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-emerald-400 mb-1.5">Match Reasons</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {result.matchReasons.map((reason, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.concerns && result.concerns.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-400 mb-1.5">Concerns</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {result.concerns.map((concern, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-orange-400 flex-shrink-0">!</span>
                                  {concern}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <p className="text-xs text-muted-foreground">
                Discovered {formatDistanceToNow(new Date(result.discoveredAt), { addSuffix: true })}
              </p>
              <Link href={`/analyze/${result.githubUsername}`}>
                <Button variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                  Full Analysis
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
