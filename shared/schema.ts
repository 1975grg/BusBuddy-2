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
  // Geofencing radii for proximity notifications (in feet)
  approachingRadiusFt: integer("approaching_radius_ft").notNull().default(800), // Notify when bus is 800ft away
  arrivalRadiusFt: integer("arrival_radius_ft").notNull().default(250), // Notify when bus arrives (250ft)
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

// Rider profiles for QR code access (anonymous riders)
export const riderProfiles = pgTable("rider_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"), // Optional display name
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  notificationMethod: text("notification_method").notNull().default("sms"), // 'sms', 'email', 'both'
  email: text("email"), // Optional for email notifications
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Route subscriptions - which riders are subscribed to which routes
export const routeSubscriptions = pgTable("route_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  riderProfileId: varchar("rider_profile_id").notNull().references(() => riderProfiles.id),
  notificationMode: text("notification_mode").notNull().default("always"), // 'always', 'manual'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stop preferences - which specific stops each rider cares about
export const stopPreferences = pgTable("stop_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => routeSubscriptions.id),
  stopId: varchar("stop_id").notNull().references(() => routeStops.id),
  notifyOnApproaching: boolean("notify_on_approaching").notNull().default(true),
  notifyOnArrival: boolean("notify_on_arrival").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Route sessions - track when routes are active/running
export const routeSessions = pgTable("route_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  driverUserId: varchar("driver_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // 'pending', 'active', 'completed', 'cancelled'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  currentStopId: varchar("current_stop_id").references(() => routeStops.id),
  estimatedCompletionTime: timestamp("estimated_completion_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Driver schedules for automatic route starting
export const driverSchedules = pgTable("driver_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  driverUserId: varchar("driver_user_id").notNull().references(() => users.id),
  scheduledTime: text("scheduled_time").notNull(), // "HH:MM" format
  daysOfWeek: text("days_of_week").array().notNull(), // ['monday', 'tuesday', ...]
  vacationWeeks: text("vacation_weeks").array().default([]), // ['2024-12-23', '2024-12-30'] - week start dates
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification log for tracking sent messages
export const notificationLog = pgTable("notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderProfileId: varchar("rider_profile_id").references(() => riderProfiles.id),
  routeSessionId: varchar("route_session_id").references(() => routeSessions.id),
  type: text("type").notNull(), // 'route_started', 'approaching_stop', 'arrived_at_stop', 'route_completed', 'service_alert'
  method: text("method").notNull(), // 'sms', 'email', 'push'
  recipient: text("recipient").notNull(), // phone number or email
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed'
  externalId: text("external_id"), // SMS service message ID
  sentAt: timestamp("sent_at"),
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

export const riderProfilesRelations = relations(riderProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [riderProfiles.organizationId],
    references: [organizations.id],
  }),
  subscriptions: many(routeSubscriptions),
  notifications: many(notificationLog),
}));

export const routeSubscriptionsRelations = relations(routeSubscriptions, ({ one, many }) => ({
  route: one(routes, {
    fields: [routeSubscriptions.routeId],
    references: [routes.id],
  }),
  riderProfile: one(riderProfiles, {
    fields: [routeSubscriptions.riderProfileId],
    references: [riderProfiles.id],
  }),
  stopPreferences: many(stopPreferences),
}));

export const stopPreferencesRelations = relations(stopPreferences, ({ one }) => ({
  subscription: one(routeSubscriptions, {
    fields: [stopPreferences.subscriptionId],
    references: [routeSubscriptions.id],
  }),
  stop: one(routeStops, {
    fields: [stopPreferences.stopId],
    references: [routeStops.id],
  }),
}));

export const routeSessionsRelations = relations(routeSessions, ({ one, many }) => ({
  route: one(routes, {
    fields: [routeSessions.routeId],
    references: [routes.id],
  }),
  driver: one(users, {
    fields: [routeSessions.driverUserId],
    references: [users.id],
  }),
  currentStop: one(routeStops, {
    fields: [routeSessions.currentStopId],
    references: [routeStops.id],
  }),
  notifications: many(notificationLog),
}));

export const driverSchedulesRelations = relations(driverSchedules, ({ one }) => ({
  route: one(routes, {
    fields: [driverSchedules.routeId],
    references: [routes.id],
  }),
  driver: one(users, {
    fields: [driverSchedules.driverUserId],
    references: [users.id],
  }),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  riderProfile: one(riderProfiles, {
    fields: [notificationLog.riderProfileId],
    references: [riderProfiles.id],
  }),
  routeSession: one(routeSessions, {
    fields: [notificationLog.routeSessionId],
    references: [routeSessions.id],
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
  approachingRadiusFt: true,
  arrivalRadiusFt: true,
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

export const insertRiderProfileSchema = createInsertSchema(riderProfiles).pick({
  phoneNumber: true,
  name: true,
  organizationId: true,
  notificationMethod: true,
  email: true,
});

export const insertRouteSubscriptionSchema = createInsertSchema(routeSubscriptions).pick({
  routeId: true,
  riderProfileId: true,
  notificationMode: true,
});

export const insertStopPreferenceSchema = createInsertSchema(stopPreferences).pick({
  subscriptionId: true,
  stopId: true,
  notifyOnApproaching: true,
  notifyOnArrival: true,
});

export const insertRouteSessionSchema = createInsertSchema(routeSessions).pick({
  routeId: true,
  driverUserId: true,
  estimatedCompletionTime: true,
});

export const insertDriverScheduleSchema = createInsertSchema(driverSchedules).pick({
  routeId: true,
  driverUserId: true,
  scheduledTime: true,
  daysOfWeek: true,
  vacationWeeks: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationLog).pick({
  riderProfileId: true,
  routeSessionId: true,
  type: true,
  method: true,
  recipient: true,
  message: true,
});

export const roleEnum = z.enum(["system_admin", "org_admin", "driver", "rider"]);
export const orgTypeEnum = z.enum(["university", "school", "hospital", "airport", "hotel"]);
export const routeTypeEnum = z.enum(["shuttle", "bus"]);
export const routeStatusEnum = z.enum(["active", "inactive"]);
export const alertTypeEnum = z.enum(["delayed", "bus_change", "cancelled", "general"]);
export const alertSeverityEnum = z.enum(["info", "warning", "critical"]);
export const messageTypeEnum = z.enum(["lost_items", "pickup_change", "general"]);
export const messageStatusEnum = z.enum(["new", "read", "resolved"]);
export const notificationMethodEnum = z.enum(["sms", "email", "both"]);
export const notificationModeEnum = z.enum(["always", "manual"]);
export const routeSessionStatusEnum = z.enum(["pending", "active", "completed", "cancelled"]);
export const notificationTypeEnum = z.enum(["route_started", "approaching_stop", "arrived_at_stop", "route_completed", "service_alert"]);
export const notificationDeliveryMethodEnum = z.enum(["sms", "email", "push"]);
export const notificationStatusEnum = z.enum(["pending", "sent", "failed"]);
export const dayOfWeekEnum = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

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
export type InsertRiderProfile = z.infer<typeof insertRiderProfileSchema>;
export type RiderProfile = typeof riderProfiles.$inferSelect;
export type InsertRouteSubscription = z.infer<typeof insertRouteSubscriptionSchema>;
export type RouteSubscription = typeof routeSubscriptions.$inferSelect;
export type InsertStopPreference = z.infer<typeof insertStopPreferenceSchema>;
export type StopPreference = typeof stopPreferences.$inferSelect;
export type InsertRouteSession = z.infer<typeof insertRouteSessionSchema>;
export type RouteSession = typeof routeSessions.$inferSelect;
export type InsertDriverSchedule = z.infer<typeof insertDriverScheduleSchema>;
export type DriverSchedule = typeof driverSchedules.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLog.$inferSelect;
export type UserRole = z.infer<typeof roleEnum>;
export type OrganizationType = z.infer<typeof orgTypeEnum>;
export type RouteType = z.infer<typeof routeTypeEnum>;
export type RouteStatus = z.infer<typeof routeStatusEnum>;
export type AlertType = z.infer<typeof alertTypeEnum>;
export type AlertSeverity = z.infer<typeof alertSeverityEnum>;
export type MessageType = z.infer<typeof messageTypeEnum>;
export type MessageStatus = z.infer<typeof messageStatusEnum>;
export type NotificationMethod = z.infer<typeof notificationMethodEnum>;
export type NotificationMode = z.infer<typeof notificationModeEnum>;
export type RouteSessionStatus = z.infer<typeof routeSessionStatusEnum>;
export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type NotificationDeliveryMethod = z.infer<typeof notificationDeliveryMethodEnum>;
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;
export type DayOfWeek = z.infer<typeof dayOfWeekEnum>;
