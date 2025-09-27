import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { 
  insertOrgSettingsSchema, 
  insertOrganizationSchema, 
  insertUserSchema,
  insertRouteSchema,
  insertRouteStopSchema,
  insertServiceAlertSchema,
  insertRiderMessageSchema,
  insertRiderProfileSchema,
  insertRouteSubscriptionSchema,
  insertStopPreferenceSchema,
  insertRouteSessionSchema,
  roleEnum,
  orgTypeEnum,
  alertTypeEnum,
  alertSeverityEnum,
  messageTypeEnum,
  notificationMethodEnum,
  notificationModeEnum
} from "@shared/schema";
import { qrService } from "./qr";
import { smsService } from "./sms";

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

  // QR Code Generation for Routes
  app.get("/api/routes/:id/qr", async (req, res) => {
    try {
      const { id } = req.params;
      const route = await storage.getRouteById(id);
      
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }

      // Get organization for the route
      const organization = await storage.getOrganizationById(route.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const qrData = await qrService.generatePrintableQrCode(route, route.organizationId, organization.name);
      res.json(qrData);
    } catch (error) {
      console.error("Error generating QR code:", error);
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

  // Delete all stops for a route
  app.delete("/api/routes/:id/stops", async (req, res) => {
    try {
      const { id } = req.params;
      
      // First check if route exists
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Delete all stops for this route
      const stops = await storage.getRouteStopsByRoute(id);
      for (const stop of stops) {
        if (stop.id) {
          await storage.deleteRouteStop(stop.id);
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route stops:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Development Toggle Route (for switching between user perspectives)
  app.get("/api/dev/mock-user/:role", async (req, res) => {
    try {
      const { role } = req.params;
      const validatedRole = roleEnum.parse(role);
      
      // Map roles to actual user IDs in storage
      const userIds = {
        system_admin: "dev-system-admin", // This one might not exist in storage
        org_admin: "dev-org-admin", // This one might not exist in storage
        driver: "dev-driver", // This one exists in storage
        rider: "dev-rider" // This one exists in storage
      };
      
      const userId = userIds[validatedRole];
      
      // Try to get the real user from storage first
      const realUser = await storage.getUser(userId);
      if (realUser) {
        return res.json(realUser);
      }
      
      // Fallback to mock data for users not in storage (system_admin, org_admin)
      const mockUsers = {
        system_admin: {
          id: "dev-system-admin",
          name: "System Administrator",
          email: "admin@busbuddy.system",
          role: "system_admin",
          organizationId: null,
          favoriteRouteId: null,
          isActive: true,
          createdAt: new Date()
        },
        org_admin: {
          id: "dev-org-admin", 
          name: "Sarah Johnson",
          email: "admin@springfield.edu",
          role: "org_admin",
          organizationId: (await storage.getAllOrganizations())[0]?.id || null,
          favoriteRouteId: null,
          isActive: true,
          createdAt: new Date()
        }
      };
      
      // Return mock data for roles that don't exist in storage
      if (mockUsers[validatedRole]) {
        return res.json(mockUsers[validatedRole]);
      }
      
      res.status(404).json({ error: "User not found" });
    } catch (error) {
      console.error("Error getting mock user:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid role" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Favorite Route Management
  app.patch("/api/users/:id/favorite-route", async (req, res) => {
    try {
      const { id: userId } = req.params;
      const { routeId } = req.body;
      
      // Validate request body
      const favoriteRouteSchema = z.object({
        routeId: z.string().nullable()
      });
      
      const validatedData = favoriteRouteSchema.parse(req.body);
      
      // Get the user first
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If setting a favorite route, validate it exists and belongs to user's org
      if (validatedData.routeId) {
        const route = await storage.getRoute(validatedData.routeId);
        if (!route) {
          return res.status(404).json({ error: "Route not found" });
        }
        
        // Check if route belongs to user's organization
        if (route.organizationId !== user.organizationId) {
          return res.status(403).json({ error: "Route does not belong to your organization" });
        }
        
        // Check if route is active
        if (!route.isActive || route.status !== "active") {
          return res.status(400).json({ error: "Cannot set favorite to inactive route" });
        }
      }
      
      // Update user's favorite route
      const updatedUser = await storage.setUserFavoriteRoute(userId, validatedData.routeId);
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update favorite route" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating favorite route:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Geocoding Routes for Address Autocomplete
  app.get("/api/geocode/search", async (req, res) => {
    try {
      const { q: query, limit = 5 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        return res.status(500).json({ error: "Mapbox token not configured" });
      }

      const searchUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=${limit}&types=address,poi`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform Mapbox response to our format
      const suggestions = data.features.map((feature: any) => ({
        id: feature.id,
        place_name: feature.place_name,
        text: feature.text,
        center: feature.center, // [longitude, latitude]
        properties: feature.properties
      }));
      
      res.json({ suggestions });
    } catch (error) {
      console.error("Error in geocode search:", error);
      res.status(500).json({ error: "Geocoding search failed" });
    }
  });

  app.get("/api/geocode/details", async (req, res) => {
    try {
      const { place_id } = req.query;
      
      if (!place_id || typeof place_id !== 'string') {
        return res.status(400).json({ error: "place_id parameter is required" });
      }

      const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        return res.status(500).json({ error: "Mapbox token not configured" });
      }

      const detailsUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place_id)}.json?access_token=${mapboxToken}`;
      
      const response = await fetch(detailsUrl);
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return res.status(404).json({ error: "Place not found" });
      }
      
      const feature = data.features[0];
      const result = {
        id: feature.id,
        place_name: feature.place_name,
        text: feature.text,
        center: feature.center, // [longitude, latitude]
        properties: feature.properties,
        address_components: feature.context || []
      };
      
      res.json(result);
    } catch (error) {
      console.error("Error in geocode details:", error);
      res.status(500).json({ error: "Geocoding details failed" });
    }
  });

  // Service Alerts (Admin → Riders)
  app.post("/api/service-alerts", async (req, res) => {
    try {
      // Validate client data (without server-controlled fields)
      const clientSchema = insertServiceAlertSchema.omit({ 
        createdByUserId: true, 
        organizationId: true 
      });
      const clientData = clientSchema.parse(req.body);
      
      // Verify route exists and get organization
      const route = await storage.getRoute(clientData.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // TODO: In a real app, get user ID from authenticated session
      // For now, find an admin user for this organization
      const adminUsers = await storage.getUsersByOrganization(route.organizationId);
      const adminUser = adminUsers.find(u => u.role === "org_admin");
      
      if (!adminUser) {
        return res.status(500).json({ error: "No admin user found for organization" });
      }
      
      // Build complete alert data with server-controlled fields
      const alertData = {
        ...clientData,
        organizationId: route.organizationId,
        createdByUserId: adminUser.id
      };
      
      const alert = await storage.createServiceAlert(alertData);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating service alert:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid alert data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/service-alerts", async (req, res) => {
    try {
      const { route_id } = req.query;
      
      if (!route_id || typeof route_id !== 'string') {
        return res.status(400).json({ error: "route_id parameter is required" });
      }
      
      let actualRouteId = route_id;
      
      // If route_id doesn't look like a UUID, try to find the route by name
      if (!route_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const routes = await storage.getAllRoutes(); // Search all routes instead of by org
        const matchedRoute = routes.find(route => 
          route.name.toLowerCase().replace(/\s+/g, '-') === route_id.toLowerCase() ||
          route.name === route_id
        );
        
        if (matchedRoute) {
          actualRouteId = matchedRoute.id;
        } else {
          return res.status(404).json({ error: "Route not found" });
        }
      }
      
      const alerts = await storage.getActiveServiceAlerts(actualRouteId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching service alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/service-alerts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deactivateServiceAlert(id);
      
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating service alert:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rider Messages (Riders → Admin)
  app.post("/api/rider-messages", async (req, res) => {
    try {
      // Validate client data (without server-controlled fields)
      const clientSchema = insertRiderMessageSchema.omit({ 
        userId: true, 
        organizationId: true 
      });
      const clientData = clientSchema.parse(req.body);
      
      // Verify route exists and get organization
      let actualRouteId = clientData.routeId;
      
      // If route_id doesn't look like a UUID, try to find the route by name
      if (!clientData.routeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const routes = await storage.getAllRoutes(); // Search all routes instead of by org
        const matchedRoute = routes.find(route => 
          route.name.toLowerCase().replace(/\s+/g, '-') === clientData.routeId.toLowerCase() ||
          route.name === clientData.routeId
        );
        
        if (matchedRoute) {
          actualRouteId = matchedRoute.id;
        } else {
          return res.status(404).json({ error: "Route not found" });
        }
      }
      
      const route = await storage.getRoute(actualRouteId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Build complete message data with server-controlled fields
      // TODO: In a real app, get user ID from authenticated session (if logged in)
      // For anonymous riders, userId can be null
      const messageData = {
        ...clientData,
        routeId: actualRouteId, // Use resolved route ID
        organizationId: route.organizationId,
        userId: null // Anonymous rider message
      };
      
      const message = await storage.createRiderMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating rider message:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/rider-messages", async (req, res) => {
    try {
      const { route_id, organization_id } = req.query;
      
      let messages = [];
      if (route_id && typeof route_id === 'string') {
        messages = await storage.getRiderMessagesByRoute(route_id);
      } else if (organization_id && typeof organization_id === 'string') {
        messages = await storage.getRiderMessagesByOrganization(organization_id);
      } else {
        return res.status(400).json({ error: "route_id or organization_id parameter is required" });
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching rider messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "status is required" });
      }
      
      const message = await storage.updateRiderMessageStatus(id, status);
      
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/respond", async (req, res) => {
    try {
      const { id } = req.params;
      const { response, responded_by_user_id } = req.body;
      
      if (!response || !responded_by_user_id) {
        return res.status(400).json({ error: "response and responded_by_user_id are required" });
      }
      
      const message = await storage.addAdminResponse(id, response, responded_by_user_id);
      
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error adding admin response:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rider Profile Management Routes
  app.post("/api/rider-profiles", async (req, res) => {
    try {
      const validatedData = insertRiderProfileSchema.parse(req.body);
      
      // Check if rider already exists with this phone number in this organization
      const existingRider = await storage.getRiderProfileByPhone(
        validatedData.phoneNumber, 
        validatedData.organizationId
      );
      
      if (existingRider) {
        return res.json(existingRider); // Return existing profile
      }
      
      const riderProfile = await storage.createRiderProfile(validatedData);
      res.status(201).json(riderProfile);
    } catch (error) {
      console.error("Error creating rider profile:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid rider profile data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Subscription Management Routes  
  app.post("/api/route-subscriptions", async (req, res) => {
    try {
      const validatedData = insertRouteSubscriptionSchema.parse(req.body);
      const subscription = await storage.createRouteSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating route subscription:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid subscription data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stop Preference Management Routes
  app.post("/api/stop-preferences", async (req, res) => {
    try {
      const validatedData = insertStopPreferenceSchema.parse(req.body);
      const preference = await storage.createStopPreference(validatedData);
      res.status(201).json(preference);
    } catch (error) {
      console.error("Error creating stop preference:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid stop preference data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
