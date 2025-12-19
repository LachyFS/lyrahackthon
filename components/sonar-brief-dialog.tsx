"use client";

import { useState, useEffect } from "react";
import { ScoutBrief } from "@/src/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Sparkles,
  Activity,
  MapPin,
  Code2,
  DollarSign,
  Briefcase,
  Building2,
  Wifi,
  Clock,
} from "lucide-react";
import { createSonarBrief, updateSonarBrief } from "@/lib/actions/sonar";
import { extractJobInfo, type JobExtraction } from "@/lib/actions/extract-job-info";

interface SonarBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief?: ScoutBrief | null;
  onSuccess?: () => void;
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

export function SonarBriefDialog({ open, onOpenChange, brief, onSuccess }: SonarBriefDialogProps) {
  const isEditing = !!brief;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [extraction, setExtraction] = useState<JobExtraction | null>(null);

  // Reset form when dialog opens/closes or brief changes
  useEffect(() => {
    if (open) {
      if (brief) {
        setDescription(brief.description || "");
        // Reconstruct extraction from existing brief data
        setExtraction({
          name: brief.name,
          skills: brief.requiredSkills || [],
          location: brief.preferredLocation || null,
          projectType: (brief.projectType as JobExtraction["projectType"]) || null,
          salaryMin: brief.salaryMin || null,
          salaryMax: brief.salaryMax || null,
          salaryPeriod: (brief.salaryPeriod as JobExtraction["salaryPeriod"]) || null,
          experienceLevel: (brief.experienceLevel as JobExtraction["experienceLevel"]) || null,
          employmentType: (brief.employmentType as JobExtraction["employmentType"]) || null,
          remotePolicy: (brief.remotePolicy as JobExtraction["remotePolicy"]) || null,
          companyName: brief.companyName || null,
        });
      } else {
        setDescription("");
        setExtraction(null);
      }
      setError(null);
    }
  }, [open, brief]);

  // Extract info when description changes (debounced)
  useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < 30) {
      setExtraction(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsExtracting(true);
      try {
        const result = await extractJobInfo(trimmed);
        setExtraction(result);
      } catch (err) {
        console.error("Extraction failed:", err);
      } finally {
        setIsExtracting(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("Please describe what you're looking for");
      return;
    }

    if (trimmedDescription.length < 20) {
      setError("Please provide more detail about the role or skills you need");
      return;
    }

    if (!extraction) {
      setError("Please wait for AI to analyze your description");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && brief) {
        const result = await updateSonarBrief({
          id: brief.id,
          name: extraction.name,
          description: trimmedDescription,
          requiredSkills: extraction.skills,
          preferredLocation: extraction.location || undefined,
          projectType: extraction.projectType || undefined,
          salaryMin: extraction.salaryMin || undefined,
          salaryMax: extraction.salaryMax || undefined,
          salaryPeriod: extraction.salaryPeriod || undefined,
          experienceLevel: extraction.experienceLevel || undefined,
          employmentType: extraction.employmentType || undefined,
          remotePolicy: extraction.remotePolicy || undefined,
          companyName: extraction.companyName || undefined,
        });

        if (!result.success) {
          setError(result.error || "Failed to update");
          return;
        }
      } else {
        const result = await createSonarBrief({
          name: extraction.name,
          description: trimmedDescription,
          requiredSkills: extraction.skills,
          preferredLocation: extraction.location || undefined,
          projectType: extraction.projectType || undefined,
          salaryMin: extraction.salaryMin || undefined,
          salaryMax: extraction.salaryMax || undefined,
          salaryPeriod: extraction.salaryPeriod || undefined,
          experienceLevel: extraction.experienceLevel || undefined,
          employmentType: extraction.employmentType || undefined,
          remotePolicy: extraction.remotePolicy || undefined,
          companyName: extraction.companyName || undefined,
          searchFrequency: "daily",
        });

        if (!result.success) {
          setError(result.error || "Failed to create");
          return;
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const salaryDisplay = extraction ? formatSalary(extraction.salaryMin, extraction.salaryMax, extraction.salaryPeriod) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 sm:max-w-[700px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              {isEditing ? "Edit Search" : "What are you looking for?"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste a job posting or describe the developer you're looking for...

Example: Looking for a senior React developer with TypeScript experience, remote friendly, $150-180k salary range. Should have experience with Next.js and GraphQL."
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60 min-h-[180px] text-base leading-relaxed resize-none"
            />

            {/* AI Extraction Preview */}
            {(isExtracting || extraction) && (
              <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-muted-foreground">Analyzing with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">AI Extracted</span>
                    </>
                  )}
                </div>

                {extraction && (
                  <div className="space-y-3">
                    {/* Title */}
                    <p className="text-white font-medium">{extraction.name}</p>

                    {/* Skills */}
                    {extraction.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {extraction.skills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                            <Code2 className="h-3 w-3 mr-1" />
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Labels row */}
                    <div className="flex flex-wrap gap-2">
                      {salaryDisplay && (
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {salaryDisplay}
                        </Badge>
                      )}
                      {extraction.experienceLevel && (
                        <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-300">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {extraction.experienceLevel.charAt(0).toUpperCase() + extraction.experienceLevel.slice(1)}
                        </Badge>
                      )}
                      {extraction.employmentType && (
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                          <Clock className="h-3 w-3 mr-1" />
                          {extraction.employmentType.charAt(0).toUpperCase() + extraction.employmentType.slice(1).replace("-", " ")}
                        </Badge>
                      )}
                      {extraction.remotePolicy && (
                        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                          <Wifi className="h-3 w-3 mr-1" />
                          {extraction.remotePolicy.charAt(0).toUpperCase() + extraction.remotePolicy.slice(1)}
                        </Badge>
                      )}
                      {extraction.location && (
                        <Badge variant="outline" className="text-xs border-pink-500/30 text-pink-300">
                          <MapPin className="h-3 w-3 mr-1" />
                          {extraction.location}
                        </Badge>
                      )}
                      {extraction.projectType && (
                        <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-300">
                          <Activity className="h-3 w-3 mr-1" />
                          {extraction.projectType}
                        </Badge>
                      )}
                      {extraction.companyName && (
                        <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                          <Building2 className="h-3 w-3 mr-1" />
                          {extraction.companyName}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isExtracting || !extraction}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  {isEditing ? "Update" : "Start Searching"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
