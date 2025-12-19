"use client";

import { useState, useEffect } from "react";
import { ScoutBrief } from "@/src/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { createSonarBrief, updateSonarBrief } from "@/lib/actions/sonar";

interface SonarBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief?: ScoutBrief | null;
  onSuccess?: () => void;
}

export function SonarBriefDialog({ open, onOpenChange, brief, onSuccess }: SonarBriefDialogProps) {
  const isEditing = !!brief;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset form when dialog opens/closes or brief changes
  useEffect(() => {
    if (open) {
      if (brief) {
        setName(brief.name);
        setDescription(brief.description || "");
      } else {
        setName("");
        setDescription("");
      }
      setError(null);
    }
  }, [open, brief]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setError("Please provide a name for this search");
      return;
    }

    if (!trimmedDescription) {
      setError("Please describe what you're looking for");
      return;
    }

    if (trimmedDescription.length < 20) {
      setError("Please provide more detail about the role or skills you need");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && brief) {
        const result = await updateSonarBrief({
          id: brief.id,
          name: trimmedName,
          description: trimmedDescription,
        });

        if (!result.success) {
          setError(result.error || "Failed to update");
          return;
        }
      } else {
        const result = await createSonarBrief({
          name: trimmedName,
          description: trimmedDescription,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              {isEditing ? "Edit Search" : "Create New Search"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Senior React Developer"
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the developer you're looking for...

Example: Looking for a senior React developer with TypeScript experience, remote friendly. Should have experience with Next.js and GraphQL."
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/60 min-h-[150px] text-base leading-relaxed resize-none"
              />
            </div>

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
              disabled={isSubmitting}
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
