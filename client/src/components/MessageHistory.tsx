import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, Archive, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  type: string;
  message: string;
  status: "new" | "read" | "resolved";
  adminResponse?: string | null;
  respondedAt?: Date | null;
  createdAt: Date;
  riderName?: string | null;
  riderEmail?: string | null;
  userId?: string | null;
  driverUserId?: string | null;
}

interface MessageHistoryProps {
  userType: "rider" | "driver";
  routeId: string;
  userId?: string;
}

export function MessageHistory({ userType, routeId, userId }: MessageHistoryProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  
  const endpoint = userType === "rider" 
    ? `/api/rider-messages?route_id=${routeId}`
    : `/api/driver-messages?route_id=${routeId}`;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  const archiveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const archiveEndpoint = userType === "rider" 
        ? `/api/rider-messages/${messageId}/archive`
        : `/api/driver-messages/${messageId}/archive`;
      return await apiRequest("PATCH", archiveEndpoint, {
        archivedByUserId: userId || ""
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Message archived",
        description: "Your message has been archived successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const deleteEndpoint = userType === "rider" 
        ? `/api/rider-messages/${messageId}`
        : `/api/driver-messages/${messageId}`;
      return await apiRequest("DELETE", deleteEndpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Message deleted",
        description: "Your message has been permanently deleted.",
      });
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (messageToDelete) {
      deleteMutation.mutate(messageToDelete);
    }
  };

  // Show all messages for the route
  const userMessages = messages;
  
  // Helper function to check if current user owns the message
  const isOwnMessage = (message: Message) => {
    if (!userId) return false;
    if (userType === "driver") {
      return message.driverUserId === userId;
    } else {
      return message.userId === userId;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  if (userMessages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            My Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No messages yet. Use the "Contact {userType === "rider" ? "Support" : "Admin"}" button to send a message.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            My Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userMessages.map((message) => (
            <div
              key={message.id}
              className="border rounded-lg p-4 space-y-3"
              data-testid={`message-${message.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {message.type.replace(/_/g, " ")}
                    </Badge>
                    {message.status === "resolved" && (
                      <Badge variant="secondary" className="text-xs">
                        Resolved
                      </Badge>
                    )}
                    {message.adminResponse && !message.status.includes("resolved") && (
                      <Badge className="bg-green-500 text-white text-xs">
                        Responded
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {isOwnMessage(message) && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => archiveMutation.mutate(message.id)}
                      disabled={archiveMutation.isPending}
                      data-testid={`button-archive-${message.id}`}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteClick(message.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${message.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Your message:</p>
                  <p className="text-sm">{message.message}</p>
                </div>

                {message.adminResponse && (
                  <div className="bg-muted/50 rounded-md p-3 border-l-4 border-primary">
                    <p className="text-sm font-medium text-primary mb-1">Admin response:</p>
                    <p className="text-sm">{message.adminResponse}</p>
                    {message.respondedAt && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(message.respondedAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
