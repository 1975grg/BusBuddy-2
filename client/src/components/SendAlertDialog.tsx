import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Clock, Bus, XCircle } from "lucide-react";
import { insertServiceAlertSchema } from "@shared/schema";
import type { Route } from "@shared/schema";

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
      queryClient.invalidateQueries({ queryKey: ["/api/service-alerts"] });
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
    onOpenChange(false);
  };

  const onSubmit = (data: ClientAlertData) => {
    sendAlertMutation.mutate(data);
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