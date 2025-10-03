# Bus Buddy

## Overview

Bus Buddy is a real-time bus and shuttle tracking platform designed for schools, hospitals, airports, hotels, and other institutions. The system provides a comprehensive solution for administrators to manage routes and vehicles, drivers to operate trips with minimal interaction, and riders to track buses live. The platform supports multi-organization deployment with customizable branding and access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Library**: Comprehensive shadcn/ui component system with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system supporting dark/light modes and organization branding
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Mobile-First Design**: Responsive layouts optimized for mobile devices with touch-friendly interfaces

### Backend Architecture
- **Server**: Express.js with TypeScript in ESM format
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful endpoints with structured error handling and request logging
- **Real-time Features**: Prepared for WebSocket integration for live GPS tracking

### Data Storage
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle migrations for version-controlled database changes
- **Storage Strategy**: Multi-tenant architecture supporting organization isolation

### Authentication & Authorization
- **Session-based Authentication**: Secure session management with database persistence
- **Role-based Access Control**: Three primary user roles (Admin, Driver, Rider) with different permission levels
- **Access Methods**: QR codes, magic links, and password-based access for flexible rider onboarding
- **Token Management**: Device token revocation and access reset capabilities

### Key Design Patterns
- **Multi-organization Support**: Complete tenant isolation with customizable branding per organization
- **Mobile-first Approach**: Touch-optimized interfaces with generous tap targets and bottom navigation
- **Real-time Updates**: Live GPS tracking with offline caching and data backfill capabilities
- **Geofencing Integration**: Automatic stop advancement using location-based triggers
- **Component-driven Development**: Reusable UI components with consistent design system
- **TCPA Compliance**: SMS consent tracking with opt-out keyword support (STOP, UNSUBSCRIBE, etc.)

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless platform
- **SMS Service**: Twilio for SMS notifications with TCPA-compliant opt-out handling
- **Email Service**: SendGrid for transactional emails and notifications
- **Maps & Geolocation**: Browser Geolocation API with planned MapLibre integration
- **Session Storage**: PostgreSQL-backed session management

### Development Tools
- **Build System**: Vite with React plugin and TypeScript support
- **Development Environment**: Replit-specific tooling with hot reload and error overlay
- **Code Quality**: TypeScript strict mode with comprehensive type checking

### UI & Styling
- **Component Library**: Radix UI primitives for accessible components
- **Styling Framework**: Tailwind CSS with custom color system and responsive design
- **Icons**: Lucide React icon library
- **Fonts**: Inter from Google Fonts for optimal mobile readability

### Utility Libraries
- **Form Handling**: React Hook Form with Zod schema validation
- **Date/Time**: date-fns for date manipulation and formatting
- **QR Code Generation**: react-qr-code for access code generation
- **Class Management**: clsx and tailwind-merge for conditional styling

## SMS Notifications & TCPA Compliance

### SMS Opt-In/Opt-Out System
- **Consent Tracking**: Database-level SMS consent field with timestamp for audit trail
- **Opt-Out Keywords**: Support for all TCPA-standard keywords (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
- **Webhook Processing**: Twilio webhook endpoint at `/api/twilio/sms-webhook` for automated opt-out handling
- **Welcome Message**: All riders receive "Reply STOP to opt out anytime" instruction upon first subscription
- **Idempotent Processing**: Multiple STOP messages handled gracefully without duplicate confirmations
- **Re-subscription**: Riders can opt back in through QR code onboarding with consent checkbox

### Implementation Details
- **Phone Normalization**: Automatic conversion between Twilio format (+1XXXXXXXXXX) and database format (XXXXXXXXXX)
- **Multi-organization Search**: Webhook searches across all organizations to find matching rider
- **Admin Visibility**: SMS consent status visible in Access Management interface
- **Consent Updates**: updateRiderProfile storage method supports consent field modifications

### Production Setup Requirements
1. Configure Twilio webhook URL in Twilio Console pointing to `/api/twilio/sms-webhook`
2. Complete A2P 10DLC registration for SMS delivery
3. (Recommended) Implement Twilio signature verification for webhook security

## Bidirectional Messaging System

### Architecture
- **Communication Paths**: Riders ↔ Admin and Drivers ↔ Admin (no direct Rider ↔ Driver communication by design)
- **Real-time Updates**: 10-second polling for admin inbox to show new messages
- **Message Attribution**: All responses tracked with admin user ID for audit trail

### Driver Messaging
- **Access**: "Contact Admin" button on driver page (/driver)
- **Message Types**: vehicle_problem, route_issue, schedule_change, general
- **Form Validation**: 10-1000 character message requirement
- **Component**: SendDriverMessageDialog with type selection and preview

### Rider Messaging
- **Access**: "Contact Support" button on rider page (/rider)
- **Message Types**: lost_items, pickup_change, general
- **Optional Fields**: riderName and riderEmail for anonymous riders
- **Form Validation**: Email validation allows empty string or valid email format
- **Component**: SendRiderMessageDialog with optional contact information

### Admin Inbox
- **Location**: /admin/messages (accessible from sidebar Messages link)
- **Unified View**: Combined rider and driver messages sorted by creation date
- **Filtering**: All, new, read, resolved status filters
- **Response Flow**: Click message card to view details and respond inline
- **Organization Scoping**: Messages filtered by admin's organization (MVP: uses first org admin)

### API Endpoints
**Driver Messages:**
- POST /api/driver-messages - Create driver message
- GET /api/driver-messages?route_id=X or ?organization_id=X - List messages
- PATCH /api/driver-messages/:id/status - Update message status
- PATCH /api/driver-messages/:id/respond - Admin responds to driver

**Rider Messages:**
- POST /api/rider-messages - Create rider message
- GET /api/rider-messages?route_id=X or ?organization_id=X - List messages
- PATCH /api/rider-messages/:id/status - Update message status
- PATCH /api/rider-messages/:id/respond - Admin responds to rider

### Database Schema
**driver_messages table:**
- organizationId, routeId, driverUserId (foreign keys)
- type, message (content)
- status (new, read, resolved)
- adminResponse, respondedByUserId (response tracking)

**rider_messages table:**
- organizationId, routeId (foreign keys)
- type, message (content)
- riderName, riderEmail, userId (contact/identity)
- status (new, read, resolved)
- adminResponse, respondedByUserId (response tracking)

### MVP Limitations
- Admin inbox uses first org admin lookup (not session-based auth)
- Works correctly for single-organization deployments
- Multi-organization production requires proper authentication context integration