import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminDashboard } from "@/components/AdminDashboard";
import { useRequireRole } from "@/contexts/UserContext";
import { apiFetch } from "@/lib/queryClient";
import type { Route } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye } from "lucide-react";

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading, viewingOrgId } = useRequireRole("org_admin");
  const [, setLocation] = useLocation();
  
  // Determine if system admin is viewing an org
  const isSystemAdminViewing = user?.role === 'system_admin' && viewingOrgId;
  const effectiveOrgId = viewingOrgId || user?.organizationId;

  // ALL HOOKS MUST BE BEFORE EARLY RETURNS
  // Fetch routes to get active count - use effectiveOrgId for filtering
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId ? `/api/routes?organizationId=${effectiveOrgId}` : "/api/routes";
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch routes");
      return response.json();
    },
    enabled: !authLoading,
  });

  // Fetch first organization admin to get organization ID
  const { data: currentAdmin } = useQuery({
    queryKey: ["/api/users", "org_admin", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId 
        ? `/api/users?role=org_admin&organizationId=${effectiveOrgId}`
        : "/api/users?role=org_admin";
      const response = await apiFetch(url);
      const users = await response.json();
      return users[0];
    },
    enabled: !authLoading,
  });

  // Fetch organization settings for name
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings", effectiveOrgId],
    queryFn: async () => {
      const url = effectiveOrgId 
        ? `/api/org-settings?organizationId=${effectiveOrgId}`
        : "/api/org-settings";
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    },
    enabled: !authLoading,
  });

  // Use effectiveOrgId for messages
  const messageOrgId = effectiveOrgId || currentAdmin?.organizationId;

  // Fetch messages to get new count
  const { data: riderMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", messageOrgId],
    queryFn: async () => {
      if (!messageOrgId) return [];
      const response = await apiFetch(`/api/rider-messages?organization_id=${messageOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      return response.json();
    },
    enabled: !!messageOrgId,
  });

  const { data: driverMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", messageOrgId],
    queryFn: async () => {
      if (!messageOrgId) return [];
      const response = await apiFetch(`/api/driver-messages?organization_id=${messageOrgId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      return response.json();
    },
    enabled: !!messageOrgId,
  });

  const activeRoutesCount = routes.filter(route => route.status === "active").length;
  
  // Count new messages (status = 'new')
  const newMessagesCount = [
    ...(Array.isArray(riderMessages) ? riderMessages : []),
    ...(Array.isArray(driverMessages) ? driverMessages : [])
  ].filter((msg: any) => msg.status === 'new').length;

  const stats = {
    activeRoutes: activeRoutesCount,
    newMessages: newMessagesCount
  };

  // Preserve viewingOrg param when navigating
  const viewingParam = viewingOrgId ? `?viewingOrg=${viewingOrgId}` : '';

  const handleManageRoutes = () => {
    setLocation(`/admin/routes${viewingParam}`);
  };

  const handleManageAccess = () => {
    setLocation(`/admin/access${viewingParam}`);
  };

  const handleOpenSupport = () => {
    setLocation(`/admin/support${viewingParam}`);
  };

  const handleBackToSystem = () => {
    setLocation('/system');
  };

  // Early return AFTER all hooks
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {isSystemAdminViewing && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800 dark:text-blue-200">
              Viewing <strong>{orgSettings?.name || 'Organization'}</strong> as System Administrator (read-only)
            </span>
            <button 
              onClick={handleBackToSystem}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              data-testid="button-back-to-system"
            >
              Back to System Dashboard
            </button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex-1">
        <AdminDashboard
          organizationName={orgSettings?.name || "Organization"}
          stats={stats}
          onManageRoutes={handleManageRoutes}
          onManageAccess={handleManageAccess}
          onOpenSupport={handleOpenSupport}
        />
      </div>
    </div>
  );
}
