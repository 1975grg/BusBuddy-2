import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquare, AlertCircle, Wrench, Calendar, HelpCircle } from "lucide-react";
import { insertDriverMessageSchema } from "@shared/schema";
import type { Route } from "@shared/schema";

interface SendDriverMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route;
  driverUserId: string;
}

const messageTypes = [
  { value: "route_issue", label: "Route Issue", icon: AlertCircle, description: "Problems with the route or traffic" },
  { value: "vehicle_problem", label: "Vehicle Problem", icon: Wrench, description: "Mechanical or vehicle-related issues" },
  { value: "schedule_change", label: "Schedule Change", icon: Calendar, description: "Request schedule modifications" },
  { value: "general", label: "General Issue", icon: HelpCircle, description: "Other concerns or questions" }
] as const;

// Client-side schema
const clientMessageSchema = insertDriverMessageSchema.omit({ 
  organizationId: true 
}).extend({
  message: z.string().min(10, "Please provide more details (at least 10 characters)").max(1000, "Message must be 1000 characters or less"),
});

type ClientMessageData = z.infer<typeof clientMessageSchema>;

export function SendDriverMessageDialog({ open, onOpenChange, route, driverUserId }: SendDriverMessageDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ClientMessageData>({
    resolver: zodResolver(clientMessageSchema),
    defaultValues: {
      type: "general",
      message: "",
      routeId: route.id,
      driverUserId: driverUserId,
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: ClientMessageData) => {
      return await apiRequest("POST", "/api/driver-messages", {
        ...messageData,
        organizationId: route.organizationId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-messages"] });
      toast({
        title: "Message sent",
        description: "Your message has been sent to the admin team. They will respond soon.",
      });
      handleClose();
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const onSubmit = (data: ClientMessageData) => {
    sendMessageMutation.mutate(data);
  };

  const selectedMessageType = messageTypes.find(type => type.value === form.watch("type"));
  const currentMessage = form.watch("message");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-send-driver-message">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Contact Admin Team
          </DialogTitle>
          <DialogDescription>
            Send a message to the admin team about <strong>{route.name}</strong>
            {route.vehicleNumber && <span> (Vehicle {route.vehicleNumber})</span>}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="driver-message-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Message Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you need help with? *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-message-type">
                        <SelectValue placeholder="Select message type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {messageTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{type.label}</div>
                                <div className="text-xs text-muted-foreground">{type.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message Content */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Please describe the issue in detail *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={selectedMessageType ? 
                        `Please provide details about the ${selectedMessageType.label.toLowerCase()}...` : 
                        "Please describe the issue..."
                      }
                      rows={5}
                      maxLength={1000}
                      data-testid="textarea-driver-message"
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {currentMessage.length}/1000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {form.watch("type") && currentMessage && currentMessage.length >= 10 && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Message Preview:</div>
                <div className="flex items-start gap-3">
                  {selectedMessageType && (
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <selectedMessageType.icon className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-medium">{selectedMessageType?.label}</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="driver-message-form"
            disabled={sendMessageMutation.isPending || !form.formState.isValid}
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
