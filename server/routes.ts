import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOrgSettingsSchema, 
  insertOrganizationSchema, 
  insertUserSchema,
  insertRouteSchema,
  insertRouteStopSchema,
  roleEnum,
  orgTypeEnum 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Organization Settings Routes
  app.get("/api/org-settings", async (req, res) => {
    try {
      const settings = await storage.getDefaultOrgSettings();
      if (!settings) {
        return res.status(404).json({ error: "Organization settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching org settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/org-settings", async (req, res) => {
    try {
      const validatedData = insertOrgSettingsSchema.parse(req.body);
      const defaultSettings = await storage.getDefaultOrgSettings();
      
      if (!defaultSettings) {
        return res.status(404).json({ error: "Organization settings not found" });
      }

      const updated = await storage.updateOrgSettings(defaultSettings.id, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Failed to update settings" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating org settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // System Admin - Organization Management Routes
  app.get("/api/system/organizations", async (req, res) => {
    try {
      const organizations = await storage.getAllOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/system/organizations", async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid organization data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/system/organizations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertOrganizationSchema.partial().parse(req.body);
      const updated = await storage.updateOrganization(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating organization:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid organization data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management Routes
  app.get("/api/users", async (req, res) => {
    try {
      const { role, organizationId } = req.query;
      
      let users;
      if (role && typeof role === "string") {
        const validatedRole = roleEnum.parse(role);
        users = await storage.getUsersByRole(validatedRole);
      } else if (organizationId && typeof organizationId === "string") {
        users = await storage.getUsersByOrganization(organizationId);
      } else {
        // For system admins - return all users
        const systemAdmins = await storage.getUsersByRole("system_admin");
        const orgAdmins = await storage.getUsersByRole("org_admin");
        const drivers = await storage.getUsersByRole("driver");
        const riders = await storage.getUsersByRole("rider");
        users = [...systemAdmins, ...orgAdmins, ...drivers, ...riders];
      }
      
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Management Routes
  app.get("/api/routes", async (req, res) => {
    try {
      const { organizationId } = req.query;
      
      let routes;
      if (organizationId && typeof organizationId === "string") {
        // Organization-specific routes (for org admins)
        routes = await storage.getRoutesByOrganization(organizationId);
      } else {
        // All routes (for system admins)
        routes = await storage.getAllRoutes();
      }
      
      // Get route stops for each route
      const routesWithStops = await Promise.all(routes.map(async (route) => {
        const stops = await storage.getRouteStopsByRoute(route.id);
        return { ...route, stops };
      }));
      
      res.json(routesWithStops);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/routes", async (req, res) => {
    try {
      const validatedData = insertRouteSchema.parse(req.body);
      const route = await storage.createRoute(validatedData);
      res.status(201).json(route);
    } catch (error) {
      console.error("Error creating route:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid route data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/routes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const route = await storage.getRoute(id);
      
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      const stops = await storage.getRouteStopsByRoute(id);
      res.json({ ...route, stops });
    } catch (error) {
      console.error("Error fetching route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/routes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRouteSchema.partial().parse(req.body);
      const updated = await storage.updateRoute(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      const stops = await storage.getRouteStopsByRoute(id);
      res.json({ ...updated, stops });
    } catch (error) {
      console.error("Error updating route:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid route data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/routes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteRoute(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Stops Management Routes
  app.get("/api/routes/:routeId/stops", async (req, res) => {
    try {
      const { routeId } = req.params;
      const stops = await storage.getRouteStopsByRoute(routeId);
      res.json(stops);
    } catch (error) {
      console.error("Error fetching route stops:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/routes/:routeId/stops", async (req, res) => {
    try {
      const { routeId } = req.params;
      const validatedData = insertRouteStopSchema.parse({ ...req.body, routeId });
      const stop = await storage.createRouteStop(validatedData);
      res.status(201).json(stop);
    } catch (error) {
      console.error("Error creating route stop:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid route stop data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/stops/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertRouteStopSchema.partial().parse(req.body);
      const updated = await storage.updateRouteStop(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Route stop not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating route stop:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid route stop data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/stops/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteRouteStop(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Route stop not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route stop:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Development Toggle Route (for switching between user perspectives)
  app.get("/api/dev/mock-user/:role", async (req, res) => {
    try {
      const { role } = req.params;
      const validatedRole = roleEnum.parse(role);
      
      // Return mock user data for each role for development purposes
      const mockUsers = {
        system_admin: {
          id: "dev-system-admin",
          name: "System Administrator",
          email: "admin@busbuddy.system",
          role: "system_admin",
          organizationId: null,
          isActive: true,
          createdAt: new Date()
        },
        org_admin: {
          id: "dev-org-admin", 
          name: "Sarah Johnson",
          email: "admin@springfield.edu",
          role: "org_admin",
          organizationId: "dev-org-1",
          isActive: true,
          createdAt: new Date()
        },
        driver: {
          id: "dev-driver",
          name: "Mike Wilson",
          email: "driver@springfield.edu", 
          role: "driver",
          organizationId: "dev-org-1",
          isActive: true,
          createdAt: new Date()
        },
        rider: {
          id: "dev-rider",
          name: "Emma Davis",
          email: "student@springfield.edu",
          role: "rider", 
          organizationId: "dev-org-1",
          isActive: true,
          createdAt: new Date()
        }
      };
      
      res.json(mockUsers[validatedRole]);
    } catch (error) {
      console.error("Error getting mock user:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid role" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
