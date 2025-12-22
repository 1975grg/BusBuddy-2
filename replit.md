# Bus Buddy

## Overview
Bus Buddy is a real-time bus and shuttle tracking platform designed for institutions such as schools, hospitals, airports, and hotels. It provides a comprehensive solution for administrators to manage routes and vehicles, enables drivers to operate trips efficiently, and allows riders to track buses live. The platform supports multi-organizational deployment with customizable branding and access controls, aiming to enhance the efficiency and safety of institutional transportation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite build tool).
- **UI**: shadcn/ui component system with Radix UI primitives, styled with Tailwind CSS (dark/light modes, organization branding).
- **State Management**: TanStack Query for server state and caching.
- **Routing**: Wouter for client-side routing.
- **Design**: Mobile-first, responsive layouts.

### Backend
- **Server**: Express.js with TypeScript (ESM format).
- **Database ORM**: Drizzle ORM for type-safe operations.
- **Session Management**: Express sessions with PostgreSQL store.
- **API**: RESTful endpoints with structured error handling.
- **Real-time**: Prepared for WebSocket integration for live GPS tracking.

### Data Storage
- **Primary Database**: PostgreSQL via Neon serverless hosting.
- **Schema Management**: Drizzle push-based workflow (`npm run db:push`).
  - Fresh environments must run `npm run db:push` to sync schema
  - Password expiration feature requires users.password_expires_at column
- **Strategy**: Multi-tenant architecture for organization isolation.

### Authentication & Authorization
- **Authentication**: Dual authentication strategy:
  - **Web**: HttpOnly cookie sessions (90-day expiry, secure, auto-refresh)
  - **Native Apps**: Bearer tokens stored in Capacitor Preferences for persistence across app restarts
- **Platform Detection**: Automatic via `Capacitor.isNativePlatform()` - web never stores tokens in localStorage (XSS protection)
- **Access Control**: Role-based (Admin, Driver, Rider).
- **Login Methods**: Password login (primary) and magic links (fallback).
- **Rider Onboarding**: QR codes, magic links, password-based access.
- **Test Accounts**: Westwood Academy admin/driver use password `busbuddy123`.
- **Password Expiration**: Automatic expiration system with role-based policies:
  - **Riders**: Passwords expire automatically on July 1st every year (end of school year)
  - **Drivers & Admins**: Never expire unless manually revoked
  - **Bulk Renewal**: Admins can renew all rider passwords in one click
  - **Login Enforcement**: Expired riders cannot log in and receive redirection to request new access
- **Security**: Token revocation, access reset, role detection via URL paths, password expiration enforcement. Server-side message filtering is a required production enhancement.

### Key Design Patterns
- **Multi-organization Support**: Tenant isolation and customizable branding.
- **Mobile-first**: Touch-optimized interfaces.
- **Real-time Updates**: Live GPS tracking with offline caching.
- **Geofencing**: Automatic stop advancement using location triggers.
- **Component-driven Development**: Reusable UI components.
- **TCPA Compliance**: SMS consent tracking with opt-out keyword support.

### Features
- **Professional Landing Page**: Multi-portal landing experience with three clear entry points (Parents/Students, Drivers, Admins), brand messaging, feature highlights, and role-appropriate CTAs. Designed for first-time visitors and unauthenticated users.
- **SMS Notifications & TCPA Compliance**: Opt-in/opt-out system with consent tracking, standard opt-out keywords (STOP, UNSUBSCRIBE), Twilio webhook processing, and welcome messages.
- **Bidirectional Messaging System**: Allows Riders ↔ Admin and Drivers ↔ Admin communication with real-time updates (polling), message attribution, and a unified Support Center for administrators to manage messages and send broadcast alerts.
- **Rider Experience & Notifications**: Riders are assigned to a single route post-onboarding, with notifications for route start, approaching/arrived at home stop (geofenced), and service alerts.
- **Route Management & Archival**: Soft-delete architecture for routes via an `archivedAt` timestamp. Archiving a route automatically revokes assignments, deactivates subscriptions, alerts, and stops, ensuring data integrity through transactional operations.
- **Admin Dashboard**: Streamlined dashboard with key metrics (Active Routes, Support Requests) and action cards for Routes, Access, and Support management. Simplified sidebar navigation.
- **Annual Password Expiration**: Automated rider password expiration on July 1st with bulk renewal tools for administrators, ensuring school-year-aligned access control.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL.
- **SMS Service**: Twilio (for TCPA-compliant SMS notifications).
- **Email Service**: SendGrid (for transactional emails).
- **Maps & Geolocation**: Browser Geolocation API, MapLibre (planned).
- **Session Storage**: PostgreSQL.

### Development Tools
- **Build System**: Vite (React, TypeScript).
- **Development Environment**: Replit tooling.
- **Code Quality**: TypeScript strict mode.

### UI & Styling
- **Component Library**: Radix UI.
- **Styling Framework**: Tailwind CSS.
- **Icons**: Lucide React.
- **Fonts**: Inter (Google Fonts).

### Utility Libraries
- **Form Handling**: React Hook Form with Zod.
- **Date/Time**: date-fns.
- **QR Code Generation**: react-qr-code.
- **Class Management**: clsx, tailwind-merge.

## Deployment

### Production Environment
- **Production URL**: https://bus-buddy-v-3-user-interface-1975grg.replit.app
- **Deployment Type**: Autoscale (1 vCPU / 0.5 GiB RAM / 1 Max)
- **Status**: Live 24/7
- **Deployed**: November 25, 2025

### iOS App (TestFlight)
- **Bundle ID**: com.bytevia.busbuddy
- **App Name**: Bus Buddy (listed as "BusBuddy Hub" in App Store Connect)
- **TestFlight Link**: https://testflight.apple.com/join/befk86Cg
- **Current Build**: 2.0 (5)
- **Build 4 Status**: Rejected (server was sleeping during review)
- **Build 5 Fix**: Updated to use production URL for 24/7 availability
- **GPS Tracking**: Working - drivers can share location, riders can follow bus on map

### Android App (Google Play Internal Testing)
- **Package ID**: com.bytevia.busbuddy
- **App Name**: Bus Buddy (temporary name until reviewed)
- **Testing Link**: https://play.google.com/apps/internaltest/4701505178777042651
- **Current Release**: 3 (1.2)
- **Released**: December 13, 2025
- **Internal Testers**: 5 registered
- **Status**: Available to internal testers
- **How to Test**: Add tester's email to Internal Testers list → Share testing link → They accept and install from Play Store

### Admin Onboarding Flow
- **System Admin Dashboard**: `/system` - Create organizations and admins
- **Temp Password**: When creating an org admin, system generates a temporary password
- **First Login**: Admin logs in with temp password → redirected to set their own password
- **Test Password**: For Westwood Academy test accounts, use `busbuddy123`

### Recent Bug Fixes (November 27, 2025)
- **Proximity Notifications**: Fixed bug where ALL riders got notifications instead of only those who selected the stop as their home stop
- **SMS Type Error**: Fixed `to.startsWith is not a function` error by adding defensive string conversion for phone numbers
- **In-App Proximity Alerts**: Added new `proximity_alerts` table and API endpoints for in-app notifications. Riders now receive toast notifications when their bus is approaching or arriving at their selected stop, even without SMS configured. Alerts are stored in the database and marked as read after being shown.

### New Features (November 28, 2025)
- **Service Alert Toast Notifications**: Service alerts from admins (delays, cancellations, route changes) now appear as toast notifications with sound, similar to proximity alerts. They display for 15 seconds and work on both web and iOS.
- **Message Management for Riders/Drivers**: Riders and drivers can now archive or delete their own messages from the message history. Previously only admins could manage messages.
- **Enhanced Forward-to-Driver Workflow**: Admins now see a confirmation dialog when forwarding rider messages to drivers, with the ability to add an optional note. Messages that have already been forwarded display an "Already Forwarded" badge to prevent duplicate forwards. The UI clearly separates "Reply to Parent/Student" from "Forward to Driver" actions with labeled sections and explanatory text.
- **Simplified Driver Experience**: Removed sidebar navigation for drivers. Drivers now see a full-screen single-page dashboard with route selection, trip controls (start/stop/GPS), live map, and messaging - no need to navigate anywhere.

### System Admin Features (December 6, 2025)
- **System Admin Dashboard**: Dedicated dashboard at `/system` for system administrators to manage all organizations.
- **Organization Viewing Mode**: System admins can "Enter as Admin" to view any organization's dashboard, routes, access management, and support center in read-only mode. A blue banner indicates read-only viewing with a "Back to System Dashboard" link.
- **Read-Only Viewing**: When viewing an organization, system admins see all data but cannot modify anything. Action buttons (Add Route, Add Driver, Remove Rider, etc.) are hidden.
- **Pages with Read-Only Support**: AdminDashboardPage, RoutesPage, AccessManagementPage, and SupportCenterPage all support the viewingOrgId context for system admin read-only viewing.

### Driver GPS Enhancements (December 6, 2025)
- **Screen Wake Lock**: When a driver starts a trip, the screen automatically stays awake to prevent GPS tracking interruption from phone sleep. Uses the Web Wake Lock API.
- **Smart Auto-Off**: Wake lock automatically releases after 30 minutes of no movement (bus stationary) to conserve battery. Threshold is 50 meters of movement required to reset the timer.
- **Movement Re-Activation**: If the bus starts moving again after being stationary for 30 minutes, wake lock automatically re-engages.
- **Visual Status Indicator**: Driver dashboard shows wake lock status (On/Auto-off/Not Supported/Off) with explanatory text.
- **Technical Note**: This is a short-term MVP solution. Long-term solution is Cube hardware integration for buses which will provide GPS independently of driver phones.

### iOS Push Notifications Fix (December 22, 2025)
- **Root Cause**: Dynamic import of `@capacitor-firebase/messaging` was hanging indefinitely because Vite treats Capacitor plugins as external dependencies and doesn't bundle them.
- **Solution**: Replaced dynamic import with `registerPlugin` from `@capacitor/core` at module scope to ensure the plugin is properly registered.
- **Foreground Notifications**: AppDelegate.swift already had `userNotificationCenter(_:willPresent:)` configured with `.banner, .sound, .badge` to show notifications when app is open.
- **Sound**: Push notifications include `sound: 'default'` in the APNs payload for iOS notification sounds.
- **Status**: Push notifications now work in both foreground and background on iOS with sound.
- **Rebuild Required**: After downloading the ios folder, run `pod install` in ios/App, then build from Xcode.