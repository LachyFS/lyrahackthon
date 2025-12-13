import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Example users table - modify as needed for your hackathon project
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add more tables as needed for your talent recruitment platform
// Example:
// export const profiles = pgTable("profiles", { ... });
// export const jobs = pgTable("jobs", { ... });
// export const applications = pgTable("applications", { ... });
