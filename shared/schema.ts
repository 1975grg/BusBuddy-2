import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
  favoriteRouteId: varchar("favorite_route_id").references(() => routes.id),
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

// Service alerts sent by admins to riders for specific routes
export const serviceAlerts = pgTable("service_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  type: text("type").notNull(), // 'delayed', 'bus_change', 'cancelled', 'general'
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"), // 'info', 'warning', 'critical'
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  activeFrom: timestamp("active_from").defaultNow(),
  activeUntil: timestamp("active_until"), // null = until manually cleared
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages sent by riders to admins
export const riderMessages = pgTable("rider_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  type: text("type").notNull(), // 'lost_items', 'pickup_change', 'general'
  message: text("message").notNull(),
  riderName: text("rider_name"), // For anonymous riders (QR access)
  riderEmail: text("rider_email"), // Optional contact info
  userId: varchar("user_id").references(() => users.id), // For logged-in riders
  status: text("status").notNull().default("new"), // 'new', 'read', 'resolved'
  adminResponse: text("admin_response"), // Admin reply
  respondedByUserId: varchar("responded_by_user_id").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  routes: many(routes),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  favoriteRoute: one(routes, {
    fields: [users.favoriteRouteId],
    references: [routes.id],
  }),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [routes.organizationId],
    references: [organizations.id],
  }),
  stops: many(routeStops),
  favoredByUsers: many(users),
  serviceAlerts: many(serviceAlerts),
  riderMessages: many(riderMessages),
}));

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, {
    fields: [routeStops.routeId],
    references: [routes.id],
  }),
}));

export const serviceAlertsRelations = relations(serviceAlerts, ({ one }) => ({
  organization: one(organizations, {
    fields: [serviceAlerts.organizationId],
    references: [organizations.id],
  }),
  route: one(routes, {
    fields: [serviceAlerts.routeId],
    references: [routes.id],
  }),
  createdBy: one(users, {
    fields: [serviceAlerts.createdByUserId],
    references: [users.id],
  }),
}));

export const riderMessagesRelations = relations(riderMessages, ({ one }) => ({
  organization: one(organizations, {
    fields: [riderMessages.organizationId],
    references: [organizations.id],
  }),
  route: one(routes, {
    fields: [riderMessages.routeId],
    references: [routes.id],
  }),
  user: one(users, {
    fields: [riderMessages.userId],
    references: [users.id],
  }),
  respondedBy: one(users, {
    fields: [riderMessages.respondedByUserId],
    references: [users.id],
  }),
}));

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

export const insertServiceAlertSchema = createInsertSchema(serviceAlerts).pick({
  organizationId: true,
  routeId: true,
  type: true,
  title: true,
  message: true,
  severity: true,
  createdByUserId: true,
  activeUntil: true,
});

export const insertRiderMessageSchema = createInsertSchema(riderMessages).pick({
  organizationId: true,
  routeId: true,
  type: true,
  message: true,
  riderName: true,
  riderEmail: true,
  userId: true,
});

export const roleEnum = z.enum(["system_admin", "org_admin", "driver", "rider"]);
export const orgTypeEnum = z.enum(["university", "school", "hospital", "airport", "hotel"]);
export const routeTypeEnum = z.enum(["shuttle", "bus"]);
export const routeStatusEnum = z.enum(["active", "inactive"]);
export const alertTypeEnum = z.enum(["delayed", "bus_change", "cancelled", "general"]);
export const alertSeverityEnum = z.enum(["info", "warning", "critical"]);
export const messageTypeEnum = z.enum(["lost_items", "pickup_change", "general"]);
export const messageStatusEnum = z.enum(["new", "read", "resolved"]);

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
export type InsertServiceAlert = z.infer<typeof insertServiceAlertSchema>;
export type ServiceAlert = typeof serviceAlerts.$inferSelect;
export type InsertRiderMessage = z.infer<typeof insertRiderMessageSchema>;
export type RiderMessage = typeof riderMessages.$inferSelect;
export type UserRole = z.infer<typeof roleEnum>;
export type OrganizationType = z.infer<typeof orgTypeEnum>;
export type RouteType = z.infer<typeof routeTypeEnum>;
export type RouteStatus = z.infer<typeof routeStatusEnum>;
export type AlertType = z.infer<typeof alertTypeEnum>;
export type AlertSeverity = z.infer<typeof alertSeverityEnum>;
export type MessageType = z.infer<typeof messageTypeEnum>;
export type MessageStatus = z.infer<typeof messageStatusEnum>;
