import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostById, hasLiked, addComment } from "@/lib/actions/posts";
import { getProfileByAuthId } from "@/lib/github";
import { PostCard } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { Post, Profile, Comment } from "@/src/db/schema";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

async function submitComment(formData: FormData) {
  "use server";
  const postId = formData.get("postId") as string;
  const content = formData.get("content") as string;

  if (!content.trim()) return;

  await addComment(postId, content);
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  const post = await getPostById(id);

  if (!post) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [liked, currentProfile] = await Promise.all([
    hasLiked(id),
    user ? getProfileByAuthId(user.id) : null,
  ]);

  const postComments = (post.comments || []) as (Comment & { author: Profile })[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PostCard
        post={post as Post & { author: Profile }}
        initialLiked={liked}
        showActions
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Comments ({postComments.length})
        </h2>

        {currentProfile && (
          <form action={submitComment} className="space-y-3">
            <input type="hidden" name="postId" value={id} />
            <Textarea
              name="content"
              placeholder="Write a comment..."
              rows={3}
              required
            />
            <Button type="submit">Post Comment</Button>
          </form>
        )}

        {postComments.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {postComments.map((comment) => (
              <div key={comment.id} className="flex gap-3 rounded-lg border p-4">
                <Link href={`/profile/${comment.author.githubUsername}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.author.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {comment.author.name?.[0] ?? comment.author.githubUsername[0]}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/profile/${comment.author.githubUsername}`}
                      className="font-medium hover:underline"
                    >
                      {comment.author.name ?? comment.author.githubUsername}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
