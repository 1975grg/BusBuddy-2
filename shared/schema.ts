import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'university', 'school', 'hospital', 'airport', 'hotel'
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#0080FF"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(), // 'system_admin', 'org_admin', 'driver', 'rider'
  organizationId: varchar("organization_id").references(() => organizations.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Keep organizationSettings for backward compatibility with existing branding system
export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#0080FF"),
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  type: true,
  logoUrl: true,
  primaryColor: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  role: true,
  organizationId: true,
});

export const insertOrgSettingsSchema = createInsertSchema(organizationSettings).pick({
  name: true,
  logoUrl: true,
  primaryColor: true,
});

export const roleEnum = z.enum(["system_admin", "org_admin", "driver", "rider"]);
export const orgTypeEnum = z.enum(["university", "school", "hospital", "airport", "hotel"]);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrgSettings = z.infer<typeof insertOrgSettingsSchema>;
export type OrgSettings = typeof organizationSettings.$inferSelect;
export type UserRole = z.infer<typeof roleEnum>;
export type OrganizationType = z.infer<typeof orgTypeEnum>;
