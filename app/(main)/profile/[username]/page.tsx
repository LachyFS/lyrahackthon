import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername, getProfileByAuthId } from "@/lib/github";
import { getUserPosts, hasLiked } from "@/lib/actions/posts";
import { isFollowing, getFollowCounts } from "@/lib/actions/social";
import { ProfileCard } from "@/components/profile-card";
import { PostCard } from "@/components/post-card";
import type { Post, Profile } from "@/src/db/schema";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentProfile = user ? await getProfileByAuthId(user.id) : null;
  const isOwnProfile = currentProfile?.id === profile.id;

  const [posts, followingStatus, followCounts] = await Promise.all([
    getUserPosts(username),
    user && !isOwnProfile ? isFollowing(profile.id) : Promise.resolve(false),
    getFollowCounts(profile.id),
  ]);

  const likedStatus = await Promise.all(posts.map((post) => hasLiked(post.id)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ProfileCard
        profile={profile}
        isOwnProfile={isOwnProfile}
        initialFollowing={followingStatus}
        showFullProfile
      />

      <div className="flex gap-6 text-sm">
        <span>
          <strong>{followCounts.followers}</strong> followers
        </span>
        <span>
          <strong>{followCounts.following}</strong> following
        </span>
        <span>
          <strong>{posts.length}</strong> posts
        </span>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Posts</h2>
        {posts.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            <p>No posts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post as Post & { author: Profile }}
                initialLiked={likedStatus[index]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
