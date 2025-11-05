# Multi-Role Authentication System - Implementation Guide

## Overview

A complete authentication and authorization system has been implemented for the bus tracking application with support for four user roles: System Admin, Organization Admin, Driver, and Rider.

## Architecture

### Database Schema

**New Tables:**
1. `invite_tokens` - Magic link tokens for passwordless authentication and user invitations
2. `user_route_assignments` - Multi-route access management for drivers and riders

**Updated Tables:**
1. `users` table now includes:
   - `phoneNumber` - For SMS-based magic links
   - `sessionToken` - 90-day persistent session
   - `sessionExpiresAt` - Session expiration timestamp
   - `defaultRouteId` - Default route for multi-route users

### Backend Components

#### Authentication Middleware (`server/auth.ts`)
- `authenticateUser` - Verifies session from HTTP-only cookie
- `requireRole(...roles)` - Restricts access to specific roles
- `requireOrganization()` - Ensures org-scoped access
- `requireRouteAccess()` - Validates route-specific permissions
- `optionalAuth` - Non-blocking authentication check

#### API Routes (`server/routes.ts`)

**Authentication Endpoints:**
- `GET /api/me` - Get current authenticated user
- `POST /api/auth/magic-link/request` - Request passwordless login link
- `POST /api/auth/magic-link/verify` - Verify token and create session
- `POST /api/auth/logout` - End session

**Invite Management (Org Admins Only):**
- `POST /api/invites` - Create invite for driver/rider with QR code
- `GET /api/invites` - List active invites for organization
- `DELETE /api/invites/:id` - Revoke/expire invite

**Route Assignment Management:**
- `GET /api/route-assignments/:userId` - Get user's route assignments
- `POST /api/route-assignments` - Assign user to route (org admins)
- `PUT /api/route-assignments/:userId/default` - Set default route
- `DELETE /api/route-assignments/:id` - Revoke route access

### Frontend Components

#### User Context (`client/src/contexts/UserContext.tsx`)
- `UserProvider` - Global authentication state
- `useUser()` - Access current user data
- `useRequireAuth()` - Enforce authentication
- `useRequireRole(...roles)` - Enforce role-based access

#### Login Page (`client/src/pages/LoginPage.tsx`)
- Email or phone-based magic link request
- Token verification from URL parameters
- Role-based redirection after login

## User Roles & Access Control

### System Admin
- **Access**: Everything across all organizations
- **Restrictions**: No in-app notifications
- **Primary Use**: Manage organizations, oversee system

### Organization Admin
- **Access**: Everything within their organization
- **Capabilities**: 
  - Create and manage routes
  - Invite drivers and riders
  - Send targeted alerts (org-wide, role-specific, route-specific)
  - Revoke access
- **Notifications**: Receives all org notifications

### Driver
- **Access**: Only assigned routes
- **Capabilities**:
  - View and control assigned route sessions
  - Receive route-specific notifications
  - Message organization admins
- **Multi-Route**: Can be assigned to multiple routes
- **Authentication**: Magic link (email/SMS) or QR code

### Rider
- **Access**: Only assigned routes
- **Capabilities**:
  - Track buses on assigned routes
  - Receive route-specific notifications
  - Message organization admins
- **Multi-Route Support**: 
  - Can have multiple routes (e.g., different children, multiple addresses)
  - Set default route for quick access
  - Switch between routes in UI
- **Authentication**: Magic link (email/SMS) or QR code

## Authentication Flow

### 1. Invitation Flow (Org Admin → Driver/Rider)

```
Org Admin → Creates invite via /api/invites
           ↓
System generates:
  - Unique token
  - Magic link
  - QR code
           ↓
User receives invitation (email/SMS)
           ↓
User clicks link or scans QR
           ↓
System creates account (if new user)
System creates route assignment
System creates 90-day session
           ↓
User is logged in and redirected to their dashboard
```

### 2. Magic Link Login Flow (Existing Users)

```
User → Enters email/phone on /login
      ↓
System → Generates temporary token (15 min expiry)
        Sends magic link
      ↓
User → Clicks link
      ↓
System → Validates token (not expired/claimed/revoked)
        Creates session
        Sets HTTP-only cookie
      ↓
User is logged in
```

### 3. Session Management

- **Duration**: 90 days
- **Storage**: HTTP-only cookie (secure, prevents XSS)
- **Auto-renewal**: No (session expires after 90 days)
- **Revocation**: Org admins can revoke access (clears session)

## Security Features

### Implemented
1. ✅ HTTP-only cookies (prevents JavaScript access to session tokens)
2. ✅ Token expiration validation (magic links expire in 15 minutes)
3. ✅ One-time token usage (tokens can't be replayed)
4. ✅ Token revocation (admins can disable tokens)
5. ✅ Organization-scoped data access (no cross-org leaks)
6. ✅ Route-scoped data access (users only see assigned routes)
7. ✅ Session expiration (90-day maximum)
8. ✅ Role-based access control (RBAC)

### Best Practices
- Session tokens are 256-bit random hex strings
- Passwords are never stored (passwordless authentication)
- Invite tokens have explicit expiration
- Database queries always filter by organizationId/routeId
- Auth middleware validates every protected request

## Multi-Route User Management

### For Riders
Riders can have multiple route assignments (common scenarios):
- Parent with multiple children on different routes
- Households with different pickup/dropoff addresses
- Complex transportation needs

**API Usage:**
```typescript
// Get rider's routes
GET /api/route-assignments/:userId

// Set default route (for quick access)
PUT /api/route-assignments/:userId/default
Body: { routeId: "route-id" }

// Assign new route
POST /api/route-assignments
Body: { userId, routeId, isDefault }

// Revoke route access
DELETE /api/route-assignments/:assignmentId
```

### For Drivers
Drivers can be assigned to multiple routes (shift coverage, backup drivers).

## Development Testing

### Current State
- ✅ RoleToggle component available for development/testing
- ✅ Login page at `/login`
- ✅ Magic links shown in toast notifications (development mode)
- ⏳ Protected routes (can be added using `useRequireAuth()` or `useRequireRole()`)

### Creating Test Users

You'll need to create seed data with users for each role. Example:

```typescript
// System Admin
await storage.createUser({
  email: "admin@system.com",
  name: "System Admin",
  role: "system_admin",
});

// Org Admin
const org = await storage.createOrganization({
  name: "Test School District",
  type: "school",
});

const orgAdmin = await storage.createUser({
  email: "admin@school.com",
  name: "School Admin",
  role: "org_admin",
  organizationId: org.id,
});

// Driver
const driver = await storage.createUser({
  email: "driver@school.com",
  phoneNumber: "+1234567890",
  name: "Bus Driver",
  role: "driver",
  organizationId: org.id,
});

// Rider
const rider = await storage.createUser({
  email: "parent@email.com",
  phoneNumber: "+1987654321",
  name: "Parent",
  role: "rider",
  organizationId: org.id,
});
```

## What's Implemented

### ✅ Complete
1. Database schema with authentication tables
2. Session management (90-day cookies)
3. Magic link authentication
4. Invite system with QR codes
5. Role-based access control middleware
6. Multi-route assignment system
7. User context provider (React)
8. Login page with magic link flow
9. API endpoints for auth, invites, route assignments
10. Organization and route scoping
11. Security: HTTP-only cookies, token validation, access control

### ⏳ Needs Implementation
1. **Protected Routes**: Wrap routes with `useRequireAuth()` or `useRequireRole()`
2. **Notification Scoping**: Filter notifications by route assignments
3. **Cross-Org Admin Messaging**: Allow org admins to message each other
4. **Seed Script**: Create development test users
5. **UI Updates**: Remove RoleToggle in production, add logout button
6. **Email/SMS Integration**: Send actual magic links via SendGrid/Twilio

## Next Steps

### Priority 1: Testing & Validation
1. Create seed script with test users for each role
2. Test complete auth flow (invite → login → session → logout)
3. Verify role-based access controls work correctly
4. Test multi-route rider scenarios
5. Validate session expiration and revocation

### Priority 2: UI Polish
1. Add protected route wrappers to pages
2. Create user menu with logout button
3. Remove RoleToggle from production builds
4. Add unauthorized/forbidden error pages
5. Improve invite management UI

### Priority 3: Notifications
1. Update notification system to check route assignments
2. Filter alerts based on user's assigned routes
3. Stop notifications when route access is revoked
4. Exclude system admin from routine in-app notifications

### Priority 4: Production Readiness
1. Set up SendGrid for magic link emails
2. Set up Twilio for SMS magic links
3. Enable secure cookies in production
4. Add rate limiting to auth endpoints
5. Set up proper error logging
6. Add session analytics

## Troubleshooting

### Issue: `/api/me` returns 401
- Cause: Session cookie not being sent with requests
- Solution: Check that cookie-parser middleware is initialized
- Verify: Inspect cookies in browser DevTools

### Issue: Magic link doesn't work
- Check: Token hasn't expired (15 minute window)
- Check: Token hasn't been claimed already
- Check: Token is still active (not revoked)
- Debug: Check server logs for validation errors

### Issue: User can access wrong organization's data
- Cause: Missing organization scope in query
- Solution: Always filter by `req.user.organizationId` for org admins
- Solution: Use `requireOrganization()` middleware

### Issue: Rider can't see multiple routes
- Cause: Missing route assignments
- Solution: Create assignments via `/api/route-assignments`
- Verify: Check `user_route_assignments` table

## Code Examples

### Protecting a Route
```typescript
// In your page component
import { useRequireRole } from "@/contexts/UserContext";

export default function AdminOnlyPage() {
  const { user, isLoading } = useRequireRole("org_admin", "system_admin");
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>Admin Content for {user.name}</div>;
}
```

### Creating an Invite
```typescript
const response = await apiRequest("POST", "/api/invites", {
  email: "newdriver@school.com",
  role: "driver",
  routeId: "route-id-here", // Optional
});

// Response includes:
// - invite.id
// - inviteLink (send to user)
// - qrCode (base64 PNG)
```

### Managing Route Assignments
```typescript
// Assign rider to multiple routes
await apiRequest("POST", "/api/route-assignments", {
  userId: riderId,
  routeId: route1Id,
  isDefault: true,
});

await apiRequest("POST", "/api/route-assignments", {
  userId: riderId,
  routeId: route2Id,
  isDefault: false,
});

// Later, change default route
await apiRequest("PUT", `/api/route-assignments/${riderId}/default`, {
  routeId: route2Id,
});
```

## Files Modified/Created

### Backend
- `shared/schema.ts` - Added auth tables and fields
- `server/storage.ts` - Added auth CRUD methods
- `server/auth.ts` - **NEW** - Auth middleware and utilities
- `server/routes.ts` - Added auth API routes
- `server/index.ts` - Added cookie-parser middleware

### Frontend
- `client/src/contexts/UserContext.tsx` - **NEW** - User context provider
- `client/src/pages/LoginPage.tsx` - **NEW** - Login UI
- `client/src/App.tsx` - Added UserProvider, login routes

## Support

For questions or issues:
1. Check server logs for detailed error messages
2. Inspect browser console for frontend errors
3. Verify database schema with `npm run db:push`
4. Test API endpoints directly with curl/Postman
5. Review this guide for configuration examples
