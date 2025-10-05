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
  type NotificationLog,
  type InsertNotificationLog,
  users,
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
  notificationLog
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
  createUser(user: InsertUser): Promise<User>;
  getUsersByRole(role: UserRole): Promise<User[]>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  setUserFavoriteRoute(userId: string, routeId: string | null): Promise<User | undefined>;
  
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
  
  // Route stops management
  getRouteStop(id: string): Promise<RouteStop | undefined>;
  getRouteStopsByRoute(routeId: string): Promise<RouteStop[]>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;
  updateRouteStop(id: string, stop: Partial<InsertRouteStop>): Promise<RouteStop | undefined>;
  deleteRouteStop(id: string): Promise<boolean>;
  
  // Service alerts (Admin → Riders)
  createServiceAlert(alert: InsertServiceAlert): Promise<ServiceAlert>;
  getActiveServiceAlerts(routeId: string): Promise<ServiceAlert[]>;
  deactivateServiceAlert(id: string): Promise<boolean>;
  
  // Rider messages (Riders → Admin)  
  createRiderMessage(message: InsertRiderMessage): Promise<RiderMessage>;
  getRiderMessagesByRoute(routeId: string): Promise<RiderMessage[]>;
  archiveRiderMessage(id: string, archivedByUserId: string): Promise<RiderMessage | undefined>;
  restoreRiderMessage(id: string): Promise<RiderMessage | undefined>;
  deleteRiderMessage(id: string): Promise<boolean>;
  updateRiderMessagePriority(id: string, priority: string): Promise<RiderMessage | undefined>;
  
  // Driver messages (Drivers → Admin)
  createDriverMessage(message: InsertDriverMessage): Promise<DriverMessage>;
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
  
  // Notification log
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  
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
    const [user] = await db.insert(users).values(insertUser).returning();
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
      );
  }

  async deactivateServiceAlert(id: string): Promise<boolean> {
    const result = await db.update(serviceAlerts)
      .set({ isActive: false })
      .where(eq(serviceAlerts.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Rider messages (Riders → Admin)
  async createRiderMessage(insertMessage: InsertRiderMessage): Promise<RiderMessage> {
    const [message] = await db.insert(riderMessages).values(insertMessage).returning();
    return message;
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

  async getDriverMessagesByRoute(routeId: string): Promise<DriverMessage[]> {
    return await db.select().from(driverMessages)
      .where(
        and(
          eq(driverMessages.routeId, routeId),
          eq(driverMessages.isActive, true)
        )
      );
  }

  async getDriverMessagesByOrganization(organizationId: string): Promise<DriverMessage[]> {
    return await db.select().from(driverMessages)
      .where(
        and(
          eq(driverMessages.organizationId, organizationId),
          eq(driverMessages.isActive, true)
        )
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

  // Notification log
  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [notification] = await db.insert(notificationLog).values(log).returning();
    return notification;
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
  private defaultOrgId: string;
  private defaultOrgSettingsId: string;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.orgSettings = new Map();
    this.routes = new Map();
    this.routeStops = new Map();
    this.routeSessions = new Map();
    
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
      role: "system_admin",
      organizationId: null, // System admins don't belong to a specific org
      favoriteRouteId: null,
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
      role: "org_admin",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
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
      role: "driver",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
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
      role: "rider",
      organizationId: this.defaultOrgId,
      favoriteRouteId: null,
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
        approachingRadiusFt: 800, // Default 800ft for approaching notification
        arrivalRadiusFt: 250, // Default 250ft for arrival notification
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
        approachingRadiusFt: 800, // Default 800ft for approaching notification
        arrivalRadiusFt: 250, // Default 250ft for arrival notification
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
    const id = randomUUID();
    const user: User = { 
      id,
      name: insertUser.name,
      email: insertUser.email,
      role: insertUser.role,
      organizationId: insertUser.organizationId || null,
      favoriteRouteId: null,
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

  // Rider messages (Riders → Admin) - Stub implementations for MemStorage
  async createRiderMessage(message: InsertRiderMessage): Promise<RiderMessage> {
    throw new Error("Rider messages not implemented in MemStorage");
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

  // Driver messages (Drivers → Admin) - Stub implementations for MemStorage
  async createDriverMessage(message: InsertDriverMessage): Promise<DriverMessage> {
    throw new Error("Driver messages not implemented in MemStorage");
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

  // Rider profile management - Stub implementations for MemStorage
  async createRiderProfile(profile: InsertRiderProfile): Promise<RiderProfile> {
    throw new Error("Rider profiles not implemented in MemStorage");
  }

  async getRiderProfileByPhone(phoneNumber: string, organizationId: string): Promise<RiderProfile | undefined> {
    throw new Error("Rider profiles not implemented in MemStorage");
  }

  async getRiderProfile(id: string): Promise<RiderProfile | undefined> {
    throw new Error("Rider profiles not implemented in MemStorage");
  }

  async updateRiderProfile(id: string, profile: Partial<InsertRiderProfile>): Promise<RiderProfile | undefined> {
    throw new Error("Rider profiles not implemented in MemStorage");
  }

  async getRidersForRoute(routeId: string): Promise<Array<RiderProfile & { subscriptionId: string; notificationMode: string }>> {
    return [];
  }

  async deleteRiderFromRoute(riderProfileId: string, routeId: string): Promise<{ success: boolean; deletedSubscription?: RouteSubscription; riderProfile?: RiderProfile }> {
    return { success: false };
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

  // Notification log implementation
  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const id = randomUUID();
    const notification: NotificationLog = {
      id,
      ...log,
      riderProfileId: log.riderProfileId ?? null,
      routeSessionId: log.routeSessionId ?? null,
      status: 'pending',
      externalId: null,
      sentAt: null,
      createdAt: new Date(),
    };
    return notification;
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
