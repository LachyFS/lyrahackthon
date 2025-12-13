"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, ExternalLink, GitFork, Star, Users } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleLike } from "@/lib/actions/posts";
import { toast } from "sonner";
import type { Post, Profile } from "@/src/db/schema";

interface PostCardProps {
  post: Post & { author: Profile };
  initialLiked?: boolean;
  showActions?: boolean;
}

export function PostCard({ post, initialLiked = false, showActions = true }: PostCardProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const optimisticLiked = !liked;
    setLiked(optimisticLiked);
    setLikesCount((prev) => (optimisticLiked ? prev + 1 : prev - 1));

    const result = await toggleLike(post.id);
    if ("error" in result) {
      setLiked(!optimisticLiked);
      setLikesCount((prev) => (optimisticLiked ? prev - 1 : prev + 1));
      toast.error(result.error);
    }
    setIsLiking(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <Link href={`/profile/${post.author.githubUsername}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatarUrl ?? undefined} />
            <AvatarFallback>
              {post.author.name?.[0] ?? post.author.githubUsername[0]}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author.githubUsername}`}
            className="font-semibold hover:underline"
          >
            {post.author.name ?? post.author.githubUsername}
          </Link>
          <p className="text-sm text-muted-foreground">
            @{post.author.githubUsername} ·{" "}
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
        {post.lookingForCollaborators && (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            Looking for collaborators
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <Link href={`/post/${post.id}`}>
          <h3 className="text-lg font-semibold hover:underline">{post.title}</h3>
        </Link>

        {post.description && (
          <p className="text-muted-foreground line-clamp-3">{post.description}</p>
        )}

        {post.images && (post.images as string[]).length > 0 && (
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            <Image
              src={(post.images as string[])[0]}
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        {post.repoUrl && (
          <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex-1">
              <a
                href={post.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-medium hover:underline"
              >
                {post.repoOwner}/{post.repoName}
                <ExternalLink className="h-3 w-3" />
              </a>
              {post.repoLanguage && (
                <span className="text-sm text-muted-foreground">
                  {post.repoLanguage}
                </span>
              )}
            </div>
            {(post.repoStars !== null || post.repoForks !== null) && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {post.repoStars !== null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    {post.repoStars}
                  </span>
                )}
                {post.repoForks !== null && (
                  <span className="flex items-center gap-1">
                    <GitFork className="h-4 w-4" />
                    {post.repoForks}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {post.tags && (post.tags as string[]).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(post.tags as string[]).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="border-t pt-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className={liked ? "text-red-500" : ""}
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart className={`mr-1 h-4 w-4 ${liked ? "fill-current" : ""}`} />
              {likesCount}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/post/${post.id}`}>
                <MessageCircle className="mr-1 h-4 w-4" />
                {post.commentsCount ?? 0}
              </Link>
            </Button>
            {post.demoUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={post.demoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Demo
                </a>
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
