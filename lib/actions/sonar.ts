"use server";

import { db } from "@/src/db";
import { scoutBriefs, scoutResults, type ScoutBrief, type ScoutResult } from "@/src/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface CreateScoutBriefInput {
  name: string;
  description: string;
  requiredSkills?: string[];
  preferredLocation?: string;
  projectType?: string;
  searchFrequency?: "daily" | "weekly";
  // AI-extracted fields
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: string;
  experienceLevel?: string;
  employmentType?: string;
  remotePolicy?: string;
  companyName?: string;
}

export interface UpdateScoutBriefInput {
  id: string;
  name?: string;
  description?: string;
  requiredSkills?: string[];
  preferredLocation?: string;
  projectType?: string;
  isActive?: boolean;
  searchFrequency?: "daily" | "weekly";
  // AI-extracted fields
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: string;
  experienceLevel?: string;
  employmentType?: string;
  remotePolicy?: string;
  companyName?: string;
}

export interface SonarBriefWithStats extends ScoutBrief {
  totalResults: number;
  newResults: number;
}

// Alias for backwards compatibility
export type ScoutBriefWithStats = SonarBriefWithStats;

// Create a new sonar brief
export async function createSonarBrief(input: CreateScoutBriefInput): Promise<{ success: boolean; brief?: ScoutBrief; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const [brief] = await db.insert(scoutBriefs).values({
      authUserId: user.id,
      name: input.name,
      description: input.description,
      requiredSkills: input.requiredSkills || [],
      preferredLocation: input.preferredLocation || null,
      projectType: input.projectType || null,
      searchFrequency: input.searchFrequency || "daily",
      salaryMin: input.salaryMin || null,
      salaryMax: input.salaryMax || null,
      salaryPeriod: input.salaryPeriod || null,
      experienceLevel: input.experienceLevel || null,
      employmentType: input.employmentType || null,
      remotePolicy: input.remotePolicy || null,
      companyName: input.companyName || null,
    }).returning();

    revalidatePath("/sonar");
    return { success: true, brief };
  } catch (error) {
    console.error("Failed to create sonar brief:", error);
    return { success: false, error: "Failed to create brief" };
  }
}

// Alias for backwards compatibility
export const createScoutBrief = createSonarBrief;

// Get all sonar briefs for the current user
export async function getSonarBriefs(): Promise<SonarBriefWithStats[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // Get briefs with result counts
    const briefs = await db
      .select({
        brief: scoutBriefs,
        totalResults: sql<number>`count(${scoutResults.id})::int`,
        newResults: sql<number>`count(case when ${scoutResults.status} = 'new' then 1 end)::int`,
      })
      .from(scoutBriefs)
      .leftJoin(scoutResults, eq(scoutBriefs.id, scoutResults.briefId))
      .where(eq(scoutBriefs.authUserId, user.id))
      .groupBy(scoutBriefs.id)
      .orderBy(desc(scoutBriefs.createdAt));

    return briefs.map(({ brief, totalResults, newResults }) => ({
      ...brief,
      totalResults,
      newResults,
    }));
  } catch (error) {
    console.error("Failed to get sonar briefs:", error);
    return [];
  }
}

// Alias for backwards compatibility
export const getScoutBriefs = getSonarBriefs;

// Get a single sonar brief by ID
export async function getSonarBrief(id: string): Promise<SonarBriefWithStats | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const [result] = await db
      .select({
        brief: scoutBriefs,
        totalResults: sql<number>`count(${scoutResults.id})::int`,
        newResults: sql<number>`count(case when ${scoutResults.status} = 'new' then 1 end)::int`,
      })
      .from(scoutBriefs)
      .leftJoin(scoutResults, eq(scoutBriefs.id, scoutResults.briefId))
      .where(and(eq(scoutBriefs.id, id), eq(scoutBriefs.authUserId, user.id)))
      .groupBy(scoutBriefs.id);

    if (!result) {
      return null;
    }

    return {
      ...result.brief,
      totalResults: result.totalResults,
      newResults: result.newResults,
    };
  } catch (error) {
    console.error("Failed to get sonar brief:", error);
    return null;
  }
}

// Alias for backwards compatibility
export const getScoutBrief = getSonarBrief;

// Update a sonar brief
export async function updateSonarBrief(input: UpdateScoutBriefInput): Promise<{ success: boolean; brief?: ScoutBrief; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const updateData: Partial<typeof scoutBriefs.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.requiredSkills !== undefined) updateData.requiredSkills = input.requiredSkills;
    if (input.preferredLocation !== undefined) updateData.preferredLocation = input.preferredLocation;
    if (input.projectType !== undefined) updateData.projectType = input.projectType;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.searchFrequency !== undefined) updateData.searchFrequency = input.searchFrequency;
    if (input.salaryMin !== undefined) updateData.salaryMin = input.salaryMin;
    if (input.salaryMax !== undefined) updateData.salaryMax = input.salaryMax;
    if (input.salaryPeriod !== undefined) updateData.salaryPeriod = input.salaryPeriod;
    if (input.experienceLevel !== undefined) updateData.experienceLevel = input.experienceLevel;
    if (input.employmentType !== undefined) updateData.employmentType = input.employmentType;
    if (input.remotePolicy !== undefined) updateData.remotePolicy = input.remotePolicy;
    if (input.companyName !== undefined) updateData.companyName = input.companyName;

    const [brief] = await db
      .update(scoutBriefs)
      .set(updateData)
      .where(and(eq(scoutBriefs.id, input.id), eq(scoutBriefs.authUserId, user.id)))
      .returning();

    if (!brief) {
      return { success: false, error: "Brief not found" };
    }

    revalidatePath("/sonar");
    return { success: true, brief };
  } catch (error) {
    console.error("Failed to update sonar brief:", error);
    return { success: false, error: "Failed to update brief" };
  }
}

// Alias for backwards compatibility
export const updateScoutBrief = updateSonarBrief;

// Delete a sonar brief
export async function deleteSonarBrief(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    await db
      .delete(scoutBriefs)
      .where(and(eq(scoutBriefs.id, id), eq(scoutBriefs.authUserId, user.id)));

    revalidatePath("/sonar");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete sonar brief:", error);
    return { success: false, error: "Failed to delete brief" };
  }
}

// Alias for backwards compatibility
export const deleteScoutBrief = deleteSonarBrief;

// Get results for a sonar brief
export async function getSonarResults(briefId: string, options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ScoutResult[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // First verify the brief belongs to the user
    const [brief] = await db
      .select({ id: scoutBriefs.id })
      .from(scoutBriefs)
      .where(and(eq(scoutBriefs.id, briefId), eq(scoutBriefs.authUserId, user.id)));

    if (!brief) {
      return [];
    }

    // Build where conditions
    const conditions = [eq(scoutResults.briefId, briefId)];
    if (options?.status) {
      conditions.push(eq(scoutResults.status, options.status));
    }

    const results = await db
      .select()
      .from(scoutResults)
      .where(and(...conditions))
      .orderBy(desc(scoutResults.matchScore), desc(scoutResults.discoveredAt))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    return results;
  } catch (error) {
    console.error("Failed to get sonar results:", error);
    return [];
  }
}

// Alias for backwards compatibility
export const getScoutResults = getSonarResults;

// Update a sonar result status
export async function updateSonarResultStatus(
  resultId: string,
  status: "new" | "viewed" | "saved" | "contacted" | "dismissed",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    // Get the result and verify ownership through the brief
    const [result] = await db
      .select({ briefId: scoutResults.briefId })
      .from(scoutResults)
      .where(eq(scoutResults.id, resultId));

    if (!result) {
      return { success: false, error: "Result not found" };
    }

    // Verify brief ownership
    const [brief] = await db
      .select({ id: scoutBriefs.id })
      .from(scoutBriefs)
      .where(and(eq(scoutBriefs.id, result.briefId), eq(scoutBriefs.authUserId, user.id)));

    if (!brief) {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: Partial<typeof scoutResults.$inferInsert> = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    await db
      .update(scoutResults)
      .set(updateData)
      .where(eq(scoutResults.id, resultId));

    revalidatePath("/sonar");
    return { success: true };
  } catch (error) {
    console.error("Failed to update sonar result:", error);
    return { success: false, error: "Failed to update result" };
  }
}

// Alias for backwards compatibility
export const updateScoutResultStatus = updateSonarResultStatus;

// Add a result to a sonar brief (used by the search API)
export async function addSonarResult(
  briefId: string,
  candidate: {
    username: string;
    name?: string | null;
    bio?: string | null;
    location?: string | null;
    score?: number;
    matchReasons?: string[];
    concerns?: string[];
    topLanguages?: string[];
    totalStars?: number;
    followers?: number;
    repoCount?: number;
  },
  searchQuery?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if this username already exists for this brief
    const [existing] = await db
      .select({ id: scoutResults.id })
      .from(scoutResults)
      .where(and(
        eq(scoutResults.briefId, briefId),
        eq(scoutResults.githubUsername, candidate.username)
      ));

    if (existing) {
      // Update the existing result if score is better
      if (candidate.score && candidate.score > 0) {
        await db
          .update(scoutResults)
          .set({
            matchScore: candidate.score,
            matchReasons: candidate.matchReasons || [],
            concerns: candidate.concerns || [],
            discoveredAt: new Date(),
          })
          .where(eq(scoutResults.id, existing.id));
      }
      return { success: true };
    }

    await db.insert(scoutResults).values({
      briefId,
      githubUsername: candidate.username,
      githubName: candidate.name || null,
      githubAvatarUrl: `https://github.com/${candidate.username}.png`,
      githubBio: candidate.bio || null,
      githubLocation: candidate.location || null,
      matchScore: candidate.score || null,
      matchReasons: candidate.matchReasons || [],
      concerns: candidate.concerns || [],
      topLanguages: candidate.topLanguages || [],
      totalStars: candidate.totalStars || null,
      followers: candidate.followers || null,
      repoCount: candidate.repoCount || null,
      searchQuery: searchQuery || null,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to add sonar result:", error);
    return { success: false, error: "Failed to add result" };
  }
}

// Alias for backwards compatibility
export const addScoutResult = addSonarResult;

// Mark brief as searched
export async function markBriefSearched(briefId: string): Promise<void> {
  try {
    await db
      .update(scoutBriefs)
      .set({ lastSearchAt: new Date() })
      .where(eq(scoutBriefs.id, briefId));
  } catch (error) {
    console.error("Failed to mark brief as searched:", error);
  }
}
