import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, User, Truck, Clock, CheckCircle2, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RiderMessage, DriverMessage } from "@shared/schema";

type Message = (RiderMessage | DriverMessage) & { messageType: 'rider' | 'driver' };

export default function AdminMessagesPage() {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [responseText, setResponseText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch current admin user to get organization ID and user ID
  const { data: currentAdmin } = useQuery({
    queryKey: ["/api/users", "org_admin"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=org_admin");
      const users = await response.json();
      return users[0]; // Get first org admin for now - TODO: Get from auth context
    },
  });

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
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">View and respond to messages from riders and drivers</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Inbox
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
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkResolved(selectedMessage)}
                          data-testid="button-mark-resolved"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
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
                          : `Driver`}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Message Type:</p>
                      <Badge variant="outline">{selectedMessage.type}</Badge>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Message:</p>
                      <p className="text-sm">{selectedMessage.message}</p>
                    </div>

                    {selectedMessage.adminResponse && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Your Response:</p>
                        <p className="text-sm">{selectedMessage.adminResponse}</p>
                      </div>
                    )}

                    {!selectedMessage.adminResponse && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Send Response:</p>
                        <Textarea
                          placeholder="Type your response here..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
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
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-full min-h-[300px]">
                    <p className="text-muted-foreground">Select a message to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
