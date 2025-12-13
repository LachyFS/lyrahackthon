"use server";

import { db } from "@/src/db";
import { follows, profiles } from "@/src/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getProfileByAuthId } from "@/lib/github";
import { revalidatePath } from "next/cache";

export async function toggleFollow(targetUserId: string) {
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

  if (profile.id === targetUserId) {
    return { error: "Cannot follow yourself" };
  }

  const existingFollow = await db.query.follows.findFirst({
    where: and(
      eq(follows.followerId, profile.id),
      eq(follows.followingId, targetUserId)
    ),
  });

  if (existingFollow) {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, profile.id),
          eq(follows.followingId, targetUserId)
        )
      );
    return { following: false };
  } else {
    await db.insert(follows).values({
      followerId: profile.id,
      followingId: targetUserId,
    });
    return { following: true };
  }
}

export async function isFollowing(targetUserId: string) {
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

  const follow = await db.query.follows.findFirst({
    where: and(
      eq(follows.followerId, profile.id),
      eq(follows.followingId, targetUserId)
    ),
  });

  return !!follow;
}

export async function getFollowers(userId: string) {
  const followerRelations = await db.query.follows.findMany({
    where: eq(follows.followingId, userId),
    with: {
      follower: true,
    },
  });

  return followerRelations.map((f) => f.follower);
}

export async function getFollowing(userId: string) {
  const followingRelations = await db.query.follows.findMany({
    where: eq(follows.followerId, userId),
    with: {
      following: true,
    },
  });

  return followingRelations.map((f) => f.following);
}

export async function getFollowCounts(userId: string) {
  const [followersResult, followingResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ]);

  return {
    followers: Number(followersResult[0]?.count ?? 0),
    following: Number(followingResult[0]?.count ?? 0),
  };
}

export async function discoverProfiles(options?: {
  language?: string;
  lookingForWork?: boolean;
  openToCollaborate?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { language, lookingForWork, openToCollaborate, search, limit = 20, offset = 0 } =
    options || {};

  let query = db.select().from(profiles);

  const conditions = [];

  if (language) {
    conditions.push(sql`${profiles.languages} ? ${language}`);
  }

  if (lookingForWork) {
    conditions.push(eq(profiles.lookingForWork, true));
  }

  if (openToCollaborate) {
    conditions.push(eq(profiles.openToCollaborate, true));
  }

  if (search) {
    conditions.push(
      or(
        ilike(profiles.githubUsername, `%${search}%`),
        ilike(profiles.name, `%${search}%`),
        ilike(profiles.bio, `%${search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query.limit(limit).offset(offset);
  return result;
}

export async function updateProfile(data: {
  headline?: string;
  lookingForWork?: boolean;
  openToCollaborate?: boolean;
  bio?: string;
}) {
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

  await db
    .update(profiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  revalidatePath(`/profile/${profile.githubUsername}`);
  return { success: true };
}
