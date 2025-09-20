# Bus Buddy Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from **Uber** and **Google Maps** for their excellence in real-time tracking, location-based services, and mobile-first design. These platforms excel at presenting complex location data in intuitive, accessible ways.

## Core Design Principles
- **Mobile-First**: Primary interface for drivers and riders on mobile devices
- **Real-Time Clarity**: Immediate visual feedback for live tracking data
- **Multi-Organization Flexibility**: Consistent base design with customizable branding
- **Accessibility**: High contrast, readable text, intuitive navigation

## Color Palette

### Base Colors (Dark & Light Mode)
- **Primary**: 210 100% 50% (Trust-inspiring blue for transportation)
- **Secondary**: 210 15% 25% / 210 10% 85% (Dark/Light mode backgrounds)
- **Success**: 142 69% 58% (Active buses, successful actions)
- **Warning**: 38 92% 50% (Delays, attention needed)
- **Error**: 0 65% 51% (Offline buses, errors)

### Accent Colors
- **Route Lines**: 210 100% 50% with 70% opacity
- **Bus Icons**: 210 100% 50% when active, 210 10% 50% when inactive

### Organization Branding
- Allow custom primary colors per organization
- Gradients: Subtle linear gradients from primary to 15% lighter shade for hero sections and key CTAs

## Typography
- **Primary**: Inter (Google Fonts) - excellent readability on mobile
- **Secondary**: System fonts as fallback
- **Sizes**: Mobile-optimized scale with generous line height for map overlays

## Layout System
**Tailwind Spacing**: Use units of 2, 4, 8, and 16 for consistent rhythm
- Mobile-first responsive breakpoints
- Generous touch targets (minimum 44px)
- Bottom navigation for mobile apps

## Component Library

### Navigation
- **Mobile**: Bottom tab navigation with 4-5 primary actions
- **Desktop**: Sidebar with collapsible organization switcher
- **Map Controls**: Floating action buttons with backdrop blur

### Real-Time Elements
- **Bus Markers**: Custom colored circles with organization branding
- **Route Lines**: Animated dashed lines showing bus paths
- **ETA Badges**: Floating cards with blur backgrounds over map
- **Status Indicators**: Color-coded dots (green=on-time, yellow=delayed, red=offline)

### Forms & Access
- **QR Code Scanner**: Full-screen overlay with corner guides
- **Magic Link Entry**: Single input with large submit button
- **Organization Selector**: Card-based grid with logos

### Data Displays
- **Trip Cards**: Clean white/dark cards with route info and timing
- **User Lists**: Avatar + role badge layout
- **Analytics Widgets**: Simple charts with primary color theming

### Admin Interface
- **Dashboard**: Grid-based layout with metric cards
- **Tables**: Zebra striping with hover states
- **Modals**: Centered with backdrop blur, mobile-responsive

## Images
- **Organization Logos**: Upload system with automatic resizing and format optimization
- **No Hero Images**: Focus on map interface as primary visual element
- **Icons**: Use Heroicons for consistency across all interface elements
- **Avatar Placeholders**: Generated initials with organization colors

## Mobile Optimizations
- **Touch Targets**: Minimum 44px height for all interactive elements
- **Thumb Navigation**: Bottom-positioned primary actions
- **Map Gestures**: Smooth pan/zoom with momentum scrolling
- **Offline States**: Clear indicators when GPS/internet unavailable

## Animations
- **Minimal**: Only for real-time updates (bus movement, ETA changes)
- **Bus Movement**: Smooth interpolated positioning on map
- **Status Changes**: Subtle color transitions for state updates
- **Loading States**: Simple pulse animations for data fetching

This design system prioritizes clarity and usability for real-time transportation tracking while maintaining flexibility for multi-organization branding.