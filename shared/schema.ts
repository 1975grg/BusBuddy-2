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
  messagingEnabled: boolean("messaging_enabled").notNull().default(true), // For regulatory compliance - disable all communications
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number"), // For SMS magic links
  role: text("role").notNull(), // 'system_admin', 'org_admin', 'driver', 'rider'
  organizationId: varchar("organization_id").references(() => organizations.id),
  favoriteRouteId: varchar("favorite_route_id").references(() => routes.id),
  defaultRouteId: varchar("default_route_id").references(() => routes.id), // For multi-route riders
  sessionToken: text("session_token"), // For persistent 90-day login
  sessionExpiresAt: timestamp("session_expires_at"), // Session expiration
  passwordHash: text("password_hash"), // Hashed password for password-based login (optional - some users use magic links only)
  passwordExpiresAt: timestamp("password_expires_at"), // Password expiration (null = never expires, used for rider annual expiration on July 1st)
  mustResetPassword: boolean("must_reset_password").notNull().default(false), // Forces password reset on next login (for temp passwords)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Push notification device tokens for native mobile apps
export const pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(), // Device-specific push token
  platform: text("platform").notNull(), // 'ios' or 'android'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

// Invite tokens for magic link authentication and QR code access
export const inviteTokens = pgTable("invite_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(), // Unique token for the invite
  userId: varchar("user_id").references(() => users.id), // For existing user invites
  email: text("email"), // For new user invites
  phoneNumber: text("phone_number"), // For SMS-based magic links
  role: text("role").notNull(), // Role to assign when claimed
  organizationId: varchar("organization_id").references(() => organizations.id), // Nullable for system admins
  routeId: varchar("route_id").references(() => routes.id), // Optional route assignment
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  claimedAt: timestamp("claimed_at"), // When the invite was used
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Password reset tokens for forgot password functionality
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(), // Unique token for password reset
  expiresAt: timestamp("expires_at").notNull(), // Token expiration (1 hour)
  usedAt: timestamp("used_at"), // When the token was used
  createdAt: timestamp("created_at").defaultNow(),
});

// Route assignments for authenticated users (drivers and riders)
export const userRouteAssignments = pgTable("user_route_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  assignedByUserId: varchar("assigned_by_user_id").notNull().references(() => users.id),
  isDefault: boolean("is_default").notNull().default(false), // Is this the user's default route?
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"), // When access was revoked
  revokedByUserId: varchar("revoked_by_user_id").references(() => users.id),
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
  archivedAt: timestamp("archived_at"), // Soft delete timestamp
  archivedByUserId: varchar("archived_by_user_id").references(() => users.id),
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
  approachingRadiusFt: integer("approaching_radius_ft").notNull().default(12000), // Notify when bus is ~5 min away (12000ft)
  arrivalRadiusFt: integer("arrival_radius_ft").notNull().default(250), // Notify when bus arrives (250ft)
  // Scheduled arrival time in minutes from route start (optional - for future scheduling features)
  scheduledArrivalMinutes: integer("scheduled_arrival_minutes"),
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
  priority: text("priority").notNull().default("normal"), // 'critical', 'high', 'normal'
  adminResponse: text("admin_response"), // Admin reply
  respondedByUserId: varchar("responded_by_user_id").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  forwardedAt: timestamp("forwarded_at"), // When message was forwarded to driver
  forwardedToDriverId: varchar("forwarded_to_driver_id").references(() => users.id), // Driver it was forwarded to
  forwardedByUserId: varchar("forwarded_by_user_id").references(() => users.id), // Admin who forwarded it
  archivedAt: timestamp("archived_at"),
  archivedByUserId: varchar("archived_by_user_id").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages sent by drivers to admins
export const driverMessages = pgTable("driver_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  driverUserId: varchar("driver_user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'route_issue', 'vehicle_problem', 'schedule_change', 'general'
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // 'new', 'read', 'resolved'
  priority: text("priority").notNull().default("normal"), // 'critical', 'high', 'normal'
  adminResponse: text("admin_response"), // Admin reply
  respondedByUserId: varchar("responded_by_user_id").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  archivedAt: timestamp("archived_at"),
  archivedByUserId: varchar("archived_by_user_id").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification logs for tracking all notifications sent (SMS and push)
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  routeId: varchar("route_id").references(() => routes.id), // Optional - some notifications aren't route-specific
  userId: varchar("user_id").references(() => users.id), // Recipient (rider or driver)
  recipientPhone: text("recipient_phone"), // For SMS notifications
  recipientName: text("recipient_name"), // For display in logs
  notificationType: text("notification_type").notNull(), // 'route_started', 'approaching_stop', 'arrived_at_stop', 'service_alert', 'welcome', 'rider_removed'
  deliveryMethod: text("delivery_method").notNull(), // 'sms', 'push'
  title: text("title"), // Push notification title
  message: text("message").notNull(), // Notification content
  status: text("status").notNull().default("sent"), // 'sent', 'failed', 'delivered'
  externalMessageId: text("external_message_id"), // Twilio message SID or push notification ID
  errorMessage: text("error_message"), // If failed, why
  sentAt: timestamp("sent_at").defaultNow(),
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
  smsConsent: boolean("sms_consent").notNull().default(false), // TCPA compliance - explicit SMS opt-in
  smsConsentDate: timestamp("sms_consent_date"), // When consent was given
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
  currentLatitude: decimal("current_latitude", { precision: 10, scale: 8 }),
  currentLongitude: decimal("current_longitude", { precision: 11, scale: 8 }),
  lastLocationUpdate: timestamp("last_location_update"),
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

// Stop notification tracking - prevents spam by tracking which notifications have been sent per session
export const stopNotificationTracking = pgTable("stop_notification_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => routeSessions.id),
  stopId: varchar("stop_id").notNull().references(() => routeStops.id),
  approachingNotificationSentAt: timestamp("approaching_notification_sent_at"),
  arrivalNotificationSentAt: timestamp("arrival_notification_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// In-app proximity alerts for riders (toasts/visual notifications without requiring SMS)
export const proximityAlerts = pgTable("proximity_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riderProfileId: varchar("rider_profile_id").notNull().references(() => riderProfiles.id),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  sessionId: varchar("session_id").references(() => routeSessions.id), // Optional - may be null for test alerts
  stopId: varchar("stop_id").notNull().references(() => routeStops.id),
  alertType: text("alert_type").notNull(), // 'approaching' or 'arrived'
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification log for tracking sent messages

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  routes: many(routes),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  favoriteRoute: one(routes, {
    fields: [users.favoriteRouteId],
    references: [routes.id],
  }),
  defaultRoute: one(routes, {
    fields: [users.defaultRouteId],
    references: [routes.id],
  }),
  routeAssignments: many(userRouteAssignments),
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
  archivedBy: one(users, {
    fields: [riderMessages.archivedByUserId],
    references: [users.id],
  }),
}));

export const driverMessagesRelations = relations(driverMessages, ({ one }) => ({
  organization: one(organizations, {
    fields: [driverMessages.organizationId],
    references: [organizations.id],
  }),
  route: one(routes, {
    fields: [driverMessages.routeId],
    references: [routes.id],
  }),
  driver: one(users, {
    fields: [driverMessages.driverUserId],
    references: [users.id],
  }),
  respondedBy: one(users, {
    fields: [driverMessages.respondedByUserId],
    references: [users.id],
  }),
  archivedBy: one(users, {
    fields: [driverMessages.archivedByUserId],
    references: [users.id],
  }),
}));

export const riderProfilesRelations = relations(riderProfiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [riderProfiles.organizationId],
    references: [organizations.id],
  }),
  subscriptions: many(routeSubscriptions),
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

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationLogs.organizationId],
    references: [organizations.id],
  }),
  route: one(routes, {
    fields: [notificationLogs.routeId],
    references: [routes.id],
  }),
  user: one(users, {
    fields: [notificationLogs.userId],
    references: [users.id],
  }),
}));

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  user: one(users, {
    fields: [inviteTokens.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [inviteTokens.organizationId],
    references: [organizations.id],
  }),
  route: one(routes, {
    fields: [inviteTokens.routeId],
    references: [routes.id],
  }),
  createdBy: one(users, {
    fields: [inviteTokens.createdByUserId],
    references: [users.id],
  }),
}));

export const userRouteAssignmentsRelations = relations(userRouteAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRouteAssignments.userId],
    references: [users.id],
  }),
  route: one(routes, {
    fields: [userRouteAssignments.routeId],
    references: [routes.id],
  }),
  assignedBy: one(users, {
    fields: [userRouteAssignments.assignedByUserId],
    references: [users.id],
  }),
  revokedBy: one(users, {
    fields: [userRouteAssignments.revokedByUserId],
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
  phoneNumber: true,
  role: true,
  organizationId: true,
  favoriteRouteId: true,
  defaultRouteId: true,
  passwordExpiresAt: true,
});

export const insertPushTokenSchema = createInsertSchema(pushTokens).pick({
  userId: true,
  token: true,
  platform: true,
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
  scheduledArrivalMinutes: true,
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

export const insertDriverMessageSchema = createInsertSchema(driverMessages).pick({
  organizationId: true,
  routeId: true,
  driverUserId: true,
  type: true,
  message: true,
});

export const insertRiderProfileSchema = createInsertSchema(riderProfiles).pick({
  phoneNumber: true,
  name: true,
  organizationId: true,
  notificationMethod: true,
  email: true,
  smsConsent: true,
  smsConsentDate: true,
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

export const insertStopNotificationTrackingSchema = createInsertSchema(stopNotificationTracking).pick({
  sessionId: true,
  stopId: true,
  approachingNotificationSentAt: true,
  arrivalNotificationSentAt: true,
});

export const insertProximityAlertSchema = createInsertSchema(proximityAlerts).omit({
  id: true,
  createdAt: true,
});

export const proximityAlertTypeEnum = z.enum(['approaching', 'arrived']);

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  createdAt: true,
  sentAt: true,
}).extend({
  userId: z.string().nullable().optional(), // Allow null for notifications to riders (who are in rider_profiles, not users)
});

export const insertInviteTokenSchema = createInsertSchema(inviteTokens).pick({
  token: true,
  userId: true,
  email: true,
  phoneNumber: true,
  role: true,
  organizationId: true,
  routeId: true,
  expiresAt: true,
  createdByUserId: true,
});

export const insertUserRouteAssignmentSchema = createInsertSchema(userRouteAssignments).pick({
  userId: true,
  routeId: true,
  assignedByUserId: true,
  isDefault: true,
});

// Organization inquiries from the public website (Get Started form)
export const organizationInquiries = pgTable("organization_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationName: text("organization_name").notNull(),
  organizationType: text("organization_type").notNull(), // school, hospital, airport, hotel, transit, other
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  estimatedFleetSize: text("estimated_fleet_size"),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending, contacted, approved, declined
  notes: text("notes"), // Internal notes from system admin
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
});

// Contact form submissions from the public website
export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // new, read, replied
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertOrganizationInquirySchema = createInsertSchema(organizationInquiries).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedByUserId: true,
  notes: true,
  status: true,
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
  status: true,
});

export const roleEnum = z.enum(["system_admin", "org_admin", "driver", "rider"]);
export const orgTypeEnum = z.enum(["university", "school", "hospital", "airport", "hotel"]);
export const routeTypeEnum = z.enum(["shuttle", "bus"]);
export const routeStatusEnum = z.enum(["active", "inactive"]);
export const alertTypeEnum = z.enum(["delayed", "bus_change", "cancelled", "general"]);
export const alertSeverityEnum = z.enum(["info", "warning", "critical"]);
export const messageTypeEnum = z.enum(["lost_items", "pickup_change", "general"]);
export const messageStatusEnum = z.enum(["new", "read", "resolved"]);
export const messagePriorityEnum = z.enum(["critical", "high", "normal"]);
export const notificationMethodEnum = z.enum(["sms", "email", "both"]);
export const notificationModeEnum = z.enum(["always", "manual"]);
export const routeSessionStatusEnum = z.enum(["pending", "active", "completed", "cancelled"]);
export const notificationTypeEnum = z.enum(["route_started", "approaching_stop", "arrived_at_stop", "service_alert"]);
export const notificationDeliveryMethodEnum = z.enum(["sms", "email", "push"]);
export const notificationStatusEnum = z.enum(["pending", "sent", "failed"]);
export const dayOfWeekEnum = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;
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
export type InsertDriverMessage = z.infer<typeof insertDriverMessageSchema>;
export type DriverMessage = typeof driverMessages.$inferSelect;
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
export type InsertStopNotificationTracking = z.infer<typeof insertStopNotificationTrackingSchema>;
export type StopNotificationTracking = typeof stopNotificationTracking.$inferSelect;
export type InsertProximityAlert = z.infer<typeof insertProximityAlertSchema>;
export type ProximityAlert = typeof proximityAlerts.$inferSelect;
export type ProximityAlertType = z.infer<typeof proximityAlertTypeEnum>;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;
export type InviteToken = typeof inviteTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertUserRouteAssignment = z.infer<typeof insertUserRouteAssignmentSchema>;
export type UserRouteAssignment = typeof userRouteAssignments.$inferSelect;
export type UserRole = z.infer<typeof roleEnum>;
export type OrganizationType = z.infer<typeof orgTypeEnum>;
export type RouteType = z.infer<typeof routeTypeEnum>;
export type RouteStatus = z.infer<typeof routeStatusEnum>;
export type AlertType = z.infer<typeof alertTypeEnum>;
export type AlertSeverity = z.infer<typeof alertSeverityEnum>;
export type MessageType = z.infer<typeof messageTypeEnum>;
export type MessageStatus = z.infer<typeof messageStatusEnum>;
export type MessagePriority = z.infer<typeof messagePriorityEnum>;
export type NotificationMethod = z.infer<typeof notificationMethodEnum>;
export type NotificationMode = z.infer<typeof notificationModeEnum>;
export type RouteSessionStatus = z.infer<typeof routeSessionStatusEnum>;
export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type NotificationDeliveryMethod = z.infer<typeof notificationDeliveryMethodEnum>;
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;
export type DayOfWeek = z.infer<typeof dayOfWeekEnum>;
export type InsertOrganizationInquiry = z.infer<typeof insertOrganizationInquirySchema>;
export type OrganizationInquiry = typeof organizationInquiries.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
