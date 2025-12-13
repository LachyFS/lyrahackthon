import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFeedPosts, getFollowingFeedPosts, hasLiked } from "@/lib/actions/posts";
import { PostCard } from "@/components/post-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Post, Profile } from "@/src/db/schema";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [allPosts, followingPosts] = await Promise.all([
    getFeedPosts(),
    getFollowingFeedPosts(),
  ]);

  const likedStatusAll = await Promise.all(
    allPosts.map((post) => hasLiked(post.id))
  );
  const likedStatusFollowing = await Promise.all(
    followingPosts.map((post) => hasLiked(post.id))
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Your Feed</h1>

      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Posts</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {allPosts.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              <p>No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            allPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post as Post & { author: Profile }}
                initialLiked={likedStatusAll[index]}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="following" className="space-y-6">
          {followingPosts.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              <p>No posts from people you follow yet.</p>
              <p className="mt-2 text-sm">
                Head to the Discover page to find engineers to follow!
              </p>
            </div>
          ) : (
            followingPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post as Post & { author: Profile }}
                initialLiked={likedStatusFollowing[index]}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
