import { useLocation } from "wouter";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  
  // TODO: remove mock functionality - replace with real data from API
  const mockStats = {
    activeRoutes: 5,
    totalRiders: 143,
    notificationsSent: 89,
    issuesReported: 2
  };

  return (
    <AdminDashboard
      organizationName="Springfield University"
      stats={mockStats}
      onAddRoute={() => setLocation('/admin/routes')}
      onManageUsers={() => console.log('Navigate to user management')}
      onViewNotifications={() => console.log('Navigate to notifications')}
    />
  );
}