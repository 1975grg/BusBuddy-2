import { AdminDashboard } from '../AdminDashboard';

export default function AdminDashboardExample() {
  const mockStats = {
    activeRoutes: 5,
    totalRiders: 143,
    notificationsSent: 89,
    issuesReported: 2
  };

  return (
    <div className="p-6">
      <AdminDashboard
        organizationName="Springfield University"
        stats={mockStats}
        onAddRoute={() => console.log('Add route')}
        onManageUsers={() => console.log('Manage users')}
        onViewNotifications={() => console.log('View notifications')}
      />
    </div>
  );
}