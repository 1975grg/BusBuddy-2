import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Filter, Bell, Phone, MessageSquare, Bus, AlertCircle } from "lucide-react";
import { useRequireRole } from "@/contexts/UserContext";
import { format } from "date-fns";
import type { Route, NotificationLog } from "@shared/schema";

export default function NotificationLogsPage() {
  const { user, isLoading: authLoading } = useRequireRole("org_admin");
  const [selectedRoute, setSelectedRoute] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Fetch routes for filter
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const activeRoutes = routes.filter(r => r.status === "active" && !r.archivedAt);

  // Build query params
  const queryParams = new URLSearchParams({
    organization_id: user.organizationId || "",
  });

  if (selectedRoute !== "all") {
    queryParams.set("route_id", selectedRoute);
  }

  if (selectedType !== "all") {
    queryParams.set("notification_type", selectedType);
  }

  if (searchText) {
    queryParams.set("search", searchText);
  }

  if (dateRange.start) {
    queryParams.set("start_date", dateRange.start);
  }

  if (dateRange.end) {
    queryParams.set("end_date", dateRange.end);
  }

  // Fetch notification logs
  const { data: logs = [], isLoading } = useQuery<NotificationLog[]>({
    queryKey: ["/api/notification-logs", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/notification-logs?${queryParams}`);
      return response.json();
    },
    staleTime: 0,
  });

  // Fetch total count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-logs/count", user.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/notification-logs/count?organization_id=${user.organizationId}`);
      return response.json();
    },
  });

  const totalCount = countData?.count || 0;

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      route_started: "Route Started",
      approaching_stop: "Approaching Stop",
      arrived_at_stop: "Arrived at Stop",
      service_alert: "Service Alert",
      welcome: "Welcome",
      rider_removed: "Rider Removed",
    };
    return labels[type] || type;
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case "route_started":
        return <Bus className="w-4 h-4" />;
      case "approaching_stop":
      case "arrived_at_stop":
        return <Bell className="w-4 h-4" />;
      case "service_alert":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getDeliveryMethodBadge = (method: string) => {
    if (method === "sms") {
      return <Badge variant="outline" className="gap-1"><Phone className="w-3 h-3" />SMS</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Bell className="w-3 h-3" />Push</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      sent: "default",
      failed: "destructive",
      delivered: "secondary",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Notification Logs</h1>
          <p className="text-muted-foreground">Track all notifications sent to riders and drivers</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Total notifications sent across all routes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalCount.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground">notifications logged</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter notifications by route, type, date, or search text</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Route</Label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger data-testid="select-route">
                  <SelectValue placeholder="All routes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All routes</SelectItem>
                  {activeRoutes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="route_started">Route Started</SelectItem>
                  <SelectItem value="approaching_stop">Approaching Stop</SelectItem>
                  <SelectItem value="arrived_at_stop">Arrived at Stop</SelectItem>
                  <SelectItem value="service_alert">Service Alert</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="rider_removed">Rider Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Search</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by recipient name, phone, or message..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRoute("all");
                  setSelectedType("all");
                  setSearchText("");
                  setDateRange({ start: "", end: "" });
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>
            Showing {logs.length} notification{logs.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading notifications...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No notifications found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or send some notifications to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover-elevate transition-all"
                  data-testid={`notification-log-${log.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getNotificationTypeIcon(log.notificationType)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.recipientName || "Unknown"}</span>
                          {log.recipientPhone && (
                            <span className="text-sm text-muted-foreground">
                              {log.recipientPhone}
                            </span>
                          )}
                          <Badge variant="secondary" className="gap-1">
                            {getNotificationTypeLabel(log.notificationType)}
                          </Badge>
                          {getDeliveryMethodBadge(log.deliveryMethod)}
                          {getStatusBadge(log.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{log.message}</p>
                        {log.errorMessage && (
                          <p className="text-sm text-destructive">Error: {log.errorMessage}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {log.sentAt ? format(new Date(log.sentAt), "MMM d, yyyy h:mm a") : "Not sent"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
