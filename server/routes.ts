import type { Express } from "express";
import { createServer, type Server } from "http";
import { z, ZodError } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { sendMagicLinkEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./email";
import { sendProximityAlertPush, sendServiceAlertPush, sendPushToUser, sendAdminMessagePush, isFirebaseReady } from "./firebase-push";
import { 
  insertOrgSettingsSchema, 
  insertOrganizationSchema, 
  insertUserSchema,
  insertRouteSchema,
  insertRouteStopSchema,
  insertServiceAlertSchema,
  insertRiderMessageSchema,
  insertDriverMessageSchema,
  insertRiderProfileSchema,
  insertRouteSubscriptionSchema,
  insertStopPreferenceSchema,
  insertRouteSessionSchema,
  insertPushTokenSchema,
  roleEnum,
  orgTypeEnum,
  alertTypeEnum,
  alertSeverityEnum,
  messageTypeEnum,
  notificationMethodEnum,
  notificationModeEnum,
  stopPreferences,
  routeStops,
  userRouteAssignments
} from "@shared/schema";
import { qrService } from "./qr";
import { smsService } from "./sms";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { calculateBusStatus } from "./busStatusCalculator";
import { 
  authenticateUser, 
  optionalAuthenticateUser,
  requireRole, 
  requireOrganization,
  requireRouteAccess,
  generateSessionToken,
  generateInviteToken,
  getSessionExpirationDate,
  type AuthUser
} from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== AUTHENTICATION ROUTES ====================
  
  // Get current authenticated user
  app.get("/api/me", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      console.log("DEBUG /api/me - user email:", user.email);
      console.log("DEBUG /api/me - routeAssignments:", JSON.stringify(user.routeAssignments, null, 2));
      res.json(user);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Request magic link (for drivers/riders)
  app.post("/api/auth/magic-link/request", async (req, res) => {
    try {
      const { email, phoneNumber } = req.body;
      
      if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Email or phone number required" });
      }

      // Find user by email or phone
      const user = email 
        ? await storage.getUserByEmail(email)
        : await storage.getUserByPhone(phoneNumber);

      if (!user) {
        // Don't reveal if user exists or not (security)
        return res.json({ success: true, message: "If an account exists, a magic link has been sent" });
      }

      // Generate magic link token
      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Create invite token
      await storage.createInviteToken({
        token,
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber || undefined,
        role: user.role,
        organizationId: user.organizationId || undefined, // Nullable for system admins
        routeId: user.favoriteRouteId || undefined,
        expiresAt,
        createdByUserId: user.id, // Self-generated
      });

      // Build magic link URL - use production URL if available
      const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const magicLink = `${appBaseUrl}/auth/verify?token=${token}`;
      
      // Send magic link via email
      if (user.email) {
        const emailSent = await sendMagicLinkEmail(user.email, magicLink, user.name || undefined);
        if (!emailSent) {
          console.error("Failed to send magic link email to:", user.email);
        }
      }
      
      res.json({ 
        success: true, 
        message: "If an account exists with that email, a login link has been sent.",
        // Only include link in development for testing
        magicLink: process.env.NODE_ENV === 'development' ? magicLink : undefined
      });
    } catch (error) {
      console.error("Error requesting magic link:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Verify magic link and create session
  app.post("/api/auth/magic-link/verify", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token required" });
      }

      // Get and validate invite token
      const inviteToken = await storage.getInviteToken(token);

      if (!inviteToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Validate token hasn't been claimed, is active, and hasn't expired
      if (inviteToken.claimedAt) {
        return res.status(401).json({ error: "Token has already been used" });
      }

      if (!inviteToken.isActive) {
        return res.status(401).json({ error: "Token has been revoked" });
      }

      if (new Date(inviteToken.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Token has expired" });
      }

      // Mark token as claimed
      await storage.claimInviteToken(token);

      // Get or create user
      let user = inviteToken.userId 
        ? await storage.getUser(inviteToken.userId)
        : await storage.getUserByEmail(inviteToken.email!);

      if (!user) {
        // Create new user if they don't exist
        user = await storage.createUser({
          email: inviteToken.email!,
          name: inviteToken.email!.split('@')[0], // Temp name
          phoneNumber: inviteToken.phoneNumber,
          role: inviteToken.role,
          organizationId: inviteToken.organizationId,
        });

        // Create route assignment if specified
        if (inviteToken.routeId) {
          await storage.createUserRouteAssignment({
            userId: user.id,
            routeId: inviteToken.routeId,
            assignedByUserId: inviteToken.createdByUserId,
            isDefault: true,
          });
        }
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({ 
          error: "Your account has been deactivated. Please contact your administrator for assistance.",
          code: "ACCOUNT_DEACTIVATED"
        });
      }

      // Check if user's organization is active (for non-system admins)
      if (user.organizationId) {
        const org = await storage.getOrganization(user.organizationId);
        if (!org || !org.isActive) {
          return res.status(401).json({ 
            error: "Your organization is no longer active. Please contact support for assistance.",
            code: "ORG_DEACTIVATED"
          });
        }
      }

      // Check password expiration for riders before granting session
      if (user.role === 'rider' && user.passwordExpiresAt) {
        const { isPasswordExpired } = await import("./passwordExpiration");
        if (isPasswordExpired(user.passwordExpiresAt)) {
          return res.status(401).json({ 
            error: "Password expired", 
            code: "PASSWORD_EXPIRED",
            message: "Your access has expired. Please request a new access code from your administrator.",
            redirectTo: "/access"
          });
        }
      }

      // Generate session token
      const sessionToken = generateSessionToken();
      const sessionExpiresAt = getSessionExpirationDate();

      // Set user session
      await storage.setUserSession(user.id, sessionToken, sessionExpiresAt);

      // Set session cookie (HttpOnly for security)
      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      });
      
      console.log(`[AUTH-COOKIE] Set for user ${user.email}, token starts: ${sessionToken.substring(0, 8)}...`);

      // Return session info (include sessionToken for native app contexts where cookies don't persist)
      res.json({
        success: true,
        sessionToken, // For native/PWA apps to store and send as Bearer token
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        }
      });
    } catch (error) {
      console.error("Error verifying magic link:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Logout - doesn't require authentication since we want logout to succeed
  // even when the session is already expired
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // Get the session token from cookie or header
      const sessionToken = req.cookies?.sessionToken || req.headers.authorization?.replace("Bearer ", "");
      
      if (sessionToken) {
        // Look up the user by token and clear their session
        const user = await storage.getUserBySessionToken(sessionToken);
        if (user) {
          await storage.clearUserSession(user.id);
        }
      }
    } catch (error) {
      // Log error but don't fail - we'll still clear the cookie
      console.error("Error clearing session on logout:", error);
    }
    
    // Always clear the session cookie and return success
    res.clearCookie("sessionToken");
    res.json({ success: true });
  });

  // Password-based login (for admin/driver accounts or when email isn't available)
  app.post("/api/auth/password/login", async (req, res) => {
    try {
      // Validate input with Zod
      const passwordLoginSchema = z.object({
        email: z.string().email("Valid email required"),
        password: z.string().min(1, "Password required"),
      });
      
      const parseResult = passwordLoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const { email, password } = parseResult.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Don't reveal if user exists (security)
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if user has a password set
      if (!user.passwordHash) {
        return res.status(401).json({ 
          error: "Password login not enabled. Please use magic link or contact your administrator.",
          code: "NO_PASSWORD_SET"
        });
      }

      // Verify password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({ 
          error: "Your account has been deactivated. Please contact your administrator for assistance.",
          code: "ACCOUNT_DEACTIVATED"
        });
      }

      // Check if user's organization is active (for non-system admins)
      if (user.organizationId) {
        const org = await storage.getOrganization(user.organizationId);
        if (!org || !org.isActive) {
          return res.status(401).json({ 
            error: "Your organization is no longer active. Please contact support for assistance.",
            code: "ORG_DEACTIVATED"
          });
        }
      }

      // Check password expiration for riders
      if (user.role === 'rider' && user.passwordExpiresAt) {
        const { isPasswordExpired } = await import("./passwordExpiration");
        if (isPasswordExpired(user.passwordExpiresAt)) {
          return res.status(401).json({ 
            error: "Password expired", 
            code: "PASSWORD_EXPIRED",
            message: "Your access has expired. Please request a new access code from your administrator.",
            redirectTo: "/access"
          });
        }
      }

      // Check if user must reset password (temp password on first login)
      if (user.mustResetPassword) {
        // Generate a temporary session for password reset only
        const sessionToken = generateSessionToken();
        const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes for reset

        await storage.setUserSession(user.id, sessionToken, sessionExpiresAt);

        res.cookie("sessionToken", sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 60 * 1000, // 30 minutes
        });

        return res.json({
          success: true,
          mustResetPassword: true,
          sessionToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
          }
        });
      }

      // Generate session token
      const sessionToken = generateSessionToken();
      const sessionExpiresAt = getSessionExpirationDate();

      // Set user session
      await storage.setUserSession(user.id, sessionToken, sessionExpiresAt);

      // Set session cookie (HttpOnly for security)
      res.cookie("sessionToken", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      });
      
      console.log(`[AUTH-COOKIE] Set for user ${user.email}, token starts: ${sessionToken.substring(0, 8)}...`);

      // Return session info (include sessionToken for native app contexts where cookies don't persist)
      res.json({
        success: true,
        sessionToken, // For native/PWA apps to store and send as Bearer token
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        }
      });
    } catch (error) {
      console.error("Error with password login:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Set password for a user (admin only, or user setting their own)
  app.post("/api/auth/password/set", authenticateUser, async (req, res) => {
    try {
      const requestingUser = (req as any).user as AuthUser;
      
      // Validate input with Zod
      const setPasswordSchema = z.object({
        userId: z.string().optional(),
        password: z.string().min(6, "Password must be at least 6 characters"),
        currentPassword: z.string().optional(),
      });
      
      const parseResult = setPasswordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      const { userId, password, currentPassword } = parseResult.data;

      // Determine target user
      const targetUserId = userId || requestingUser.id;
      const isSelf = targetUserId === requestingUser.id;

      // If setting someone else's password, must be admin
      if (!isSelf && requestingUser.role !== 'org_admin' && requestingUser.role !== 'system_admin') {
        return res.status(403).json({ error: "Only administrators can set other users' passwords" });
      }

      // Get target user to check role and current password
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // If setting own password, verify current password if one exists
      // Skip this check if mustResetPassword is true (admin just reset their password)
      if (isSelf && targetUser.passwordHash && !targetUser.mustResetPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: "Current password required" });
        }
        const bcrypt = await import("bcrypt");
        const isValid = await bcrypt.compare(currentPassword, targetUser.passwordHash);
        if (!isValid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      // Hash the new password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);

      // Determine password expiration based on role
      const { getPasswordExpirationForRole } = await import("./passwordExpiration");
      const passwordExpiresAt = getPasswordExpirationForRole(targetUser.role);

      // Update user's password and expiration
      await storage.setUserPasswordWithExpiration(targetUserId, passwordHash, passwordExpiresAt);

      // Clear the mustResetPassword flag if it was set (temp password has been changed)
      if (targetUser.mustResetPassword) {
        await storage.updateUser(targetUserId, { mustResetPassword: false });
      }

      res.json({ success: true, message: "Password set successfully" });
    } catch (error) {
      console.error("Error setting password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Request password reset - sends email with reset link
  app.post("/api/auth/password/reset-request", async (req, res) => {
    try {
      const resetRequestSchema = z.object({
        email: z.string().email("Invalid email address"),
      });
      
      const parseResult = resetRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      
      const { email } = parseResult.data;
      const normalizedEmail = email.trim().toLowerCase();

      // Find user by email
      const user = await storage.getUserByEmail(normalizedEmail);
      
      // Always return success to prevent email enumeration attacks
      if (!user || !user.isActive) {
        console.log(`Password reset requested for non-existent/inactive email: ${normalizedEmail}`);
        return res.json({ success: true, message: "If an account exists with this email, you'll receive a password reset link." });
      }

      // Generate a secure random token
      const crypto = await import("crypto");
      const resetToken = crypto.randomBytes(32).toString("hex");
      
      // Hash the token before storing for security
      const bcrypt = await import("bcrypt");
      const hashedToken = await bcrypt.hash(resetToken, 10);
      
      // Store the hashed reset token (expires in 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.createPasswordResetToken(user.id, hashedToken, expiresAt);

      // Send password reset email (with unhashed token for URL)
      const { sendPasswordResetEmail } = await import("./email");
      await sendPasswordResetEmail(normalizedEmail, resetToken, user.name);

      res.json({ success: true, message: "If an account exists with this email, you'll receive a password reset link." });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset password with token
  app.post("/api/auth/password/reset", async (req, res) => {
    try {
      const resetSchema = z.object({
        token: z.string().min(1, "Token is required"),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      });
      
      const parseResult = resetSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const { token, newPassword } = parseResult.data;

      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
      }

      // Check if token was already used
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "This reset link has already been used. Please request a new one." });
      }

      // Get the user
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Hash the new password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Determine password expiration based on role
      const { getPasswordExpirationForRole } = await import("./passwordExpiration");
      const passwordExpiresAt = getPasswordExpirationForRole(user.role);

      // Update the user's password
      await storage.setUserPasswordWithExpiration(user.id, passwordHash, passwordExpiresAt);

      // Mark the token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      // Invalidate all existing sessions for security
      await storage.setUserSession(user.id, null, null);

      res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== RIDER ONBOARDING (QR CODE SIGNUP) ====================
  
  // Complete rider onboarding from QR code - creates user account, rider profile, and subscription
  // Also handles returning users who want to add another route
  app.post("/api/rider-onboard", async (req, res) => {
    try {
      const { z } = await import("zod");
      
      // Validate input - password is optional for returning users
      const onboardSchema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters").optional(),
        phoneNumber: z.string().min(10, "Valid phone number required"),
        organizationId: z.string().min(1, "Organization ID required"),
        routeId: z.string().min(1, "Route ID required"),
        selectedStopIds: z.array(z.string()).min(1, "At least one stop must be selected"),
        notificationMode: z.enum(["always", "manual"]).default("always"),
        smsConsent: z.boolean(),
      });

      const validatedData = onboardSchema.parse(req.body);

      // Check if email already exists - if so, handle as returning user
      const existingUser = await storage.getUserByEmail(validatedData.email);
      
      if (existingUser) {
        // Returning user flow - add route to their existing account
        console.log(`[RIDER-ONBOARD] Returning user detected: ${existingUser.email}`);
        
        // Must be a rider to add routes via this flow
        if (existingUser.role !== "rider") {
          return res.status(400).json({
            error: "This email is registered as a staff account. Please use a different email.",
            code: "NOT_A_RIDER"
          });
        }
        
        // Check if account is active
        if (!existingUser.isActive) {
          return res.status(403).json({
            error: "Your account has been deactivated. Please contact your administrator.",
            code: "ACCOUNT_DEACTIVATED"
          });
        }
        
        // SECURITY: Verify password for returning users before granting session
        if (!validatedData.password) {
          return res.status(400).json({
            error: "Password is required to add a route to your existing account.",
            code: "PASSWORD_REQUIRED"
          });
        }
        
        if (!existingUser.passwordHash) {
          return res.status(400).json({
            error: "Your account does not have a password set. Please reset your password first.",
            code: "NO_PASSWORD_SET"
          });
        }
        
        const bcrypt = await import("bcrypt");
        const isPasswordValid = await bcrypt.compare(validatedData.password, existingUser.passwordHash);
        
        if (!isPasswordValid) {
          return res.status(401).json({
            error: "Incorrect password. Please try again.",
            code: "INVALID_PASSWORD"
          });
        }
        
        // Check if they already have a rider profile for this org
        let riderProfile = await storage.getRiderProfileByPhone(validatedData.phoneNumber, validatedData.organizationId);
        
        if (!riderProfile) {
          // Create rider profile for this organization
          riderProfile = await storage.createRiderProfile({
            phoneNumber: validatedData.phoneNumber,
            name: validatedData.name,
            organizationId: validatedData.organizationId,
            notificationMethod: "sms",
            smsConsent: validatedData.smsConsent,
            smsConsentAt: validatedData.smsConsent ? new Date() : undefined,
          });
          console.log(`[RIDER-ONBOARD] Created new rider profile for returning user: ${riderProfile.id}`);
        }
        
        // Check if they already have a subscription to this route
        const existingSubscriptions = await storage.getSubscriptionsByRiderProfile(riderProfile.id);
        const alreadySubscribed = existingSubscriptions.some(sub => sub.routeId === validatedData.routeId);
        
        if (alreadySubscribed) {
          // Already following this route - log them in and tell them
          const sessionToken = generateSessionToken();
          const sessionExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          await storage.setUserSession(existingUser.id, sessionToken, sessionExpiresAt);
          
          return res.status(200).json({
            success: true,
            message: "You're already following this route!",
            isExistingSubscription: true,
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
            },
            sessionToken,
          });
        }
        
        // Create new route subscription
        const subscription = await storage.createRouteSubscription({
          routeId: validatedData.routeId,
          riderProfileId: riderProfile.id,
          notificationMode: validatedData.notificationMode,
        });
        
        // Create stop preferences
        for (const stopId of validatedData.selectedStopIds) {
          try {
            await storage.createStopPreference({
              subscriptionId: subscription.id,
              stopId,
              notifyOnApproaching: true,
              notifyOnArrival: true,
            });
          } catch (error) {
            console.error(`Failed to create stop preference for ${stopId}:`, error);
          }
        }
        
        // Create route assignment
        try {
          await storage.createUserRouteAssignment({
            userId: existingUser.id,
            routeId: validatedData.routeId,
            assignedByUserId: existingUser.id,
            isDefault: false, // Not default since they have other routes
            isActive: true,
          });
        } catch (error) {
          console.error("Failed to create user route assignment:", error);
        }
        
        // Log them in
        const sessionToken = generateSessionToken();
        const sessionExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await storage.setUserSession(existingUser.id, sessionToken, sessionExpiresAt);
        
        const route = await storage.getRoute(validatedData.routeId);
        console.log(`[RIDER-ONBOARD] Added route ${route?.name} to existing user ${existingUser.email}`);
        
        return res.status(200).json({
          success: true,
          message: `Route "${route?.name || 'New route'}" added to your account!`,
          isRouteAdded: true,
          user: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
          },
          sessionToken,
        });
      }
      
      // New user flow - require password
      if (!validatedData.password) {
        return res.status(400).json({ 
          error: "Password is required for new accounts",
          code: "PASSWORD_REQUIRED"
        });
      }

      // Check if phone number already has a rider profile for this organization (new user with existing phone)
      const existingProfile = await storage.getRiderProfileByPhone(validatedData.phoneNumber, validatedData.organizationId);
      if (existingProfile) {
        return res.status(409).json({ 
          error: "This phone number is already registered. Please use the same email as before or contact support.",
          code: "PHONE_IN_USE"
        });
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(validatedData.password, 10);

      // Get password expiration for rider (next July 1st)
      const { getPasswordExpirationForRole } = await import("./passwordExpiration");
      const passwordExpiresAt = getPasswordExpirationForRole("rider");

      // Create user account
      const user = await storage.createUser({
        name: validatedData.name,
        email: validatedData.email,
        phoneNumber: validatedData.phoneNumber,
        role: "rider",
        organizationId: validatedData.organizationId,
        favoriteRouteId: validatedData.routeId,
        isActive: true,
      });

      // Set password with expiration
      await storage.setUserPasswordWithExpiration(user.id, passwordHash, passwordExpiresAt);

      // Create rider profile for SMS notifications
      const riderProfile = await storage.createRiderProfile({
        phoneNumber: validatedData.phoneNumber,
        name: validatedData.name,
        organizationId: validatedData.organizationId,
        notificationMethod: "sms",
        smsConsent: validatedData.smsConsent,
        smsConsentAt: validatedData.smsConsent ? new Date() : undefined,
      });

      // Create route subscription
      const subscription = await storage.createRouteSubscription({
        routeId: validatedData.routeId,
        riderProfileId: riderProfile.id,
        notificationMode: validatedData.notificationMode,
      });

      // Create stop preferences
      for (const stopId of validatedData.selectedStopIds) {
        try {
          await storage.createStopPreference({
            subscriptionId: subscription.id,
            stopId,
            notifyOnApproaching: true,
            notifyOnArrival: true,
          });
        } catch (error) {
          console.error(`Failed to create stop preference for ${stopId}:`, error);
        }
      }

      // Create route assignment for the user
      await storage.createUserRouteAssignment({
        userId: user.id,
        routeId: validatedData.routeId,
        assignedByUserId: user.id, // Self-assigned via QR code
        isDefault: true,
        isActive: true,
      });

      // Create a session for the user so they're logged in
      const sessionToken = generateSessionToken();
      const sessionExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      await storage.setUserSession(user.id, sessionToken, sessionExpiresAt);

      // Send welcome SMS if consent given
      if (validatedData.smsConsent && smsService) {
        try {
          const route = await storage.getRoute(validatedData.routeId);
          await smsService.sendWelcomeSms(validatedData.phoneNumber, route?.name || "your route");
        } catch (error) {
          console.error("Failed to send welcome SMS:", error);
        }
      }

      // Send welcome email (non-blocking)
      try {
        const route = await storage.getRoute(validatedData.routeId);
        const { sendWelcomeEmail } = await import("./email");
        sendWelcomeEmail(validatedData.email, validatedData.name, route?.name).catch(err => {
          console.error("Failed to send welcome email:", err);
        });
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }

      res.status(201).json({
        success: true,
        message: "Account created successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        sessionToken,
      });
    } catch (error: any) {
      console.error("Error in rider onboarding:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ error: "Failed to create account. Please try again." });
    }
  });

  // ==================== INVITE MANAGEMENT ROUTES ====================
  
  // Create invite for driver or rider (org admins only)
  app.post("/api/invites", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { email, phoneNumber, role, routeId } = req.body;

      if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Email or phone number required" });
      }

      if (!["driver", "rider"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be driver or rider" });
      }

      // Generate invite token
      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invite
      const invite = await storage.createInviteToken({
        token,
        email,
        phoneNumber,
        role,
        organizationId: user.organizationId!,
        routeId,
        expiresAt,
        createdByUserId: user.id,
      });

      // Generate invite link
      const inviteLink = `${req.protocol}://${req.get('host')}/auth/invite/${token}`;

      // Generate QR code
      const qrCode = await qrService.generateQRCode(inviteLink);

      res.json({
        success: true,
        invite: {
          id: invite.id,
          email,
          phoneNumber,
          role,
          routeId,
          expiresAt,
        },
        inviteLink,
        qrCode,
      });
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active invites for organization
  app.get("/api/invites", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const invites = await storage.getActiveInvitesByOrganization(user.organizationId!);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Expire/revoke invite
  app.delete("/api/invites/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.expireInviteToken(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error expiring invite:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== ROUTE ASSIGNMENT ROUTES ====================
  
  // Get user's route assignments
  app.get("/api/route-assignments/:userId", authenticateUser, async (req, res) => {
    try {
      const requestingUser = (req as any).user as AuthUser;
      const { userId } = req.params;

      // Users can view their own assignments, org admins can view anyone's in their org
      if (requestingUser.id !== userId && requestingUser.role !== "org_admin" && requestingUser.role !== "system_admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const assignments = await storage.getUserRouteAssignments(userId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching route assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create route assignment (org admins only)
  app.post("/api/route-assignments", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const requestingUser = (req as any).user as AuthUser;
      const { userId, routeId, isDefault } = req.body;

      const assignment = await storage.createUserRouteAssignment({
        userId,
        routeId,
        assignedByUserId: requestingUser.id,
        isDefault: isDefault || false,
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error creating route assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Set default route for user (creates assignment if needed)
  app.put("/api/route-assignments/:userId/default", authenticateUser, async (req, res) => {
    try {
      const requestingUser = (req as any).user as AuthUser;
      const { userId } = req.params;
      const { routeId } = req.body;

      console.log("[ROUTE-SYNC] Setting default route:", { 
        userId, 
        routeId, 
        requestingUserId: requestingUser.id,
        requestingUserRole: requestingUser.role 
      });

      // Users can set their own default, org admins can set for their org
      if (requestingUser.id !== userId && requestingUser.role !== "org_admin" && requestingUser.role !== "system_admin") {
        console.log("[ROUTE-SYNC] Forbidden - user mismatch");
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check if user already has an assignment for this route
      const existingAssignments = await storage.getUserRouteAssignments(userId);
      const existingForRoute = existingAssignments.find(a => a.routeId === routeId);
      
      console.log("[ROUTE-SYNC] Existing assignments:", existingAssignments.length, "Has route:", !!existingForRoute);
      
      let assignment: any;
      
      if (existingForRoute) {
        // Use setDefaultRoute which clears all defaults then sets this one
        assignment = await storage.setDefaultRoute(userId, routeId);
        console.log("[ROUTE-SYNC] Updated existing assignment to default");
      } else {
        // First, clear all default flags for this user using direct DB update
        await db.update(userRouteAssignments)
          .set({ isDefault: false })
          .where(eq(userRouteAssignments.userId, userId));
        
        // Create new assignment with this route as default
        assignment = await storage.createUserRouteAssignment({
          userId,
          routeId,
          assignedByUserId: requestingUser.id,
          isDefault: true,
        });
        console.log("[ROUTE-SYNC] Created new assignment:", assignment?.id);
      }
      
      res.json(assignment);
    } catch (error) {
      console.error("[ROUTE-SYNC] Error setting default route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Revoke route assignment (org admins only)
  app.delete("/api/route-assignments/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const requestingUser = (req as any).user as AuthUser;
      const { id } = req.params;

      const assignment = await storage.revokeRouteAssignment(id, requestingUser.id);
      res.json(assignment);
    } catch (error) {
      console.error("Error revoking route assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================== EXISTING ROUTES BELOW ====================
  
  // Organization Settings Routes
  app.get("/api/org-settings", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { organizationId } = req.query;
      
      // System admin can view any org's settings
      if (user.role === "system_admin" && organizationId && typeof organizationId === "string") {
        const org = await storage.getOrganizationById(organizationId);
        if (!org) {
          return res.status(404).json({ error: "Organization not found" });
        }
        // Return org settings based on organization data
        return res.json({
          id: org.id,
          name: org.name,
          primaryColor: org.primaryColor,
          organizationId: org.id,
          type: org.type
        });
      }
      
      // For regular users, get default org settings
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

  // Object Storage Routes (logo upload)
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to set ACL policy after upload
  app.put("/api/objects/acl", async (req, res) => {
    try {
      const { objectPath } = req.body;
      if (!objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const finalPath = await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: "system",
        visibility: "public",
      });
      
      res.json({ objectPath: finalPath });
    } catch (error) {
      console.error("Error setting ACL policy:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error retrieving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Organization Management (for org admins)
  app.get("/api/organization", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      
      // Get the logged-in user's organization
      if (!user.organizationId) {
        return res.status(400).json({ error: "User not associated with an organization" });
      }
      
      const organization = await storage.getOrganization(user.organizationId);
      
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/organization/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate only the fields being updated (partial schema)
      const partialSchema = insertOrganizationSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Only pass defined fields to prevent overwriting with undefined
      const updateData: Partial<typeof validatedData> = {};
      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.logoUrl !== undefined) updateData.logoUrl = validatedData.logoUrl;
      if (validatedData.primaryColor !== undefined) updateData.primaryColor = validatedData.primaryColor;
      if (validatedData.type !== undefined) updateData.type = validatedData.type;
      
      const updated = await storage.updateOrganization(id, updateData);
      
      if (!updated) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json(updated);
    } catch (error) {
      // Handle validation errors
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // System Admin - Organization Management Routes
  app.get("/api/system/organizations", async (req, res) => {
    try {
      const { includeAdmins } = req.query;
      const organizations = await storage.getAllOrganizations();
      
      if (includeAdmins === "true") {
        const orgsWithAdmins = await Promise.all(
          organizations.map(async (org) => {
            const admins = await storage.getUsersByRole("org_admin");
            const orgAdmin = admins.find(admin => admin.organizationId === org.id);
            return { ...org, admin: orgAdmin || null };
          })
        );
        return res.json(orgsWithAdmins);
      }
      
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

  app.post("/api/system/organizations/admin", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const createAdminSchema = z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6)
      });
      
      const { organizationId, name, email, password } = createAdminSchema.parse(req.body);
      
      // Verify organization exists
      const org = await storage.getOrganization(organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Check if email is already in use
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      // Hash the password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create the admin user with mustResetPassword flag
      const newAdmin = await storage.createUser({
        name,
        email,
        role: "org_admin",
        organizationId,
        passwordHash,
        isActive: true
      });
      
      // Set the mustResetPassword flag
      await storage.updateUser(newAdmin.id, { mustResetPassword: true });
      
      res.status(201).json(newAdmin);
    } catch (error) {
      console.error("Error creating org admin:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
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

  // Toggle organization active status (archive/unarchive)
  app.post("/api/system/organizations/:id/toggle-status", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify organization exists
      const org = await storage.getOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const isDeactivating = org.isActive; // If currently active, we're deactivating
      
      // Get all users in this organization
      const orgUsers = await storage.getUsersByOrganization(id);
      
      // Toggle active status
      const updated = await storage.updateOrganization(id, { isActive: !org.isActive });
      
      // When deactivating an organization, also deactivate all its users and clear their sessions
      if (isDeactivating && orgUsers.length > 0) {
        let deactivatedCount = 0;
        for (const user of orgUsers) {
          // Deactivate user and clear their session
          await storage.deactivateUser(user.id);
          await storage.clearUserSession(user.id);
          deactivatedCount++;
        }
        console.log(`Deactivated ${deactivatedCount} users when deactivating organization ${org.name}`);
        
        return res.json({
          ...updated,
          usersDeactivated: deactivatedCount,
          message: `Organization and ${deactivatedCount} user(s) have been deactivated`
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling organization status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all admins for an organization
  app.get("/api/system/organizations/:id/admins", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify organization exists
      const org = await storage.getOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Get all org_admins for this organization
      const allAdmins = await storage.getUsersByRole("org_admin");
      const orgAdmins = allAdmins.filter(admin => admin.organizationId === id);
      
      res.json(orgAdmins);
    } catch (error) {
      console.error("Error fetching org admins:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update an org admin's details (name, email)
  app.put("/api/system/organizations/:orgId/admins/:adminId", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { orgId, adminId } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      // Verify organization exists
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Verify admin exists and belongs to org
      const admin = await storage.getUser(adminId);
      if (!admin || admin.organizationId !== orgId || admin.role !== "org_admin") {
        return res.status(404).json({ error: "Admin not found in this organization" });
      }
      
      // If email is being changed, check it's not already in use
      if (validatedData.email && validatedData.email !== admin.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }
      
      const updated = await storage.updateUser(adminId, validatedData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating org admin:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset an org admin's password
  app.post("/api/system/organizations/:orgId/admins/:adminId/reset-password", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { orgId, adminId } = req.params;
      const resetSchema = z.object({
        password: z.string().min(6)
      });
      
      const { password } = resetSchema.parse(req.body);
      
      // Verify organization exists
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Verify admin exists and belongs to org
      const admin = await storage.getUser(adminId);
      if (!admin || admin.organizationId !== orgId || admin.role !== "org_admin") {
        return res.status(404).json({ error: "Admin not found in this organization" });
      }
      
      // Hash the new password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Update password and set mustResetPassword flag
      await storage.updateUser(adminId, { 
        passwordHash, 
        mustResetPassword: true 
      });
      
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting admin password:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deactivate/Activate an org admin
  app.post("/api/system/organizations/:orgId/admins/:adminId/toggle-status", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { orgId, adminId } = req.params;
      
      // Verify organization exists
      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Verify admin exists and belongs to org
      const admin = await storage.getUser(adminId);
      if (!admin || admin.organizationId !== orgId || admin.role !== "org_admin") {
        return res.status(404).json({ error: "Admin not found in this organization" });
      }
      
      // Toggle active status
      const updated = await storage.updateUser(adminId, { isActive: !admin.isActive });
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling admin status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management Routes
  app.get("/api/users", async (req, res) => {
    try {
      const { role, organizationId } = req.query;
      
      let users;
      // Support both role AND organizationId filtering together
      if (role && typeof role === "string" && organizationId && typeof organizationId === "string") {
        const validatedRole = roleEnum.parse(role);
        const allByRole = await storage.getUsersByRole(validatedRole);
        users = allByRole.filter(u => u.organizationId === organizationId);
      } else if (role && typeof role === "string") {
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

  // Bulk renew all rider passwords for an organization (admin only)
  app.post("/api/users/renew-all-rider-passwords", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      
      // Only org_admin and system_admin can renew passwords
      if (user.role !== 'org_admin' && user.role !== 'system_admin') {
        return res.status(403).json({ error: "Unauthorized - admin access required" });
      }
      
      // Validate request body with Zod
      const renewPasswordSchema = z.object({
        organizationId: z.string().uuid("Invalid organization ID format")
      });
      
      const validationResult = renewPasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        });
      }
      
      const { organizationId } = validationResult.data;
      
      // Org admins can only renew passwords for their own organization
      if (user.role === 'org_admin' && organizationId !== user.organizationId) {
        return res.status(403).json({ error: "Cannot renew passwords for other organizations" });
      }
      
      // Import the password expiration utility
      const { getNextJuly1st } = await import("./passwordExpiration");
      const newExpiresAt = getNextJuly1st();
      
      // Renew all rider passwords for this organization
      const renewedCount = await storage.renewAllRiderPasswords(organizationId, newExpiresAt);
      
      res.json({ 
        success: true,
        renewedCount,
        newExpiresAt: newExpiresAt.toISOString(),
        message: `Successfully renewed ${renewedCount} rider password(s) to expire on ${newExpiresAt.toLocaleDateString()}`
      });
    } catch (error) {
      console.error("Error renewing rider passwords:", error);
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

  // ==================== STAFF MANAGEMENT (Drivers & Admins) ====================
  
  // Get staff members (drivers and admins) for the organization
  app.get("/api/staff", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { role, organizationId } = req.query;
      
      // System admins can view any org's staff, org admins only their own
      const effectiveOrgId = user.role === "system_admin" && organizationId && typeof organizationId === "string"
        ? organizationId
        : user.organizationId;
      
      // Get all users for the organization
      const allUsers = await storage.getUsersByOrganization(effectiveOrgId);
      
      // Filter to only drivers and org_admins
      let staffMembers = allUsers.filter(u => 
        u.role === "driver" || u.role === "org_admin"
      );
      
      // Further filter by role if specified
      if (role && typeof role === "string") {
        staffMembers = staffMembers.filter(u => u.role === role);
      }
      
      // For each driver, get their route assignments
      const staffWithAssignments = await Promise.all(
        staffMembers.map(async (staff) => {
          if (staff.role === "driver") {
            const assignments = await storage.getUserRouteAssignments(staff.id);
            return { ...staff, routeAssignments: assignments };
          }
          return { ...staff, routeAssignments: [] };
        })
      );
      
      res.json(staffWithAssignments);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new staff member (driver or admin)
  app.post("/api/staff", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      
      const staffSchema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email required"),
        phoneNumber: z.string().optional(),
        role: z.enum(["driver", "org_admin"], { errorMap: () => ({ message: "Role must be driver or org_admin" }) }),
        password: z.string().min(6, "Password must be at least 6 characters"),
        routeId: z.string().uuid().optional(), // For drivers - which route to assign
      });
      
      const validationResult = staffSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.errors 
        });
      }
      
      const { name, email, phoneNumber, role, password, routeId } = validationResult.data;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Hash the password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create the user
      const newStaff = await storage.createUser({
        name,
        email,
        phoneNumber: phoneNumber || null,
        role,
        organizationId: user.organizationId,
        passwordHash,
        isActive: true,
      });
      
      // If driver and routeId provided, create route assignment
      if (role === "driver" && routeId) {
        // Verify route belongs to organization
        const route = await storage.getRoute(routeId);
        if (!route || route.organizationId !== user.organizationId) {
          // User created but route assignment failed - still return success
          return res.status(201).json({ 
            ...newStaff, 
            routeAssignments: [],
            warning: "User created but route assignment failed - route not found in organization" 
          });
        }
        
        await storage.createUserRouteAssignment({
          userId: newStaff.id,
          routeId,
          assignedByUserId: user.id,
          isDefault: true,
          isActive: true,
        });
        
        // Fetch assignments to return with response
        const assignments = await storage.getUserRouteAssignments(newStaff.id);
        return res.status(201).json({ ...newStaff, routeAssignments: assignments });
      }
      
      res.status(201).json({ ...newStaff, routeAssignments: [] });
    } catch (error) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update a staff member
  app.patch("/api/staff/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Get the staff member
      const staffMember = await storage.getUser(id);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      
      // Verify same organization (org admins can only manage their own org)
      if (user.role === "org_admin" && staffMember.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "Cannot modify staff from another organization" });
      }
      
      // Verify it's actually a staff member (driver or org_admin)
      if (staffMember.role !== "driver" && staffMember.role !== "org_admin") {
        return res.status(400).json({ error: "This endpoint is only for drivers and admins" });
      }
      
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        phoneNumber: z.string().optional().nullable(),
        routeId: z.string().uuid().optional().nullable(), // For reassigning driver to route
      });
      
      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.errors 
        });
      }
      
      const { name, phoneNumber, routeId } = validationResult.data;
      
      // Update user fields
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      
      let updatedStaff = staffMember;
      if (Object.keys(updateData).length > 0) {
        updatedStaff = await storage.updateUser(id, updateData) || staffMember;
      }
      
      // Handle route assignment for drivers
      if (staffMember.role === "driver" && routeId !== undefined) {
        // Get current assignments
        const currentAssignments = await storage.getUserRouteAssignments(id);
        
        if (routeId === null) {
          // Remove all assignments
          for (const assignment of currentAssignments) {
            await storage.revokeRouteAssignment(assignment.id, user.id);
          }
        } else {
          // Verify route belongs to organization
          const route = await storage.getRoute(routeId);
          if (!route || route.organizationId !== user.organizationId) {
            return res.status(400).json({ error: "Route not found in your organization" });
          }
          
          // Remove existing assignments and add new one
          for (const assignment of currentAssignments) {
            await storage.revokeRouteAssignment(assignment.id, user.id);
          }
          
          await storage.createUserRouteAssignment({
            userId: id,
            routeId,
            assignedByUserId: user.id,
            isDefault: true,
            isActive: true,
          });
        }
      }
      
      // Fetch updated assignments
      const assignments = await storage.getUserRouteAssignments(id);
      
      res.json({ ...updatedStaff, routeAssignments: assignments });
    } catch (error) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete/deactivate a staff member
  app.delete("/api/staff/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Get the staff member
      const staffMember = await storage.getUser(id);
      if (!staffMember) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      
      // Prevent self-deletion
      if (staffMember.id === user.id) {
        return res.status(400).json({ error: "Cannot remove your own account" });
      }
      
      // Verify same organization
      if (user.role === "org_admin" && staffMember.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "Cannot remove staff from another organization" });
      }
      
      // Verify it's a staff member
      if (staffMember.role !== "driver" && staffMember.role !== "org_admin") {
        return res.status(400).json({ error: "This endpoint is only for drivers and admins" });
      }
      
      // Revoke all route assignments for drivers
      if (staffMember.role === "driver") {
        const assignments = await storage.getUserRouteAssignments(id);
        for (const assignment of assignments) {
          await storage.revokeRouteAssignment(assignment.id, user.id);
        }
      }
      
      // Deactivate the user
      await storage.deactivateUser(id);
      
      res.json({ success: true, message: "Staff member removed successfully" });
    } catch (error) {
      console.error("Error removing staff member:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Management Routes
  app.get("/api/routes", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      let routes;
      
      if (user.role === "system_admin") {
        // System admins can optionally filter by organizationId or see all routes
        const { organizationId } = req.query;
        if (organizationId && typeof organizationId === "string") {
          routes = await storage.getRoutesByOrganization(organizationId);
        } else {
          routes = await storage.getAllRoutes();
        }
      } else if (user.role === "org_admin") {
        // Org admins can ONLY see routes from their own organization
        // Never trust client-provided organizationId
        routes = await storage.getRoutesByOrganization(user.organizationId);
      } else if (user.role === "driver") {
        // Drivers can see ALL active routes in their organization
        // This allows any driver to operate any route without needing explicit assignment
        routes = await storage.getRoutesByOrganization(user.organizationId);
      } else if (user.role === "rider") {
        // Riders can only see routes they're assigned to (via subscription)
        const assignedRouteIds = user.routeAssignments?.map(a => a.routeId) || [];
        if (assignedRouteIds.length === 0) {
          return res.json([]); // No assigned routes
        }
        
        // Get all routes for the user's organization, then filter to assigned ones
        const orgRoutes = await storage.getRoutesByOrganization(user.organizationId);
        routes = orgRoutes.filter(route => assignedRouteIds.includes(route.id));
      } else {
        return res.status(403).json({ error: "Access denied" });
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

  app.post("/api/routes", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      
      // Org admins can only create routes in their own organization
      // Never trust client-provided organizationId for org admins
      const organizationId = user.role === "org_admin" 
        ? user.organizationId 
        : req.body.organizationId;
      
      const validatedData = insertRouteSchema.parse({ 
        ...req.body, 
        organizationId 
      });
      
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
      console.log("DEBUG GET /api/routes/:id - requesting route:", id);
      const route = await storage.getRoute(id);
      
      if (!route) {
        console.log("DEBUG GET /api/routes/:id - route not found for id:", id);
        return res.status(404).json({ error: "Route not found" });
      }
      
      console.log("DEBUG GET /api/routes/:id - found route:", route.name);
      const stops = await storage.getRouteStopsByRoute(id);
      res.json({ ...route, stops });
    } catch (error) {
      console.error("Error fetching route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/routes/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route exists and get its organization
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only update routes in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only update routes in your organization" });
      }
      
      // Don't allow changing organizationId
      const { organizationId, ...updateData } = req.body;
      const validatedData = insertRouteSchema.partial().parse(updateData);
      const updated = await storage.updateRoute(id, validatedData);
      
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

  app.delete("/api/routes/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route exists and get its organization
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only archive routes in their organization
      // System admins can archive any route
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only archive routes in your organization" });
      }
      
      // Archive the route with safety checks
      const result = await storage.archiveRoute(id, user.id);
      
      if (!result.success) {
        // Check if it's an active trips conflict
        if (result.error?.includes("active trips")) {
          return res.status(409).json({ 
            error: result.error,
            code: "ACTIVE_TRIPS_EXIST"
          });
        }
        return res.status(400).json({ error: result.error });
      }
      
      // Log archive action for audit trail
      console.log(`Route archived: ${id} by user ${user.id} (${user.role}). Affected: ${result.affectedRiders} riders, ${result.affectedDrivers} drivers`);
      
      res.json({ 
        success: true,
        message: "Route archived successfully",
        affectedRiders: result.affectedRiders,
        affectedDrivers: result.affectedDrivers
      });
    } catch (error) {
      console.error("Error archiving route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Restore archived route
  app.post("/api/routes/:id/restore", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route exists and get its organization
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only restore routes in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only restore routes in your organization" });
      }
      
      const result = await storage.restoreRoute(id);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      console.log(`Route restored: ${id} by user ${user.id} (${user.role})`);
      
      res.json({ 
        success: true,
        message: "Route restored successfully"
      });
    } catch (error) {
      console.error("Error restoring route:", error);
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
  app.get("/api/routes/:routeId/stops", authenticateUser, requireRouteAccess(), async (req, res) => {
    try {
      const { routeId } = req.params;
      
      const stops = await storage.getRouteStopsByRoute(routeId);
      res.json(stops);
    } catch (error) {
      console.error("Error fetching route stops:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/routes/:routeId/stops", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { routeId } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route exists and user has access
      const route = await storage.getRoute(routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only add stops to routes in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only add stops to routes in your organization" });
      }
      
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

  app.put("/api/stops/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Get the stop to verify it exists and check its route's organization
      const stop = await storage.getRouteStop(id);
      if (!stop) {
        return res.status(404).json({ error: "Route stop not found" });
      }
      
      // Get the route to check organization
      const route = await storage.getRoute(stop.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only update stops in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only update stops in your organization" });
      }
      
      const validatedData = insertRouteStopSchema.partial().parse(req.body);
      const updated = await storage.updateRouteStop(id, validatedData);
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating route stop:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid route stop data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/stops/:id", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Get the stop to verify it exists and check its route's organization
      const stop = await storage.getRouteStop(id);
      if (!stop) {
        return res.status(404).json({ error: "Route stop not found" });
      }
      
      // Get the route to check organization
      const route = await storage.getRoute(stop.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only delete stops in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only delete stops in your organization" });
      }
      
      // Check if any riders have this stop as their home stop preference
      const dependentPreferences = await db.select()
        .from(stopPreferences)
        .where(eq(stopPreferences.stopId, id));
      
      if (dependentPreferences.length > 0) {
        return res.status(409).json({
          error: "Cannot delete stop. Riders have selected this as their home stop.",
          code: "STOP_IN_USE",
          affectedRiders: dependentPreferences.length
        });
      }
      
      const deleted = await storage.deleteRouteStop(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route stop:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reorder route stops (for drag-and-drop UI)
  app.patch("/api/routes/:routeId/stops/reorder", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { routeId } = req.params;
      const user = (req as any).user as AuthUser;
      const { stops } = req.body; // Array of { stopId, orderIndex }
      
      // Verify route exists and check organization ownership
      const route = await storage.getRoute(routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only reorder stops in their organization
      // System admins can reorder stops in any organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only reorder stops in your organization" });
      }
      
      // Validate request body
      if (!Array.isArray(stops) || stops.length === 0) {
        return res.status(400).json({ error: "Invalid request. Expected array of stops." });
      }
      
      // Load current stops for this route to validate the submitted list
      const currentStops = await storage.getRouteStopsByRoute(routeId);
      const currentStopIds = new Set(currentStops.map(s => s.id));
      const submittedStopIds = new Set(stops.map(s => s.stopId));
      
      // Verify the submitted list contains exactly the same stops (no missing, no extra, no foreign)
      if (currentStopIds.size !== submittedStopIds.size) {
        return res.status(400).json({ 
          error: "Invalid stops list. Must include all stops for this route (no more, no less)." 
        });
      }
      
      for (const stopId of submittedStopIds) {
        if (!currentStopIds.has(stopId)) {
          return res.status(400).json({ 
            error: "Invalid stop ID. All stops must belong to this route." 
          });
        }
      }
      
      // Validate that indices are contiguous (0, 1, 2, 3...)
      const indices = stops.map(s => s.orderIndex).sort((a, b) => a - b);
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] !== i) {
          return res.status(400).json({ 
            error: "Invalid order indices. Must be contiguous starting from 0." 
          });
        }
      }
      
      // Update all stops in a transaction (safe now - verified all stops belong to route)
      await db.transaction(async (tx) => {
        for (const stop of stops) {
          await tx.update(routeStops)
            .set({ orderIndex: stop.orderIndex })
            .where(eq(routeStops.id, stop.stopId));
        }
      });
      
      // Fetch and return updated stops
      const updatedStops = await storage.getRouteStopsByRoute(routeId);
      res.json(updatedStops);
    } catch (error) {
      console.error("Error reordering route stops:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete all stops for a route (DANGEROUS - use with caution)
  app.delete("/api/routes/:id/stops", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user as AuthUser;
      
      // First check if route exists
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Org admins can only delete stops in their organization
      if (user.role === "org_admin" && route.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You can only delete stops in your organization" });
      }
      
      // Get all stops for this route
      const stops = await storage.getRouteStopsByRoute(id);
      
      // Check if any riders depend on these stops
      const stopIds = stops.map(s => s.id).filter(Boolean);
      if (stopIds.length > 0) {
        const dependentPreferences = await db.select()
          .from(stopPreferences)
          .where(sql`${stopPreferences.stopId} IN (${sql.join(stopIds.map(id => sql`${id}`), sql`, `)})`);
        
        if (dependentPreferences.length > 0) {
          return res.status(409).json({
            error: "Cannot delete all stops. Some riders have selected these as their home stops.",
            code: "STOPS_IN_USE",
            affectedRiders: dependentPreferences.length
          });
        }
      }
      
      // Delete all stops for this route in a transaction (all-or-nothing)
      // Use hard delete since we've already verified no dependent riders exist
      await db.transaction(async (tx) => {
        for (const stop of stops) {
          if (stop.id) {
            await tx.delete(routeStops)
              .where(eq(routeStops.id, stop.id));
          }
        }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route stops:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Session Management Routes (GPS Tracking)
  app.post("/api/route-sessions/start", authenticateUser, requireRole('driver'), async (req, res) => {
    try {
      const { routeId, driverUserId } = req.body;
      
      if (!routeId || !driverUserId) {
        return res.status(400).json({ error: "routeId and driverUserId are required" });
      }

      // Use the new startRoute method which handles active session checking
      const session = await storage.startRoute(routeId, driverUserId);
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof Error && error.message === 'Route already has an active session') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error starting route session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/route-sessions/:id/end", authenticateUser, requireRole('driver'), async (req, res) => {
    try {
      const { id } = req.params;
      
      const session = await storage.endRoute(id);
      
      if (!session) {
        return res.status(404).json({ error: "Route session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error ending route session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/route-sessions/:id/location", authenticateUser, requireRole('driver'), async (req, res) => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;
      
      console.log(`[GPS] Location update received for session ${id}: lat=${latitude}, lng=${longitude}`);
      
      // Validate latitude and longitude are provided and are numbers
      if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
        console.log(`[GPS] Missing coordinates for session ${id}`);
        return res.status(400).json({ error: "latitude and longitude are required" });
      }

      const lat = Number(latitude);
      const lng = Number(longitude);

      // Validate numeric conversion and ranges
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "latitude and longitude must be valid numbers" });
      }

      if (lat < -90 || lat > 90) {
        return res.status(400).json({ error: "latitude must be between -90 and 90" });
      }

      if (lng < -180 || lng > 180) {
        return res.status(400).json({ error: "longitude must be between -180 and 180" });
      }

      // Update location and check geofences
      const { session, stopsToNotify } = await storage.updateDriverLocation(id, lat, lng);
      
      if (!session) {
        return res.status(404).json({ error: "Route session not found" });
      }

      // Get route and riders once upfront (instead of per-stop)
      const route = await storage.getRoute(session.routeId);
      if (!route) {
        return res.json(session);
      }

      const riders = await storage.getRidersForRoute(session.routeId);
      if (riders.length === 0) {
        return res.json(session);
      }

      // Batch-load all subscriptions for these riders in one query
      const riderIds = riders.map(r => r.id);
      const allSubscriptions = await Promise.all(
        riderIds.map(riderId => storage.getSubscriptionsByRiderProfile(riderId))
      );
      const subscriptionMap = new Map<string, typeof allSubscriptions[0][0]>();
      allSubscriptions.flat().forEach(sub => {
        if (sub.routeId === session.routeId) {
          subscriptionMap.set(sub.riderProfileId, sub);
        }
      });

      // Batch-load all stop preferences for these subscriptions in one query
      const subscriptionIds = Array.from(subscriptionMap.values()).map(s => s.id);
      const allStopPrefs = await Promise.all(
        subscriptionIds.map(subId => storage.getStopPreferencesBySubscription(subId))
      );
      
      // Build lookup map: subscriptionId -> Map<stopId, prefs>
      const stopPrefsMap = new Map<string, Map<string, typeof allStopPrefs[0][0]>>();
      allStopPrefs.forEach((prefs, idx) => {
        const stopMap = new Map<string, typeof prefs[0]>();
        prefs.forEach(pref => stopMap.set(pref.stopId, pref));
        stopPrefsMap.set(subscriptionIds[idx], stopMap);
      });

      // Send notifications for stops within geofence
      console.log(`[Notification] Processing ${stopsToNotify.length} stops to notify, checking ${riders.length} riders`);
      
      for (const { stopId, notificationType } of stopsToNotify) {
        const stop = await storage.getRouteStop(stopId);
        if (!stop) continue;
        
        console.log(`[Notification] Checking stop "${stop.name}" (${notificationType})`);

        // Track if we sent any notification for this stop (for spam prevention)
        let notificationSent = false;

        for (const rider of riders) {
          const subscription = subscriptionMap.get(rider.id);
          if (!subscription) continue;

          const riderStopPrefs = stopPrefsMap.get(subscription.id);
          const hasAnyStopPrefs = riderStopPrefs && riderStopPrefs.size > 0;
          const stopPref = riderStopPrefs?.get(stopId);
          
          // CRITICAL: Only notify riders who specifically selected this stop as their home stop
          // - If rider has stop preferences: only notify for their selected stops
          // - If rider has NO stop preferences (legacy/admin-added): skip them entirely
          //   (this prevents spamming riders who weren't set up through proper onboarding)
          if (!stopPref) {
            if (hasAnyStopPrefs) {
              console.log(`[Notification] Skipping rider ${rider.name} - they selected a different stop, not ${stop.name}`);
            } else {
              console.log(`[Notification] Skipping rider ${rider.name} - no stop preferences configured (legacy/admin rider)`);
            }
            continue;
          }
          
          // Skip if rider turned off notifications for this type
          if (notificationType === 'approaching' && !stopPref.notifyOnApproaching) continue;
          if (notificationType === 'arrived' && !stopPref.notifyOnArrival) continue;
          
          console.log(`[Notification] SENDING ${notificationType} notification to ${rider.name} (${rider.phoneNumber}) for stop ${stop.name}`);

          // Build notification message
          const message = notificationType === 'approaching'
            ? `Your bus is approximately 5 minutes away from ${stop.name}`
            : `Your bus has arrived at ${stop.name}`;

          notificationSent = true;

          // ALWAYS create in-app proximity alert (works without SMS/Twilio)
          try {
            await storage.createProximityAlert({
              riderProfileId: rider.id,
              routeId: session.routeId,
              sessionId: session.id,
              stopId: stopId,
              alertType: notificationType,
              message: message,
              isRead: false,
              readAt: null,
            });
            console.log(`[Notification] Created in-app alert for ${rider.name}`);
          } catch (alertError) {
            console.error(`Failed to create in-app alert for ${rider.name}:`, alertError);
          }

          // Send Firebase push notification to authenticated RIDERS on this route (with rate limiting)
          // IMPORTANT: Only send to riders, NOT drivers - drivers don't need proximity alerts
          if (isFirebaseReady()) {
            try {
              // Get rider user IDs in a single optimized query (excludes drivers/admins)
              const riderUserIds = await storage.getRiderUserIdsForRoute(session.routeId);
              
              // Send push notification to each authenticated rider only
              for (const userId of riderUserIds) {
                const pushResult = await sendProximityAlertPush(
                  userId,
                  notificationType as 'approaching' | 'arrived',
                  stop.name,
                  route.name,
                  session.routeId,  // Include route ID for unique key
                  session.id        // Include session ID for unique key
                );
                if (pushResult.rateLimited) {
                  console.log(`[Notification] Firebase push to user ${userId} rate-limited (recent notification sent)`);
                } else {
                  console.log(`[Notification] Firebase push to user ${userId}: ${pushResult.sent} success, ${pushResult.failed} failed`);
                }
              }
            } catch (pushError) {
              console.error(`[Notification] Firebase push error:`, pushError);
            }
          }

          // ALSO try to send SMS if Twilio is configured (optional enhancement)
          if (smsService.isConfigured() && rider.smsConsent) {
            try {
              await smsService.sendSms(rider.phoneNumber, `Bus Buddy: ${message}`);
              console.log(`[Notification] SMS sent to ${rider.phoneNumber}`);

              // Log the SMS notification
              await storage.createNotificationLog({
                organizationId: route.organizationId,
                routeId: session.routeId,
                userId: null,
                recipientPhone: rider.phoneNumber,
                recipientName: rider.name || undefined,
                notificationType: notificationType === 'approaching' ? 'approaching_stop' : 'arrived_at_stop',
                deliveryMethod: 'sms',
                title: undefined,
                message: `Bus Buddy: ${message}`,
                status: 'sent',
              });
            } catch (smsError) {
              console.error(`Failed to send ${notificationType} SMS to ${rider.phoneNumber}:`, smsError);
              // Log failed SMS (but in-app alert was still created)
              await storage.createNotificationLog({
                organizationId: route.organizationId,
                routeId: session.routeId,
                userId: null,
                recipientPhone: rider.phoneNumber,
                recipientName: rider.name || undefined,
                notificationType: notificationType === 'approaching' ? 'approaching_stop' : 'arrived_at_stop',
                deliveryMethod: 'sms',
                title: undefined,
                message: `Bus Buddy: ${message}`,
                status: 'failed',
                errorMessage: smsError instanceof Error ? smsError.message : 'Unknown error',
              });
            }
          }
        }

        // Mark notification as sent ONCE per stop (not per rider) to prevent spam
        if (notificationSent) {
          if (notificationType === 'approaching') {
            await storage.markApproachingNotificationSent(id, stopId);
          } else {
            await storage.markArrivalNotificationSent(id, stopId);
          }
        }
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session location:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/route-sessions/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['pending', 'active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }

      const session = await storage.updateRouteSessionStatus(id, status);
      
      if (!session) {
        return res.status(404).json({ error: "Route session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/route-sessions/active/:routeId", async (req, res) => {
    try {
      const { routeId } = req.params;
      console.log(`[Session] Looking for active session for route: ${routeId}`);
      
      const session = await storage.getActiveRouteSession(routeId);
      
      if (!session) {
        console.log(`[Session] No active session found for route: ${routeId}`);
        return res.status(404).json({ error: "No active session found for this route" });
      }
      
      console.log(`[Session] Found session ${session.id} for route ${routeId}:`, {
        status: session.status,
        lat: session.currentLatitude,
        lng: session.currentLongitude,
        lastUpdate: session.lastLocationUpdate
      });
      
      const stops = await storage.getRouteStopsByRoute(routeId);
      const { status } = calculateBusStatus(session, stops);
      
      console.log(`[Session] Calculated status: ${status} for session ${session.id}`);
      
      res.json({
        ...session,
        calculatedStatus: status
      });
    } catch (error) {
      console.error("Error fetching active session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all active sessions (for admin to see which routes have trips running)
  // NOTE: This route MUST come before /api/route-sessions/:id to avoid matching "all-active" as an ID
  app.get("/api/route-sessions/all-active", authenticateUser, requireRole('org_admin'), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      if (!user.organizationId) {
        return res.status(403).json({ error: "No organization associated with user" });
      }

      // Get all routes for this organization
      const routes = await storage.getRoutesByOrganization(user.organizationId);
      const routeIds = routes.map(r => r.id);

      // Get active sessions for these routes
      const activeSessions: Array<{ routeId: string; sessionId: string; status: string }> = [];
      
      for (const routeId of routeIds) {
        const session = await storage.getActiveRouteSession(routeId);
        if (session) {
          activeSessions.push({
            routeId: session.routeId,
            sessionId: session.id,
            status: session.status
          });
        }
      }

      res.json(activeSessions);
    } catch (error) {
      console.error("Error fetching all active sessions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/route-sessions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getRouteSession(id);
      
      if (!session) {
        return res.status(404).json({ error: "Route session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error fetching route session:", error);
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
      // Convert activeUntil string to Date if present
      const requestData = {
        ...req.body,
        activeUntil: req.body.activeUntil ? new Date(req.body.activeUntil) : null
      };
      
      // Validate client data (without server-controlled fields)
      const clientSchema = insertServiceAlertSchema.omit({ 
        createdByUserId: true, 
        organizationId: true 
      });
      const clientData = clientSchema.parse(requestData);
      
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
      
      // Send SMS notifications to all riders on this route with SMS consent
      try {
        console.log(`📱 Fetching riders for route: ${clientData.routeId}`);
        const riders = await storage.getRidersForRoute(clientData.routeId);
        console.log(`📱 Found ${riders.length} riders:`, riders.map(r => ({ name: r.name, phoneNumber: r.phoneNumber, smsConsent: r.smsConsent })));
        
        const ridersWithSms = riders.filter((rider: any) => rider.smsConsent);
        console.log(`📱 ${ridersWithSms.length} riders have SMS consent`);
        
        // Send SMS to each rider with consent
        for (const rider of ridersWithSms) {
          if (rider.phoneNumber) {
            console.log(`📱 Sending SMS to ${rider.name} (${rider.phoneNumber})...`);
            const result = await smsService.sendServiceAlertNotification(
              rider.phoneNumber,
              route.name,
              clientData.title,
              clientData.message
            );
            console.log(`📱 SMS result for ${rider.name}:`, result);
            
            // Log notification
            try {
              await storage.createNotificationLog({
                organizationId: route.organizationId,
                routeId: clientData.routeId,
                userId: null, // Riders are in rider_profiles, not users table
                recipientName: rider.name,
                recipientPhone: rider.phoneNumber,
                notificationType: "service_alert",
                deliveryMethod: "sms",
                message: `${clientData.title}: ${clientData.message}`,
                status: result.success ? "sent" : "failed",
                errorMessage: result.error || null,
                sentAt: new Date(),
              });
            } catch (logError) {
              console.error("Failed to log notification:", logError);
            }
          }
        }
      } catch (smsError) {
        // Log SMS error but don't fail the request - alert was still created
        console.error("❌ Error sending SMS notifications for service alert:", smsError);
      }

      // Send Firebase push notifications to authenticated riders on this route
      if (isFirebaseReady()) {
        try {
          const routeAssignments = await storage.getRouteAssignmentsByRoute(clientData.routeId);
          const authenticatedRiderUserIds = routeAssignments.map(a => a.userId);
          
          if (authenticatedRiderUserIds.length > 0) {
            const pushResult = await sendServiceAlertPush(
              authenticatedRiderUserIds,
              clientData.type,
              clientData.title,
              clientData.message,
              route.name
            );
            console.log(`[ServiceAlert] Firebase push sent: ${pushResult.totalSent} success, ${pushResult.totalFailed} failed`);
          }
        } catch (pushError) {
          console.error("[ServiceAlert] Firebase push error:", pushError);
        }
      }
      
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
      const { route_id, organization_id } = req.query;
      
      // Support both route_id and organization_id filtering
      if (route_id && typeof route_id === 'string') {
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
        return res.json(alerts);
      }
      
      if (organization_id && typeof organization_id === 'string') {
        const alerts = await storage.getServiceAlertsByOrganization(organization_id);
        return res.json(alerts);
      }
      
      return res.status(400).json({ error: "route_id or organization_id parameter is required" });
    } catch (error) {
      console.error("Error fetching service alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Expire a service alert (admin)
  app.patch("/api/service-alerts/:id/expire", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.expireServiceAlert(id);
      
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error expiring service alert:", error);
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

  // Broadcast alert to all active routes in organization
  app.post("/api/service-alerts/broadcast-all", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { organization_id, type, title, message, severity, activeUntil } = req.body;
      
      // Verify user has access to this organization (unless system admin)
      if (user.role !== "system_admin" && user.organizationId !== organization_id) {
        return res.status(403).json({ error: "You don't have permission to broadcast to this organization" });
      }
      
      if (!organization_id || !type || !title || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get admin user for this organization
      const adminUsers = await storage.getUsersByOrganization(organization_id);
      const adminUser = adminUsers.find(u => u.role === "org_admin");
      
      if (!adminUser) {
        return res.status(500).json({ error: "No admin user found for organization" });
      }

      // Get all active routes for this organization
      const allRoutes = await storage.getRoutesByOrganization(organization_id);
      const activeRoutes = allRoutes.filter(r => !r.archivedAt);

      if (activeRoutes.length === 0) {
        return res.status(400).json({ error: "No active routes found for this organization" });
      }

      const createdAlerts = [];
      let totalNotificationsSent = 0;

      // Create alert for each active route
      for (const route of activeRoutes) {
        const alertData = {
          routeId: route.id,
          organizationId: organization_id,
          type: type as "delayed" | "bus_change" | "cancelled" | "general",
          title,
          message,
          severity: severity as "info" | "warning" | "critical" || "warning",
          createdByUserId: adminUser.id,
          activeFrom: new Date(),
          activeUntil: activeUntil ? new Date(activeUntil) : null,
          isActive: true,
        };

        const alert = await storage.createServiceAlert(alertData);
        createdAlerts.push(alert);

        // Send SMS notifications to riders on this route
        try {
          const riders = await storage.getRidersForRoute(route.id);
          const ridersWithSms = riders.filter((rider: any) => rider.smsConsent);
          
          for (const rider of ridersWithSms) {
            if (rider.phoneNumber) {
              const result = await smsService.sendServiceAlertNotification(
                rider.phoneNumber,
                route.name,
                title,
                message
              );
              
              totalNotificationsSent++;
              
              // Log notification
              try {
                await storage.createNotificationLog({
                  organizationId: organization_id,
                  routeId: route.id,
                  userId: null,
                  recipientName: rider.name,
                  recipientPhone: rider.phoneNumber,
                  notificationType: "service_alert",
                  deliveryMethod: "sms",
                  message: `${title}: ${message}`,
                  status: result.success ? "sent" : "failed",
                  errorMessage: result.error || null,
                  sentAt: new Date(),
                });
              } catch (logError) {
                console.error("Failed to log notification:", logError);
              }
            }
          }
        } catch (smsError) {
          console.error(`Error sending SMS for route ${route.name}:`, smsError);
        }
      }

      res.status(201).json({
        success: true,
        alertsCreated: createdAlerts.length,
        routesNotified: activeRoutes.length,
        notificationsSent: totalNotificationsSent,
        alerts: createdAlerts
      });
    } catch (error) {
      console.error("Error broadcasting alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Notification Logs (Admin only)
  app.get("/api/notification-logs", async (req, res) => {
    try {
      const { organization_id, route_id, notification_type, start_date, end_date, search, limit, offset } = req.query;
      
      if (!organization_id || typeof organization_id !== 'string') {
        return res.status(400).json({ error: "organization_id parameter is required" });
      }

      const params: any = {
        organizationId: organization_id,
      };

      if (route_id && typeof route_id === 'string') {
        params.routeId = route_id;
      }

      if (notification_type && typeof notification_type === 'string') {
        params.notificationType = notification_type;
      }

      if (start_date && typeof start_date === 'string') {
        // Parse ISO timestamp string from frontend (already converted to UTC)
        params.startDate = new Date(start_date);
      }

      if (end_date && typeof end_date === 'string') {
        // Parse ISO timestamp string from frontend (already converted to UTC)
        params.endDate = new Date(end_date);
      }

      if (search && typeof search === 'string') {
        params.searchText = search;
      }

      if (limit && typeof limit === 'string') {
        params.limit = parseInt(limit, 10);
      }

      if (offset && typeof offset === 'string') {
        params.offset = parseInt(offset, 10);
      }

      const logs = await storage.getNotificationLogs(params);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notification-logs/count", async (req, res) => {
    try {
      const { organization_id } = req.query;
      
      if (!organization_id || typeof organization_id !== 'string') {
        return res.status(400).json({ error: "organization_id parameter is required" });
      }

      const count = await storage.getNotificationLogCount(organization_id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification log count:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rider Messages (Riders → Admin)
  // Use optional authentication to capture user ID for logged-in riders
  app.post("/api/rider-messages", optionalAuthenticateUser, async (req, res) => {
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

      // Check if messaging is enabled for this organization
      const org = await storage.getOrganization(route.organizationId);
      if (org && org.messagingEnabled === false) {
        return res.status(403).json({ error: "Communications are disabled for this organization" });
      }
      
      // Get user ID from authenticated session if logged in
      const user = (req as any).user as AuthUser | undefined;
      
      // Build complete message data with server-controlled fields
      const messageData = {
        ...clientData,
        routeId: actualRouteId, // Use resolved route ID
        organizationId: route.organizationId,
        userId: user?.id || null // Capture logged-in user's ID, null for anonymous
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
      
      // Debug: log userId for each message to verify it's being returned
      console.log("[DEBUG] Rider messages userId values:", messages.map(m => ({ id: m.id, userId: m.userId })));
      
      // Prevent HTTP caching for real-time message updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching rider messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/status", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "status is required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateRiderMessageStatus(id, status);
      res.json(message);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/respond", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { adminResponse, respondedByUserId } = req.body;
      
      if (!adminResponse || !respondedByUserId) {
        return res.status(400).json({ error: "adminResponse and respondedByUserId are required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }

      // Check if messaging is enabled for this organization
      const org = await storage.getOrganization(targetMessage.organizationId);
      if (org && org.messagingEnabled === false) {
        return res.status(403).json({ error: "Communications are disabled for this organization" });
      }
      
      const message = await storage.addAdminResponse(id, adminResponse, respondedByUserId);
      res.json(message);
    } catch (error) {
      console.error("Error adding admin response:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/archive", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { archivedByUserId } = req.body;
      
      if (!archivedByUserId) {
        return res.status(400).json({ error: "archivedByUserId is required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Allow access if: admin of the org, system admin, or the rider who created the message
      const isAdmin = user.role === "org_admin" || user.role === "system_admin";
      const isOwner = targetMessage.userId === user.id;
      const sameOrg = targetMessage.organizationId === user.organizationId;
      
      if (!(isOwner || (isAdmin && sameOrg) || user.role === "system_admin")) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.archiveRiderMessage(id, archivedByUserId);
      res.json(message);
    } catch (error) {
      console.error("Error archiving rider message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/restore", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.restoreRiderMessage(id);
      res.json(message);
    } catch (error) {
      console.error("Error restoring rider message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/rider-messages/:id", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Allow access if: admin of the org, system admin, or the rider who created the message
      const isAdmin = user.role === "org_admin" || user.role === "system_admin";
      const isOwner = targetMessage.userId === user.id;
      const sameOrg = targetMessage.organizationId === user.organizationId;
      
      if (!(isOwner || (isAdmin && sameOrg) || user.role === "system_admin")) {
        return res.status(403).json({ error: "You don't have permission to delete this message" });
      }
      
      const success = await storage.deleteRiderMessage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rider message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/mark-read", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateRiderMessageStatus(id, "read");
      res.json(message);
    } catch (error) {
      console.error("Error marking rider message as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rider-messages/:id/priority", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Validate priority using Zod schema
      const prioritySchema = z.object({
        priority: z.enum(['critical', 'high', 'normal'])
      });
      
      const { priority } = prioritySchema.parse(req.body);
      
      // Load the message directly by ID
      const targetMessage = await storage.getRiderMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateRiderMessagePriority(id, priority);
      res.json(message);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid priority value", details: error.errors });
      }
      console.error("Error updating rider message priority:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proximity Alerts API (in-app notifications for riders)
  // Get unread proximity alerts for a rider
  app.get("/api/proximity-alerts/:riderProfileId", async (req, res) => {
    try {
      const { riderProfileId } = req.params;
      const alerts = await storage.getUnreadProximityAlerts(riderProfileId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching proximity alerts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark a single proximity alert as read
  app.patch("/api/proximity-alerts/:alertId/read", async (req, res) => {
    try {
      const { alertId } = req.params;
      const alert = await storage.markProximityAlertAsRead(alertId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error marking proximity alert as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark all proximity alerts as read for a rider
  app.patch("/api/proximity-alerts/:riderProfileId/read-all", async (req, res) => {
    try {
      const { riderProfileId } = req.params;
      await storage.markAllProximityAlertsAsRead(riderProfileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all proximity alerts as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Driver Message Routes (Drivers → Admin)
  app.post("/api/driver-messages", async (req, res) => {
    try {
      const validatedData = insertDriverMessageSchema.parse(req.body);
      
      // Get the driver's actual organization from their user record (trusted source)
      const driver = await storage.getUser(validatedData.driverUserId);
      if (!driver || !driver.organizationId) {
        return res.status(400).json({ error: "Invalid driver" });
      }
      
      // Check if messaging is enabled for the driver's ACTUAL organization (not client-provided)
      const org = await storage.getOrganization(driver.organizationId);
      if (org && org.messagingEnabled === false) {
        return res.status(403).json({ error: "Communications are disabled for this organization" });
      }
      
      // Override organizationId with trusted driver's organization
      const trustedData = { ...validatedData, organizationId: driver.organizationId };
      const message = await storage.createDriverMessage(trustedData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating driver message:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid driver message data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/driver-messages", async (req, res) => {
    try {
      const { route_id, organization_id } = req.query;
      
      let messages;
      if (route_id && typeof route_id === "string") {
        messages = await storage.getDriverMessagesByRoute(route_id);
      } else if (organization_id && typeof organization_id === "string") {
        messages = await storage.getDriverMessagesByOrganization(organization_id);
      } else {
        return res.status(400).json({ error: "route_id or organization_id is required" });
      }
      
      // Prevent HTTP caching for real-time message updates
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching driver messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/status", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "status is required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateDriverMessageStatus(id, status);
      res.json(message);
    } catch (error) {
      console.error("Error updating driver message status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/respond", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { adminResponse, respondedByUserId } = req.body;
      
      if (!adminResponse || !respondedByUserId) {
        return res.status(400).json({ error: "adminResponse and respondedByUserId are required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }

      // Check if messaging is enabled for this organization
      const org = await storage.getOrganization(targetMessage.organizationId);
      if (org && org.messagingEnabled === false) {
        return res.status(403).json({ error: "Communications are disabled for this organization" });
      }
      
      const message = await storage.respondToDriverMessage(id, adminResponse, respondedByUserId);
      
      // Send Firebase push notification to the driver (with rate limiting)
      if (isFirebaseReady() && targetMessage.driverUserId) {
        try {
          const pushResult = await sendAdminMessagePush(
            targetMessage.driverUserId,
            id,
            adminResponse,
            true // this is a response to a driver message
          );
          if (pushResult.rateLimited) {
            console.log(`[PUSH] Driver message response to ${targetMessage.driverUserId} rate-limited (recent notification already sent)`);
          } else {
            console.log(`[PUSH] Driver message response notification sent to ${targetMessage.driverUserId}: ${pushResult.sent} success, ${pushResult.failed} failed`);
          }
        } catch (pushError) {
          console.error("[PUSH] Error sending driver message notification:", pushError);
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error adding admin response to driver message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/mark-read", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateDriverMessageStatus(id, "read");
      res.json(message);
    } catch (error) {
      console.error("Error marking driver message as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/archive", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { archivedByUserId } = req.body;
      
      if (!archivedByUserId) {
        return res.status(400).json({ error: "archivedByUserId is required" });
      }
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Allow access if: admin of the org, system admin, or the driver who created the message
      const isAdmin = user.role === "org_admin" || user.role === "system_admin";
      const isOwner = targetMessage.driverUserId === user.id;
      const sameOrg = targetMessage.organizationId === user.organizationId;
      
      if (!(isOwner || (isAdmin && sameOrg) || user.role === "system_admin")) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.archiveDriverMessage(id, archivedByUserId);
      res.json(message);
    } catch (error) {
      console.error("Error archiving driver message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/restore", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.restoreDriverMessage(id);
      res.json(message);
    } catch (error) {
      console.error("Error restoring driver message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/driver-messages/:id", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Allow access if: admin of the org, system admin, or the driver who created the message
      const isAdmin = user.role === "org_admin" || user.role === "system_admin";
      const isOwner = targetMessage.driverUserId === user.id;
      const sameOrg = targetMessage.organizationId === user.organizationId;
      
      if (!(isOwner || (isAdmin && sameOrg) || user.role === "system_admin")) {
        return res.status(403).json({ error: "You don't have permission to delete this message" });
      }
      
      const success = await storage.deleteDriverMessage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting driver message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/driver-messages/:id/priority", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      
      // Validate priority using Zod schema
      const prioritySchema = z.object({
        priority: z.enum(['critical', 'high', 'normal'])
      });
      
      const { priority } = prioritySchema.parse(req.body);
      
      // Load the message directly by ID
      const targetMessage = await storage.getDriverMessage(id);
      
      if (!targetMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && targetMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      const message = await storage.updateDriverMessagePriority(id, priority);
      res.json(message);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid priority value", details: error.errors });
      }
      console.error("Error updating driver message priority:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Message Forwarding Routes
  // Forward rider message to driver (creates driver message with forwarded content)
  app.post("/api/rider-messages/:id/forward-to-driver", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { forwardedByUserId, additionalNote } = req.body;
      
      if (!forwardedByUserId) {
        return res.status(400).json({ error: "forwardedByUserId is required" });
      }
      
      // Get the original rider message
      const riderMessage = await storage.getRiderMessage(id);
      if (!riderMessage) {
        return res.status(404).json({ error: "Rider message not found" });
      }
      
      // Check if already forwarded
      if (riderMessage.forwardedAt) {
        return res.status(400).json({ 
          error: "Message already forwarded", 
          forwardedAt: riderMessage.forwardedAt 
        });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && riderMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      // Get the route to find driver
      const route = await storage.getRoute(riderMessage.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Get drivers for this route (MVP: use first available driver for the organization)
      const users = await storage.getUsersByOrganization(riderMessage.organizationId);
      const driver = users.find(u => u.role === 'driver');
      
      if (!driver) {
        return res.status(404).json({ error: "No driver found for this route" });
      }
      
      // Create driver message with forwarded content
      const senderName = riderMessage.riderName || riderMessage.riderEmail || "Anonymous Rider";
      let forwardedMessage = `Forwarded from rider ${senderName}: ${riderMessage.message}`;
      if (additionalNote) {
        forwardedMessage += `\n\nAdmin note: ${additionalNote}`;
      }
      
      const driverMessageData = {
        organizationId: riderMessage.organizationId,
        routeId: riderMessage.routeId,
        driverUserId: driver.id,
        type: "general" as const,
        message: forwardedMessage,
      };
      
      const newDriverMessage = await storage.createDriverMessage(driverMessageData);
      
      // Mark the original rider message as forwarded
      await storage.markRiderMessageAsForwarded(id, driver.id, forwardedByUserId);
      
      res.status(201).json({ 
        success: true, 
        driverMessage: newDriverMessage,
        forwardedToDriver: driver.name || driver.email,
        message: "Message forwarded to driver successfully" 
      });
    } catch (error) {
      console.error("Error forwarding rider message to driver:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Broadcast driver message as service alert (visible to all riders on route)
  app.post("/api/driver-messages/:id/broadcast-as-alert", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { id } = req.params;
      const { broadcastByUserId, severity = "warning" } = req.body;
      
      if (!broadcastByUserId) {
        return res.status(400).json({ error: "broadcastByUserId is required" });
      }
      
      // Get the original driver message
      const driverMessage = await storage.getDriverMessage(id);
      if (!driverMessage) {
        return res.status(404).json({ error: "Driver message not found" });
      }
      
      // Verify organization ownership (system admins can access any org)
      if (user.role !== "system_admin" && driverMessage.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to modify this message" });
      }
      
      // Get driver info for attribution
      const driver = await storage.getUser(driverMessage.driverUserId);
      const driverName = driver?.name || "Driver";
      
      // Create service alert with forwarded content
      const alertData = {
        organizationId: driverMessage.organizationId,
        routeId: driverMessage.routeId,
        type: "general" as const,
        title: `Message from ${driverName}`,
        message: `Forwarded from driver ${driverName}: ${driverMessage.message}`,
        severity: severity as "info" | "warning" | "critical",
        createdByUserId: broadcastByUserId,
        activeFrom: new Date(),
        activeUntil: null, // Stays active until manually cleared
        isActive: true,
      };
      
      const alert = await storage.createServiceAlert(alertData);
      
      res.status(201).json({ 
        success: true, 
        alert,
        message: "Driver message broadcasted as alert successfully" 
      });
    } catch (error) {
      console.error("Error broadcasting driver message as alert:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin compose direct message to driver
  app.post("/api/admin-driver-messages", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { driverUserId, routeId, message, type = "general" } = req.body;
      
      if (!driverUserId || !message) {
        return res.status(400).json({ error: "driverUserId and message are required" });
      }
      
      // Verify the driver exists and belongs to the admin's org (or system admin)
      const driver = await storage.getUser(driverUserId);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }
      
      if (user.role !== "system_admin" && driver.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "You don't have permission to message this driver" });
      }

      // Check if messaging is enabled for this organization
      const org = await storage.getOrganization(driver.organizationId!);
      if (org && org.messagingEnabled === false) {
        return res.status(403).json({ error: "Communications are disabled for this organization" });
      }
      
      // If no routeId provided, try to get driver's default route assignment
      let effectiveRouteId = routeId;
      if (!effectiveRouteId) {
        const assignments = await storage.getUserRouteAssignments(driverUserId);
        const defaultAssignment = assignments.find(a => a.isDefault) || assignments[0];
        effectiveRouteId = defaultAssignment?.routeId || null;
      }
      
      // Route is required - reject if we couldn't determine one
      if (!effectiveRouteId) {
        return res.status(400).json({ error: "A route is required. Please select a route or assign one to the driver first." });
      }
      
      // Create driver message on behalf of admin (using driver's ID but with admin content)
      const driverMessageData = {
        organizationId: driver.organizationId!,
        routeId: effectiveRouteId,
        driverUserId,
        type: type as "route_issue" | "vehicle_problem" | "schedule_change" | "general",
        message: `[From Admin] ${message}`,
      };
      
      const newMessage = await storage.createDriverMessage(driverMessageData);
      
      // Send Firebase push notification to the driver (with rate limiting)
      if (isFirebaseReady()) {
        try {
          const pushResult = await sendAdminMessagePush(
            driverUserId,
            newMessage.id,
            message,
            false // not a response, it's a direct message
          );
          if (pushResult.rateLimited) {
            console.log(`[PUSH] Admin direct message to ${driverUserId} rate-limited (recent notification already sent)`);
          } else {
            console.log(`[PUSH] Admin direct message notification sent to ${driverUserId}: ${pushResult.sent} success, ${pushResult.failed} failed`);
          }
        } catch (pushError) {
          console.error("[PUSH] Error sending admin direct message notification:", pushError);
        }
      }
      
      res.status(201).json({ 
        success: true, 
        message: newMessage,
        notification: "Message sent and push notification delivered" 
      });
    } catch (error) {
      console.error("Error sending admin message to driver:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get drivers for an organization (for admin compose dropdown)
  app.get("/api/organization-drivers", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { organization_id } = req.query;
      
      const effectiveOrgId = user.role === "system_admin" && organization_id 
        ? String(organization_id) 
        : user.organizationId;
      
      if (!effectiveOrgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }
      
      // Get all users for the org and filter to drivers
      const allUsers = await storage.getUsersByOrganization(effectiveOrgId);
      const drivers = allUsers.filter(u => u.role === "driver" && u.isActive);
      
      // Get route assignments for each driver
      const driversWithRoutes = await Promise.all(drivers.map(async (d) => {
        const assignments = await storage.getUserRouteAssignments(d.id);
        const defaultAssignment = assignments.find(a => a.isDefault) || assignments[0];
        return {
          id: d.id,
          name: d.name,
          email: d.email,
          phoneNumber: d.phoneNumber,
          defaultRouteId: defaultAssignment?.routeId || null
        };
      }));
      
      res.json(driversWithRoutes);
    } catch (error) {
      console.error("Error fetching organization drivers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get organization settings (including messaging toggle)
  app.get("/api/organization-settings", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { organization_id } = req.query;
      
      const effectiveOrgId = user.role === "system_admin" && organization_id 
        ? String(organization_id) 
        : user.organizationId;
      
      if (!effectiveOrgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }
      
      const org = await storage.getOrganization(effectiveOrgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json({
        id: org.id,
        name: org.name,
        messagingEnabled: org.messagingEnabled ?? true
      });
    } catch (error) {
      console.error("Error fetching organization settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle organization messaging (communications compliance)
  app.patch("/api/organization-settings/messaging", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const user = (req as any).user as AuthUser;
      const { enabled, organization_id } = req.body;
      
      // System admin can target any org, org_admin uses their own
      const effectiveOrgId = user.role === "system_admin" && organization_id 
        ? String(organization_id) 
        : user.organizationId;
      
      if (!effectiveOrgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }
      
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      
      // Update the organization's messaging setting
      await storage.updateOrganization(effectiveOrgId, { messagingEnabled: enabled });
      
      res.json({ success: true, messagingEnabled: enabled });
    } catch (error) {
      console.error("Error updating messaging settings:", error);
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
        // Update existing rider's consent if it has changed
        const consentChanged = existingRider.smsConsent !== validatedData.smsConsent;
        
        if (consentChanged || validatedData.name !== existingRider.name) {
          const updatedProfile = await storage.updateRiderProfile(existingRider.id, {
            name: validatedData.name,
            smsConsent: validatedData.smsConsent,
            smsConsentDate: validatedData.smsConsent ? new Date() : null,
          });
          return res.json(updatedProfile);
        }
        
        return res.json(existingRider); // Return existing profile if no changes
      }
      
      // Automatically set consent date when consent is given for new riders
      const profileData = {
        ...validatedData,
        smsConsentDate: validatedData.smsConsent ? new Date() : null,
      };
      
      const riderProfile = await storage.createRiderProfile(profileData);
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
      
      // Send welcome SMS to the new rider
      try {
        // Get rider profile to get phone number
        const riderProfile = await storage.getRiderProfile(validatedData.riderProfileId);
        // Get route to get route name
        const route = await storage.getRouteById(validatedData.routeId);
        // Get organization to get organization name
        const organization = riderProfile ? await storage.getOrganizationById(riderProfile.organizationId) : null;
        
        // Check SMS consent before sending
        if (riderProfile && route && organization && smsService.isConfigured()) {
          if (riderProfile.smsConsent) {
            const smsResult = await smsService.sendWelcomeMessage(
              riderProfile.phoneNumber,
              route.name,
              organization.name
            );
            
            if (!smsResult.success) {
              console.error("Failed to send welcome SMS:", smsResult.error);
            } else {
              console.log("Welcome SMS sent successfully:", smsResult.messageId);
            }
            
            // Log notification
            try {
              await storage.createNotificationLog({
                organizationId: route.organizationId,
                routeId: route.id,
                userId: null, // Riders are in rider_profiles, not users table
                recipientName: riderProfile.name,
                recipientPhone: riderProfile.phoneNumber,
                notificationType: "welcome",
                deliveryMethod: "sms",
                message: `Welcome to ${organization.name}! You're now subscribed to notifications for the ${route.name} route.`,
                status: smsResult.success ? "sent" : "failed",
                errorMessage: smsResult.error || null,
                sentAt: new Date(),
              });
            } catch (logError) {
              console.error("Failed to log notification:", logError);
            }
          } else {
            console.log("SMS not sent - rider has not given SMS consent");
          }
        } else {
          console.log("SMS not sent - missing data or SMS not configured");
        }
      } catch (smsError) {
        console.error("Error sending welcome SMS:", smsError);
        // Don't fail the subscription if SMS fails
      }
      
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

  // Route Rider Management Routes
  app.get("/api/routes/:routeId/riders", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { routeId } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route belongs to user's organization (unless system admin)
      if (user.role !== "system_admin") {
        const route = await storage.getRoute(routeId);
        if (!route) {
          return res.status(404).json({ error: "Route not found" });
        }
        if (route.organizationId !== user.organizationId) {
          return res.status(403).json({ error: "Access to this route denied" });
        }
      }
      
      console.log("Fetching riders for route:", routeId);
      const riders = await storage.getRidersForRoute(routeId);
      console.log("Found riders:", riders.length, riders);
      res.json(riders);
    } catch (error) {
      console.error("Error fetching riders for route:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Route Driver Management Routes
  app.get("/api/routes/:routeId/drivers", authenticateUser, requireRole("org_admin", "system_admin"), async (req, res) => {
    try {
      const { routeId } = req.params;
      const user = (req as any).user as AuthUser;
      
      // Verify route belongs to user's organization (unless system admin)
      if (user.role !== "system_admin") {
        const route = await storage.getRoute(routeId);
        if (!route) {
          return res.status(404).json({ error: "Route not found" });
        }
        if (route.organizationId !== user.organizationId) {
          return res.status(403).json({ error: "Access to this route denied" });
        }
      }
      
      const drivers = await storage.getDriversForRoute(routeId);
      res.json(drivers);
    } catch (error) {
      console.error("Error fetching drivers for route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/routes/:routeId/riders/:riderProfileId", async (req, res) => {
    try {
      const { routeId, riderProfileId } = req.params;
      
      const result = await storage.deleteRiderFromRoute(riderProfileId, routeId);
      
      if (!result.success) {
        return res.status(404).json({ error: "Rider subscription not found" });
      }

      // Send deletion SMS if we have the rider info, SMS is configured, and rider has consent
      if (result.riderProfile && result.deletedSubscription && smsService.isConfigured()) {
        try {
          if (result.riderProfile.smsConsent) {
            const route = await storage.getRouteById(routeId);
            const organization = await storage.getOrganizationById(result.riderProfile.organizationId);
            
            if (route && organization) {
              const smsResult = await smsService.sendRiderRemovedMessage(
                result.riderProfile.phoneNumber,
                route.name,
                organization.name,
                result.riderProfile.name
              );
              
              if (!smsResult.success) {
                console.error("Failed to send deletion SMS:", smsResult.error);
              } else {
                console.log("Deletion SMS sent successfully:", smsResult.messageId);
              }
              
              // Log notification
              try {
                const firstName = result.riderProfile.name ? result.riderProfile.name.trim().split(' ')[0] : '';
                const greeting = firstName ? `Hey ${firstName}, ` : '';
                
                await storage.createNotificationLog({
                  organizationId: route.organizationId,
                  routeId: route.id,
                  userId: null, // Riders are in rider_profiles, not users table
                  recipientName: result.riderProfile.name,
                  recipientPhone: result.riderProfile.phoneNumber,
                  notificationType: "rider_removed",
                  deliveryMethod: "sms",
                  message: `${greeting}just to let you know - you're no longer receiving notifications for the ${route.name} route.`,
                  status: smsResult.success ? "sent" : "failed",
                  errorMessage: smsResult.error || null,
                  sentAt: new Date(),
                });
              } catch (logError) {
                console.error("Failed to log notification:", logError);
              }
            }
          } else {
            console.log("Deletion SMS not sent - rider has not given SMS consent");
          }
        } catch (smsError) {
          console.error("Error sending deletion SMS:", smsError);
          // Don't fail the deletion if SMS fails
        }
      }

      res.json({ 
        message: "Rider removed successfully",
        deletedSubscription: result.deletedSubscription 
      });
    } catch (error) {
      console.error("Error deleting rider from route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Twilio webhook for incoming SMS (STOP keyword handling)
  app.post("/api/twilio/sms-webhook", async (req, res) => {
    try {
      // Twilio sends data as application/x-www-form-urlencoded
      const { From: fromPhone, Body: messageBody } = req.body;
      
      if (!fromPhone || !messageBody) {
        console.error("Twilio webhook missing required fields");
        return res.status(400).send("Missing required fields");
      }

      console.log(`Incoming SMS from ${fromPhone}: ${messageBody}`);

      // Check if message is a TCPA-compliant opt-out keyword (case-insensitive)
      // Supported keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
      const normalizedMessage = messageBody.trim().toUpperCase();
      const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
      if (optOutKeywords.includes(normalizedMessage)) {
        // Format phone number to match database format (remove non-digits and leading 1)
        let cleanPhone = fromPhone.replace(/\D/g, '');
        // Remove leading 1 (country code) if present (for US/Canada numbers)
        if (cleanPhone.startsWith('1')) {
          cleanPhone = cleanPhone.substring(1);
        }
        
        // Try to find rider across all organizations
        const organizations = await storage.getAllOrganizations();
        let riderFound = false;
        let wasOptedIn = false;
        
        for (const org of organizations) {
          const rider = await storage.getRiderProfileByPhone(cleanPhone, org.id);
          
          if (rider) {
            riderFound = true;
            
            // Only update and send confirmation if they were opted in
            if (rider.smsConsent) {
              wasOptedIn = true;
              await storage.updateRiderProfile(rider.id, {
                smsConsent: false,
                smsConsentDate: null
              });
              
              console.log(`Rider ${rider.id} opted out of SMS via STOP keyword`);
              
              // Send confirmation message
              if (smsService.isConfigured()) {
                const confirmResult = await smsService.sendSms(
                  fromPhone,
                  `You've been unsubscribed from Bus Buddy SMS notifications. You will no longer receive text alerts.`
                );
                
                if (confirmResult.success) {
                  console.log("STOP confirmation sent successfully");
                } else {
                  console.error("Failed to send STOP confirmation:", confirmResult.error);
                }
              }
              
              break; // Found and processed, stop searching
            }
          }
        }
        
        if (!riderFound) {
          console.log(`STOP received from unknown number: ${fromPhone}`);
        } else if (!wasOptedIn) {
          console.log(`STOP received from ${fromPhone} but already opted out - no action taken`);
        }
      }
      
      // Respond to Twilio with empty TwiML (required for webhook)
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Temporary debug endpoint to test SMS configuration
  app.get("/api/debug/sms-config", async (req, res) => {
    const isConfigured = smsService.isConfigured();
    res.json({
      isConfigured,
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      twilioAccountSidLength: process.env.TWILIO_ACCOUNT_SID?.length || 0,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || 'not set',
    });
  });

  // Temporary debug endpoint to test SMS sending
  app.post("/api/debug/test-sms", async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "phone and message are required" });
    }
    
    console.log("Debug SMS test starting...");
    const result = await smsService.sendSms(phone, message);
    console.log("Debug SMS test result:", result);
    res.json(result);
  });

  // Push Notification Routes
  app.post("/api/push-tokens", authenticateUser, async (req, res) => {
    try {
      // Validate request body with Zod schema
      const validatedData = insertPushTokenSchema.parse(req.body);
      
      // Verify user is registering their own token
      const authUser = (req as any).user as AuthUser;
      if (authUser.id !== validatedData.userId) {
        return res.status(403).json({ error: "Cannot register token for another user" });
      }
      
      const pushToken = await storage.registerPushToken(validatedData);
      
      res.status(201).json(pushToken);
    } catch (error) {
      console.error("Error registering push token:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid push token data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test push notification endpoint (for debugging)
  app.post("/api/test-push", async (req, res) => {
    try {
      const { userId, title, body } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      const { sendPushToUser, isFirebaseReady } = await import("./firebase-push");
      
      if (!isFirebaseReady()) {
        return res.status(500).json({ error: "Firebase not initialized" });
      }
      
      const result = await sendPushToUser(
        userId,
        title || "🚌 Test Notification",
        body || "This is a test push notification from Bus Buddy!",
        { type: "test" }
      );
      
      console.log(`[Test Push] Sent to user ${userId}: ${result.sent} success, ${result.failed} failed`);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error sending test push:", error);
      res.status(500).json({ error: "Failed to send test push" });
    }
  });

  // ==================== PUBLIC WEBSITE ROUTES ====================
  
  // Contact form submission (public - no auth required)
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required" });
      }
      
      const contactMessage = await storage.createContactMessage({
        name,
        email,
        subject: subject || null,
        message,
      });
      
      console.log(`New contact form submission from ${email}`);
      res.status(201).json({ success: true, id: contactMessage.id });
    } catch (error) {
      console.error("Error creating contact message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Organization inquiry submission (public - no auth required)
  app.post("/api/organization-inquiries", async (req, res) => {
    try {
      const { organizationName, organizationType, contactName, contactEmail, contactPhone, estimatedFleetSize, message } = req.body;
      
      if (!organizationName || !organizationType || !contactName || !contactEmail) {
        return res.status(400).json({ error: "Organization name, type, contact name, and email are required" });
      }
      
      const inquiry = await storage.createOrganizationInquiry({
        organizationName,
        organizationType,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        estimatedFleetSize: estimatedFleetSize || null,
        message: message || null,
      });
      
      console.log(`New organization inquiry from ${contactEmail} for ${organizationName}`);
      res.status(201).json({ success: true, id: inquiry.id });
    } catch (error) {
      console.error("Error creating organization inquiry:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get all organization inquiries (system admin only)
  app.get("/api/system/inquiries", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const inquiries = await storage.getOrganizationInquiries();
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching organization inquiries:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Update organization inquiry status (system admin only)
  app.patch("/api/system/inquiries/:id", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const user = (req as any).user as AuthUser;
      
      const inquiry = await storage.updateOrganizationInquiry(id, {
        status,
        notes,
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
      });
      
      res.json(inquiry);
    } catch (error) {
      console.error("Error updating organization inquiry:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get all contact messages (system admin only)
  app.get("/api/system/contact-messages", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Mark contact message as read (system admin only)
  app.patch("/api/system/contact-messages/:id/read", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const message = await storage.markContactMessageRead(id);
      res.json(message);
    } catch (error) {
      console.error("Error marking contact message as read:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test SendGrid email (system admin only)
  app.post("/api/system/test-email", authenticateUser, requireRole("system_admin"), async (req, res) => {
    try {
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ error: "Email address required" });
      }
      
      const { sendWelcomeEmail } = await import("./email");
      const result = await sendWelcomeEmail(to, "Test User", "Test Route");
      
      if (result) {
        res.json({ success: true, message: `Test email sent to ${to}` });
      } else {
        res.status(500).json({ error: "Failed to send email - check server logs for details" });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: error.message || "Failed to send test email" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
