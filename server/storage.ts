import { 
  type User, 
  type InsertUser, 
  type Organization, 
  type InsertOrganization,
  type OrgSettings, 
  type InsertOrgSettings,
  type UserRole,
  type Route,
  type InsertRoute,
  type RouteStop,
  type InsertRouteStop,
  type ServiceAlert,
  type InsertServiceAlert,
  type RiderMessage,
  type InsertRiderMessage,
  type DriverMessage,
  type InsertDriverMessage,
  type RiderProfile,
  type InsertRiderProfile,
  type RouteSubscription,
  type InsertRouteSubscription,
  type StopPreference,
  type InsertStopPreference,
  type RouteSession,
  type InsertRouteSession,
  type StopNotificationTracking,
  type InsertStopNotificationTracking,
  type ProximityAlert,
  type InsertProximityAlert,
  type NotificationLog,
  type InsertNotificationLog,
  type InviteToken,
  type InsertInviteToken,
  type UserRouteAssignment,
  type InsertUserRouteAssignment,
  type PushToken,
  type InsertPushToken,
  type PasswordResetToken,
  users,
  passwordResetTokens,
  organizations,
  organizationSettings,
  routes,
  routeStops,
  serviceAlerts,
  riderMessages,
  driverMessages,
  riderProfiles,
  routeSubscriptions,
  stopPreferences,
  routeSessions,
  stopNotificationTracking,
  proximityAlerts,
  notificationLogs,
  inviteTokens,
  userRouteAssignments,
  pushTokens
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  getUserBySessionToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  getUsersByRole(role: UserRole): Promise<User[]>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  setUserFavoriteRoute(userId: string, routeId: string | null): Promise<User | undefined>;
  setUserSession(userId: string, token: string, expiresAt: Date): Promise<User | undefined>;
  clearUserSession(userId: string): Promise<User | undefined>;
  setUserPassword(userId: string, passwordHash: string): Promise<User | undefined>;
  setUserPasswordWithExpiration(userId: string, passwordHash: string, passwordExpiresAt: Date | null): Promise<User | undefined>;
  deactivateUser(userId: string): Promise<User | undefined>;
  renewAllRiderPasswords(organizationId: string, newExpiresAt: Date): Promise<number>;
  
  // Push notification tokens
  registerPushToken(token: InsertPushToken): Promise<PushToken>;
  getPushTokensByUser(userId: string): Promise<PushToken[]>;
  deactivatePushToken(token: string): Promise<boolean>;
  
  // Invite tokens for magic link authentication
  createInviteToken(token: InsertInviteToken): Promise<InviteToken>;
  getInviteToken(token: string): Promise<InviteToken | undefined>;
  getInviteTokenById(id: string): Promise<InviteToken | undefined>;
  claimInviteToken(token: string): Promise<InviteToken | undefined>;
  getActiveInvitesByOrganization(organizationId: string): Promise<InviteToken[]>;
  expireInviteToken(id: string): Promise<boolean>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<boolean>;
  
  // User route assignments (for multi-route users)
  createUserRouteAssignment(assignment: InsertUserRouteAssignment): Promise<UserRouteAssignment>;
  getUserRouteAssignments(userId: string): Promise<UserRouteAssignment[]>;
  getRouteAssignmentsByRoute(routeId: string): Promise<UserRouteAssignment[]>;
  setDefaultRoute(userId: string, routeId: string): Promise<UserRouteAssignment | undefined>;
  revokeRouteAssignment(assignmentId: string, revokedByUserId: string): Promise<UserRouteAssignment | undefined>;
  deleteRouteAssignment(assignmentId: string): Promise<boolean>;
  
  // Organization management
  getOrganization(id: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  
  // Organization settings (backward compatibility)
  getOrgSettings(id: string): Promise<OrgSettings | undefined>;
  createOrgSettings(settings: InsertOrgSettings): Promise<OrgSettings>;
  updateOrgSettings(id: string, settings: Partial<InsertOrgSettings>): Promise<OrgSettings | undefined>;
  getDefaultOrgSettings(): Promise<OrgSettings | undefined>;
  
  // Route management
  getRoute(id: string): Promise<Route | undefined>;
  getRoutesByOrganization(organizationId: string): Promise<Route[]>;
  getAllRoutes(): Promise<Route[]>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: string): Promise<boolean>;
  archiveRoute(id: string, archivedByUserId: string): Promise<{ success: boolean; error?: string; affectedRiders?: number; affectedDrivers?: number }>;
  
  // Route stops management
  getRouteStop(id: string): Promise<RouteStop | undefined>;
  getRouteStopsByRoute(routeId: string): Promise<RouteStop[]>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;
  updateRouteStop(id: string, stop: Partial<InsertRouteStop>): Promise<RouteStop | undefined>;
  deleteRouteStop(id: string): Promise<boolean>;
  
  // Service alerts (Admin → Riders)
  createServiceAlert(alert: InsertServiceAlert): Promise<ServiceAlert>;
  getActiveServiceAlerts(routeId: string): Promise<ServiceAlert[]>;
  getServiceAlertsByOrganization(organizationId: string): Promise<ServiceAlert[]>;
  deactivateServiceAlert(id: string): Promise<boolean>;
  expireServiceAlert(id: string): Promise<boolean>;
  
  // Rider messages (Riders → Admin)  
  createRiderMessage(message: InsertRiderMessage): Promise<RiderMessage>;
  getRiderMessage(id: string): Promise<RiderMessage | undefined>;
  getRiderMessagesByRoute(routeId: string): Promise<RiderMessage[]>;
  archiveRiderMessage(id: string, archivedByUserId: string): Promise<RiderMessage | undefined>;
  restoreRiderMessage(id: string): Promise<RiderMessage | undefined>;
  deleteRiderMessage(id: string): Promise<boolean>;
  updateRiderMessagePriority(id: string, priority: string): Promise<RiderMessage | undefined>;
  
  // Driver messages (Drivers → Admin)
  createDriverMessage(message: InsertDriverMessage): Promise<DriverMessage>;
  getDriverMessage(id: string): Promise<DriverMessage | undefined>;
  getDriverMessagesByRoute(routeId: string): Promise<DriverMessage[]>;
  getDriverMessagesByOrganization(organizationId: string): Promise<DriverMessage[]>;
  updateDriverMessageStatus(id: string, status: string): Promise<DriverMessage | undefined>;
  respondToDriverMessage(id: string, response: string, respondedByUserId: string): Promise<DriverMessage | undefined>;
  archiveDriverMessage(id: string, archivedByUserId: string): Promise<DriverMessage | undefined>;
  restoreDriverMessage(id: string): Promise<DriverMessage | undefined>;
  deleteDriverMessage(id: string): Promise<boolean>;
  updateDriverMessagePriority(id: string, priority: string): Promise<DriverMessage | undefined>;
  
  // Rider profiles management
  createRiderProfile(profile: InsertRiderProfile): Promise<RiderProfile>;
  getRiderProfileByPhone(phoneNumber: string, organizationId: string): Promise<RiderProfile | undefined>;
  getRiderProfile(id: string): Promise<RiderProfile | undefined>;
  updateRiderProfile(id: string, profile: Partial<InsertRiderProfile>): Promise<RiderProfile | undefined>;
  getRidersForRoute(routeId: string): Promise<Array<RiderProfile & { subscriptionId: string; notificationMode: string }>>;
  deleteRiderFromRoute(riderProfileId: string, routeId: string): Promise<{ success: boolean; deletedSubscription?: RouteSubscription; riderProfile?: RiderProfile }>;
  getDriversForRoute(routeId: string): Promise<Array<{ id: string; name: string | null; email: string; phoneNumber: string | null; organizationId: string }>>;
  
  // Route subscriptions management
  createRouteSubscription(subscription: InsertRouteSubscription): Promise<RouteSubscription>;
  getSubscriptionsByRiderProfile(riderProfileId: string): Promise<RouteSubscription[]>;
  getSubscriptionsByRoute(routeId: string): Promise<RouteSubscription[]>;
  updateSubscriptionNotificationMode(subscriptionId: string, notificationMode: 'always' | 'manual'): Promise<RouteSubscription | undefined>;
  
  // Stop preferences management
  createStopPreference(preference: InsertStopPreference): Promise<StopPreference>;
  getStopPreferencesBySubscription(subscriptionId: string): Promise<StopPreference[]>;
  
  // Route sessions management (tracking active routes)
  createRouteSession(session: InsertRouteSession): Promise<RouteSession>;
  getActiveRouteSession(routeId: string): Promise<RouteSession | undefined>;
  getRouteSession(sessionId: string): Promise<RouteSession | undefined>;
  updateRouteSessionStatus(sessionId: string, status: 'pending' | 'active' | 'completed' | 'cancelled'): Promise<RouteSession | undefined>;
  updateRouteSessionCurrentStop(sessionId: string, stopId: string | null): Promise<RouteSession | undefined>;
  updateRouteSessionLocation(sessionId: string, latitude: string, longitude: string): Promise<RouteSession | undefined>;
  startRoute(routeId: string, driverUserId: string): Promise<RouteSession>;
  endRoute(sessionId: string): Promise<RouteSession | undefined>;
  updateDriverLocation(sessionId: string, latitude: number, longitude: number): Promise<{ session: RouteSession; stopsToNotify: Array<{ stopId: string; notificationType: 'approaching' | 'arrived' }> }>;
  
  // Stop notification tracking (prevent spam)
  getStopNotificationTracking(sessionId: string, stopId: string): Promise<StopNotificationTracking | undefined>;
  markApproachingNotificationSent(sessionId: string, stopId: string): Promise<void>;
  markArrivalNotificationSent(sessionId: string, stopId: string): Promise<void>;
  
  // Notification logs
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  getNotificationLogs(params: {
    organizationId: string;
    routeId?: string;
    notificationType?: string;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]>;
  getNotificationLogCount(organizationId: string): Promise<number>;
  
  // In-app proximity alerts (for riders without SMS)
  createProximityAlert(alert: InsertProximityAlert): Promise<ProximityAlert>;
  getUnreadProximityAlerts(riderProfileId: string): Promise<ProximityAlert[]>;
  markProximityAlertAsRead(alertId: string): Promise<ProximityAlert | undefined>;
  markAllProximityAlertsAsRead(riderProfileId: string): Promise<void>;
  
  // Additional route methods
  getRouteById(id: string): Promise<Route | undefined>;
  getOrganizationById(id: string): Promise<Organization | undefined>;
  getRiderMessagesByOrganization(organizationId: string): Promise<RiderMessage[]>;
  updateRiderMessageStatus(id: string, status: string): Promise<RiderMessage | undefined>;
  addAdminResponse(id: string, response: string, respondedByUserId: string): Promise<RiderMessage | undefined>;
}

// Database-backed storage implementation (from javascript_database blueprint)
export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Import password expiration utility
    const { getPasswordExpirationForRole } = await import("./passwordExpiration");
    
    // Set password expiration based on role
    // Riders: expire on next July 1st
    // Drivers/Admins: never expire (null)
    const passwordExpiresAt = getPasswordExpirationForRole(insertUser.role);
    
    const [user] = await db.insert(users).values({
      ...insertUser,
      passwordExpiresAt
    }).returning();
    return user;
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async setUserFavoriteRoute(userId: string, routeId: string | null): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ favoriteRouteId: routeId })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user || undefined;
  }

  async getUserBySessionToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users)
      .where(and(
        eq(users.sessionToken, token),
        sql`${users.sessionExpiresAt} > NOW()`
      ));
    return user || undefined;
  }

  async updateUser(id: string, updateUser: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updateUser)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async setUserSession(userId: string, token: string, expiresAt: Date): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ sessionToken: token, sessionExpiresAt: expiresAt })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async clearUserSession(userId: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ sessionToken: null, sessionExpiresAt: null })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async setUserPassword(userId: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async setUserPasswordWithExpiration(userId: string, passwordHash: string, passwordExpiresAt: Date | null): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ passwordHash, passwordExpiresAt })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async deactivateUser(userId: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async renewAllRiderPasswords(organizationId: string, newExpiresAt: Date): Promise<number> {
    const result = await db.update(users)
      .set({ passwordExpiresAt: newExpiresAt })
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'rider')
        )
      )
      .returning({ id: users.id });
    return result.length;
  }

  // Push notification tokens
  async registerPushToken(insertToken: InsertPushToken): Promise<PushToken> {
    // Check if token already exists
    const existing = await db.select()
      .from(pushTokens)
      .where(eq(pushTokens.token, insertToken.token))
      .limit(1);
    
    if (existing.length > 0) {
      // Reactivate existing token and update timestamp
      const [updated] = await db.update(pushTokens)
        .set({ 
          isActive: true, 
          lastUsedAt: new Date(),
          userId: insertToken.userId // Update userId in case it changed
        })
        .where(eq(pushTokens.token, insertToken.token))
        .returning();
      return updated;
    }
    
    // Insert new token if it doesn't exist
    const [token] = await db.insert(pushTokens).values(insertToken).returning();
    return token;
  }

  async getPushTokensByUser(userId: string): Promise<PushToken[]> {
    return await db.select()
      .from(pushTokens)
      .where(and(
        eq(pushTokens.userId, userId),
        eq(pushTokens.isActive, true)
      ));
  }

  async deactivatePushToken(token: string): Promise<boolean> {
    const [updated] = await db.update(pushTokens)
      .set({ isActive: false })
      .where(eq(pushTokens.token, token))
      .returning();
    return !!updated;
  }

  // Invite tokens management
  async createInviteToken(insertToken: InsertInviteToken): Promise<InviteToken> {
    const [token] = await db.insert(inviteTokens).values(insertToken).returning();
    return token;
  }

  async getInviteToken(token: string): Promise<InviteToken | undefined> {
    const [inviteToken] = await db.select().from(inviteTokens)
      .where(and(
        eq(inviteTokens.token, token),
        eq(inviteTokens.isActive, true),
        isNull(inviteTokens.claimedAt),
        sql`${inviteTokens.expiresAt} > NOW()`
      ));
    return inviteToken || undefined;
  }

  async getInviteTokenById(id: string): Promise<InviteToken | undefined> {
    const [token] = await db.select().from(inviteTokens).where(eq(inviteTokens.id, id));
    return token || undefined;
  }

  async claimInviteToken(token: string): Promise<InviteToken | undefined> {
    const [inviteToken] = await db.update(inviteTokens)
      .set({ claimedAt: new Date() })
      .where(eq(inviteTokens.token, token))
      .returning();
    return inviteToken || undefined;
  }

  async getActiveInvitesByOrganization(organizationId: string): Promise<InviteToken[]> {
    return await db.select().from(inviteTokens)
      .where(and(
        eq(inviteTokens.organizationId, organizationId),
        eq(inviteTokens.isActive, true),
        isNull(inviteTokens.claimedAt)
      ));
  }

  async expireInviteToken(id: string): Promise<boolean> {
    const result = await db.update(inviteTokens)
      .set({ isActive: false })
      .where(eq(inviteTokens.id, id));
    return true;
  }

  // Password reset tokens management
  // Note: The 'hashedToken' parameter should already be bcrypt-hashed by the caller
  async createPasswordResetToken(userId: string, hashedToken: string, expiresAt: Date): Promise<PasswordResetToken> {
    // Invalidate any existing unused tokens for this user
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt)
      ));
    
    // Create new reset token (stores the pre-hashed token)
    const [resetToken] = await db.insert(passwordResetTokens).values({
      userId,
      token: hashedToken,
      expiresAt,
    }).returning();
    return resetToken;
  }

  // Verify a raw (unhashed) token against stored bcrypt hashes
  async getPasswordResetToken(rawToken: string): Promise<PasswordResetToken | undefined> {
    // Get all unexpired, unused tokens 
    const bcrypt = await import("bcrypt");
    const validTokens = await db.select().from(passwordResetTokens)
      .where(and(
        isNull(passwordResetTokens.usedAt),
        sql`${passwordResetTokens.expiresAt} > NOW()`
      ));
    
    // Compare the raw token against each stored hash using bcrypt
    // bcrypt.compare(rawToken, storedHash) returns true if they match
    for (const resetToken of validTokens) {
      const isMatch = await bcrypt.compare(rawToken, resetToken.token);
      if (isMatch) {
        return resetToken;
      }
    }
    return undefined;
  }

  async markPasswordResetTokenUsed(id: string): Promise<boolean> {
    const [updated] = await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id))
      .returning();
    return !!updated;
  }

  // User route assignments management
  async createUserRouteAssignment(insertAssignment: InsertUserRouteAssignment): Promise<UserRouteAssignment> {
    const [assignment] = await db.insert(userRouteAssignments).values(insertAssignment).returning();
    return assignment;
  }

  async getUserRouteAssignments(userId: string): Promise<UserRouteAssignment[]> {
    return await db.select().from(userRouteAssignments)
      .where(and(
        eq(userRouteAssignments.userId, userId),
        eq(userRouteAssignments.isActive, true),
        isNull(userRouteAssignments.revokedAt)
      ));
  }

  async getRouteAssignmentsByRoute(routeId: string): Promise<UserRouteAssignment[]> {
    return await db.select().from(userRouteAssignments)
      .where(and(
        eq(userRouteAssignments.routeId, routeId),
        eq(userRouteAssignments.isActive, true),
        isNull(userRouteAssignments.revokedAt)
      ));
  }

  async setDefaultRoute(userId: string, routeId: string): Promise<UserRouteAssignment | undefined> {
    // First, clear all default flags for this user
    await db.update(userRouteAssignments)
      .set({ isDefault: false })
      .where(eq(userRouteAssignments.userId, userId));
    
    // Then set the new default
    const [assignment] = await db.update(userRouteAssignments)
      .set({ isDefault: true })
      .where(and(
        eq(userRouteAssignments.userId, userId),
        eq(userRouteAssignments.routeId, routeId),
        eq(userRouteAssignments.isActive, true)
      ))
      .returning();
    return assignment || undefined;
  }

  async revokeRouteAssignment(assignmentId: string, revokedByUserId: string): Promise<UserRouteAssignment | undefined> {
    const [assignment] = await db.update(userRouteAssignments)
      .set({ 
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: revokedByUserId
      })
      .where(eq(userRouteAssignments.id, assignmentId))
      .returning();
    return assignment || undefined;
  }

  async deleteRouteAssignment(assignmentId: string): Promise<boolean> {
    await db.delete(userRouteAssignments).where(eq(userRouteAssignments.id, assignmentId));
    return true;
  }

  // Organization management
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(insertOrg).returning();
    return org;
  }

  async updateOrganization(id: string, updateOrg: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [org] = await db.update(organizations)
      .set(updateOrg)
      .where(eq(organizations.id, id))
      .returning();
    return org || undefined;
  }

  // Organization settings (backward compatibility)
  async getOrgSettings(id: string): Promise<OrgSettings | undefined> {
    const [settings] = await db.select().from(organizationSettings).where(eq(organizationSettings.id, id));
    return settings || undefined;
  }

  async createOrgSettings(insertSettings: InsertOrgSettings): Promise<OrgSettings> {
    const [settings] = await db.insert(organizationSettings).values(insertSettings).returning();
    return settings;
  }

  async updateOrgSettings(id: string, updateSettings: Partial<InsertOrgSettings>): Promise<OrgSettings | undefined> {
    const [settings] = await db.update(organizationSettings)
      .set(updateSettings)
      .where(eq(organizationSettings.id, id))
      .returning();
    return settings || undefined;
  }

  async getDefaultOrgSettings(): Promise<OrgSettings | undefined> {
    const [settings] = await db.select().from(organizationSettings).limit(1);
    return settings || undefined;
  }

  // Route management
  async getRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route || undefined;
  }

  async getRoutesByOrganization(organizationId: string): Promise<Route[]> {
    return await db.select().from(routes).where(eq(routes.organizationId, organizationId));
  }

  async getAllRoutes(): Promise<Route[]> {
    return await db.select().from(routes);
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const [route] = await db.insert(routes).values(insertRoute).returning();
    return route;
  }

  async updateRoute(id: string, updateRoute: Partial<InsertRoute>): Promise<Route | undefined> {
    const [route] = await db.update(routes)
      .set(updateRoute)
      .where(eq(routes.id, id))
      .returning();
    return route || undefined;
  }

  async deleteRoute(id: string): Promise<boolean> {
    const result = await db.delete(routes).where(eq(routes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async archiveRoute(id: string, archivedByUserId: string): Promise<{ success: boolean; error?: string; affectedRiders?: number; affectedDrivers?: number }> {
    try {
      // Check if route exists and isn't already archived
      const [route] = await db.select().from(routes).where(eq(routes.id, id));
      if (!route) {
        return { success: false, error: "Route not found" };
      }
      if (route.archivedAt) {
        return { success: false, error: "Route is already archived" };
      }

      // Check for active route sessions - block if found
      const activeSessions = await db.select().from(routeSessions)
        .where(and(
          eq(routeSessions.routeId, id),
          sql`${routeSessions.status} IN ('pending', 'active')`
        ));
      
      if (activeSessions.length > 0) {
        return { 
          success: false, 
          error: "Cannot archive route with active trips. Please end all active trips first." 
        };
      }

      // Count affected riders and drivers by joining with users table
      const assignments = await db.select({
        assignmentId: userRouteAssignments.id,
        userId: userRouteAssignments.userId,
        userRole: users.role
      })
        .from(userRouteAssignments)
        .innerJoin(users, eq(users.id, userRouteAssignments.userId))
        .where(and(
          eq(userRouteAssignments.routeId, id),
          eq(userRouteAssignments.isActive, true)
        ));

      const affectedDrivers = assignments.filter(a => a.userRole === 'driver').length;
      const affectedRiders = assignments.filter(a => a.userRole === 'rider').length;

      // Use transaction to ensure all-or-nothing update
      await db.transaction(async (tx) => {
        // 1. Revoke all active route assignments
        await tx.update(userRouteAssignments)
          .set({ 
            isActive: false, 
            revokedAt: new Date(), 
            revokedByUserId: archivedByUserId 
          })
          .where(and(
            eq(userRouteAssignments.routeId, id),
            eq(userRouteAssignments.isActive, true)
          ));

        // 2. Deactivate all rider subscriptions (for QR code/anonymous riders)
        await tx.update(routeSubscriptions)
          .set({ isActive: false })
          .where(eq(routeSubscriptions.routeId, id));

        // 3. Mark all service alerts inactive
        await tx.update(serviceAlerts)
          .set({ isActive: false })
          .where(eq(serviceAlerts.routeId, id));

        // 4. Mark all route stops inactive
        await tx.update(routeStops)
          .set({ isActive: false })
          .where(eq(routeStops.routeId, id));

        // 5. Archive the route
        await tx.update(routes)
          .set({ 
            status: 'inactive',
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: archivedByUserId
          })
          .where(eq(routes.id, id));
      });

      return { 
        success: true, 
        affectedRiders, 
        affectedDrivers 
      };
    } catch (error) {
      console.error("Error archiving route:", error);
      return { 
        success: false, 
        error: "Failed to archive route" 
      };
    }
  }

  // Route stops management
  async getRouteStop(id: string): Promise<RouteStop | undefined> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    return stop || undefined;
  }

  async getRouteStopsByRoute(routeId: string): Promise<RouteStop[]> {
    return await db.select().from(routeStops).where(eq(routeStops.routeId, routeId));
  }

  async createRouteStop(insertStop: InsertRouteStop): Promise<RouteStop> {
    const [stop] = await db.insert(routeStops).values(insertStop).returning();
    return stop;
  }

  async updateRouteStop(id: string, updateStop: Partial<InsertRouteStop>): Promise<RouteStop | undefined> {
    const [stop] = await db.update(routeStops)
      .set(updateStop)
      .where(eq(routeStops.id, id))
      .returning();
    return stop || undefined;
  }

  async deleteRouteStop(id: string): Promise<boolean> {
    const result = await db.delete(routeStops).where(eq(routeStops.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Service alerts (Admin → Riders)
  async createServiceAlert(insertAlert: InsertServiceAlert): Promise<ServiceAlert> {
    const [alert] = await db.insert(serviceAlerts).values(insertAlert).returning();
    return alert;
  }

  async getActiveServiceAlerts(routeId: string): Promise<ServiceAlert[]> {
    const now = new Date();
    return await db.select().from(serviceAlerts)
      .where(
        and(
          eq(serviceAlerts.routeId, routeId),
          eq(serviceAlerts.isActive, true),
          // Active from is in the past (or now)
          sql`${serviceAlerts.activeFrom} <= ${now}`,
          // Active until is null (no expiry) or in the future
          sql`${serviceAlerts.activeUntil} IS NULL OR ${serviceAlerts.activeUntil} > ${now}`
        )
      )
      .orderBy(desc(serviceAlerts.createdAt)); // Newest first
  }

  async deactivateServiceAlert(id: string): Promise<boolean> {
    const result = await db.update(serviceAlerts)
      .set({ isActive: false })
      .where(eq(serviceAlerts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getServiceAlertsByOrganization(organizationId: string): Promise<ServiceAlert[]> {
    const now = new Date();
    return await db.select().from(serviceAlerts)
      .where(
        and(
          eq(serviceAlerts.organizationId, organizationId),
          eq(serviceAlerts.isActive, true),
          // Active from is in the past (or now)
          sql`${serviceAlerts.activeFrom} <= ${now}`,
          // Active until is null (no expiry) or in the future
          sql`${serviceAlerts.activeUntil} IS NULL OR ${serviceAlerts.activeUntil} > ${now}`
        )
      )
      .orderBy(desc(serviceAlerts.createdAt));
  }

  async expireServiceAlert(id: string): Promise<boolean> {
    const now = new Date();
    const result = await db.update(serviceAlerts)
      .set({ isActive: false, activeUntil: now })
      .where(eq(serviceAlerts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Rider messages (Riders → Admin)
  async createRiderMessage(insertMessage: InsertRiderMessage): Promise<RiderMessage> {
    const [message] = await db.insert(riderMessages).values(insertMessage).returning();
    return message;
  }

  async getRiderMessage(id: string): Promise<RiderMessage | undefined> {
    const result = await db.select().from(riderMessages).where(eq(riderMessages.id, id));
    return result[0];
  }

  async getRiderMessagesByRoute(routeId: string): Promise<RiderMessage[]> {
    // Filter out archived messages and sort by: newest date first, critical priority first within same day
    return await db.select().from(riderMessages)
      .where(
        and(
          eq(riderMessages.routeId, routeId),
          eq(riderMessages.isActive, true),
          isNull(riderMessages.archivedAt)
        )
      )
      .orderBy(
        desc(riderMessages.createdAt),
        sql`CASE WHEN ${riderMessages.priority} = 'critical' THEN 1 WHEN ${riderMessages.priority} = 'high' THEN 2 ELSE 3 END`
      );
  }

  async getRiderMessagesByOrganization(organizationId: string): Promise<RiderMessage[]> {
    // Filter out archived messages and sort by: newest date first, critical priority first within same day
    return await db.select().from(riderMessages)
      .where(
        and(
          eq(riderMessages.organizationId, organizationId),
          eq(riderMessages.isActive, true),
          isNull(riderMessages.archivedAt)
        )
      )
      .orderBy(
        desc(riderMessages.createdAt),
        sql`CASE WHEN ${riderMessages.priority} = 'critical' THEN 1 WHEN ${riderMessages.priority} = 'high' THEN 2 ELSE 3 END`
      );
  }

  async updateRiderMessageStatus(id: string, status: string): Promise<RiderMessage | undefined> {
    const [message] = await db.update(riderMessages)
      .set({ status })
      .where(eq(riderMessages.id, id))
      .returning();
    return message || undefined;
  }

  async addAdminResponse(id: string, response: string, respondedByUserId: string): Promise<RiderMessage | undefined> {
    const [message] = await db.update(riderMessages)
      .set({ 
        adminResponse: response,
        respondedByUserId,
        respondedAt: new Date(),
        status: "responded"
      })
      .where(eq(riderMessages.id, id))
      .returning();
    return message || undefined;
  }

  async archiveRiderMessage(id: string, archivedByUserId: string): Promise<RiderMessage | undefined> {
    const [message] = await db.update(riderMessages)
      .set({ 
        archivedAt: new Date(),
        archivedByUserId
      })
      .where(eq(riderMessages.id, id))
      .returning();
    return message || undefined;
  }

  async restoreRiderMessage(id: string): Promise<RiderMessage | undefined> {
    const [message] = await db.update(riderMessages)
      .set({ 
        archivedAt: null,
        archivedByUserId: null
      })
      .where(eq(riderMessages.id, id))
      .returning();
    return message || undefined;
  }

  async deleteRiderMessage(id: string): Promise<boolean> {
    const result = await db.delete(riderMessages).where(eq(riderMessages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateRiderMessagePriority(id: string, priority: string): Promise<RiderMessage | undefined> {
    const [message] = await db.update(riderMessages)
      .set({ priority })
      .where(eq(riderMessages.id, id))
      .returning();
    return message || undefined;
  }

  // Driver messages (Drivers → Admin)
  async createDriverMessage(insertMessage: InsertDriverMessage): Promise<DriverMessage> {
    const [message] = await db.insert(driverMessages).values(insertMessage).returning();
    return message;
  }

  async getDriverMessage(id: string): Promise<DriverMessage | undefined> {
    const result = await db.select().from(driverMessages).where(eq(driverMessages.id, id));
    return result[0];
  }

  async getDriverMessagesByRoute(routeId: string): Promise<DriverMessage[]> {
    // Filter out archived messages and sort by: newest date first, critical priority first within same day
    return await db.select().from(driverMessages)
      .where(
        and(
          eq(driverMessages.routeId, routeId),
          eq(driverMessages.isActive, true),
          isNull(driverMessages.archivedAt)
        )
      )
      .orderBy(
        desc(driverMessages.createdAt),
        sql`CASE WHEN ${driverMessages.priority} = 'critical' THEN 1 WHEN ${driverMessages.priority} = 'high' THEN 2 ELSE 3 END`
      );
  }

  async getDriverMessagesByOrganization(organizationId: string): Promise<DriverMessage[]> {
    // Filter out archived messages and sort by: newest date first, critical priority first within same day
    return await db.select().from(driverMessages)
      .where(
        and(
          eq(driverMessages.organizationId, organizationId),
          eq(driverMessages.isActive, true),
          isNull(driverMessages.archivedAt)
        )
      )
      .orderBy(
        desc(driverMessages.createdAt),
        sql`CASE WHEN ${driverMessages.priority} = 'critical' THEN 1 WHEN ${driverMessages.priority} = 'high' THEN 2 ELSE 3 END`
      );
  }

  async updateDriverMessageStatus(id: string, status: string): Promise<DriverMessage | undefined> {
    const [message] = await db.update(driverMessages)
      .set({ status })
      .where(eq(driverMessages.id, id))
      .returning();
    return message || undefined;
  }

  async respondToDriverMessage(id: string, response: string, respondedByUserId: string): Promise<DriverMessage | undefined> {
    const [message] = await db.update(driverMessages)
      .set({ 
        adminResponse: response,
        respondedByUserId,
        respondedAt: new Date(),
        status: "responded"
      })
      .where(eq(driverMessages.id, id))
      .returning();
    return message || undefined;
  }

  async archiveDriverMessage(id: string, archivedByUserId: string): Promise<DriverMessage | undefined> {
    const [message] = await db.update(driverMessages)
      .set({ 
        archivedAt: new Date(),
        archivedByUserId
      })
      .where(eq(driverMessages.id, id))
      .returning();
    return message || undefined;
  }

  async restoreDriverMessage(id: string): Promise<DriverMessage | undefined> {
    const [message] = await db.update(driverMessages)
      .set({ 
        archivedAt: null,
        archivedByUserId: null
      })
      .where(eq(driverMessages.id, id))
      .returning();
    return message || undefined;
  }

  async deleteDriverMessage(id: string): Promise<boolean> {
    const result = await db.delete(driverMessages).where(eq(driverMessages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateDriverMessagePriority(id: string, priority: string): Promise<DriverMessage | undefined> {
    const [message] = await db.update(driverMessages)
      .set({ priority })
      .where(eq(driverMessages.id, id))
      .returning();
    return message || undefined;
  }

  // Rider profiles management
  async createRiderProfile(profile: InsertRiderProfile): Promise<RiderProfile> {
    const [riderProfile] = await db.insert(riderProfiles).values(profile).returning();
    return riderProfile;
  }

  async getRiderProfileByPhone(phoneNumber: string, organizationId: string): Promise<RiderProfile | undefined> {
    const [profile] = await db.select().from(riderProfiles)
      .where(and(
        eq(riderProfiles.phoneNumber, phoneNumber),
        eq(riderProfiles.organizationId, organizationId)
      ));
    return profile || undefined;
  }

  async getRiderProfile(id: string): Promise<RiderProfile | undefined> {
    const [profile] = await db.select().from(riderProfiles).where(eq(riderProfiles.id, id));
    return profile || undefined;
  }

  async updateRiderProfile(id: string, profile: Partial<InsertRiderProfile>): Promise<RiderProfile | undefined> {
    const [updated] = await db.update(riderProfiles)
      .set(profile)
      .where(eq(riderProfiles.id, id))
      .returning();
    return updated || undefined;
  }

  // Route subscriptions management
  async createRouteSubscription(subscription: InsertRouteSubscription): Promise<RouteSubscription> {
    const [sub] = await db.insert(routeSubscriptions).values(subscription).returning();
    return sub;
  }

  async getSubscriptionsByRiderProfile(riderProfileId: string): Promise<RouteSubscription[]> {
    return db.select().from(routeSubscriptions)
      .where(eq(routeSubscriptions.riderProfileId, riderProfileId));
  }

  async getSubscriptionsByRoute(routeId: string): Promise<RouteSubscription[]> {
    return db.select().from(routeSubscriptions)
      .where(eq(routeSubscriptions.routeId, routeId));
  }

  async updateSubscriptionNotificationMode(subscriptionId: string, notificationMode: 'always' | 'manual'): Promise<RouteSubscription | undefined> {
    const [subscription] = await db.update(routeSubscriptions)
      .set({ notificationMode })
      .where(eq(routeSubscriptions.id, subscriptionId))
      .returning();
    return subscription || undefined;
  }

  // Stop preferences management
  async createStopPreference(preference: InsertStopPreference): Promise<StopPreference> {
    const [pref] = await db.insert(stopPreferences).values(preference).returning();
    return pref;
  }

  async getStopPreferencesBySubscription(subscriptionId: string): Promise<StopPreference[]> {
    return db.select().from(stopPreferences)
      .where(eq(stopPreferences.subscriptionId, subscriptionId));
  }

  // Route sessions management (tracking active routes)
  async createRouteSession(session: InsertRouteSession): Promise<RouteSession> {
    const [sess] = await db.insert(routeSessions).values(session).returning();
    return sess;
  }

  async getActiveRouteSession(routeId: string): Promise<RouteSession | undefined> {
    const [session] = await db.select().from(routeSessions)
      .where(and(
        eq(routeSessions.routeId, routeId),
        eq(routeSessions.status, 'active')
      ));
    return session || undefined;
  }

  async updateRouteSessionStatus(sessionId: string, status: 'pending' | 'active' | 'completed' | 'cancelled'): Promise<RouteSession | undefined> {
    const [session] = await db.update(routeSessions)
      .set({ status })
      .where(eq(routeSessions.id, sessionId))
      .returning();
    return session || undefined;
  }

  async updateRouteSessionCurrentStop(sessionId: string, stopId: string | null): Promise<RouteSession | undefined> {
    const [session] = await db.update(routeSessions)
      .set({ currentStopId: stopId })
      .where(eq(routeSessions.id, sessionId))
      .returning();
    return session || undefined;
  }

  async getRouteSession(sessionId: string): Promise<RouteSession | undefined> {
    const [session] = await db.select().from(routeSessions)
      .where(eq(routeSessions.id, sessionId));
    return session || undefined;
  }

  async updateRouteSessionLocation(sessionId: string, latitude: string, longitude: string): Promise<RouteSession | undefined> {
    const [session] = await db.update(routeSessions)
      .set({ 
        currentLatitude: latitude, 
        currentLongitude: longitude,
        lastLocationUpdate: new Date()
      })
      .where(eq(routeSessions.id, sessionId))
      .returning();
    return session || undefined;
  }

  async startRoute(routeId: string, driverUserId: string): Promise<RouteSession> {
    // Check if there's already an active session for this route
    const existingSession = await this.getActiveRouteSession(routeId);
    if (existingSession) {
      throw new Error('Route already has an active session');
    }

    const [session] = await db.insert(routeSessions).values({
      routeId,
      driverUserId,
      status: 'active',
      startedAt: new Date(),
    }).returning();
    return session;
  }

  async endRoute(sessionId: string): Promise<RouteSession | undefined> {
    const [session] = await db.update(routeSessions)
      .set({ 
        status: 'completed',
        completedAt: new Date()
      })
      .where(eq(routeSessions.id, sessionId))
      .returning();
    return session || undefined;
  }

  async updateDriverLocation(
    sessionId: string, 
    latitude: number, 
    longitude: number
  ): Promise<{ session: RouteSession; stopsToNotify: Array<{ stopId: string; notificationType: 'approaching' | 'arrived' }> }> {
    // Import geofence utilities
    const { isWithinGeofence } = await import('./geofence');
    
    // Update session location
    const session = await this.updateRouteSessionLocation(sessionId, latitude.toString(), longitude.toString());
    if (!session) {
      throw new Error('Session not found');
    }

    // Get all stops for this route, sorted by order
    const allStops = await this.getRouteStopsByRoute(session.routeId);
    const stopsToNotify: Array<{ stopId: string; notificationType: 'approaching' | 'arrived' }> = [];

    // Determine current stop progression to prevent duplicate notifications on backtracking
    let currentStopOrderIndex = 0;
    if (session.currentStopId) {
      const currentStop = allStops.find(s => s.id === session.currentStopId);
      if (currentStop) {
        currentStopOrderIndex = currentStop.orderIndex;
      }
    }

    // Only check stops that are at or after the current stop (upcoming stops)
    const upcomingStops = allStops.filter(stop => stop.orderIndex >= currentStopOrderIndex);

    // Check each upcoming stop for geofence triggers
    for (const stop of upcomingStops) {
      if (!stop.latitude || !stop.longitude) continue;

      const stopLat = parseFloat(stop.latitude);
      const stopLon = parseFloat(stop.longitude);

      // Check if notification was already sent for this stop in this session
      const tracking = await this.getStopNotificationTracking(sessionId, stop.id);

      // Check for arrival notification (smaller radius)
      if (!tracking?.arrivalNotificationSentAt && isWithinGeofence(latitude, longitude, stopLat, stopLon, stop.arrivalRadiusFt)) {
        stopsToNotify.push({ stopId: stop.id, notificationType: 'arrived' });
        
        // Update current stop to mark progression
        const [updatedSession] = await db.update(routeSessions)
          .set({ currentStopId: stop.id })
          .where(eq(routeSessions.id, sessionId))
          .returning();
        
        // Update the session object to reflect the change
        if (updatedSession) {
          Object.assign(session, updatedSession);
        }
      }
      // Check for approaching notification (larger radius)
      else if (!tracking?.approachingNotificationSentAt && isWithinGeofence(latitude, longitude, stopLat, stopLon, stop.approachingRadiusFt)) {
        stopsToNotify.push({ stopId: stop.id, notificationType: 'approaching' });
      }
    }

    return { session, stopsToNotify };
  }

  // Stop notification tracking
  async getStopNotificationTracking(sessionId: string, stopId: string): Promise<StopNotificationTracking | undefined> {
    const [tracking] = await db.select().from(stopNotificationTracking)
      .where(and(
        eq(stopNotificationTracking.sessionId, sessionId),
        eq(stopNotificationTracking.stopId, stopId)
      ));
    return tracking || undefined;
  }

  async markApproachingNotificationSent(sessionId: string, stopId: string): Promise<void> {
    // Check if tracking record exists
    const existing = await this.getStopNotificationTracking(sessionId, stopId);
    
    if (existing) {
      // Update existing record
      await db.update(stopNotificationTracking)
        .set({ approachingNotificationSentAt: new Date() })
        .where(and(
          eq(stopNotificationTracking.sessionId, sessionId),
          eq(stopNotificationTracking.stopId, stopId)
        ));
    } else {
      // Create new record
      await db.insert(stopNotificationTracking).values({
        sessionId,
        stopId,
        approachingNotificationSentAt: new Date(),
      });
    }
  }

  async markArrivalNotificationSent(sessionId: string, stopId: string): Promise<void> {
    // Check if tracking record exists
    const existing = await this.getStopNotificationTracking(sessionId, stopId);
    
    if (existing) {
      // Update existing record
      await db.update(stopNotificationTracking)
        .set({ arrivalNotificationSentAt: new Date() })
        .where(and(
          eq(stopNotificationTracking.sessionId, sessionId),
          eq(stopNotificationTracking.stopId, stopId)
        ));
    } else {
      // Create new record
      await db.insert(stopNotificationTracking).values({
        sessionId,
        stopId,
        arrivalNotificationSentAt: new Date(),
      });
    }
  }

  // Notification log
  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [notification] = await db.insert(notificationLogs).values(log).returning();
    return notification;
  }

  async getNotificationLogs(params: {
    organizationId: string;
    routeId?: string;
    notificationType?: string;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]> {
    const {
      organizationId,
      routeId,
      notificationType,
      startDate,
      endDate,
      searchText,
      limit = 50,
      offset = 0
    } = params;

    let query = db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.organizationId, organizationId));

    // Apply filters
    const conditions = [eq(notificationLogs.organizationId, organizationId)];
    
    if (routeId) {
      conditions.push(eq(notificationLogs.routeId, routeId));
    }
    
    if (notificationType) {
      conditions.push(eq(notificationLogs.notificationType, notificationType));
    }
    
    if (startDate) {
      conditions.push(sql`${notificationLogs.sentAt} >= ${startDate}`);
    }
    
    if (endDate) {
      conditions.push(sql`${notificationLogs.sentAt} <= ${endDate}`);
    }
    
    if (searchText) {
      conditions.push(
        sql`(${notificationLogs.recipientName} ILIKE ${`%${searchText}%`} OR ${notificationLogs.recipientPhone} ILIKE ${`%${searchText}%`} OR ${notificationLogs.message} ILIKE ${`%${searchText}%`})`
      );
    }

    const results = await db
      .select()
      .from(notificationLogs)
      .where(and(...conditions))
      .orderBy(desc(notificationLogs.sentAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async getNotificationLogCount(organizationId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationLogs)
      .where(eq(notificationLogs.organizationId, organizationId));
    
    return result?.count || 0;
  }

  // In-app proximity alerts
  async createProximityAlert(alert: InsertProximityAlert): Promise<ProximityAlert> {
    const [created] = await db.insert(proximityAlerts).values(alert).returning();
    return created;
  }

  async getUnreadProximityAlerts(riderProfileId: string): Promise<ProximityAlert[]> {
    return await db
      .select()
      .from(proximityAlerts)
      .where(and(
        eq(proximityAlerts.riderProfileId, riderProfileId),
        eq(proximityAlerts.isRead, false)
      ))
      .orderBy(desc(proximityAlerts.createdAt));
  }

  async markProximityAlertAsRead(alertId: string): Promise<ProximityAlert | undefined> {
    const [updated] = await db
      .update(proximityAlerts)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(proximityAlerts.id, alertId))
      .returning();
    return updated || undefined;
  }

  async markAllProximityAlertsAsRead(riderProfileId: string): Promise<void> {
    await db
      .update(proximityAlerts)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(proximityAlerts.riderProfileId, riderProfileId),
        eq(proximityAlerts.isRead, false)
      ));
  }

  // Additional route methods
  async getRouteById(id: string): Promise<Route | undefined> {
    return this.getRoute(id);
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    return this.getOrganization(id);
  }

  async getRidersForRoute(routeId: string): Promise<Array<RiderProfile & { subscriptionId: string; notificationMode: string }>> {
    const results = await db.select({
      id: riderProfiles.id,
      phoneNumber: riderProfiles.phoneNumber,
      name: riderProfiles.name,
      organizationId: riderProfiles.organizationId,
      notificationMethod: riderProfiles.notificationMethod,
      email: riderProfiles.email,
      smsConsent: riderProfiles.smsConsent,
      smsConsentDate: riderProfiles.smsConsentDate,
      isActive: riderProfiles.isActive,
      createdAt: riderProfiles.createdAt,
      subscriptionId: routeSubscriptions.id,
      notificationMode: routeSubscriptions.notificationMode
    })
    .from(riderProfiles)
    .innerJoin(routeSubscriptions, eq(riderProfiles.id, routeSubscriptions.riderProfileId))
    .where(eq(routeSubscriptions.routeId, routeId));
    
    return results;
  }

  async getDriversForRoute(routeId: string): Promise<Array<{ id: string; name: string | null; email: string; phoneNumber: string | null; organizationId: string }>> {
    const results = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      organizationId: users.organizationId
    })
    .from(users)
    .innerJoin(userRouteAssignments, eq(users.id, userRouteAssignments.userId))
    .where(and(
      eq(userRouteAssignments.routeId, routeId),
      eq(userRouteAssignments.isActive, true),
      eq(users.isActive, true),
      eq(users.role, 'driver')
    ));
    
    return results;
  }

  async deleteRiderFromRoute(riderProfileId: string, routeId: string): Promise<{ success: boolean; deletedSubscription?: RouteSubscription; riderProfile?: RiderProfile }> {
    try {
      // Get rider profile and subscription details before deletion
      const riderProfile = await this.getRiderProfile(riderProfileId);
      const [subscription] = await db.select()
        .from(routeSubscriptions)
        .where(and(
          eq(routeSubscriptions.riderProfileId, riderProfileId),
          eq(routeSubscriptions.routeId, routeId)
        ))
        .limit(1);

      if (!subscription) {
        return { success: false };
      }

      // Delete stop preferences for this subscription
      await db.delete(stopPreferences)
        .where(eq(stopPreferences.subscriptionId, subscription.id));

      // Delete the route subscription
      await db.delete(routeSubscriptions)
        .where(eq(routeSubscriptions.id, subscription.id));

      // Check if rider has any other subscriptions
      const remainingSubscriptions = await db.select()
        .from(routeSubscriptions)
        .where(eq(routeSubscriptions.riderProfileId, riderProfileId))
        .limit(1);

      // If no other subscriptions, delete the rider profile
      if (remainingSubscriptions.length === 0) {
        await db.delete(riderProfiles)
          .where(eq(riderProfiles.id, riderProfileId));
      }

      return { 
        success: true, 
        deletedSubscription: subscription,
        riderProfile 
      };
    } catch (error) {
      console.error('Error deleting rider from route:', error);
      return { success: false };
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private organizations: Map<string, Organization>;
  private orgSettings: Map<string, OrgSettings>;
  private routes: Map<string, Route>;
  private routeStops: Map<string, RouteStop>;
  private routeSessions: Map<string, RouteSession>;
  private notificationLogs: Map<string, NotificationLog>;
  private stopNotificationTracking: Map<string, StopNotificationTracking>;
  private proximityAlertsStore: Map<string, ProximityAlert>;
  private defaultOrgId: string;
  private defaultOrgSettingsId: string;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.orgSettings = new Map();
    this.routes = new Map();
    this.routeStops = new Map();
    this.routeSessions = new Map();
    this.notificationLogs = new Map();
    this.stopNotificationTracking = new Map();
    this.proximityAlertsStore = new Map();
    
    // Create default organization
    this.defaultOrgId = randomUUID();
    const defaultOrg: Organization = {
      id: this.defaultOrgId,
      name: "Springfield University",
      type: "university",
      logoUrl: null,
      primaryColor: "#0080FF",
      isActive: true,
      createdAt: new Date()
    };
    this.organizations.set(this.defaultOrgId, defaultOrg);
    
    // Create default organization settings (backward compatibility)
    this.defaultOrgSettingsId = randomUUID();
    const defaultSettings: OrgSettings = {
      id: this.defaultOrgSettingsId,
      name: "Springfield University",
      logoUrl: null,
      primaryColor: "#0080FF"
    };
    this.orgSettings.set(this.defaultOrgSettingsId, defaultSettings);
    
    // Create initial system admin user
    const systemAdminId = randomUUID();
    const systemAdmin: User = {
      id: systemAdminId,
      name: "System Administrator",
      email: "admin@busbuddy.system",
      phoneNumber: null,
      role: "system_admin",
      organizationId: null, // System admins don't belong to a specific org
      favoriteRouteId: null,
      defaultRouteId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(systemAdminId, systemAdmin);
    
    // Create initial org admin for default org
    const orgAdminId = randomUUID();
    const orgAdmin: User = {
      id: orgAdminId,
      name: "Sarah Johnson",
      email: "admin@springfield.edu",
      phoneNumber: null,
      role: "org_admin",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
      defaultRouteId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(orgAdminId, orgAdmin);
    
    // Create initial driver user for default org
    const driverId = "dev-driver"; // Use consistent ID for testing
    const driver: User = {
      id: driverId,
      name: "Mike Wilson",
      email: "driver@springfield.edu",
      phoneNumber: null,
      role: "driver",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
      defaultRouteId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(driverId, driver);
    
    // Create initial rider user for default org
    const riderId = "dev-rider"; // Use consistent ID for testing
    const rider: User = {
      id: riderId,
      name: "Emma Davis",
      email: "student@springfield.edu",
      phoneNumber: null,
      role: "rider",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
      defaultRouteId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(riderId, rider);
    
    // Create sample routes for the default organization
    this.createSampleRoutes();
  }

  private createSampleRoutes() {
    // Main Campus Loop
    const route1Id = randomUUID();
    const route1: Route = {
      id: route1Id,
      name: "Main Campus Loop",
      type: "shuttle",
      status: "active",
      vehicleNumber: "SHUTTLE-001",
      organizationId: this.defaultOrgId,
      isActive: true,
      createdAt: new Date()
    };
    this.routes.set(route1Id, route1);
    
    // Add stops for route 1
    const stops1 = [
      { name: "Main Entrance", orderIndex: 1 },
      { name: "Student Center", orderIndex: 2 },
      { name: "Library", orderIndex: 3 },
      { name: "Cafeteria", orderIndex: 4 }
    ];
    
    stops1.forEach(stop => {
      const stopId = randomUUID();
      const routeStop: RouteStop = {
        id: stopId,
        name: stop.name,
        address: null,
        placeId: null,
        routeId: route1Id,
        orderIndex: stop.orderIndex,
        latitude: null,
        longitude: null,
        approachingRadiusFt: 12000, // 12000ft for ~5 min warning at 25 mph
        arrivalRadiusFt: 250, // 250ft for arrival notification
        scheduledArrivalMinutes: null, // Not used for MVP
        isActive: true,
        createdAt: new Date()
      };
      this.routeStops.set(stopId, routeStop);
    });
    
    // West Campus Express
    const route2Id = randomUUID();
    const route2: Route = {
      id: route2Id,
      name: "West Campus Express",
      type: "bus",
      status: "active",
      vehicleNumber: "BUS-105",
      organizationId: this.defaultOrgId,
      isActive: true,
      createdAt: new Date()
    };
    this.routes.set(route2Id, route2);
    
    // Add stops for route 2
    const stops2 = [
      { name: "West Gate", orderIndex: 1 },
      { name: "Engineering Building", orderIndex: 2 },
      { name: "Research Center", orderIndex: 3 },
      { name: "Parking Garage B", orderIndex: 4 },
      { name: "Athletics Complex", orderIndex: 5 }
    ];
    
    stops2.forEach(stop => {
      const stopId = randomUUID();
      const routeStop: RouteStop = {
        id: stopId,
        name: stop.name,
        address: null,
        placeId: null,
        routeId: route2Id,
        orderIndex: stop.orderIndex,
        latitude: null,
        longitude: null,
        approachingRadiusFt: 12000, // 12000ft for ~5 min warning at 25 mph
        arrivalRadiusFt: 250, // 250ft for arrival notification
        scheduledArrivalMinutes: null, // Not used for MVP
        isActive: true,
        createdAt: new Date()
      };
      this.routeStops.set(stopId, routeStop);
    });
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Import password expiration utility
    const { getPasswordExpirationForRole } = await import("./passwordExpiration");
    
    const id = randomUUID();
    const user: User = { 
      id,
      name: insertUser.name,
      email: insertUser.email,
      phoneNumber: insertUser.phoneNumber || null,
      role: insertUser.role,
      organizationId: insertUser.organizationId || null,
      favoriteRouteId: null,
      defaultRouteId: null,
      sessionToken: null,
      sessionExpiresAt: null,
      passwordExpiresAt: insertUser.passwordExpiresAt || getPasswordExpirationForRole(insertUser.role),
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.organizationId === organizationId);
  }

  async setUserFavoriteRoute(userId: string, routeId: string | null): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    
    const updatedUser: User = {
      ...user,
      favoriteRouteId: routeId
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async renewAllRiderPasswords(organizationId: string, newExpiresAt: Date): Promise<number> {
    let renewedCount = 0;
    const users = Array.from(this.users.values());
    
    for (const user of users) {
      if (user.role === 'rider' && user.organizationId === organizationId) {
        const updatedUser: User = {
          ...user,
          passwordExpiresAt: newExpiresAt
        };
        this.users.set(user.id, updatedUser);
        renewedCount++;
      }
    }
    
    return renewedCount;
  }

  // Organization management
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(org => org.isActive);
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const org: Organization = { 
      id,
      name: insertOrg.name,
      type: insertOrg.type,
      logoUrl: insertOrg.logoUrl || null,
      primaryColor: insertOrg.primaryColor || "#0080FF",
      isActive: true,
      createdAt: new Date()
    };
    this.organizations.set(id, org);
    return org;
  }

  async updateOrganization(id: string, updateData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const existing = this.organizations.get(id);
    if (!existing) return undefined;
    
    const updated: Organization = { ...existing, ...updateData };
    this.organizations.set(id, updated);
    return updated;
  }

  async getOrgSettings(id: string): Promise<OrgSettings | undefined> {
    return this.orgSettings.get(id);
  }

  async createOrgSettings(settings: InsertOrgSettings): Promise<OrgSettings> {
    const id = randomUUID();
    const orgSettings: OrgSettings = { 
      id, 
      name: settings.name,
      logoUrl: settings.logoUrl || null,
      primaryColor: settings.primaryColor || "#0080FF"
    };
    this.orgSettings.set(id, orgSettings);
    return orgSettings;
  }

  async updateOrgSettings(id: string, settings: Partial<InsertOrgSettings>): Promise<OrgSettings | undefined> {
    const existing = this.orgSettings.get(id);
    if (!existing) return undefined;
    
    const updated: OrgSettings = { ...existing, ...settings };
    this.orgSettings.set(id, updated);
    return updated;
  }

  async getDefaultOrgSettings(): Promise<OrgSettings | undefined> {
    return this.orgSettings.get(this.defaultOrgSettingsId);
  }
  
  // Route management
  async getRoute(id: string): Promise<Route | undefined> {
    return this.routes.get(id);
  }

  async getRoutesByOrganization(organizationId: string): Promise<Route[]> {
    return Array.from(this.routes.values()).filter(
      route => route.organizationId === organizationId && route.isActive
    );
  }

  async getAllRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values()).filter(route => route.isActive);
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const id = randomUUID();
    const route: Route = {
      id,
      name: insertRoute.name,
      type: insertRoute.type,
      status: insertRoute.status || "active",
      vehicleNumber: insertRoute.vehicleNumber || null,
      organizationId: insertRoute.organizationId,
      isActive: true,
      createdAt: new Date()
    };
    this.routes.set(id, route);
    return route;
  }

  async updateRoute(id: string, updateData: Partial<InsertRoute>): Promise<Route | undefined> {
    const existing = this.routes.get(id);
    if (!existing) return undefined;
    
    const updated: Route = { ...existing, ...updateData };
    this.routes.set(id, updated);
    return updated;
  }

  async deleteRoute(id: string): Promise<boolean> {
    const existing = this.routes.get(id);
    if (!existing) return false;
    
    // Soft delete - mark as inactive
    const updated: Route = { ...existing, isActive: false };
    this.routes.set(id, updated);
    
    // Also soft delete all route stops
    const stops = await this.getRouteStopsByRoute(id);
    for (const stop of stops) {
      await this.deleteRouteStop(stop.id);
    }
    
    return true;
  }

  async archiveRoute(id: string, archivedByUserId: string): Promise<{ success: boolean; error?: string; affectedRiders?: number; affectedDrivers?: number }> {
    const existing = this.routes.get(id);
    if (!existing) {
      return { success: false, error: "Route not found" };
    }
    
    // For MemStorage, just mark as inactive (simplified archival)
    const updated: Route = { ...existing, isActive: false, status: 'inactive' };
    this.routes.set(id, updated);
    
    return { 
      success: true, 
      affectedRiders: 0, 
      affectedDrivers: 0 
    };
  }
  
  // Route stops management
  async getRouteStop(id: string): Promise<RouteStop | undefined> {
    return this.routeStops.get(id);
  }

  async getRouteStopsByRoute(routeId: string): Promise<RouteStop[]> {
    return Array.from(this.routeStops.values())
      .filter(stop => stop.routeId === routeId && stop.isActive)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async createRouteStop(insertStop: InsertRouteStop): Promise<RouteStop> {
    const id = randomUUID();
    const stop: RouteStop = {
      id,
      name: insertStop.name,
      address: insertStop.address || null,
      placeId: insertStop.placeId || null,
      routeId: insertStop.routeId,
      orderIndex: insertStop.orderIndex,
      latitude: insertStop.latitude || null,
      longitude: insertStop.longitude || null,
      approachingRadiusFt: insertStop.approachingRadiusFt || 800,
      arrivalRadiusFt: insertStop.arrivalRadiusFt || 250,
      isActive: true,
      createdAt: new Date()
    };
    this.routeStops.set(id, stop);
    return stop;
  }

  async updateRouteStop(id: string, updateData: Partial<InsertRouteStop>): Promise<RouteStop | undefined> {
    const existing = this.routeStops.get(id);
    if (!existing) return undefined;
    
    const updated: RouteStop = { ...existing, ...updateData };
    this.routeStops.set(id, updated);
    return updated;
  }

  async deleteRouteStop(id: string): Promise<boolean> {
    const existing = this.routeStops.get(id);
    if (!existing) return false;
    
    // Soft delete - mark as inactive
    const updated: RouteStop = { ...existing, isActive: false };
    this.routeStops.set(id, updated);
    return true;
  }

  // Service alerts (Admin → Riders) - Stub implementations for MemStorage
  async createServiceAlert(alert: InsertServiceAlert): Promise<ServiceAlert> {
    throw new Error("Service alerts not implemented in MemStorage");
  }

  async getActiveServiceAlerts(routeId: string): Promise<ServiceAlert[]> {
    return [];
  }

  async deactivateServiceAlert(id: string): Promise<boolean> {
    return false;
  }

  async getServiceAlertsByOrganization(organizationId: string): Promise<ServiceAlert[]> {
    return [];
  }

  async expireServiceAlert(id: string): Promise<boolean> {
    return false;
  }

  // Rider messages (Riders → Admin) - Stub implementations for MemStorage
  async createRiderMessage(message: InsertRiderMessage): Promise<RiderMessage> {
    throw new Error("Rider messages not implemented in MemStorage");
  }

  async getRiderMessage(id: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  async getRiderMessagesByRoute(routeId: string): Promise<RiderMessage[]> {
    return [];
  }

  async getRiderMessagesByOrganization(organizationId: string): Promise<RiderMessage[]> {
    return [];
  }

  async updateRiderMessageStatus(id: string, status: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  async addAdminResponse(id: string, response: string, respondedByUserId: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  async archiveRiderMessage(id: string, archivedByUserId: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  async restoreRiderMessage(id: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  async deleteRiderMessage(id: string): Promise<boolean> {
    return false;
  }

  async updateRiderMessagePriority(id: string, priority: string): Promise<RiderMessage | undefined> {
    return undefined;
  }

  // Driver messages (Drivers → Admin) - Stub implementations for MemStorage
  async createDriverMessage(message: InsertDriverMessage): Promise<DriverMessage> {
    throw new Error("Driver messages not implemented in MemStorage");
  }

  async getDriverMessage(id: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  async getDriverMessagesByRoute(routeId: string): Promise<DriverMessage[]> {
    return [];
  }

  async getDriverMessagesByOrganization(organizationId: string): Promise<DriverMessage[]> {
    return [];
  }

  async updateDriverMessageStatus(id: string, status: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  async respondToDriverMessage(id: string, response: string, respondedByUserId: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  async archiveDriverMessage(id: string, archivedByUserId: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  async restoreDriverMessage(id: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  async deleteDriverMessage(id: string): Promise<boolean> {
    return false;
  }

  async updateDriverMessagePriority(id: string, priority: string): Promise<DriverMessage | undefined> {
    return undefined;
  }

  // Rider profile management - Stub implementations for MemStorage
  async createRiderProfile(profile: InsertRiderProfile): Promise<RiderProfile> {
    throw new Error("Rider profiles not implemented in MemStorage");
  }

  async getRiderProfileByPhone(phoneNumber: string, organizationId: string): Promise<RiderProfile | undefined> {
    return undefined;
  }

  async getRiderProfile(id: string): Promise<RiderProfile | undefined> {
    return undefined;
  }

  async updateRiderProfile(id: string, profile: Partial<InsertRiderProfile>): Promise<RiderProfile | undefined> {
    return undefined;
  }

  async getRidersForRoute(routeId: string): Promise<Array<RiderProfile & { subscriptionId: string; notificationMode: string }>> {
    return [];
  }

  async deleteRiderFromRoute(riderProfileId: string, routeId: string): Promise<{ success: boolean; deletedSubscription?: RouteSubscription; riderProfile?: RiderProfile }> {
    return { success: false };
  }

  async getDriversForRoute(routeId: string): Promise<Array<{ id: string; name: string | null; email: string; phoneNumber: string | null; organizationId: string }>> {
    return [];
  }

  // Route subscription management implementation
  async createRouteSubscription(subscription: InsertRouteSubscription): Promise<RouteSubscription> {
    const [created] = await db.insert(routeSubscriptions).values(subscription).returning();
    return created;
  }

  async getSubscriptionsByRiderProfile(riderProfileId: string): Promise<RouteSubscription[]> {
    return await db.select()
      .from(routeSubscriptions)
      .where(eq(routeSubscriptions.riderProfileId, riderProfileId));
  }

  async getSubscriptionsByRoute(routeId: string): Promise<RouteSubscription[]> {
    return await db.select()
      .from(routeSubscriptions)
      .where(eq(routeSubscriptions.routeId, routeId));
  }

  async updateSubscriptionNotificationMode(subscriptionId: string, notificationMode: 'always' | 'manual'): Promise<RouteSubscription | undefined> {
    const [updated] = await db.update(routeSubscriptions)
      .set({ notificationMode })
      .where(eq(routeSubscriptions.id, subscriptionId))
      .returning();
    return updated;
  }

  // Stop preference management implementation
  async createStopPreference(preference: InsertStopPreference): Promise<StopPreference> {
    const [created] = await db.insert(stopPreferences).values(preference).returning();
    return created;
  }

  async getStopPreferencesBySubscription(subscriptionId: string): Promise<StopPreference[]> {
    return await db.select()
      .from(stopPreferences)
      .where(eq(stopPreferences.subscriptionId, subscriptionId));
  }

  // Route session management implementation
  async createRouteSession(session: InsertRouteSession): Promise<RouteSession> {
    const id = randomUUID();
    const newSession: RouteSession = {
      id,
      ...session,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      currentStopId: null,
      currentLatitude: null,
      currentLongitude: null,
      lastLocationUpdate: null,
      estimatedCompletionTime: session.estimatedCompletionTime ?? null,
      createdAt: new Date(),
    };
    this.routeSessions.set(id, newSession);
    return newSession;
  }

  async getActiveRouteSession(routeId: string): Promise<RouteSession | undefined> {
    return Array.from(this.routeSessions.values()).find(
      s => s.routeId === routeId && s.status === 'active'
    );
  }

  async getRouteSession(sessionId: string): Promise<RouteSession | undefined> {
    return this.routeSessions.get(sessionId);
  }

  async updateRouteSessionStatus(sessionId: string, status: 'pending' | 'active' | 'completed' | 'cancelled'): Promise<RouteSession | undefined> {
    const session = this.routeSessions.get(sessionId);
    if (!session) return undefined;
    
    const updated = {
      ...session,
      status,
      startedAt: status === 'active' && !session.startedAt ? new Date() : session.startedAt,
      completedAt: (status === 'completed' || status === 'cancelled') ? new Date() : session.completedAt,
    };
    this.routeSessions.set(sessionId, updated);
    return updated;
  }

  async updateRouteSessionCurrentStop(sessionId: string, stopId: string | null): Promise<RouteSession | undefined> {
    const session = this.routeSessions.get(sessionId);
    if (!session) return undefined;
    
    const updated = { ...session, currentStopId: stopId };
    this.routeSessions.set(sessionId, updated);
    return updated;
  }

  async updateRouteSessionLocation(sessionId: string, latitude: string, longitude: string): Promise<RouteSession | undefined> {
    const session = this.routeSessions.get(sessionId);
    if (!session) return undefined;
    
    const updated = {
      ...session,
      currentLatitude: latitude,
      currentLongitude: longitude,
      lastLocationUpdate: new Date(),
    };
    this.routeSessions.set(sessionId, updated);
    return updated;
  }

  // Notification logs implementation
  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const id = randomUUID();
    const notification: NotificationLog = {
      id,
      ...log,
      routeId: log.routeId ?? null,
      userId: log.userId ?? null,
      recipientPhone: log.recipientPhone ?? null,
      recipientName: log.recipientName ?? null,
      title: log.title ?? null,
      externalMessageId: log.externalMessageId ?? null,
      errorMessage: log.errorMessage ?? null,
      sentAt: new Date(),
      createdAt: new Date(),
    };
    this.notificationLogs.set(id, notification);
    return notification;
  }

  async getNotificationLogs(params: {
    organizationId: string;
    routeId?: string;
    notificationType?: string;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]> {
    const {
      organizationId,
      routeId,
      notificationType,
      startDate,
      endDate,
      searchText,
      limit = 50,
      offset = 0
    } = params;

    let results = Array.from(this.notificationLogs.values()).filter(
      log => log.organizationId === organizationId
    );

    if (routeId) {
      results = results.filter(log => log.routeId === routeId);
    }

    if (notificationType) {
      results = results.filter(log => log.notificationType === notificationType);
    }

    if (startDate) {
      results = results.filter(log => log.sentAt && log.sentAt >= startDate);
    }

    if (endDate) {
      results = results.filter(log => log.sentAt && log.sentAt <= endDate);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      results = results.filter(log =>
        (log.recipientName?.toLowerCase().includes(search)) ||
        (log.recipientPhone?.toLowerCase().includes(search)) ||
        (log.message?.toLowerCase().includes(search))
      );
    }

    // Sort by sentAt descending
    results.sort((a, b) => {
      const aTime = a.sentAt?.getTime() || 0;
      const bTime = b.sentAt?.getTime() || 0;
      return bTime - aTime;
    });

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  async getNotificationLogCount(organizationId: string): Promise<number> {
    return Array.from(this.notificationLogs.values()).filter(
      log => log.organizationId === organizationId
    ).length;
  }

  // GPS Tracking Methods
  async startRoute(routeId: string, driverUserId: string): Promise<RouteSession> {
    // Check if there's already an active session for this route
    const existingSession = Array.from(this.routeSessions.values()).find(
      session => session.routeId === routeId && session.status === 'active'
    );
    
    if (existingSession) {
      return existingSession;
    }

    // Create new session
    const id = randomUUID();
    const session: RouteSession = {
      id,
      routeId,
      driverUserId,
      status: 'active',
      startedAt: new Date(),
      completedAt: null,
      currentStopId: null,
      currentLatitude: null,
      currentLongitude: null,
      lastLocationUpdate: null,
      estimatedCompletionTime: null,
      createdAt: new Date(),
    };
    this.routeSessions.set(id, session);
    return session;
  }

  async endRoute(sessionId: string): Promise<RouteSession | undefined> {
    const session = this.routeSessions.get(sessionId);
    if (!session) return undefined;

    const updated: RouteSession = {
      ...session,
      status: 'completed',
      completedAt: new Date(),
    };
    this.routeSessions.set(sessionId, updated);
    return updated;
  }

  async updateDriverLocation(
    sessionId: string,
    latitude: number,
    longitude: number
  ): Promise<{ session: RouteSession; stopsToNotify: Array<{ stopId: string; notificationType: 'approaching' | 'arrived' }> }> {
    // Import geofence utilities
    const { isWithinGeofence } = await import('./geofence');

    // Update session location
    const session = await this.updateRouteSessionLocation(sessionId, latitude.toString(), longitude.toString());
    if (!session) {
      throw new Error('Route session not found');
    }

    // Get all stops for this route, sorted by order
    const allStops = Array.from(this.routeStops.values()).filter(stop => stop.routeId === session.routeId && stop.isActive);
    const stopsToNotify: Array<{ stopId: string; notificationType: 'approaching' | 'arrived' }> = [];

    // Determine current stop progression to prevent duplicate notifications on backtracking
    let currentStopOrderIndex = 0;
    if (session.currentStopId) {
      const currentStop = allStops.find(s => s.id === session.currentStopId);
      if (currentStop) {
        currentStopOrderIndex = currentStop.orderIndex;
      }
    }

    // Only check stops that are at or after the current stop (upcoming stops)
    const upcomingStops = allStops.filter(stop => stop.orderIndex >= currentStopOrderIndex);

    for (const stop of upcomingStops) {
      const stopLat = stop.latitude ? parseFloat(stop.latitude) : null;
      const stopLon = stop.longitude ? parseFloat(stop.longitude) : null;

      if (stopLat === null || stopLon === null) continue;

      // Check if notification was already sent for this stop in this session
      const tracking = await this.getStopNotificationTracking(sessionId, stop.id);

      // Check for arrival notification (smaller radius)
      if (!tracking?.arrivalNotificationSentAt && isWithinGeofence(latitude, longitude, stopLat, stopLon, stop.arrivalRadiusFt)) {
        stopsToNotify.push({ stopId: stop.id, notificationType: 'arrived' });
        
        // Update current stop to mark progression
        session.currentStopId = stop.id;
        this.routeSessions.set(sessionId, session);
      }
      // Check for approaching notification (larger radius)
      else if (!tracking?.approachingNotificationSentAt && isWithinGeofence(latitude, longitude, stopLat, stopLon, stop.approachingRadiusFt)) {
        stopsToNotify.push({ stopId: stop.id, notificationType: 'approaching' });
      }
    }

    return { session, stopsToNotify };
  }

  async getStopNotificationTracking(sessionId: string, stopId: string): Promise<StopNotificationTracking | undefined> {
    const key = `${sessionId}-${stopId}`;
    return this.stopNotificationTracking.get(key);
  }

  async markApproachingNotificationSent(sessionId: string, stopId: string): Promise<void> {
    const key = `${sessionId}-${stopId}`;
    const existing = this.stopNotificationTracking.get(key);

    if (existing) {
      this.stopNotificationTracking.set(key, {
        ...existing,
        approachingNotificationSentAt: new Date(),
      });
    } else {
      const tracking: StopNotificationTracking = {
        id: randomUUID(),
        sessionId,
        stopId,
        approachingNotificationSentAt: new Date(),
        arrivalNotificationSentAt: null,
        createdAt: new Date(),
      };
      this.stopNotificationTracking.set(key, tracking);
    }
  }

  async markArrivalNotificationSent(sessionId: string, stopId: string): Promise<void> {
    const key = `${sessionId}-${stopId}`;
    const existing = this.stopNotificationTracking.get(key);

    if (existing) {
      this.stopNotificationTracking.set(key, {
        ...existing,
        arrivalNotificationSentAt: new Date(),
      });
    } else {
      const tracking: StopNotificationTracking = {
        id: randomUUID(),
        sessionId,
        stopId,
        approachingNotificationSentAt: null,
        arrivalNotificationSentAt: new Date(),
        createdAt: new Date(),
      };
      this.stopNotificationTracking.set(key, tracking);
    }
  }

  // In-app proximity alerts
  async createProximityAlert(alert: InsertProximityAlert): Promise<ProximityAlert> {
    const newAlert: ProximityAlert = {
      ...alert,
      id: randomUUID(),
      isRead: alert.isRead ?? false,
      readAt: alert.readAt ?? null,
      createdAt: new Date(),
    };
    this.proximityAlertsStore.set(newAlert.id, newAlert);
    return newAlert;
  }

  async getUnreadProximityAlerts(riderProfileId: string): Promise<ProximityAlert[]> {
    const alerts: ProximityAlert[] = [];
    for (const alert of this.proximityAlertsStore.values()) {
      if (alert.riderProfileId === riderProfileId && !alert.isRead) {
        alerts.push(alert);
      }
    }
    return alerts.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async markProximityAlertAsRead(alertId: string): Promise<ProximityAlert | undefined> {
    const alert = this.proximityAlertsStore.get(alertId);
    if (!alert) return undefined;
    
    const updated: ProximityAlert = {
      ...alert,
      isRead: true,
      readAt: new Date(),
    };
    this.proximityAlertsStore.set(alertId, updated);
    return updated;
  }

  async markAllProximityAlertsAsRead(riderProfileId: string): Promise<void> {
    for (const [id, alert] of this.proximityAlertsStore.entries()) {
      if (alert.riderProfileId === riderProfileId && !alert.isRead) {
        this.proximityAlertsStore.set(id, {
          ...alert,
          isRead: true,
          readAt: new Date(),
        });
      }
    }
  }

  // Additional helper methods
  async getRouteById(id: string): Promise<Route | undefined> {
    return this.getRoute(id);
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    return this.getOrganization(id);
  }
}

// Seed function to populate initial data
async function seedDatabase() {
  try {
    // Check if we already have organizations
    const existingOrgs = await db.select().from(organizations);
    if (existingOrgs.length > 0) {
      return; // Already seeded
    }

    // Create default organization
    const [defaultOrg] = await db.insert(organizations).values({
      name: "Springfield University",
      type: "university",
      logoUrl: null,
      primaryColor: "#0080FF",
      isActive: true,
    }).returning();

    // Create default organization settings (backward compatibility)
    await db.insert(organizationSettings).values({
      name: "Springfield University",
      logoUrl: null,
      primaryColor: "#0080FF",
    });

    // Create initial system admin user
    await db.insert(users).values({
      id: "dev-system-admin",
      name: "System Administrator",
      email: "admin@busbuddy.system",
      role: "system_admin",
      organizationId: null,
      favoriteRouteId: null,
      isActive: true,
    });

    // Create initial org admin
    await db.insert(users).values({
      id: "dev-org-admin",
      name: "Sarah Johnson",
      email: "admin@springfield.edu",
      role: "org_admin",
      organizationId: defaultOrg.id,
      favoriteRouteId: null,
      isActive: true,
    });

    // Create initial driver user
    await db.insert(users).values({
      id: "dev-driver",
      name: "Mike Wilson",
      email: "driver@springfield.edu",
      role: "driver",
      organizationId: defaultOrg.id,
      favoriteRouteId: null,
      isActive: true,
    });

    // Create initial rider user
    await db.insert(users).values({
      id: "dev-rider",
      name: "Emma Davis",
      email: "student@springfield.edu",
      role: "rider",
      organizationId: defaultOrg.id,
      favoriteRouteId: null,
      isActive: true,
    });

    // Create sample routes
    // Main Campus Loop
    const [route1] = await db.insert(routes).values({
      name: "Main Campus Loop",
      type: "shuttle",
      status: "active",
      vehicleNumber: "SHUTTLE-001",
      organizationId: defaultOrg.id,
      isActive: true,
    }).returning();

    // West Campus Express
    const [route2] = await db.insert(routes).values({
      name: "West Campus Express",
      type: "bus",
      status: "active",
      vehicleNumber: "BUS-105",
      organizationId: defaultOrg.id,
      isActive: true,
    }).returning();

    // Add stops for route 1
    const stops1 = [
      { name: "Main Entrance", orderIndex: 1 },
      { name: "Student Center", orderIndex: 2 },
      { name: "Library", orderIndex: 3 },
      { name: "Cafeteria", orderIndex: 4 }
    ];

    for (const stop of stops1) {
      await db.insert(routeStops).values({
        name: stop.name,
        address: null,
        placeId: null,
        routeId: route1.id,
        orderIndex: stop.orderIndex,
        latitude: null,
        longitude: null,
        approachingRadiusFt: 800,
        arrivalRadiusFt: 250,
        isActive: true,
      });
    }

    // Add stops for route 2
    const stops2 = [
      { name: "West Gate", orderIndex: 1 },
      { name: "Engineering Building", orderIndex: 2 },
      { name: "Research Center", orderIndex: 3 },
      { name: "Parking Garage B", orderIndex: 4 },
      { name: "Athletics Complex", orderIndex: 5 }
    ];

    for (const stop of stops2) {
      await db.insert(routeStops).values({
        name: stop.name,
        address: null,
        placeId: null,
        routeId: route2.id,
        orderIndex: stop.orderIndex,
        latitude: null,
        longitude: null,
        approachingRadiusFt: 800,
        arrivalRadiusFt: 250,
        isActive: true,
      });
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

export const storage = new DatabaseStorage();

// Seed the database on startup
seedDatabase();
