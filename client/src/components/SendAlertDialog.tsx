import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Clock, Bus, XCircle, Calendar } from "lucide-react";
import { insertServiceAlertSchema } from "@shared/schema";
import type { Route } from "@shared/schema";
import { useState } from "react";

interface SendAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route;
}

const alertTypes = [
  { value: "delayed", label: "Service Delayed", icon: Clock, color: "bg-yellow-500" },
  { value: "bus_change", label: "Bus Change", icon: Bus, color: "bg-blue-500" },
  { value: "cancelled", label: "Service Cancelled", icon: XCircle, color: "bg-red-500" },
  { value: "general", label: "General Notice", icon: AlertCircle, color: "bg-gray-500" }
] as const;

const severityLevels = [
  { value: "info", label: "Info", description: "Minor updates and notices" },
  { value: "warning", label: "Warning", description: "Important service changes" },
  { value: "critical", label: "Critical", description: "Critical alerts requiring immediate attention" }
] as const;

const expirationOptions = [
  { value: "end-of-day", label: "End of Day", description: "Expires at 11:59 PM today" },
  { value: "morning", label: "Morning Only", description: "Expires at 12:00 PM today" },
  { value: "afternoon", label: "Afternoon Only", description: "Expires at 11:59 PM today" },
  { value: "tomorrow", label: "Until Tomorrow", description: "Expires at 11:59 PM tomorrow" },
  { value: "3-days", label: "Next 3 Days", description: "Expires in 3 days at 11:59 PM" },
  { value: "custom", label: "Custom Date/Time", description: "Choose your own expiration" },
  { value: "manual", label: "Until Manually Cleared", description: "No automatic expiration" }
] as const;

// Helper function to calculate expiration timestamp
function calculateExpiration(option: string, customDate?: string): Date | null {
  const now = new Date();
  const result = new Date();
  
  switch (option) {
    case "end-of-day":
    case "afternoon":
      result.setHours(23, 59, 59, 999);
      return result;
    
    case "morning":
      result.setHours(12, 0, 0, 0);
      return result;
    
    case "tomorrow":
      result.setDate(result.getDate() + 1);
      result.setHours(23, 59, 59, 999);
      return result;
    
    case "3-days":
      result.setDate(result.getDate() + 3);
      result.setHours(23, 59, 59, 999);
      return result;
    
    case "custom":
      return customDate ? new Date(customDate) : null;
    
    case "manual":
    default:
      return null;
  }
}

// Client-side schema without server-controlled fields
const clientAlertSchema = insertServiceAlertSchema.omit({ 
  createdByUserId: true, 
  organizationId: true 
}).extend({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  message: z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
});

type ClientAlertData = z.infer<typeof clientAlertSchema>;

export function SendAlertDialog({ open, onOpenChange, route }: SendAlertDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expirationOption, setExpirationOption] = useState("end-of-day");
  const [customDateTime, setCustomDateTime] = useState("");

  const form = useForm<ClientAlertData>({
    resolver: zodResolver(clientAlertSchema),
    defaultValues: {
      type: "general",
      severity: "warning",
      title: "",
      message: "",
      routeId: route.id,
      activeUntil: null,
    },
  });

  const sendAlertMutation = useMutation({
    mutationFn: async (alertData: ClientAlertData) => {
      return await apiRequest("POST", "/api/service-alerts", alertData);
    },
    onSuccess: () => {
      // Invalidate organization-specific query to refresh Active Alerts tab
      queryClient.invalidateQueries({ queryKey: ["/api/service-alerts", route.organizationId] });
      toast({
        title: "Alert sent",
        description: "Service alert has been sent to all riders on this route.",
      });
      handleClose();
    },
    onError: (error) => {
      console.error("Error sending alert:", error);
      toast({
        title: "Error",
        description: "Failed to send alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    setExpirationOption("end-of-day");
    setCustomDateTime("");
    onOpenChange(false);
  };

  const onSubmit = (data: ClientAlertData) => {
    const expiration = calculateExpiration(expirationOption, customDateTime);
    const alertData = {
      ...data,
      activeUntil: expiration,
    };
    sendAlertMutation.mutate(alertData);
  };

  const selectedAlertType = alertTypes.find(type => type.value === form.watch("type"));
  const currentSeverity = form.watch("severity");
  const currentTitle = form.watch("title");
  const currentMessage = form.watch("message");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]" data-testid="dialog-send-alert">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Send Alert to Riders
          </DialogTitle>
          <DialogDescription>
            Send a service alert to all riders on <strong>{route.name}</strong>
            {route.vehicleNumber && <span> (Vehicle {route.vehicleNumber})</span>}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="alert-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Alert Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-alert-type">
                        <SelectValue placeholder="Select alert type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {alertTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
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

            {/* Severity Level */}
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-severity">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {severityLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="space-y-1">
                            <div className="font-medium">{level.label}</div>
                            <div className="text-xs text-muted-foreground">{level.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expiration Option */}
            <div>
              <FormLabel>Alert Expiration</FormLabel>
              <Select onValueChange={setExpirationOption} defaultValue={expirationOption}>
                <SelectTrigger data-testid="select-expiration" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expirationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="space-y-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="mt-2">
                Choose when this alert should automatically expire
              </FormDescription>
            </div>

            {/* Custom Date/Time Picker */}
            {expirationOption === "custom" && (
              <div>
                <FormLabel>Expiration Date & Time</FormLabel>
                <Input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="mt-2"
                  data-testid="input-custom-datetime"
                />
              </div>
            )}

            {/* Alert Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Title *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief title for the alert"
                      maxLength={100}
                      data-testid="input-alert-title"
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {currentTitle.length}/100 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Alert Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Detailed message about the service alert"
                      rows={4}
                      maxLength={500}
                      data-testid="textarea-alert-message"
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {currentMessage.length}/500 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {form.watch("type") && currentTitle && currentMessage && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Preview:</div>
                <div className="flex items-start gap-3">
                  {selectedAlertType && (
                    <div className={`p-1.5 rounded-full ${selectedAlertType.color}`}>
                      <selectedAlertType.icon className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{currentTitle}</h4>
                      <Badge variant={currentSeverity === "critical" ? "destructive" : currentSeverity === "warning" ? "default" : "secondary"}>
                        {severityLevels.find(s => s.value === currentSeverity)?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{currentMessage}</p>
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
            form="alert-form"
            disabled={sendAlertMutation.isPending || !form.formState.isValid}
            data-testid="button-send-alert"
          >
            {sendAlertMutation.isPending ? "Sending..." : "Send Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}