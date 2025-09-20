import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrgSettingsSchema } from "@shared/schema";

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

  const httpServer = createServer(app);

  return httpServer;
}
