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



// Type exports for use in application
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
