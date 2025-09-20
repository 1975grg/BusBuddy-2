import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminDashboardPage() {
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
      onAddRoute={() => console.log('Navigate to add route')}
      onManageUsers={() => console.log('Navigate to user management')}
      onViewNotifications={() => console.log('Navigate to notifications')}
    />
  );
}