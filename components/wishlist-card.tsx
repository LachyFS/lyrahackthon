"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Building,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Handshake,
  Rocket,
  GraduationCap,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteWishlist, toggleWishlistActive } from "@/lib/actions/wishlist";
import { toast } from "sonner";
import type { Wishlist, Profile } from "@/src/db/schema";

interface WishlistCardProps {
  wishlist: Wishlist & { profile?: Profile };
  isOwner?: boolean;
  showProfile?: boolean;
}

const TYPE_CONFIG = {
  job: { icon: Briefcase, label: "Looking for a job", color: "text-blue-500" },
  freelance: { icon: Target, label: "Freelance work", color: "text-green-500" },
  collaboration: { icon: Handshake, label: "Side project collab", color: "text-purple-500" },
  cofounding: { icon: Rocket, label: "Co-founder search", color: "text-orange-500" },
  mentorship: { icon: GraduationCap, label: "Seeking mentorship", color: "text-cyan-500" },
};

const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: "Available now",
  "2weeks": "2 weeks notice",
  "1month": "1 month",
  "3months": "3 months",
  passive: "Passively looking",
};

export function WishlistCard({ wishlist, isOwner = false, showProfile = true }: WishlistCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isActive, setIsActive] = useState(wishlist.isActive);

  const typeConfig = TYPE_CONFIG[wishlist.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.job;
  const TypeIcon = typeConfig.icon;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this wishlist item?")) return;
    setIsDeleting(true);
    const result = await deleteWishlist(wishlist.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Wishlist item deleted");
    }
    setIsDeleting(false);
  };

  const handleToggle = async () => {
    setIsToggling(true);
    const result = await toggleWishlistActive(wishlist.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      setIsActive(result.isActive ?? !isActive);
      toast.success(result.isActive ? "Wishlist item activated" : "Wishlist item paused");
    }
    setIsToggling(false);
  };

  const formatSalary = (min?: number | null, max?: number | null, currency?: string | null) => {
    if (!min && !max) return null;
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `${formatter.format(min)}+`;
    if (max) return `Up to ${formatter.format(max)}`;
    return null;
  };

  const salary = formatSalary(wishlist.salaryMin, wishlist.salaryMax, wishlist.salaryCurrency);
  const techStack = (wishlist.techStack as string[]) || [];

  return (
    <Card className={!isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {showProfile && wishlist.profile && (
              <Link href={`/profile/${wishlist.profile.githubUsername}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={wishlist.profile.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    {wishlist.profile.name?.[0] ?? wishlist.profile.githubUsername[0]}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2">
                <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                <span className="text-sm text-muted-foreground">{typeConfig.label}</span>
                {!isActive && <Badge variant="outline">Paused</Badge>}
              </div>
              <h3 className="font-semibold mt-1">{wishlist.title}</h3>
              {showProfile && wishlist.profile && (
                <Link
                  href={`/profile/${wishlist.profile.githubUsername}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  @{wishlist.profile.githubUsername}
                </Link>
              )}
            </div>
          </div>

          {isOwner && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                disabled={isToggling}
              >
                {isActive ? (
                  <ToggleRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {wishlist.description && (
          <p className="text-sm text-muted-foreground">{wishlist.description}</p>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          {wishlist.roleType && (
            <Badge variant="secondary">{wishlist.roleType}</Badge>
          )}
          {wishlist.workStyle && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {wishlist.workStyle.charAt(0).toUpperCase() + wishlist.workStyle.slice(1)}
            </Badge>
          )}
          {wishlist.location && (
            <Badge variant="outline">{wishlist.location}</Badge>
          )}
          {salary && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {salary}
            </Badge>
          )}
          {wishlist.companySize && wishlist.companySize !== "any" && (
            <Badge variant="outline" className="gap-1">
              <Building className="h-3 w-3" />
              {wishlist.companySize.charAt(0).toUpperCase() + wishlist.companySize.slice(1)}
            </Badge>
          )}
          {wishlist.availability && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {AVAILABILITY_LABELS[wishlist.availability] || wishlist.availability}
            </Badge>
          )}
        </div>

        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {techStack.map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Posted {formatDistanceToNow(new Date(wishlist.createdAt), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
