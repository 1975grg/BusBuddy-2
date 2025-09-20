import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Route, Zap, Mail, AlertTriangle, Plus } from "lucide-react";

interface DashboardStats {
  activeRoutes: number;
  totalRiders: number;
  notificationsSent: number;
  issuesReported: number;
}

interface AdminDashboardProps {
  organizationName: string;
  stats: DashboardStats;
  onAddRoute?: () => void;
  onManageUsers?: () => void;
  onViewNotifications?: () => void;
}

export function AdminDashboard({ 
  organizationName, 
  stats, 
  onAddRoute, 
  onManageUsers, 
  onViewNotifications 
}: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{organizationName}</p>
        </div>
        <Button onClick={onAddRoute} data-testid="button-add-route">
          <Plus className="w-4 h-4 mr-2" />
          Add Route
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRoutes}</div>
            <Badge className="bg-bus-active text-white mt-1">
              Live Tracking
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Riders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRiders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notificationsSent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Reported</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.issuesReported}</div>
            <Badge variant={stats.issuesReported > 0 ? "destructive" : "secondary"} className="mt-1">
              {stats.issuesReported > 0 ? "Needs Attention" : "All Clear"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="w-5 h-5" />
              Route Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and manage bus routes, assign vehicles, and set up stops.
            </p>
            <Button className="w-full" onClick={onAddRoute} data-testid="button-manage-routes">
              Manage Routes
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Generate QR codes, manage passwords, and control rider access.
            </p>
            <Button className="w-full" variant="outline" onClick={onManageUsers} data-testid="button-manage-users">
              Manage Access
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View notification activity and manage alert preferences.
            </p>
            <Button className="w-full" variant="outline" onClick={onViewNotifications} data-testid="button-view-notifications">
              View Activity
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}