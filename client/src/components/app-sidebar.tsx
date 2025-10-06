import { useState, useMemo } from "react";
import { Calendar, Home, Route as RouteIcon, Users, Settings, Zap, MapPin, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "@shared/schema";
import busIconUrl from "@assets/generated_images/Bus_Buddy_app_icon_a37f6bcb.png";
import adminIconUrl from "@assets/generated_images/Admin_control_tower_icon_448585dd.png";
import driverIconUrl from "@assets/generated_images/Driver_steering_wheel_icon_1bfac9fb.png";
import riderIconUrl from "@assets/generated_images/Rider_GPS_pin_icon_48a84853.png";

// TODO: remove mock functionality - replace with real user data
const mockUser = {
  name: "Sarah Johnson",
  role: "Organization Admin", 
  organization: "Springfield University",
  avatar: adminIconUrl
};

const getRoleIcon = (role: "admin" | "driver" | "rider") => {
  switch (role) {
    case "admin": return adminIconUrl;
    case "driver": return driverIconUrl;
    case "rider": return riderIconUrl;
    default: return adminIconUrl;
  }
};

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

// Will move this inside the component function

// Driver and rider items will be created dynamically inside the component
// to include the message count badge

export function AppSidebar() {
  const [location] = useLocation();
  
  // Detect user role from URL path
  const userRole = useMemo<"admin" | "driver" | "rider">(() => {
    if (location.startsWith("/admin")) return "admin";
    if (location.startsWith("/driver")) return "driver";
    if (location.startsWith("/track") || location.startsWith("/rider")) return "rider";
    return "admin"; // default fallback
  }, [location]);
  
  // Fetch organization settings for branding
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings"],
    queryFn: async () => {
      const response = await fetch("/api/org-settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  // Fetch routes to get active count (only for admin)
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
    enabled: userRole === "admin",
  });

  // Fetch current user for drivers/riders
  const { data: currentDriver } = useQuery<{ id: string; organizationId: string }>({
    queryKey: ["/api/dev/mock-user/driver"],
    enabled: userRole === "driver",
  });

  const { data: currentRider } = useQuery<{ id: string; organizationId: string }>({
    queryKey: ["/api/dev/mock-user/rider"],
    enabled: userRole === "rider",
  });

  // Fetch first organization for admin users to get messages
  const { data: firstOrg } = useQuery({
    queryKey: ["/api/users", "org_admin_id"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=org_admin");
      const users = await response.json();
      return users[0]?.organizationId;
    },
    enabled: userRole === "admin",
  });

  // Fetch messages based on user role
  // Admin: all organization messages
  const { data: adminRiderMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", "admin", firstOrg],
    queryFn: async () => {
      if (!firstOrg) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${firstOrg}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      return response.json();
    },
    enabled: userRole === "admin" && !!firstOrg,
    refetchInterval: 10000,
  });

  const { data: adminDriverMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", "admin", firstOrg],
    queryFn: async () => {
      if (!firstOrg) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${firstOrg}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      return response.json();
    },
    enabled: userRole === "admin" && !!firstOrg,
    refetchInterval: 10000,
  });

  // Driver: only their own messages
  const { data: driverOwnMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", "driver", currentDriver?.id],
    queryFn: async () => {
      if (!currentDriver?.id) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${currentDriver.organizationId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      const allMessages = await response.json();
      // Filter to only show this driver's messages
      return allMessages.filter((msg: any) => msg.driverUserId === currentDriver.id);
    },
    enabled: userRole === "driver" && !!currentDriver,
    refetchInterval: 10000,
  });

  // Rider: only their own messages
  const { data: riderOwnMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", "rider", currentRider?.id],
    queryFn: async () => {
      if (!currentRider?.id) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${currentRider.organizationId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      const allMessages = await response.json();
      // Filter to only show this rider's messages
      return allMessages.filter((msg: any) => msg.userId === currentRider.id);
    },
    enabled: userRole === "rider" && !!currentRider,
    refetchInterval: 10000,
  });

  const activeRoutesCount = userRole === "admin" ? routes.filter(route => route.status === "active").length : 0;
  
  // Count new messages (status = 'new') based on role
  const newMessagesCount = useMemo(() => {
    if (userRole === "admin") {
      return [
        ...(Array.isArray(adminRiderMessages) ? adminRiderMessages : []),
        ...(Array.isArray(adminDriverMessages) ? adminDriverMessages : [])
      ].filter((msg: any) => msg.status === 'new').length;
    } else if (userRole === "driver") {
      return driverOwnMessages.filter((msg: any) => msg.status === 'new').length;
    } else if (userRole === "rider") {
      return riderOwnMessages.filter((msg: any) => msg.status === 'new').length;
    }
    return 0;
  }, [userRole, adminRiderMessages, adminDriverMessages, driverOwnMessages, riderOwnMessages]);

  // Build menu items based on user role
  const menuItems = useMemo<MenuItem[]>(() => {
    switch (userRole) {
      case "admin":
        return [
          {
            title: "Dashboard",
            url: "/admin",
            icon: Home,
          },
          {
            title: "Routes",
            url: "/admin/routes",
            icon: RouteIcon,
            badge: activeRoutesCount > 0 ? `${activeRoutesCount} Active` : undefined
          },
          {
            title: "Access", 
            url: "/admin/access",
            icon: Users,
          },
          {
            title: "Messages",
            url: "/admin/support",
            icon: MessageSquare,
            badge: newMessagesCount > 0 ? `${newMessagesCount} New` : undefined
          },
          {
            title: "Settings",
            url: "/admin/settings",
            icon: Settings,
          },
        ];
      case "driver":
        return [
          {
            title: "My Routes",
            url: "/driver",
            icon: RouteIcon,
          },
          {
            title: "Trip Control",
            url: "/driver/control",
            icon: MapPin,
          },
        ];
      case "rider":
        return [
          {
            title: "Track Bus",
            url: "/track",
            icon: MapPin,
          },
        ];
      default:
        return [];
    }
  }, [userRole, activeRoutesCount, newMessagesCount]);

  const getRoleColor = () => {
    switch (userRole) {
      case "admin": return "bg-primary";
      case "driver": return "bg-bus-active";
      case "rider": return "bg-accent";
      default: return "bg-primary";
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={orgSettings?.logoUrl || busIconUrl} 
            alt={orgSettings?.logoUrl ? `${orgSettings.name} logo` : "Bus Buddy"} 
            className="w-8 h-8 rounded-lg object-contain" 
          />
          <div>
            <h2 className="font-bold text-lg">Bus Buddy</h2>
            <p className="text-sm text-muted-foreground">{orgSettings?.name || mockUser.organization}</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getRoleColor()}`} />
            {userRole === "admin" ? "Administration" : userRole === "driver" ? "Driver Panel" : "Rider Portal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar>
              <AvatarImage src={getRoleIcon(userRole)} alt={`${userRole} icon`} />
              <AvatarFallback>
                <div className={`w-6 h-6 rounded-full ${getRoleColor()}`} />
              </AvatarFallback>
            </Avatar>
            {/* GPS ping animation for rider role */}
            {userRole === "rider" && (
              <div className="absolute inset-0 rounded-full animate-ping bg-bus-active opacity-20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{mockUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{mockUser.role}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}