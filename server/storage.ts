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
  users,
  organizations,
  organizationSettings,
  routes,
  routeStops
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private organizations: Map<string, Organization>;
  private orgSettings: Map<string, OrgSettings>;
  private routes: Map<string, Route>;
  private routeStops: Map<string, RouteStop>;
  private defaultOrgId: string;
  private defaultOrgSettingsId: string;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.orgSettings = new Map();
    this.routes = new Map();
    this.routeStops = new Map();
    
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
        approachingRadiusM: 250, // Default 250m for approaching notification
        arrivalRadiusM: 75, // Default 75m for arrival notification
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
        approachingRadiusM: 250, // Default 250m for approaching notification
        arrivalRadiusM: 75, // Default 75m for arrival notification
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
      approachingRadiusM: insertStop.approachingRadiusM || 250,
      arrivalRadiusM: insertStop.arrivalRadiusM || 75,
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
        approachingRadiusM: 250,
        arrivalRadiusM: 75,
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
        approachingRadiusM: 250,
        arrivalRadiusM: 75,
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
