import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Shield, Users, Truck, MapPin } from "lucide-react";
import type { UserRole } from "@shared/schema";

interface RoleToggleProps {
  className?: string;
}

export function RoleToggle({ className }: RoleToggleProps) {
  const [, setLocation] = useLocation();
  const [currentRole, setCurrentRole] = useState<UserRole>("system_admin");

  const roles = [
    {
      value: "system_admin" as UserRole,
      label: "System Admin",
      icon: Shield,
      color: "bg-red-100 text-red-800",
      route: "/system"
    },
    {
      value: "org_admin" as UserRole,
      label: "Org Admin", 
      icon: Users,
      color: "bg-blue-100 text-blue-800",
      route: "/admin"
    },
    {
      value: "driver" as UserRole,
      label: "Driver",
      icon: Truck,
      color: "bg-green-100 text-green-800", 
      route: "/driver"
    },
    {
      value: "rider" as UserRole,
      label: "Rider",
      icon: MapPin,
      color: "bg-purple-100 text-purple-800",
      route: "/track"
    }
  ];

  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    const role = roles.find(r => r.value === newRole);
    if (role) {
      setLocation(role.route);
    }
  };

  const currentRoleData = roles.find(r => r.value === currentRole);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">View as:</span>
      <Select value={currentRole} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-32" data-testid="select-role-toggle">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.value} value={role.value}>
              <div className="flex items-center gap-2">
                <role.icon className="w-3 h-3" />
                {role.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {currentRoleData && (
        <Badge className={currentRoleData.color} data-testid={`badge-current-role-${currentRole}`}>
          <currentRoleData.icon className="w-3 h-3 mr-1" />
          {currentRoleData.label}
        </Badge>
      )}
    </div>
  );
}