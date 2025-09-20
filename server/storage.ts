import { 
  type User, 
  type InsertUser, 
  type Organization, 
  type InsertOrganization,
  type OrgSettings, 
  type InsertOrgSettings,
  type UserRole 
} from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private organizations: Map<string, Organization>;
  private orgSettings: Map<string, OrgSettings>;
  private defaultOrgId: string;
  private defaultOrgSettingsId: string;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.orgSettings = new Map();
    
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
      isActive: true,
      createdAt: new Date()
    };
    this.users.set(orgAdminId, orgAdmin);
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
}

export const storage = new MemStorage();
