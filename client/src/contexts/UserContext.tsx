import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { pushNotificationService } from "@/lib/pushNotifications";

// Extended user type with route assignments and rider profile
interface UserWithAssignments extends User {
  routeAssignments?: Array<{
    id: string;
    routeId: string;
    isDefault: boolean;
  }>;
  riderProfileId?: string | null;
}

interface UserContextType {
  user: UserWithAssignments | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  refetchUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // Fetch current user from /api/me
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<UserWithAssignments>({
    queryKey: ["/api/me"],
    retry: false, // Don't retry on 401
    refetchOnWindowFocus: false,
  });

  // Initialize push notifications when user is authenticated on native platform
  useEffect(() => {
    if (user?.id) {
      // Initialize push notifications for native platforms (iOS/Android)
      pushNotificationService.initialize(user.id).catch((err) => {
        console.error('Failed to initialize push notifications:', err);
      });
    }
  }, [user?.id]);

  const contextValue: UserContextType = {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    error: error as Error | null,
    refetchUser: refetch,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

// Hook to require authentication
export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useUser();

  if (isLoading) {
    return { user: null, isLoading: true, isAuthenticated: false };
  }

  if (!isAuthenticated || !user) {
    // Redirect to login or show error
    window.location.href = "/login";
    return { user: null, isLoading: false, isAuthenticated: false };
  }

  return { user, isLoading: false, isAuthenticated: true };
}

// Hook to require specific role
export function useRequireRole(...allowedRoles: string[]) {
  const { user, isLoading } = useRequireAuth();

  if (isLoading || !user) {
    return { user: null, isLoading: true, hasAccess: false, viewingOrgId: null };
  }

  // Check for system_admin viewing an org dashboard via viewingOrg query param
  const urlParams = new URLSearchParams(window.location.search);
  const viewingOrgId = urlParams.get('viewingOrg');
  
  // System admin can access org_admin pages when viewing a specific org
  const isSystemAdminViewingOrg = user.role === 'system_admin' && viewingOrgId && 
    (allowedRoles.includes('org_admin') || allowedRoles.includes('driver'));
  
  const hasAccess = allowedRoles.includes(user.role) || isSystemAdminViewingOrg;

  if (!hasAccess) {
    window.location.href = "/unauthorized";
    return { user, isLoading: false, hasAccess: false, viewingOrgId: null };
  }

  return { user, isLoading: false, hasAccess: true, viewingOrgId };
}
