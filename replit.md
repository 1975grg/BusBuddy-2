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

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless platform
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