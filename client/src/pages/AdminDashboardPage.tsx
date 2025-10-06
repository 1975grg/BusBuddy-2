import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminDashboard } from "@/components/AdminDashboard";
import type { Route } from "@shared/schema";

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  
  // Fetch routes to get active count
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  // Fetch first organization admin to get organization ID
  const { data: currentAdmin } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=org_admin");
      const users = await response.json();
      return users[0];
    },
  });

  // Fetch organization settings for name
  const { data: orgSettings } = useQuery({
    queryKey: ["/api/org-settings"],
    queryFn: async () => {
      const response = await fetch("/api/org-settings");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  // Fetch messages to get new count
  const { data: riderMessages = [] } = useQuery({
    queryKey: ["/api/rider-messages", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${currentAdmin.organizationId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch rider messages");
      }
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
  });

  const { data: driverMessages = [] } = useQuery({
    queryKey: ["/api/driver-messages", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${currentAdmin.organizationId}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch driver messages");
      }
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
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

  const handleManageRoutes = () => {
    setLocation('/admin/routes');
  };

  const handleManageAccess = () => {
    setLocation('/admin/access');
  };

  const handleOpenSupport = () => {
    setLocation('/admin/support');
  };

  return (
    <AdminDashboard
      organizationName={orgSettings?.name || "Springfield University"}
      stats={stats}
      onManageRoutes={handleManageRoutes}
      onManageAccess={handleManageAccess}
      onOpenSupport={handleOpenSupport}
    />
  );
}
