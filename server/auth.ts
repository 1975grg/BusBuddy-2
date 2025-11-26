import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User, UserRole } from "@shared/schema";

// Session duration: 90 days in milliseconds
export const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

// Generate a random session token
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Generate a random invite token
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

// Calculate session expiration date
export function getSessionExpirationDate(): Date {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

// Extend user type to include route assignments
export interface AuthUser extends User {
  routeAssignments?: Array<{
    id: string;
    routeId: string;
    isDefault: boolean;
  }>;
}

// Express middleware to authenticate requests
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check for session token in cookie or header
    const cookieToken = req.cookies?.sessionToken;
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const token = cookieToken || headerToken;

    // Debug logging for authentication troubleshooting
    console.log(`[AUTH] ${req.method} ${req.path} - cookie: ${cookieToken ? 'YES' : 'NO'}, header: ${headerToken ? 'YES' : 'NO'}`);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user by session token
    const user = await storage.getUserBySessionToken(token);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Check password expiration for riders
    if (user.role === 'rider' && user.passwordExpiresAt) {
      const { isPasswordExpired } = await import("./passwordExpiration");
      if (isPasswordExpired(user.passwordExpiresAt)) {
        // Clear the session since password has expired
        await storage.clearUserSession(user.id);
        return res.status(401).json({ 
          error: "Password expired", 
          code: "PASSWORD_EXPIRED",
          message: "Your access has expired. Please request a new access code from your administrator."
        });
      }
    }

    // Get user's route assignments
    const routeAssignments = await storage.getUserRouteAssignments(user.id);

    // Attach user to request
    (req as any).user = {
      ...user,
      routeAssignments: routeAssignments.map((a) => ({
        id: a.id,
        routeId: a.routeId,
        isDefault: a.isDefault,
      })),
    } as AuthUser;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Middleware to require specific role
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      return res
        .status(403)
        .json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// Middleware to require access to specific organization
export function requireOrganization(organizationId?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // System admins can access all organizations
    if (user.role === "system_admin") {
      return next();
    }

    // Get organization ID from parameter or request
    const reqOrgId = organizationId || req.params.organizationId || req.query.organization_id;

    if (!reqOrgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    // Check if user belongs to this organization
    if (user.organizationId !== reqOrgId) {
      return res.status(403).json({ error: "Access to this organization denied" });
    }

    next();
  };
}

// Middleware to require access to specific route
export function requireRouteAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // System admins can access all routes
    if (user.role === "system_admin") {
      return next();
    }

    const routeId = req.params.routeId || req.query.route_id;

    if (!routeId) {
      return res.status(400).json({ error: "Route ID required" });
    }

    // Org admins can access all routes in their organization
    if (user.role === "org_admin") {
      const route = await storage.getRoute(routeId as string);
      if (route && route.organizationId === user.organizationId) {
        return next();
      }
    }

    // Drivers and riders need explicit route assignments
    if (user.role === "driver" || user.role === "rider") {
      const hasAccess = user.routeAssignments?.some(
        (a) => a.routeId === routeId
      );

      if (hasAccess) {
        return next();
      }
    }

    return res.status(403).json({ error: "Access to this route denied" });
  };
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies?.sessionToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      const user = await storage.getUserBySessionToken(token);
      if (user && user.isActive) {
        const routeAssignments = await storage.getUserRouteAssignments(user.id);
        (req as any).user = {
          ...user,
          routeAssignments: routeAssignments.map((a) => ({
            id: a.id,
            routeId: a.routeId,
            isDefault: a.isDefault,
          })),
        } as AuthUser;
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    next();
  }
}
