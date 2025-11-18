import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, User, Truck, Clock, Send, Megaphone, Archive, ArchiveRestore, Trash2, AlertCircle, Bell, XCircle, Bus, Forward, Radio, Calendar, Search, Filter, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { SendAlertDialog } from "@/components/SendAlertDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { RiderMessage, DriverMessage, Route, ServiceAlert, NotificationLog } from "@shared/schema";

type Message = (RiderMessage | DriverMessage) & { messageType: 'rider' | 'driver' };

export default function SupportCenterPage() {
  const { user, isLoading: authLoading } = useRequireRole("org_admin");
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [responseText, setResponseText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [alertRoute, setAlertRoute] = useState<Route | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastFormData, setBroadcastFormData] = useState({
    type: "general",
    title: "",
    message: "",
    severity: "warning",
    activeUntil: "",
  });
  
  // Inbox filters
  const [inboxRouteFilter, setInboxRouteFilter] = useState<string>("all");
  const [inboxDateRange, setInboxDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [inboxSearchText, setInboxSearchText] = useState("");

  // Active Alerts filters
  const [alertsRouteFilter, setAlertsRouteFilter] = useState<string>("all");
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>("all");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>("all");
  const [alertsDateRange, setAlertsDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  
  // Notification logs filters
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

  // Use authenticated user's organization ID directly
  const currentAdmin = user;

  // Fetch active routes for alerts tab
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const activeRoutes = routes.filter(route => route.status === "active");

  // Fetch rider messages
  const { data: riderMessages = [] } = useQuery<RiderMessage[]>({
    queryKey: ["/api/rider-messages", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/rider-messages?organization_id=${currentAdmin.organizationId}`, {
        cache: 'no-cache' // Force fresh data, bypass HTTP cache
      });
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
    refetchInterval: 10000,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch when component mounts
  });

  // Fetch driver messages
  const { data: driverMessages = [] } = useQuery<DriverMessage[]>({
    queryKey: ["/api/driver-messages", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${currentAdmin.organizationId}`, {
        cache: 'no-cache' // Force fresh data, bypass HTTP cache
      });
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
    refetchInterval: 10000,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch when component mounts
  });

  // Fetch active service alerts
  const { data: serviceAlerts = [] } = useQuery<ServiceAlert[]>({
    queryKey: ["/api/service-alerts", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/service-alerts?organization_id=${currentAdmin.organizationId}`);
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
    refetchInterval: 10000,
  });
  
  // Build query params for notification logs
  const logsQueryParams = new URLSearchParams({
    organization_id: currentAdmin?.organizationId || "",
  });
  
  if (selectedRoute !== "all") {
    logsQueryParams.set("route_id", selectedRoute);
  }
  
  if (selectedType !== "all") {
    logsQueryParams.set("notification_type", selectedType);
  }
  
  if (searchText) {
    logsQueryParams.set("search", searchText);
  }
  
  if (dateRange.start) {
    logsQueryParams.set("start_date", dateRange.start);
  }
  
  if (dateRange.end) {
    logsQueryParams.set("end_date", dateRange.end);
  }
  
  // Fetch notification logs
  const { data: notificationLogs = [], isLoading: logsLoading } = useQuery<NotificationLog[]>({
    queryKey: ["/api/notification-logs", logsQueryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/notification-logs?${logsQueryParams}`);
      return response.json();
    },
    staleTime: 0,
  });
  
  // Fetch total notification count
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-logs/count", currentAdmin?.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/notification-logs/count?organization_id=${currentAdmin.organizationId}`);
      return response.json();
    },
  });
  
  const totalNotificationCount = countData?.count || 0;

  // Combine and tag messages
  const allMessages: Message[] = [
    ...riderMessages.map(m => ({ ...m, messageType: 'rider' as const })),
    ...driverMessages.map(m => ({ ...m, messageType: 'driver' as const }))
  ].filter(m => {
    // Filter out archived messages unless showArchived is enabled
    if (!showArchived && m.archivedAt) return false;
    return true;
  }).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    
    // Sort by date (newest first)
    if (aTime !== bTime) return bTime - aTime;
    
    // If same date, sort by priority (critical first)
    const priorityOrder = { critical: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    return aPriority - bPriority;
  });

  // Filter messages by status, route, priority, date range, and search
  const filteredMessages = allMessages.filter(m => {
    // Status filter
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    
    // Route filter
    if (inboxRouteFilter !== "all" && m.routeId !== inboxRouteFilter) return false;
    
    // Priority filter
    if (priorityFilter !== "all" && m.priority !== priorityFilter) return false;
    
    // Date range filter
    if (inboxDateRange.start && m.createdAt) {
      const messageDate = new Date(m.createdAt);
      const startDate = new Date(inboxDateRange.start);
      if (messageDate < startDate) return false;
    }
    if (inboxDateRange.end && m.createdAt) {
      const messageDate = new Date(m.createdAt);
      const endDate = new Date(inboxDateRange.end);
      endDate.setHours(23, 59, 59, 999); // End of day
      if (messageDate > endDate) return false;
    }
    
    // Search text filter
    if (inboxSearchText) {
      const searchLower = inboxSearchText.toLowerCase();
      const messageText = m.message.toLowerCase();
      const riderName = m.messageType === 'rider' ? ((m as RiderMessage).riderName || "").toLowerCase() : "";
      const routeName = getRouteName(m.routeId).toLowerCase();
      
      if (!messageText.includes(searchLower) && 
          !riderName.includes(searchLower) && 
          !routeName.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });

  // Respond to message mutation
  const respondMutation = useMutation({
    mutationFn: async ({ id, messageType, response }: { id: string, messageType: 'rider' | 'driver', response: string }) => {
      const endpoint = messageType === 'rider' 
        ? `/api/rider-messages/${id}/respond`
        : `/api/driver-messages/${id}/respond`;
      
      return await apiRequest("PATCH", endpoint, {
        adminResponse: response,
        respondedByUserId: currentAdmin?.id || ""
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      setResponseText("");
      setSelectedMessage(null);
      toast({ title: "Response sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send response", variant: "destructive" });
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, messageType, status }: { id: string, messageType: 'rider' | 'driver', status: string }) => {
      const endpoint = messageType === 'rider'
        ? `/api/rider-messages/${id}/status`
        : `/api/driver-messages/${id}/status`;
      
      return await apiRequest("PATCH", endpoint, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      toast({ title: "Status updated successfully" });
    }
  });

  // Archive message mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, messageType }: { id: string, messageType: 'rider' | 'driver' }) => {
      const endpoint = messageType === 'rider'
        ? `/api/rider-messages/${id}/archive`
        : `/api/driver-messages/${id}/archive`;
      
      return await apiRequest("PATCH", endpoint, { archived_by_user_id: currentAdmin?.id || "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      setSelectedMessage(null);
      toast({ title: "Message archived successfully" });
    }
  });

  // Restore message mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ id, messageType }: { id: string, messageType: 'rider' | 'driver' }) => {
      const endpoint = messageType === 'rider'
        ? `/api/rider-messages/${id}/restore`
        : `/api/driver-messages/${id}/restore`;
      
      return await apiRequest("PATCH", endpoint, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      toast({ title: "Message restored successfully" });
    }
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, messageType }: { id: string, messageType: 'rider' | 'driver' }) => {
      const endpoint = messageType === 'rider'
        ? `/api/rider-messages/${id}`
        : `/api/driver-messages/${id}`;
      
      return await apiRequest("DELETE", endpoint, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      setSelectedMessage(null);
      toast({ title: "Message deleted successfully" });
    }
  });

  // Forward rider message to driver
  const forwardToDriverMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest("POST", `/api/rider-messages/${messageId}/forward-to-driver`, {
        forwardedByUserId: currentAdmin?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      toast({ 
        title: "Message forwarded to driver",
        description: "The driver will see this message in their app"
      });
    },
    onError: () => {
      toast({ 
        title: "Forward failed",
        description: "Could not forward message to driver",
        variant: "destructive"
      });
    }
  });

  // Broadcast driver message as service alert
  const broadcastAsAlertMutation = useMutation({
    mutationFn: async ({ messageId, severity }: { messageId: string, severity?: string }) => {
      return await apiRequest("POST", `/api/driver-messages/${messageId}/broadcast-as-alert`, {
        broadcastByUserId: currentAdmin?.id,
        severity: severity || "warning"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-alerts"] });
      toast({ 
        title: "Alert broadcast successfully",
        description: "All riders on this route will see the alert"
      });
    },
    onError: () => {
      toast({ 
        title: "Broadcast failed",
        description: "Could not broadcast message as alert",
        variant: "destructive"
      });
    }
  });

  // Expire alert mutation
  const expireAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiRequest("PATCH", `/api/service-alerts/${alertId}/expire`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-alerts", currentAdmin?.organizationId] });
      toast({ title: "Alert expired successfully" });
    },
    onError: () => {
      toast({ title: "Failed to expire alert", variant: "destructive" });
    }
  });

  // Mark rider message as read
  const markRiderMessageReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest("PATCH", `/api/rider-messages/${messageId}/mark-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
    },
  });

  // Mark driver message as read
  const markDriverMessageReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest("PATCH", `/api/driver-messages/${messageId}/mark-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
    },
  });

  // Broadcast alert to all routes
  const broadcastAlertMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/service-alerts/broadcast-all", {
        organization_id: currentAdmin?.organizationId,
        ...data,
        activeUntil: data.activeUntil || null,
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-logs"] });
      toast({
        title: "Broadcast successful",
        description: `Alert sent to ${response.routesNotified} routes (${response.notificationsSent} notifications attempted)`,
      });
      setBroadcastDialogOpen(false);
      setBroadcastFormData({
        type: "general",
        title: "",
        message: "",
        severity: "warning",
        activeUntil: "",
      });
    },
    onError: () => {
      toast({
        title: "Broadcast failed",
        description: "Could not send alert to all routes",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge className="bg-blue-500 text-white">New</Badge>;
      case "read":
        return <Badge variant="outline">Read</Badge>;
      case "resolved":
        return <Badge className="bg-green-500 text-white">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge className="bg-red-500 text-white" data-testid="badge-priority-critical"><AlertCircle className="w-3 h-3 mr-1" />Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500 text-white">High</Badge>;
      case "normal":
      default:
        return null; // Don't show badge for normal priority
    }
  };

  const getMessageTypeIcon = (messageType: 'rider' | 'driver') => {
    return messageType === 'rider' 
      ? <User className="w-4 h-4" />
      : <Truck className="w-4 h-4" />;
  };

  const getRouteName = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    return route?.name || "Unknown Route";
  };

  const handleRespond = () => {
    if (!selectedMessage || !responseText.trim()) return;
    
    respondMutation.mutate({
      id: selectedMessage.id,
      messageType: selectedMessage.messageType,
      response: responseText.trim()
    });
  };

  const handleMarkResolved = (message: Message) => {
    updateStatusMutation.mutate({
      id: message.id,
      messageType: message.messageType,
      status: "resolved"
    });
  };

  // Clear inbox filters
  const clearInboxFilters = () => {
    setStatusFilter("all");
    setInboxRouteFilter("all");
    setPriorityFilter("all");
    setInboxDateRange({ start: "", end: "" });
    setInboxSearchText("");
  };

  // Clear active alerts filters
  const clearAlertsFilters = () => {
    setAlertsRouteFilter("all");
    setAlertTypeFilter("all");
    setAlertSeverityFilter("all");
    setAlertsDateRange({ start: "", end: "" });
  };

  // Filter active alerts
  const filteredAlerts = serviceAlerts.filter(alert => {
    // Route filter
    if (alertsRouteFilter !== "all" && alert.routeId !== alertsRouteFilter) return false;
    
    // Type filter
    if (alertTypeFilter !== "all" && alert.type !== alertTypeFilter) return false;
    
    // Severity filter
    if (alertSeverityFilter !== "all" && alert.severity !== alertSeverityFilter) return false;
    
    // Date range filter
    if (alertsDateRange.start && alert.createdAt) {
      const alertDate = new Date(alert.createdAt);
      const startDate = new Date(alertsDateRange.start);
      if (alertDate < startDate) return false;
    }
    if (alertsDateRange.end && alert.createdAt) {
      const alertDate = new Date(alert.createdAt);
      const endDate = new Date(alertsDateRange.end);
      endDate.setHours(23, 59, 59, 999); // End of day
      if (alertDate > endDate) return false;
    }
    
    return true;
  });

  // Helper functions for notification logs
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

  const getNotificationStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      sent: "default",
      failed: "destructive",
      delivered: "secondary",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Manage rider and driver communications</p>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList data-testid="support-tabs">
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <MessageSquare className="w-4 h-4 mr-2" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Megaphone className="w-4 h-4 mr-2" />
            Send Alert
          </TabsTrigger>
          <TabsTrigger value="active-alerts" data-testid="tab-active-alerts">
            <Bell className="w-4 h-4 mr-2" />
            Active Alerts
          </TabsTrigger>
          <TabsTrigger value="notification-logs" data-testid="tab-notification-logs">
            <Radio className="w-4 h-4 mr-2" />
            Notification Logs
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Message Inbox
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="show-archived" 
                      checked={showArchived}
                      onCheckedChange={(checked) => setShowArchived(!!checked)}
                      data-testid="checkbox-show-archived"
                    />
                    <label htmlFor="show-archived" className="text-sm cursor-pointer">
                      Show archived
                    </label>
                  </div>
                </div>
                
                {/* Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="inbox-route-filter" className="text-xs">Route</Label>
                    <Select value={inboxRouteFilter} onValueChange={setInboxRouteFilter}>
                      <SelectTrigger id="inbox-route-filter" data-testid="select-inbox-route-filter">
                        <SelectValue placeholder="All Routes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Routes</SelectItem>
                        {routes.map(route => (
                          <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="status-filter" className="text-xs">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter" data-testid="select-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="priority-filter" className="text-xs">Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger id="priority-filter" data-testid="select-priority-filter">
                        <SelectValue placeholder="All Priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="inbox-start-date" className="text-xs">Start Date</Label>
                    <Input
                      id="inbox-start-date"
                      type="date"
                      value={inboxDateRange.start}
                      onChange={(e) => setInboxDateRange(prev => ({ ...prev, start: e.target.value }))}
                      data-testid="input-inbox-start-date"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="inbox-end-date" className="text-xs">End Date</Label>
                    <Input
                      id="inbox-end-date"
                      type="date"
                      value={inboxDateRange.end}
                      onChange={(e) => setInboxDateRange(prev => ({ ...prev, end: e.target.value }))}
                      data-testid="input-inbox-end-date"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="inbox-search" className="text-xs">Search</Label>
                    <Input
                      id="inbox-search"
                      type="text"
                      placeholder="Search messages..."
                      value={inboxSearchText}
                      onChange={(e) => setInboxSearchText(e.target.value)}
                      data-testid="input-inbox-search"
                    />
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearInboxFilters}
                    data-testid="button-clear-inbox-filters"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Messages List */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No messages</p>
                  ) : (
                    filteredMessages.map((message) => (
                      <Card
                        key={`${message.messageType}-${message.id}`}
                        className={`cursor-pointer transition-colors ${
                          selectedMessage?.id === message.id ? "border-primary" : ""
                        }`}
                        onClick={() => {
                          // Mark message as read when clicked
                          if (message.status === "new") {
                            if (message.messageType === 'rider') {
                              markRiderMessageReadMutation.mutate(message.id);
                            } else {
                              markDriverMessageReadMutation.mutate(message.id);
                            }
                          }
                          setSelectedMessage(message);
                        }}
                        data-testid={`message-card-${message.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getMessageTypeIcon(message.messageType)}
                                <span className="font-medium">
                                  {message.messageType === 'rider' 
                                    ? (message as RiderMessage).riderName || "Anonymous Rider"
                                    : `Driver`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {message.priority && getPriorityBadge(message.priority)}
                                {getStatusBadge(message.status)}
                                {message.archivedAt && <Badge variant="secondary" className="text-xs"><Archive className="w-3 h-3 mr-1" />Archived</Badge>}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{message.message}</p>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Unknown"}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                <Bus className="w-3 h-3 mr-1" />
                                {getRouteName(message.routeId)}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Message Detail & Response */}
                <div>
                  {selectedMessage ? (
                    <Card>
                      <CardHeader>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              {getMessageTypeIcon(selectedMessage.messageType)}
                              Message Details
                            </CardTitle>
                            {selectedMessage.status !== "resolved" && !selectedMessage.archivedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkResolved(selectedMessage)}
                                data-testid="button-mark-resolved"
                              >
                                Mark Resolved
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedMessage.archivedAt ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => restoreMutation.mutate({ id: selectedMessage.id, messageType: selectedMessage.messageType })}
                                  disabled={restoreMutation.isPending}
                                  data-testid="button-restore-message"
                                >
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm("Permanently delete this message?")) {
                                      deleteMutation.mutate({ id: selectedMessage.id, messageType: selectedMessage.messageType });
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                  data-testid="button-delete-message"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                              </>
                            ) : (
                              <>
                                {selectedMessage.messageType === 'rider' && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => forwardToDriverMutation.mutate(selectedMessage.id)}
                                    disabled={forwardToDriverMutation.isPending}
                                    data-testid="button-forward-to-driver"
                                  >
                                    <Forward className="w-4 h-4 mr-2" />
                                    {forwardToDriverMutation.isPending ? "Forwarding..." : "Forward to Driver"}
                                  </Button>
                                )}
                                {selectedMessage.messageType === 'driver' && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => broadcastAsAlertMutation.mutate({ messageId: selectedMessage.id })}
                                    disabled={broadcastAsAlertMutation.isPending}
                                    data-testid="button-broadcast-alert"
                                  >
                                    <Radio className="w-4 h-4 mr-2" />
                                    {broadcastAsAlertMutation.isPending ? "Broadcasting..." : "Broadcast as Alert"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => archiveMutation.mutate({ id: selectedMessage.id, messageType: selectedMessage.messageType })}
                                  disabled={archiveMutation.isPending}
                                  data-testid="button-archive-message"
                                >
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-1">From:</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedMessage.messageType === 'rider'
                              ? (selectedMessage as RiderMessage).riderName || "Anonymous Rider"
                              : "Driver"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Route:</p>
                          <Badge variant="outline" className="text-xs">
                            <Bus className="w-3 h-3 mr-1" />
                            {getRouteName(selectedMessage.routeId)}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Message:</p>
                          <p className="text-sm">{selectedMessage.message}</p>
                        </div>
                        {selectedMessage.adminResponse && (
                          <div className="bg-muted p-3 rounded-md">
                            <p className="text-sm font-medium mb-1">Your Response:</p>
                            <p className="text-sm">{selectedMessage.adminResponse}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium mb-2">Send Response:</p>
                          <Textarea
                            placeholder="Type your response..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            className="mb-2"
                            data-testid="textarea-response"
                          />
                          <Button
                            onClick={handleRespond}
                            disabled={!responseText.trim() || respondMutation.isPending}
                            className="w-full"
                            data-testid="button-send-response"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {respondMutation.isPending ? "Sending..." : "Send Response"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="h-full flex items-center justify-center">
                      <CardContent className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Select a message to view details</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Broadcast to All Routes */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                Broadcast to All Routes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Send an alert to all active routes in your organization at once
              </p>
              <Button
                onClick={() => setBroadcastDialogOpen(true)}
                variant="default"
                data-testid="button-broadcast-all"
              >
                <Radio className="w-4 h-4 mr-2" />
                Broadcast Alert to All Routes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                Send Route Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Send broadcast alerts to all riders on a specific route
              </p>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {activeRoutes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active routes</p>
                ) : (
                  activeRoutes.map((route) => (
                    <Card key={route.id} className="hover-elevate" data-testid={`route-alert-card-${route.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{route.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {route.vehicleNumber ? `Vehicle: ${route.vehicleNumber}` : "No vehicle assigned"}
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              setAlertRoute(route);
                              setAlertDialogOpen(true);
                            }}
                            data-testid={`button-send-alert-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <Megaphone className="w-4 h-4 mr-2" />
                            Send Alert
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Alerts Tab */}
        <TabsContent value="active-alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Active Service Alerts
                </CardTitle>
                
                {/* Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="alerts-route-filter" className="text-xs">Route</Label>
                    <Select value={alertsRouteFilter} onValueChange={setAlertsRouteFilter}>
                      <SelectTrigger id="alerts-route-filter" data-testid="select-alerts-route-filter">
                        <SelectValue placeholder="All Routes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Routes</SelectItem>
                        {routes.map(route => (
                          <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="alert-type-filter" className="text-xs">Alert Type</Label>
                    <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
                      <SelectTrigger id="alert-type-filter" data-testid="select-alert-type-filter">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                        <SelectItem value="bus_change">Bus Change</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="alert-severity-filter" className="text-xs">Severity</Label>
                    <Select value={alertSeverityFilter} onValueChange={setAlertSeverityFilter}>
                      <SelectTrigger id="alert-severity-filter" data-testid="select-alert-severity-filter">
                        <SelectValue placeholder="All Severities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="alerts-start-date" className="text-xs">Start Date</Label>
                    <Input
                      id="alerts-start-date"
                      type="date"
                      value={alertsDateRange.start}
                      onChange={(e) => setAlertsDateRange(prev => ({ ...prev, start: e.target.value }))}
                      data-testid="input-alerts-start-date"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="alerts-end-date" className="text-xs">End Date</Label>
                    <Input
                      id="alerts-end-date"
                      type="date"
                      value={alertsDateRange.end}
                      onChange={(e) => setAlertsDateRange(prev => ({ ...prev, end: e.target.value }))}
                      data-testid="input-alerts-end-date"
                    />
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAlertsFilters}
                    data-testid="button-clear-alerts-filters"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage currently active alerts sent to riders
              </p>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredAlerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active alerts</p>
                ) : (
                  filteredAlerts.map((alert) => {
                      const route = routes.find(r => r.id === alert.routeId);
                      const alertType = alert.type === "delayed" ? { icon: Clock, color: "bg-yellow-500" } :
                                       alert.type === "bus_change" ? { icon: Bus, color: "bg-blue-500" } :
                                       alert.type === "cancelled" ? { icon: XCircle, color: "bg-red-500" } :
                                       { icon: AlertCircle, color: "bg-gray-500" };
                      const Icon = alertType.icon;

                      return (
                        <Card key={alert.id} className="hover-elevate" data-testid={`active-alert-${alert.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-1.5 rounded-full ${alertType.color} flex-shrink-0`}>
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-medium">{alert.title}</h3>
                                    <p className="text-sm text-muted-foreground">{route?.name || "Unknown route"}</p>
                                  </div>
                                  <Badge variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "default" : "secondary"}>
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm">{alert.message}</p>
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Sent {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "Unknown"}
                                    </span>
                                    {alert.activeUntil && (
                                      <span>
                                        Expires {new Date(alert.activeUntil).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => expireAlertMutation.mutate(alert.id)}
                                    disabled={expireAlertMutation.isPending}
                                    data-testid={`button-expire-alert-${alert.id}`}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Expire Now
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Logs Tab */}
        <TabsContent value="notification-logs" className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalNotificationCount.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">notifications logged</p>
            </CardContent>
          </Card>

          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
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

          {/* Notification History Card */}
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Loading notifications...</div>
                </div>
              ) : notificationLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No notifications found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or send some notifications to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {notificationLogs.map((log) => (
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
                              {getNotificationStatusBadge(log.status)}
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
        </TabsContent>
      </Tabs>

      {/* Broadcast Alert Dialog */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent className="sm:max-w-[525px]" data-testid="dialog-broadcast-alert">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Broadcast Alert to All Routes
            </DialogTitle>
            <DialogDescription>
              This alert will be sent to all active routes in your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-type">Alert Type *</Label>
              <Select
                value={broadcastFormData.type}
                onValueChange={(value) => setBroadcastFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="broadcast-type" data-testid="select-broadcast-type">
                  <SelectValue placeholder="Select alert type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Notice</SelectItem>
                  <SelectItem value="delayed">Service Delayed</SelectItem>
                  <SelectItem value="bus_change">Bus Change</SelectItem>
                  <SelectItem value="cancelled">Service Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="broadcast-severity">Severity</Label>
              <Select
                value={broadcastFormData.severity}
                onValueChange={(value) => setBroadcastFormData(prev => ({ ...prev, severity: value }))}
              >
                <SelectTrigger id="broadcast-severity" data-testid="select-broadcast-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="broadcast-title">Title *</Label>
              <Input
                id="broadcast-title"
                value={broadcastFormData.title}
                onChange={(e) => setBroadcastFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., School Closure - Snow Day"
                maxLength={100}
                data-testid="input-broadcast-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Message *</Label>
              <Textarea
                id="broadcast-message"
                value={broadcastFormData.message}
                onChange={(e) => setBroadcastFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Provide details about this alert..."
                className="min-h-[100px]"
                maxLength={500}
                data-testid="textarea-broadcast-message"
              />
              <p className="text-xs text-muted-foreground">
                {broadcastFormData.message.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="broadcast-expires">Expires (Optional)</Label>
              <Input
                id="broadcast-expires"
                type="datetime-local"
                value={broadcastFormData.activeUntil}
                onChange={(e) => setBroadcastFormData(prev => ({ ...prev, activeUntil: e.target.value }))}
                data-testid="input-broadcast-expires"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for manual expiration
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBroadcastDialogOpen(false)}
              data-testid="button-cancel-broadcast"
            >
              Cancel
            </Button>
            <Button
              onClick={() => broadcastAlertMutation.mutate(broadcastFormData)}
              disabled={!broadcastFormData.title || !broadcastFormData.message || broadcastAlertMutation.isPending}
              data-testid="button-send-broadcast"
            >
              {broadcastAlertMutation.isPending ? "Broadcasting..." : "Broadcast to All Routes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Alert Dialog */}
      {alertRoute && (
        <SendAlertDialog
          open={alertDialogOpen}
          onOpenChange={setAlertDialogOpen}
          route={alertRoute}
        />
      )}
    </div>
  );
}
