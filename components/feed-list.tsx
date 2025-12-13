"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PostCard } from "@/components/post-card";
import { PostCardSkeleton } from "@/components/post-card-skeleton";
import { getFeedPosts, hasLiked } from "@/lib/actions/posts";
import type { Post, Profile } from "@/src/db/schema";
import { Loader2 } from "lucide-react";

interface FeedListProps {
  initialPosts: (Post & { author: Profile })[];
  initialLikedStatus: boolean[];
  searchQuery?: string;
}

export function FeedList({ initialPosts, initialLikedStatus, searchQuery }: FeedListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [likedStatus, setLikedStatus] = useState(initialLikedStatus);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length === 20);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Reset when search query changes
  useEffect(() => {
    setPosts(initialPosts);
    setLikedStatus(initialLikedStatus);
    setPage(1);
    setHasMore(initialPosts.length === 20);
  }, [initialPosts, initialLikedStatus, searchQuery]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    const nextPage = page + 1;

    try {
      const newPosts = await getFeedPosts(nextPage, 20, searchQuery);

      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        const newLikedStatus = await Promise.all(
          newPosts.map((post) => hasLiked(post.id))
        );

        setPosts((prev) => [...prev, ...(newPosts as (Post & { author: Profile })[])]);
        setLikedStatus((prev) => [...prev, ...newLikedStatus]);
        setPage(nextPage);
        setHasMore(newPosts.length === 20);
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore, searchQuery]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, loadMore]);

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          initialLiked={likedStatus[index]}
        />
      ))}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isLoading && (
            <div className="space-y-6 w-full">
              <PostCardSkeleton />
            </div>
          )}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}
