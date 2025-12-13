"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Link as LinkIcon, Building, Briefcase, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions/social";
import { toast } from "sonner";
import type { Profile } from "@/src/db/schema";

interface ProfileCardProps {
  profile: Profile;
  isOwnProfile?: boolean;
  initialFollowing?: boolean;
  showFullProfile?: boolean;
}

export function ProfileCard({
  profile,
  isOwnProfile = false,
  initialFollowing = false,
  showFullProfile = false,
}: ProfileCardProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const wasFollowing = following;
    setFollowing(!following);
    const result = await toggleFollow(profile.id);
    if ("error" in result) {
      setFollowing(wasFollowing);
      toast.error(result.error);
    } else {
      toast.success(wasFollowing ? `Unfollowed @${profile.githubUsername}` : `Following @${profile.githubUsername}`);
    }
    setIsLoading(false);
  };

  const topLanguages = (profile.topLanguages as { name: string; percentage: number }[]) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Link href={`/profile/${profile.githubUsername}`}>
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xl">
              {profile.name?.[0] ?? profile.githubUsername[0]}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href={`/profile/${profile.githubUsername}`}
                className="text-lg font-semibold hover:underline"
              >
                {profile.name ?? profile.githubUsername}
              </Link>
              <p className="text-sm text-muted-foreground">@{profile.githubUsername}</p>
            </div>
            {!isOwnProfile && (
              <Button
                variant={following ? "outline" : "default"}
                size="sm"
                onClick={handleFollow}
                disabled={isLoading}
              >
                {following ? "Following" : "Follow"}
              </Button>
            )}
          </div>
          {profile.headline && (
            <p className="mt-1 text-sm font-medium">{profile.headline}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}

        <div className="flex flex-wrap gap-2">
          {profile.lookingForWork && (
            <Badge variant="default" className="gap-1">
              <Briefcase className="h-3 w-3" />
              Looking for work
            </Badge>
          )}
          {profile.openToCollaborate && (
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              Open to collaborate
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {profile.location}
            </span>
          )}
          {profile.company && (
            <span className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              {profile.company}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>

        {showFullProfile && (
          <>
            <div className="flex gap-4 text-sm">
              <span>
                <strong>{profile.publicRepos}</strong> repos
              </span>
              <span>
                <strong>{profile.followers}</strong> followers
              </span>
              <span>
                <strong>{profile.following}</strong> following
              </span>
            </div>

            {topLanguages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Top Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {topLanguages.map((lang) => (
                    <Badge key={lang.name} variant="outline">
                      {lang.name} ({lang.percentage}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
