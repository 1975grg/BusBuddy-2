import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { User, LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient, setStoredSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { pushNotificationService } from "@/lib/pushNotifications";

export function UserMenu() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: async () => {
      // Clear stored session token (for native apps)
      // MUST await to ensure token is cleared from Capacitor Preferences
      await setStoredSessionToken(null);
      
      // Reset push notification service so it can re-initialize on next login
      // This ensures the iOS permission prompt can appear again
      await pushNotificationService.removeAllListeners();
      
      // Invalidate all queries to clear the cache
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.clear();
      
      // Use window.location to force full page reload and clear all React state
      window.location.href = "/login";
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout",
      });
    },
  });

  if (!user) {
    return null;
  }

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "system_admin":
        return "default";
      case "org_admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-user-menu">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Badge variant={getRoleBadgeVariant(user.role)} data-testid="badge-user-role">
            {getRoleLabel(user.role)}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
