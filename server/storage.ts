import { type User, type InsertUser, type OrgSettings, type InsertOrgSettings } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getOrgSettings(id: string): Promise<OrgSettings | undefined>;
  createOrgSettings(settings: InsertOrgSettings): Promise<OrgSettings>;
  updateOrgSettings(id: string, settings: Partial<InsertOrgSettings>): Promise<OrgSettings | undefined>;
  getDefaultOrgSettings(): Promise<OrgSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private orgSettings: Map<string, OrgSettings>;
  private defaultOrgId: string;

  constructor() {
    this.users = new Map();
    this.orgSettings = new Map();
    
    // Create default organization settings
    this.defaultOrgId = randomUUID();
    const defaultSettings: OrgSettings = {
      id: this.defaultOrgId,
      name: "Springfield University",
      logoUrl: null,
      primaryColor: "#0080FF"
    };
    this.orgSettings.set(this.defaultOrgId, defaultSettings);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
    return this.orgSettings.get(this.defaultOrgId);
  }
}

export const storage = new MemStorage();
