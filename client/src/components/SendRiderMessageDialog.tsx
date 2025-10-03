import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { MessageSquare, Package, MapPin, HelpCircle } from "lucide-react";
import { insertRiderMessageSchema } from "@shared/schema";
import type { Route } from "@shared/schema";

interface SendRiderMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route;
}

const messageTypes = [
  { value: "lost_items", label: "Lost Items", icon: Package, description: "Report lost belongings on the bus" },
  { value: "pickup_change", label: "Pickup Change Request", icon: MapPin, description: "Request changes to pickup location or time" },
  { value: "general", label: "General Issue", icon: HelpCircle, description: "Other transportation-related concerns" }
] as const;

// Client-side schema without server-controlled fields
const clientMessageSchema = insertRiderMessageSchema.omit({ 
  userId: true,
  organizationId: true 
}).extend({
  message: z.string().min(10, "Please provide more details (at least 10 characters)").max(1000, "Message must be 1000 characters or less"),
  riderName: z.string().optional(),
  riderEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
});

type ClientMessageData = z.infer<typeof clientMessageSchema>;

export function SendRiderMessageDialog({ open, onOpenChange, route }: SendRiderMessageDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ClientMessageData>({
    resolver: zodResolver(clientMessageSchema),
    defaultValues: {
      type: "general",
      message: "",
      routeId: route.id,
      riderName: "",
      riderEmail: "",
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: ClientMessageData) => {
      return await apiRequest("POST", "/api/rider-messages", messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rider-messages"] });
      toast({
        title: "Message sent",
        description: "Your message has been sent to the transportation team. They will respond soon.",
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
  const currentRiderName = form.watch("riderName");
  const currentRiderEmail = form.watch("riderEmail");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-send-rider-message">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Contact Transportation Team
          </DialogTitle>
          <DialogDescription>
            Send a message to the transportation team about <strong>{route.name}</strong>
            {route.vehicleNumber && <span> (Vehicle {route.vehicleNumber})</span>}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="rider-message-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                  <FormLabel>Please describe your issue in detail *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={selectedMessageType ? 
                        `Please provide details about your ${selectedMessageType.label.toLowerCase()}...` : 
                        "Please describe your transportation-related issue..."
                      }
                      rows={5}
                      maxLength={1000}
                      data-testid="textarea-rider-message"
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {currentMessage.length}/1000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rider Name */}
            <FormField
              control={form.control}
              name="riderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Your name"
                      maxLength={100}
                      data-testid="input-rider-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rider Email */}
            <FormField
              control={form.control}
              name="riderEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Email (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="email"
                      placeholder="your.email@example.com"
                      maxLength={200}
                      data-testid="input-rider-email"
                    />
                  </FormControl>
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
                    {(currentRiderName || currentRiderEmail) && (
                      <p className="text-xs text-muted-foreground">
                        Contact: {currentRiderName} {currentRiderEmail && `(${currentRiderEmail})`}
                      </p>
                    )}
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
            form="rider-message-form"
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