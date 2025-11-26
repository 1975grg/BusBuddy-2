import { useState, useMemo } from "react";
import { Calendar, Home, Route as RouteIcon, Users, Settings, Zap, MapPin, MessageSquare, ChevronDown, Bell, LogOut } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Route } from "@shared/schema";
import busIconUrl from "@assets/bus-buddy-logo.png";
import adminIconUrl from "@assets/generated_images/Admin_control_tower_icon_448585dd.png";
import driverIconUrl from "@assets/generated_images/Driver_steering_wheel_icon_1bfac9fb.png";
import riderIconUrl from "@assets/generated_images/Rider_GPS_pin_icon_48a84853.png";

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

const getRoleLabel = (role: string) => {
  switch (role) {
    case "system_admin":
      return "System Admin";
    case "org_admin":
      return "Org Admin";
    case "driver":
      return "Driver";
    case "rider":
      return "Rider";
    default:
      return role;
  }
};

// Generate abbreviation from organization name (up to 3 characters)
const getOrgAbbreviation = (orgName: string | undefined, userRole: string): string => {
  // For super admin without org, show "BB" for Bus Buddy
  if (!orgName || userRole === "system_admin") {
    return "BB";
  }
  
  // Split by spaces and get first letter of each word
  const words = orgName.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word: take first 3 characters (e.g., "Westwood" → "WES")
    return words[0].slice(0, 3).toUpperCase();
  }
  
  // Multiple words: take first letter of each word, up to 3
  const abbreviation = words
    .slice(0, 3)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
  
  return abbreviation || "BB";
};

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user: authenticatedUser } = useUser();
  const { toast } = useToast();
  
  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      // Redirect to login page
      setLocation("/login");
      toast({
        title: "Logged out successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Detect user role from URL path
  const userRole = useMemo<"admin" | "driver" | "rider">(() => {
    if (location.startsWith("/admin") || location.startsWith("/system")) return "admin";
    if (location.startsWith("/driver")) return "driver";
    if (location.startsWith("/track") || location.startsWith("/rider")) return "rider";
    return "admin"; // default fallback
  }, [location]);
  
  // Fetch organization data for branding (uses same endpoint as SettingsPage)
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/organization"],
    queryFn: async () => {
      const response = await fetch("/api/organization");
      if (!response.ok) throw new Error("Failed to fetch organization");
      return response.json();
    }
  });

  // Fetch routes to get active count (only for admin)
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
    enabled: userRole === "admin" && !!authenticatedUser,
  });

  // Use authenticated user's organization ID instead of mock endpoints
  const userOrgId = authenticatedUser?.organizationId;

  // Fetch messages based on user role using real authenticated user's org
  // Admin: all organization messages
  const { data: adminRiderMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", "admin", userOrgId],
    queryFn: async () => {
      if (!userOrgId) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${userOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      return response.json();
    },
    enabled: userRole === "admin" && !!userOrgId,
    refetchInterval: 10000,
  });

  const { data: adminDriverMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", "admin", userOrgId],
    queryFn: async () => {
      if (!userOrgId) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${userOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      return response.json();
    },
    enabled: userRole === "admin" && !!userOrgId,
    refetchInterval: 10000,
  });

  // Driver: only their own messages - using authenticated user
  const { data: driverOwnMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", "driver", authenticatedUser?.id],
    queryFn: async () => {
      if (!authenticatedUser?.id || !userOrgId) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${userOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      const allMessages = await response.json();
      // Filter to only show this driver's messages
      return allMessages.filter((msg: any) => msg.driverUserId === authenticatedUser.id);
    },
    enabled: userRole === "driver" && !!authenticatedUser && !!userOrgId,
    refetchInterval: 10000,
  });

  // Rider: only their own messages - using authenticated user
  const { data: riderOwnMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", "rider", authenticatedUser?.id],
    queryFn: async () => {
      if (!authenticatedUser?.id || !userOrgId) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${userOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      const allMessages = await response.json();
      // Filter to only show this rider's messages
      return allMessages.filter((msg: any) => msg.userId === authenticatedUser.id);
    },
    enabled: userRole === "rider" && !!authenticatedUser && !!userOrgId,
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
            title: "Inbox",
            url: "/admin/support",
            icon: MessageSquare,
            badge: newMessagesCount > 0 ? `${newMessagesCount} New` : undefined
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
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full" data-testid="dropdown-bus-buddy-menu">
            <div className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-md p-2 cursor-pointer">
              {orgSettings?.logoUrl ? (
                <img 
                  src={orgSettings.logoUrl} 
                  alt={orgSettings?.name || "Organization"} 
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: orgSettings?.primaryColor || "#0080FF" }}
                >
                  {getOrgAbbreviation(orgSettings?.name, authenticatedUser?.role || "")}
                </div>
              )}
              <div className="flex-1 text-left">
                <h2 className="font-bold text-lg">Bus Buddy</h2>
                <p className="text-sm text-muted-foreground">{orgSettings?.name || "Bus Tracking"}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {authenticatedUser && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="flex items-center gap-2 cursor-pointer" data-testid="menu-settings">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/support?tab=notification-logs" className="flex flex-col items-start gap-1 cursor-pointer" data-testid="menu-notification-logs">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      <span>Notification Logs</span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">View SMS notification history</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-destructive" data-testid="menu-logout">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </>
            )}
            {!authenticatedUser && (
              <DropdownMenuItem asChild>
                <Link href="/login" className="flex items-center gap-2 cursor-pointer" data-testid="menu-login">
                  <LogOut className="w-4 h-4" />
                  <span>Login</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
            <p className="text-sm font-medium truncate">{authenticatedUser?.name || "Guest"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {authenticatedUser ? getRoleLabel(authenticatedUser.role) : "Not logged in"}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}