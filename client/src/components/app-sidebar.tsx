import { useState } from "react";
import { Calendar, Home, Route, Users, Settings, Zap, MapPin } from "lucide-react";
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
import { Link } from "wouter";
import busIconUrl from "@assets/generated_images/Bus_Buddy_app_icon_a37f6bcb.png";
import adminAvatarUrl from "@assets/generated_images/School_admin_avatar_e511f99c.png";

// TODO: remove mock functionality - replace with real user data
const mockUser = {
  name: "Sarah Johnson",
  role: "Organization Admin",
  organization: "Springfield University",
  avatar: adminAvatarUrl
};

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

const adminItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Home,
  },
  {
    title: "Routes",
    url: "/admin/routes",
    icon: Route,
    badge: "5 Active"
  },
  {
    title: "Access Management", 
    url: "/admin/access",
    icon: Users,
  },
  {
    title: "Notifications",
    url: "/admin/notifications",
    icon: Zap,
    badge: "89 Sent"
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
];

const driverItems: MenuItem[] = [
  {
    title: "My Routes",
    url: "/driver",
    icon: Route,
  },
  {
    title: "Trip Control",
    url: "/driver/control",
    icon: MapPin,
  },
];

const riderItems: MenuItem[] = [
  {
    title: "Track Bus",
    url: "/track",
    icon: MapPin,
  },
  {
    title: "My Routes",
    url: "/track/routes",
    icon: Route,
  },
  {
    title: "Notifications",
    url: "/track/notifications",
    icon: Zap,
  },
];

export function AppSidebar() {
  const [userRole] = useState<"admin" | "driver" | "rider">("admin"); // TODO: remove mock - get from auth

  const getMenuItems = () => {
    switch (userRole) {
      case "admin": return adminItems;
      case "driver": return driverItems;
      case "rider": return riderItems;
      default: return adminItems;
    }
  };

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
          <img src={busIconUrl} alt="Bus Buddy" className="w-8 h-8 rounded-lg" />
          <div>
            <h2 className="font-bold text-lg">Bus Buddy</h2>
            <p className="text-sm text-muted-foreground">{mockUser.organization}</p>
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
              {getMenuItems().map((item) => (
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
          <Avatar>
            <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
            <AvatarFallback>{mockUser.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{mockUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{mockUser.role}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}