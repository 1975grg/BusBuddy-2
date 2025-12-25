# Bus Buddy

## Overview
Bus Buddy is a real-time bus and shuttle tracking platform for institutions like schools, hospitals, airports, and hotels. It provides tools for administrators to manage routes and vehicles, assists drivers with trip operations, and allows riders to track buses live. The platform supports multi-organizational deployment with customizable branding and access controls, aiming to enhance the efficiency and safety of institutional transportation.

## User Preferences
Preferred communication style: Simple, everyday language.

## Development Notes
- **iOS Project Location**: `~/Downloads/BusBuddy-v3-user-interface/ios/App` (on user's local Mac)
- **Production API**: https://bus-buddy-v-3-user-interface-1975grg.replit.app
- **Test Account (Driver)**: testdriver@universityhs.edu at University HS organization

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React with TypeScript (Vite).
- **UI Components**: shadcn/ui with Radix UI primitives, styled using Tailwind CSS (supporting dark/light modes and organization branding).
- **Responsiveness**: Mobile-first design for optimal experience on various devices.
- **Landing Page**: Professional multi-portal landing page with distinct entry points for Parents/Students, Drivers, and Admins, featuring brand messaging and CTAs.

### Technical Implementations
- **Backend Server**: Express.js with TypeScript (ESM).
- **Database ORM**: Drizzle ORM for type-safe PostgreSQL operations.
- **Session Management**: Express sessions with PostgreSQL store.
- **API**: RESTful endpoints with structured error handling.
- **Real-time Capabilities**: Planned WebSocket integration for live GPS tracking.
- **Authentication**: Dual strategy using HttpOnly cookie sessions for web and Bearer tokens (Capacitor Preferences) for native apps, with role-based access control (Admin, Driver, Rider). Includes password expiration policies (e.g., annual for riders) and magic link support.
- **Data Storage Strategy**: Multi-tenant architecture using Neon PostgreSQL, with Drizzle for schema management.
- **Notification System**: SMS notifications with TCPA compliance (opt-in/out, keyword support), in-app proximity alerts, and service alerts via toast notifications.
- **Messaging System**: Bidirectional messaging (Riders ↔ Admin, Drivers ↔ Admin) with real-time updates, message attribution, and a unified Support Center. Includes admin direct messaging to drivers.
- **Location Services**: Geofencing for automatic stop advancement and screen wake lock for drivers during trips to ensure continuous GPS tracking.
- **System Administration**: Dedicated dashboard for system administrators to manage organizations, including a read-only viewing mode for organizational data.
- **Communications Compliance**: Toggle in Organization Settings to disable all messaging for regulatory compliance, with server-side enforcement and UI indication.

### Feature Specifications
- **Route Management**: Create, manage, and archive routes with soft-delete architecture.
- **Rider Experience**: Route assignment, live tracking, and geofenced notifications (route start, approaching/arrived at stop).
- **Admin Dashboard**: Streamlined dashboard with key metrics, action cards, and simplified navigation.
- **Driver Experience**: Simplified single-page dashboard with route selection, trip controls, live map, and messaging.
- **Native App Enhancements**: Optimized API calls for native platforms using Bearer tokens and full URLs; working iOS push notifications and GPS tracking.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL.
- **SMS Service**: Twilio.
- **Email Service**: SendGrid.
- **Maps & Geolocation**: Browser Geolocation API, MapLibre (planned).

### UI & Styling
- **Component Library**: Radix UI.
- **Styling Framework**: Tailwind CSS.
- **Icons**: Lucide React.
- **Fonts**: Inter (Google Fonts).

### Utility Libraries
- **Form Handling**: React Hook Form with Zod.
- **Date/Time**: date-fns.
- **QR Code Generation**: react-qr-code.