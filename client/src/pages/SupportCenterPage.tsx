import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User, Truck, Clock, Send, Megaphone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SendAlertDialog } from "@/components/SendAlertDialog";
import type { RiderMessage, DriverMessage, Route } from "@shared/schema";

type Message = (RiderMessage | DriverMessage) & { messageType: 'rider' | 'driver' };

export default function SupportCenterPage() {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [responseText, setResponseText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  // Combine and tag messages
  const allMessages: Message[] = [
    ...riderMessages.map(m => ({ ...m, messageType: 'rider' as const })),
    ...driverMessages.map(m => ({ ...m, messageType: 'driver' as const }))
  ].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Filter messages
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
        <h1 className="text-2xl font-bold">Support Center</h1>
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
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Message Inbox
                </CardTitle>
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
                              {getStatusBadge(message.status)}
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
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {getMessageTypeIcon(selectedMessage.messageType)}
                            Message Details
                          </CardTitle>
                          {selectedMessage.status !== "resolved" && (
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
