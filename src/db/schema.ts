import {
  pgSchema,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
  (table) => [
    index("profiles_github_username_idx").on(table.githubUsername),
    index("profiles_languages_idx").on(table.languages),
  ]
);

// ============================================
// POSTS - Projects/work shared by engineers
// ============================================
export const posts = devshowcase.table(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Post content
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // Media
    images: jsonb("images").$type<string[]>().default([]),
    // GitHub repo link (optional)
    repoUrl: text("repo_url"),
    repoName: text("repo_name"),
    repoOwner: text("repo_owner"),
    // Repo metadata (if linked)
    repoStars: integer("repo_stars"),
    repoForks: integer("repo_forks"),
    repoLanguage: varchar("repo_language", { length: 100 }),
    // External links
    demoUrl: text("demo_url"),
    // Tags/tech stack
    tags: jsonb("tags").$type<string[]>().default([]),
    // Post flags
    lookingForCollaborators: boolean("looking_for_collaborators").default(false),
    // Counts (denormalized for performance)
    likesCount: integer("likes_count").default(0),
    commentsCount: integer("comments_count").default(0),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("posts_author_id_idx").on(table.authorId),
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_tags_idx").on(table.tags),
  ]
);

// ============================================
// FOLLOWS - User following relationships
// ============================================
export const follows = devshowcase.table(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ]
);

// ============================================
// LIKES - Post likes
// ============================================
export const likes = devshowcase.table(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("likes_post_id_idx").on(table.postId),
  ]
);

// ============================================
// COMMENTS - Post comments
// ============================================
export const comments = devshowcase.table(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // For threaded comments (optional)
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("comments_post_id_idx").on(table.postId),
    index("comments_author_id_idx").on(table.authorId),
  ]
);

// ============================================
// RELATIONS
// ============================================
export const profilesRelations = relations(profiles, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  likes: many(likes),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "followers" }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(profiles, {
    fields: [posts.authorId],
    references: [profiles.id],
  }),
  comments: many(comments),
  likes: many(likes),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(profiles, {
    fields: [follows.followerId],
    references: [profiles.id],
    relationName: "followers",
  }),
  following: one(profiles, {
    fields: [follows.followingId],
    references: [profiles.id],
    relationName: "following",
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(profiles, {
    fields: [likes.userId],
    references: [profiles.id],
  }),
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(profiles, {
    fields: [comments.authorId],
    references: [profiles.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
}));

// Type exports for use in application
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
