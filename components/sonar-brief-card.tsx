"use client";

import { useState, useEffect } from "react";
import { ScoutBrief, ScoutResult } from "@/src/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  Users,
  MapPin,
  Code2,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Briefcase,
  Building2,
  Wifi,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { updateSonarBrief, deleteSonarBrief, getSonarResults } from "@/lib/actions/sonar";
import { SonarResultCard } from "@/components/sonar-result-card";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface SonarBriefWithStats extends ScoutBrief {
  totalResults: number;
  newResults: number;
}

interface SonarBriefCardProps {
  brief: SonarBriefWithStats;
  onEdit?: (brief: ScoutBrief) => void;
  onRunSearch?: (briefId: string) => void;
  isSearching?: boolean;
  onRefresh?: () => void;
}

function formatSalary(min: number | null, max: number | null, period: string | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };
  const p = period === "hourly" ? "/hr" : period === "monthly" ? "/mo" : "/yr";
  if (min && max) return `${fmt(min)} - ${fmt(max)}${p}`;
  if (min) return `${fmt(min)}+${p}`;
  if (max) return `Up to ${fmt(max)}${p}`;
  return "";
}

export function SonarBriefCard({ brief, onEdit, onRunSearch, isSearching, onRefresh }: SonarBriefCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const salaryDisplay = formatSalary(brief.salaryMin, brief.salaryMax, brief.salaryPeriod);

  // Fetch results when expanded
  useEffect(() => {
    if (isExpanded && results.length === 0 && brief.totalResults > 0) {
      setIsLoadingResults(true);
      getSonarResults(brief.id, { limit: 10 })
        .then((data) => setResults(data))
        .finally(() => setIsLoadingResults(false));
    }
  }, [isExpanded, brief.id, brief.totalResults, results.length]);

  // Refresh results after a search completes
  useEffect(() => {
    if (!isSearching && isExpanded) {
      getSonarResults(brief.id, { limit: 10 }).then((data) => setResults(data));
    }
  }, [isSearching, isExpanded, brief.id]);

  const handleStatusChange = (resultId: string, newStatus: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, status: newStatus } : r))
    );
    onRefresh?.();
  };

  const handleToggleActive = async () => {
    setIsUpdating(true);
    try {
      await updateSonarBrief({ id: brief.id, isActive: !brief.isActive });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await deleteSonarBrief(brief.id);
    } finally {
      setIsUpdating(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="bg-white/[0.02] border-white/10 hover:border-white/20 transition-all duration-300 group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg ${brief.isActive ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                <Activity className={`h-5 w-5 ${brief.isActive ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg text-white truncate">{brief.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {brief.lastSearchAt
                    ? `Last searched ${formatDistanceToNow(new Date(brief.lastSearchAt), { addSuffix: true })}`
                    : "Never searched"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {brief.newResults > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  {brief.newResults} new
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                  <DropdownMenuItem onClick={() => onEdit?.(brief)} className="cursor-pointer">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleActive} disabled={isUpdating} className="cursor-pointer">
                    {brief.isActive ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="cursor-pointer text-red-400 focus:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {brief.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {brief.description}
            </p>
          )}

          {/* Skills */}
          {brief.requiredSkills && brief.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {brief.requiredSkills.slice(0, 6).map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                  <Code2 className="h-3 w-3 mr-1" />
                  {skill}
                </Badge>
              ))}
              {brief.requiredSkills.length > 6 && (
                <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">
                  +{brief.requiredSkills.length - 6} more
                </Badge>
              )}
            </div>
          )}

          {/* Labels row - salary, experience, employment type, remote, location, project type */}
          <div className="flex flex-wrap gap-2">
            {salaryDisplay && (
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                <DollarSign className="h-3 w-3 mr-1" />
                {salaryDisplay}
              </Badge>
            )}
            {brief.experienceLevel && (
              <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-300">
                <Briefcase className="h-3 w-3 mr-1" />
                {brief.experienceLevel.charAt(0).toUpperCase() + brief.experienceLevel.slice(1)}
              </Badge>
            )}
            {brief.employmentType && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                <Clock className="h-3 w-3 mr-1" />
                {brief.employmentType.charAt(0).toUpperCase() + brief.employmentType.slice(1).replace("-", " ")}
              </Badge>
            )}
            {brief.remotePolicy && (
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                <Wifi className="h-3 w-3 mr-1" />
                {brief.remotePolicy.charAt(0).toUpperCase() + brief.remotePolicy.slice(1)}
              </Badge>
            )}
            {brief.preferredLocation && (
              <Badge variant="outline" className="text-xs border-pink-500/30 text-pink-300">
                <MapPin className="h-3 w-3 mr-1" />
                {brief.preferredLocation}
              </Badge>
            )}
            {brief.projectType && (
              <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-300">
                <Sparkles className="h-3 w-3 mr-1" />
                {brief.projectType}
              </Badge>
            )}
            {brief.companyName && (
              <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                <Building2 className="h-3 w-3 mr-1" />
                {brief.companyName}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{brief.totalResults} found</span>
              </div>
              <Badge variant="outline" className={`text-xs ${brief.isActive ? 'border-emerald-500/30 text-emerald-300' : 'border-white/10 text-muted-foreground'}`}>
                {brief.searchFrequency}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRunSearch?.(brief.id)}
                disabled={isSearching}
                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-1" />
                    Run Now
                  </>
                )}
              </Button>
              {brief.totalResults > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="border-white/10 hover:border-white/20"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide Results
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show Results
                    </>
                  )}
                </Button>
              )}
              <Link href={`/sonar/${brief.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-white"
                >
                  View All
                </Button>
              </Link>
            </div>
          </div>

          {/* Inline Results Section */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  {isLoadingResults ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                    </div>
                  ) : results.length > 0 ? (
                    <>
                      {results.map((result, index) => (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                        >
                          <SonarResultCard
                            result={result}
                            onStatusChange={handleStatusChange}
                          />
                        </motion.div>
                      ))}
                      {brief.totalResults > results.length && (
                        <div className="text-center pt-2">
                          <Link href={`/sonar/${brief.id}`}>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
                              View all {brief.totalResults} results
                            </Button>
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No results yet. Run a search to find matching developers.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-zinc-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Search</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{brief.name}&quot;? This will also delete all {brief.totalResults} discovered profiles. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {isUpdating ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
