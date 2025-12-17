"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AnalysisResult } from "@/lib/actions/github-analyze";
import { getFeedPosts, hasLiked } from "@/lib/actions/posts";
import type { Post, Profile } from "@/src/db/schema";

// Query keys factory for consistent key management
export const queryKeys = {
  all: ["app"] as const,

  // Profile analysis
  profileAnalysis: (username: string) => [...queryKeys.all, "profile-analysis", username] as const,

  // Search history
  searchHistory: () => [...queryKeys.all, "search-history"] as const,

  // GitHub user search (autocomplete)
  githubUsers: (query: string) => [...queryKeys.all, "github-users", query] as const,

  // Feed posts
  feedPosts: (searchQuery?: string) => [...queryKeys.all, "feed-posts", searchQuery ?? ""] as const,

  // User collaboration data
  userCollaboration: (username: string) => [...queryKeys.all, "user-collaboration", username] as const,
};

// Profile analysis hook
export function useProfileAnalysis(username: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.profileAnalysis(username),
    queryFn: async (): Promise<AnalysisResult> => {
      const response = await fetch(`/api/analyze/${encodeURIComponent(username)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch analysis" }));
        throw new Error(error.error || "Failed to fetch analysis");
      }
      return response.json();
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes - profile data doesn't change often
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Search history hook
interface RecentSearch {
  id: string;
  githubUsername: string;
  githubName: string | null;
  githubAvatarUrl: string | null;
  githubBio: string | null;
  githubLocation: string | null;
  searchQuery: string | null;
  createdAt: string;
}

export function useSearchHistory(limit: number = 8) {
  return useQuery({
    queryKey: [...queryKeys.searchHistory(), limit],
    queryFn: async (): Promise<RecentSearch[]> => {
      const response = await fetch(`/api/search-history?limit=${limit}`);
      if (!response.ok) {
        throw new Error("Failed to fetch search history");
      }
      const data = await response.json();
      return data.searches || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// GitHub user search hook (for autocomplete)
interface GitHubUserSuggestion {
  login: string;
  avatar_url: string;
  name?: string;
}

export function useGitHubUserSearch(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.githubUsers(query),
    queryFn: async (): Promise<GitHubUserSuggestion[]> => {
      if (query.length < 2) return [];
      const response = await fetch(`/api/github/search-users?q=${encodeURIComponent(query)}&limit=5`);
      if (!response.ok) {
        throw new Error("Failed to search GitHub users");
      }
      const data = await response.json();
      return data.users || [];
    },
    enabled: (options?.enabled ?? true) && query.length >= 2,
    staleTime: 60 * 1000, // 1 minute cache for search results
  });
}

// Feed posts infinite query hook
export function useFeedPosts(searchQuery?: string, pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.feedPosts(searchQuery),
    queryFn: async ({ pageParam = 1 }): Promise<{
      posts: (Post & { author: Profile })[];
      likedStatus: boolean[];
      nextPage: number | null;
    }> => {
      const posts = await getFeedPosts(pageParam, pageSize, searchQuery);

      // Get liked status for all posts
      const likedStatus = await Promise.all(
        posts.map((post) => hasLiked(post.id))
      );

      return {
        posts: posts as (Post & { author: Profile })[],
        likedStatus,
        nextPage: posts.length === pageSize ? pageParam + 1 : null,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// User collaboration hook (for graph navigation)
import { fetchUserCollaboration, type CollaborationData, type GitHubProfile } from "@/lib/actions/github-analyze";

interface UserCollaborationData {
  profile: GitHubProfile;
  collaboration: CollaborationData;
}

export function useUserCollaboration(username: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.userCollaboration(username),
    queryFn: async (): Promise<UserCollaborationData> => {
      return fetchUserCollaboration(username);
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });
}

// Prefetch helpers
export function usePrefetchProfileAnalysis() {
  const queryClient = useQueryClient();

  return (username: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.profileAnalysis(username),
      queryFn: async (): Promise<AnalysisResult> => {
        const response = await fetch(`/api/analyze/${encodeURIComponent(username)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch analysis");
        }
        return response.json();
      },
      staleTime: 10 * 60 * 1000,
    });
  };
}

export function usePrefetchUserCollaboration() {
  const queryClient = useQueryClient();

  return (username: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.userCollaboration(username),
      queryFn: () => fetchUserCollaboration(username),
      staleTime: 10 * 60 * 1000,
    });
  };
}

// Invalidation helpers
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateSearchHistory: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.searchHistory() }),
    invalidateFeedPosts: (searchQuery?: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(searchQuery) }),
    invalidateProfileAnalysis: (username: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.profileAnalysis(username) }),
  };
}
