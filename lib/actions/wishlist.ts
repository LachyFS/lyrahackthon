"use server";

import { db } from "@/src/db";
import { wishlists, profiles } from "@/src/db/schema";
import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getProfileByAuthId } from "@/lib/github";
import { revalidatePath } from "next/cache";

export type WishlistType = "job" | "collaboration" | "mentorship" | "cofounding" | "freelance";
export type WorkStyle = "remote" | "hybrid" | "onsite";
export type CompanySize = "startup" | "mid" | "enterprise" | "any";
export type Availability = "immediately" | "2weeks" | "1month" | "3months" | "passive";

export interface CreateWishlistInput {
  type: WishlistType;
  title: string;
  description?: string;
  roleType?: string;
  workStyle?: WorkStyle;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  techStack?: string[];
  companySize?: CompanySize;
  industries?: string[];
  availability?: Availability;
  hoursPerWeek?: number;
}

export async function createWishlist(input: CreateWishlistInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  try {
    const [newWishlist] = await db
      .insert(wishlists)
      .values({
        profileId: profile.id,
        type: input.type,
        title: input.title,
        description: input.description,
        roleType: input.roleType,
        workStyle: input.workStyle,
        location: input.location,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        salaryCurrency: input.salaryCurrency || "USD",
        techStack: input.techStack || [],
        companySize: input.companySize,
        industries: input.industries || [],
        availability: input.availability,
        hoursPerWeek: input.hoursPerWeek,
      })
      .returning();

    revalidatePath(`/profile/${profile.githubUsername}`);
    revalidatePath("/wishlists");
    return { success: true, wishlist: newWishlist };
  } catch (error) {
    console.error("Failed to create wishlist:", error);
    return { error: "Failed to create wishlist" };
  }
}

export async function updateWishlist(wishlistId: string, input: Partial<CreateWishlistInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const existingWishlist = await db.query.wishlists.findFirst({
    where: eq(wishlists.id, wishlistId),
  });

  if (!existingWishlist || existingWishlist.profileId !== profile.id) {
    return { error: "Not authorized" };
  }

  try {
    const [updated] = await db
      .update(wishlists)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(wishlists.id, wishlistId))
      .returning();

    revalidatePath(`/profile/${profile.githubUsername}`);
    revalidatePath("/wishlists");
    return { success: true, wishlist: updated };
  } catch (error) {
    console.error("Failed to update wishlist:", error);
    return { error: "Failed to update wishlist" };
  }
}

export async function deleteWishlist(wishlistId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const existingWishlist = await db.query.wishlists.findFirst({
    where: eq(wishlists.id, wishlistId),
  });

  if (!existingWishlist || existingWishlist.profileId !== profile.id) {
    return { error: "Not authorized" };
  }

  await db.delete(wishlists).where(eq(wishlists.id, wishlistId));
  revalidatePath(`/profile/${profile.githubUsername}`);
  revalidatePath("/wishlists");
  return { success: true };
}

export async function toggleWishlistActive(wishlistId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return { error: "Profile not found" };
  }

  const existingWishlist = await db.query.wishlists.findFirst({
    where: eq(wishlists.id, wishlistId),
  });

  if (!existingWishlist || existingWishlist.profileId !== profile.id) {
    return { error: "Not authorized" };
  }

  const [updated] = await db
    .update(wishlists)
    .set({
      isActive: !existingWishlist.isActive,
      updatedAt: new Date(),
    })
    .where(eq(wishlists.id, wishlistId))
    .returning();

  revalidatePath(`/profile/${profile.githubUsername}`);
  revalidatePath("/wishlists");
  return { success: true, isActive: updated.isActive };
}

export async function getMyWishlists() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const profile = await getProfileByAuthId(user.id);
  if (!profile) {
    return [];
  }

  return db.query.wishlists.findMany({
    where: eq(wishlists.profileId, profile.id),
    orderBy: [desc(wishlists.createdAt)],
  });
}

export async function getProfileWishlists(profileId: string) {
  return db.query.wishlists.findMany({
    where: and(
      eq(wishlists.profileId, profileId),
      eq(wishlists.isActive, true)
    ),
    orderBy: [desc(wishlists.createdAt)],
  });
}

interface DiscoverWishlistsOptions {
  type?: WishlistType;
  workStyle?: WorkStyle;
  techStack?: string[];
  search?: string;
  limit?: number;
}

export async function discoverWishlists(options: DiscoverWishlistsOptions = {}) {
  const { type, workStyle, techStack, search, limit = 50 } = options;

  const allWishlists = await db.query.wishlists.findMany({
    where: eq(wishlists.isActive, true),
    orderBy: [desc(wishlists.createdAt)],
    limit,
    with: {
      profile: true,
    },
  });

  // Filter in JS for complex conditions
  let filtered = allWishlists;

  if (type) {
    filtered = filtered.filter(w => w.type === type);
  }

  if (workStyle) {
    filtered = filtered.filter(w => w.workStyle === workStyle);
  }

  if (techStack && techStack.length > 0) {
    filtered = filtered.filter(w => {
      const wTechStack = (w.techStack as string[]) || [];
      return techStack.some(t => wTechStack.includes(t));
    });
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(w =>
      w.title.toLowerCase().includes(searchLower) ||
      w.description?.toLowerCase().includes(searchLower) ||
      w.roleType?.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}
