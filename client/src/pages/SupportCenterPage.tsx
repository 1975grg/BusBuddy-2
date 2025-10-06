import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User, Truck, Clock, Send, Megaphone, Archive, ArchiveRestore, Trash2, AlertCircle, Bell, XCircle, Bus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SendAlertDialog } from "@/components/SendAlertDialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { RiderMessage, DriverMessage, Route, ServiceAlert } from "@shared/schema";

type Message = (RiderMessage | DriverMessage) & { messageType: 'rider' | 'driver' };

export default function SupportCenterPage() {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [responseText, setResponseText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("new");
  const [showArchived, setShowArchived] = useState(false);
  const [alertRoute, setAlertRoute] = useState<Route | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  // Fetch current admin user to get organization ID
  const { data: currentAdmin } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=org_admin");
      const users = await response.json();
      return users[0];
    },
  });

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
      const response = await fetch(`/api/rider-messages?organization_id=${currentAdmin.organizationId}`);
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
    refetchInterval: 10000,
  });

  // Fetch driver messages
  const { data: driverMessages = [] } = useQuery<DriverMessage[]>({
    queryKey: ["/api/driver-messages", currentAdmin?.organizationId],
    queryFn: async () => {
      if (!currentAdmin?.organizationId) return [];
      const response = await fetch(`/api/driver-messages?organization_id=${currentAdmin.organizationId}`);
      return response.json();
    },
    enabled: !!currentAdmin?.organizationId,
    refetchInterval: 10000,
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

  // Filter messages by status
  const filteredMessages = statusFilter === "all" 
    ? allMessages 
    : allMessages.filter(m => m.status === statusFilter);

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
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Message Inbox
                </CardTitle>
                <div className="flex items-center gap-3">
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
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Messages</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Messages List */}
                <div className="space-y-3">
                  {filteredMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No messages</p>
                  ) : (
                    filteredMessages.map((message) => (
                      <Card
                        key={`${message.messageType}-${message.id}`}
                        className={`cursor-pointer transition-colors ${
                          selectedMessage?.id === message.id ? "border-primary" : ""
                        }`}
                        onClick={() => setSelectedMessage(message)}
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
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Unknown"}
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
              <div className="space-y-3">
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
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Active Service Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage currently active alerts sent to riders
              </p>
              <div className="space-y-3">
                {serviceAlerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active alerts</p>
                ) : (
                  serviceAlerts.map((alert) => {
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
      </Tabs>

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
