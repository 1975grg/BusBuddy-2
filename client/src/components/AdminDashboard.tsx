import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Route, MessageSquare, Plus } from "lucide-react";

interface DashboardStats {
  activeRoutes: number;
  supportRequests: number;
}

interface AdminDashboardProps {
  organizationName: string;
  stats: DashboardStats;
  onManageRoutes?: () => void;
  onManageAccess?: () => void;
  onOpenSupport?: () => void;
}

export function AdminDashboard({ 
  organizationName, 
  stats, 
  onManageRoutes,
  onManageAccess, 
  onOpenSupport 
}: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{organizationName}</p>
        </div>
        <Button onClick={onManageRoutes} data-testid="button-add-route">
          <Plus className="w-4 h-4 mr-2" />
          Add Route
        </Button>
      </div>

      {/* Compact Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.supportRequests}</div>
            <Badge variant={stats.supportRequests > 0 ? "destructive" : "secondary"} className="mt-1">
              {stats.supportRequests > 0 ? "Needs Attention" : "All Clear"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="w-5 h-5" />
              Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and manage bus routes, assign vehicles, and set up stops.
            </p>
            <Button className="w-full" onClick={onManageRoutes} data-testid="button-manage-routes">
              Manage Routes
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add riders and drivers, generate QR codes, and manage access.
            </p>
            <Button className="w-full" variant="outline" onClick={onManageAccess} data-testid="button-manage-access">
              Manage Access
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View rider and driver messages, send alerts to routes.
            </p>
            <Button className="w-full" variant="outline" onClick={onOpenSupport} data-testid="button-open-support">
              Open Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
