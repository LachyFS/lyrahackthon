"use server";

import { db } from "@/src/db";
import { posts, likes, comments, profiles } from "@/src/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getProfileByAuthId } from "@/lib/github";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const repoUrl = formData.get("repoUrl") as string;
  const demoUrl = formData.get("demoUrl") as string;
  const tagsString = formData.get("tags") as string;
  const lookingForCollaborators = formData.get("lookingForCollaborators") === "true";
  const imagesString = formData.get("images") as string;

  const tags = tagsString
    ? tagsString.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const images = imagesString ? JSON.parse(imagesString) : [];

  // Parse repo info from URL
  let repoName: string | null = null;
  let repoOwner: string | null = null;
  if (repoUrl) {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      repoOwner = match[1];
      repoName = match[2].replace(/\.git$/, "");
    }
  }

  try {
    const [newPost] = await db
      .insert(posts)
      .values({
        authorId: profile.id,
        title,
        description,
        repoUrl: repoUrl || null,
        repoName,
        repoOwner,
        demoUrl: demoUrl || null,
        tags,
        images,
        lookingForCollaborators,
      })
      .returning();

    revalidatePath("/feed");
    revalidatePath(`/profile/${profile.githubUsername}`);
    return { success: true, post: newPost };
  } catch (error) {
    console.error("Failed to create post:", error);
    return { error: "Failed to create post" };
  }
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post || post.authorId !== profile.id) {
    return { error: "Not authorized" };
  }

  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/feed");
  revalidatePath(`/profile/${profile.githubUsername}`);
  return { success: true };
}

export async function getFeedPosts(page = 1, limit = 20, search?: string) {
  const offset = (page - 1) * limit;

  let whereClause;
  if (search && search.trim()) {
    const searchTerm = `%${search.trim().toLowerCase()}%`;
    whereClause = sql`(
      LOWER(${posts.title}) LIKE ${searchTerm} OR
      LOWER(${posts.description}) LIKE ${searchTerm} OR
      EXISTS (
        SELECT 1 FROM unnest(${posts.tags}::text[]) AS tag
        WHERE LOWER(tag) LIKE ${searchTerm}
      )
    )`;
  }

  const feedPosts = await db.query.posts.findMany({
    where: whereClause,
    orderBy: [desc(posts.createdAt)],
    limit,
    offset,
    with: {
      author: true,
    },
  });

  return feedPosts;
}

export async function getFollowingFeedPosts(page = 1, limit = 20) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return [];
  }

  const offset = (page - 1) * limit;

  // Get users the current user follows
  const { follows } = await import("@/src/db/schema");
  const following = await db.query.follows.findMany({
    where: eq(follows.followerId, profile.id),
  });

  const followingIds = following.map((f) => f.followingId);

  if (followingIds.length === 0) {
    return [];
  }

  const feedPosts = await db.query.posts.findMany({
    where: inArray(posts.authorId, followingIds),
    orderBy: [desc(posts.createdAt)],
    limit,
    offset,
    with: {
      author: true,
    },
  });

  return feedPosts;
}

export async function getPostById(postId: string) {
  return db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      author: true,
      comments: {
        with: {
          author: true,
        },
        orderBy: [desc(comments.createdAt)],
      },
    },
  });
}

export async function getUserPosts(username: string) {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.githubUsername, username),
  });

  if (!profile) {
    return [];
  }

  return db.query.posts.findMany({
    where: eq(posts.authorId, profile.id),
    orderBy: [desc(posts.createdAt)],
    with: {
      author: true,
    },
  });
}

export async function toggleLike(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const existingLike = await db.query.likes.findFirst({
    where: and(eq(likes.userId, profile.id), eq(likes.postId, postId)),
  });

  if (existingLike) {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, profile.id), eq(likes.postId, postId)));
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} - 1` })
      .where(eq(posts.id, postId));
    return { liked: false };
  } else {
    await db.insert(likes).values({ userId: profile.id, postId });
    await db
      .update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, postId));
    return { liked: true };
  }
}

export async function hasLiked(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return false;
  }

  const like = await db.query.likes.findFirst({
    where: and(eq(likes.userId, profile.id), eq(likes.postId, postId)),
  });

  return !!like;
}

export async function addComment(postId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const [newComment] = await db
    .insert(comments)
    .values({
      postId,
      authorId: profile.id,
      content,
    })
    .returning();

  await db
    .update(posts)
    .set({ commentsCount: sql`${posts.commentsCount} + 1` })
    .where(eq(posts.id, postId));

  revalidatePath(`/post/${postId}`);
  return { success: true, comment: newComment };
}

export async function getComments(postId: string) {
  return db.query.comments.findMany({
    where: eq(comments.postId, postId),
    orderBy: [desc(comments.createdAt)],
    with: {
      author: true,
    },
  });
}
