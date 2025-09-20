import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, decimal } from "drizzle-orm/pg-core";
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

export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'shuttle', 'bus'
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  vehicleNumber: text("vehicle_number"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const routeStops = pgTable("route_stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"), // Full formatted address from geocoding service
  placeId: text("place_id"), // Unique identifier from mapping service
  routeId: varchar("route_id").notNull().references(() => routes.id),
  orderIndex: integer("order_index").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  // Geofencing radii for proximity notifications (in meters)
  approachingRadiusM: integer("approaching_radius_m").notNull().default(250), // Notify when bus is 250m away
  arrivalRadiusM: integer("arrival_radius_m").notNull().default(75), // Notify when bus arrives (75m)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertRouteSchema = createInsertSchema(routes).pick({
  name: true,
  type: true,
  status: true,
  vehicleNumber: true,
  organizationId: true,
});

export const insertRouteStopSchema = createInsertSchema(routeStops).pick({
  name: true,
  address: true,
  placeId: true,
  routeId: true,
  orderIndex: true,
  latitude: true,
  longitude: true,
  approachingRadiusM: true,
  arrivalRadiusM: true,
});

export const roleEnum = z.enum(["system_admin", "org_admin", "driver", "rider"]);
export const orgTypeEnum = z.enum(["university", "school", "hospital", "airport", "hotel"]);
export const routeTypeEnum = z.enum(["shuttle", "bus"]);
export const routeStatusEnum = z.enum(["active", "inactive"]);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrgSettings = z.infer<typeof insertOrgSettingsSchema>;
export type OrgSettings = typeof organizationSettings.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;
export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;
export type RouteStop = typeof routeStops.$inferSelect;
export type UserRole = z.infer<typeof roleEnum>;
export type OrganizationType = z.infer<typeof orgTypeEnum>;
export type RouteType = z.infer<typeof routeTypeEnum>;
export type RouteStatus = z.infer<typeof routeStatusEnum>;
