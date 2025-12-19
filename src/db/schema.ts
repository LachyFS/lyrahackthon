import {
  pgSchema,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Create a private schema for DevShowcase
export const devshowcase = pgSchema("devshowcase");

// ============================================
// PROFILES - Auto-generated from GitHub
// ============================================
export const profiles = devshowcase.table(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Link to Supabase Auth user
    authUserId: uuid("auth_user_id").notNull().unique(),
    // GitHub data
    githubId: integer("github_id").notNull().unique(),
    githubUsername: varchar("github_username", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    name: text("name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    location: text("location"),
    website: text("website"),
    company: text("company"),
    // GitHub stats (auto-populated)
    publicRepos: integer("public_repos").default(0),
    followers: integer("followers").default(0),
    following: integer("following").default(0),
    // Parsed from GitHub repos
    languages: jsonb("languages").$type<string[]>().default([]),
    topLanguages: jsonb("top_languages").$type<{ name: string; percentage: number }[]>().default([]),
    // Profile customization
    headline: text("headline"),
    lookingForWork: boolean("looking_for_work").default(false),
    openToCollaborate: boolean("open_to_collaborate").default(false),
    // GitHub OAuth tokens (encrypted)
    // These are stored to enable token refresh without re-authentication
    githubAccessToken: text("github_access_token"),
    githubRefreshToken: text("github_refresh_token"),
    githubTokenExpiresAt: timestamp("github_token_expires_at"),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastGithubSync: timestamp("last_github_sync"),
  },
  (table: any) => [
    index("profiles_github_username_idx").on(table.githubUsername),
    index("profiles_languages_idx").on(table.languages),
  ]
).enableRLS();


// ============================================
// SEARCH HISTORY - Discovered/searched GitHub accounts
// ============================================
export const searchHistory = devshowcase.table(
  "search_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Link to Supabase Auth user (who performed the search)
    authUserId: uuid("auth_user_id").notNull(),
    // Searched GitHub account info
    githubUsername: varchar("github_username", { length: 255 }).notNull(),
    githubName: text("github_name"),
    githubAvatarUrl: text("github_avatar_url"),
    githubBio: text("github_bio"),
    githubLocation: text("github_location"),
    // Search context
    searchQuery: text("search_query"), // The original search query
    searchType: varchar("search_type", { length: 50 }).default("ai_search"), // 'ai_search', 'direct', 'analyze'
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table: any) => [
    index("search_history_auth_user_id_idx").on(table.authUserId),
    index("search_history_github_username_idx").on(table.githubUsername),
    index("search_history_created_at_idx").on(table.createdAt),
  ]
).enableRLS();



// ============================================
// SCOUT BRIEFS - Saved search briefs for daily discovery
// ============================================
export const scoutBriefs = devshowcase.table(
  "scout_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Link to Supabase Auth user (who created the brief)
    authUserId: uuid("auth_user_id").notNull(),
    // Brief details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"), // The prompt/brief/job posting content
    // AI-extracted requirements
    requiredSkills: jsonb("required_skills").$type<string[]>().default([]),
    preferredLocation: varchar("preferred_location", { length: 255 }),
    projectType: varchar("project_type", { length: 255 }),
    // AI-extracted salary information
    salaryMin: integer("salary_min"), // Minimum salary in USD
    salaryMax: integer("salary_max"), // Maximum salary in USD
    salaryCurrency: varchar("salary_currency", { length: 10 }).default("USD"),
    salaryPeriod: varchar("salary_period", { length: 20 }), // 'yearly', 'monthly', 'hourly'
    // AI-extracted labels/tags
    experienceLevel: varchar("experience_level", { length: 50 }), // 'junior', 'mid', 'senior', 'lead', 'principal'
    employmentType: varchar("employment_type", { length: 50 }), // 'full-time', 'part-time', 'contract', 'freelance'
    remotePolicy: varchar("remote_policy", { length: 50 }), // 'remote', 'hybrid', 'onsite'
    companyName: varchar("company_name", { length: 255 }),
    // Search configuration
    isActive: boolean("is_active").default(true), // Whether to run daily searches
    lastSearchAt: timestamp("last_search_at"),
    searchFrequency: varchar("search_frequency", { length: 50 }).default("daily"), // 'daily', 'weekly'
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table: any) => [
    index("scout_briefs_auth_user_id_idx").on(table.authUserId),
    index("scout_briefs_is_active_idx").on(table.isActive),
  ]
).enableRLS();

// ============================================
// SCOUT RESULTS - Discovered profiles from scout briefs
// ============================================
export const scoutResults = devshowcase.table(
  "scout_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Link to the scout brief
    briefId: uuid("brief_id").notNull().references(() => scoutBriefs.id, { onDelete: "cascade" }),
    // Discovered GitHub profile
    githubUsername: varchar("github_username", { length: 255 }).notNull(),
    githubName: text("github_name"),
    githubAvatarUrl: text("github_avatar_url"),
    githubBio: text("github_bio"),
    githubLocation: text("github_location"),
    // Match scoring
    matchScore: integer("match_score"), // 0-100 score from getTopCandidates
    matchReasons: jsonb("match_reasons").$type<string[]>().default([]),
    concerns: jsonb("concerns").$type<string[]>().default([]),
    // Profile stats snapshot
    topLanguages: jsonb("top_languages").$type<string[]>().default([]),
    totalStars: integer("total_stars"),
    followers: integer("followers"),
    repoCount: integer("repo_count"),
    // User actions
    status: varchar("status", { length: 50 }).default("new"), // 'new', 'viewed', 'saved', 'contacted', 'dismissed'
    notes: text("notes"), // User notes about this candidate
    // Discovery metadata
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
    searchQuery: text("search_query"), // The query that found this profile
  },
  (table: any) => [
    index("scout_results_brief_id_idx").on(table.briefId),
    index("scout_results_github_username_idx").on(table.githubUsername),
    index("scout_results_status_idx").on(table.status),
    index("scout_results_discovered_at_idx").on(table.discoveredAt),
  ]
).enableRLS();


// Type exports for use in application
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
export type ScoutBrief = typeof scoutBriefs.$inferSelect;
export type NewScoutBrief = typeof scoutBriefs.$inferInsert;
export type ScoutResult = typeof scoutResults.$inferSelect;
export type NewScoutResult = typeof scoutResults.$inferInsert;
