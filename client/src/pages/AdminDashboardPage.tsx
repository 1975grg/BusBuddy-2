import { useLocation } from "wouter";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  
  // TODO: remove mock functionality - replace with real data from API
  const mockStats = {
    activeRoutes: 5,
    supportRequests: 2 // Previously "issuesReported"
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
      organizationName="Springfield University"
      stats={mockStats}
      onManageRoutes={handleManageRoutes}
      onManageAccess={handleManageAccess}
      onOpenSupport={handleOpenSupport}
    />
  );
}
