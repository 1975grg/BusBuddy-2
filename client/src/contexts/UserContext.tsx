import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

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
    return { user: null, isLoading: true, hasAccess: false };
  }

  const hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess) {
    window.location.href = "/unauthorized";
    return { user, isLoading: false, hasAccess: false };
  }

  return { user, isLoading: false, hasAccess: true };
}
