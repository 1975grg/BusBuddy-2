import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SortableRouteStops } from "./SortableRouteStops";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Users } from "lucide-react";
import type { Route, RouteStop, RiderProfile } from "@shared/schema";

const editRouteSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  type: z.enum(["shuttle", "bus"]),
  status: z.enum(["active", "inactive"]),
  vehicleNumber: z.string().optional(),
  stops: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Stop name is required"),
    address: z.string().optional(),
    placeId: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    approachingRadiusFt: z.number().optional(),
    arrivalRadiusFt: z.number().optional(),
    orderIndex: z.number().optional(),
  })).min(1, "At least one stop is required"),
});

type EditRouteData = z.infer<typeof editRouteSchema>;

interface EditRouteDialogProps {
  route: Route;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditRouteDialog({ route, open, onOpenChange, onSuccess }: EditRouteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current stops for the route
  const { data: stops = [] } = useQuery<RouteStop[]>({
    queryKey: ["/api/routes", route.id, "stops"],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${route.id}/stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");
      return response.json();
    },
    enabled: open && !!route.id,
  });

  // Fetch riders for the route
  const { data: riders = [] } = useQuery<Array<RiderProfile & { subscriptionId: string; notificationMode: string }>>({
    queryKey: ["/api/routes", route.id, "riders"],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${route.id}/riders`);
      if (!response.ok) throw new Error("Failed to fetch riders");
      return response.json();
    },
    enabled: open && !!route.id,
  });

  const form = useForm<EditRouteData>({
    resolver: zodResolver(editRouteSchema),
    defaultValues: {
      name: "",
      type: "bus",
      status: "active",
      vehicleNumber: "",
      stops: [],
    },
  });

  // Update form values when route or stops data changes
  useEffect(() => {
    if (route && stops.length >= 0) {
      const formStops = stops.length > 0 ? stops
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(stop => ({
          id: stop.id || crypto.randomUUID(),
          name: stop.name,
          address: stop.address || undefined,
          placeId: stop.placeId || undefined,
          latitude: stop.latitude ? parseFloat(stop.latitude) : undefined,
          longitude: stop.longitude ? parseFloat(stop.longitude) : undefined,
          approachingRadiusFt: stop.approachingRadiusFt || 800,
          arrivalRadiusFt: stop.arrivalRadiusFt || 250,
          orderIndex: stop.orderIndex,
        })) : [{ 
          id: crypto.randomUUID(), 
          name: "", 
          approachingRadiusFt: 800,
          arrivalRadiusFt: 250 
        }];

      form.reset({
        name: route.name,
        type: route.type as "shuttle" | "bus",
        status: route.status as "active" | "inactive",
        vehicleNumber: route.vehicleNumber || "",
        stops: formStops,
      });
    }
  }, [route, stops, form]);

  const updateRouteMutation = useMutation({
    mutationFn: async (data: EditRouteData) => {
      // Update the route
      const routeData = {
        name: data.name,
        type: data.type,
        status: data.status,
        vehicleNumber: data.vehicleNumber || null,
      };
      
      console.log("Updating route with data:", routeData);
      
      const routeResponse = await apiRequest("PUT", `/api/routes/${route.id}`, routeData);
      const updatedRoute = await routeResponse.json();

      // Delete existing stops and recreate them
      await apiRequest("DELETE", `/api/routes/${route.id}/stops`);

      // Create new stops
      for (let i = 0; i < data.stops.length; i++) {
        const stop = data.stops[i];
        await apiRequest("POST", `/api/routes/${route.id}/stops`, {
          name: stop.name,
          address: stop.address || null,
          placeId: stop.placeId || null,
          latitude: stop.latitude ? String(stop.latitude) : null,
          longitude: stop.longitude ? String(stop.longitude) : null,
          orderIndex: i + 1,
          approachingRadiusFt: stop.approachingRadiusFt || 800,
          arrivalRadiusFt: stop.arrivalRadiusFt || 250,
        });
      }

      return updatedRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routes", route.id, "stops"] });
      toast({
        title: "Route updated",
        description: "Your route has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error updating route:", error);
      toast({
        title: "Error",
        description: "Failed to update route. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteRiderMutation = useMutation({
    mutationFn: async ({ riderId, riderName }: { riderId: string; riderName?: string }) => {
      const response = await apiRequest("DELETE", `/api/routes/${route.id}/riders/${riderId}`);
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes", route.id, "riders"] });
      toast({
        title: "Rider removed",
        description: `${variables.riderName || "The rider"} has been removed from this route and notified via SMS.`,
      });
    },
    onError: (error) => {
      console.error("Error removing rider:", error);
      toast({
        title: "Error",
        description: "Failed to remove rider. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditRouteData) => {
    updateRouteMutation.mutate(data);
  };

  const formStops = form.watch("stops");

  const addStop = () => {
    const currentStops = form.getValues("stops");
    form.setValue("stops", [...currentStops, { 
      id: crypto.randomUUID(), 
      name: "", 
      approachingRadiusFt: 800,
      arrivalRadiusFt: 250 
    }]);
  };

  const removeStop = (stopId: string) => {
    const currentStops = form.getValues("stops");
    if (currentStops.length > 1) {
      form.setValue("stops", currentStops.filter((stop) => stop.id !== stopId));
    }
  };

  const handleStopsChange = (newStops: any[]) => {
    form.setValue("stops", newStops);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Route</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Main Campus Loop" data-testid="input-edit-route-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-route-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="shuttle">Shuttle</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Number (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., SHUTTLE-001" data-testid="input-edit-vehicle-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-route-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <SortableRouteStops
              stops={formStops}
              control={form.control}
              setValue={form.setValue}
              watch={form.watch}
              onStopsChange={handleStopsChange}
              onAddStop={addStop}
              onRemoveStop={removeStop}
            />
            
            <FormMessage>{form.formState.errors.stops?.message}</FormMessage>

            {/* Rider Management Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Subscribed Riders ({riders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No riders have subscribed to this route yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {riders.map((rider) => (
                      <div 
                        key={rider.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        data-testid={`rider-item-${rider.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {rider.name || "Unnamed Rider"}
                            </span>
                            <Badge variant={rider.notificationMode === "always" ? "default" : "secondary"}>
                              {rider.notificationMode === "always" ? "Auto" : "Manual"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {rider.phoneNumber}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-remove-rider-${rider.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Rider</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove{" "}
                                <strong>{rider.name || rider.phoneNumber}</strong> from this route?
                                They will receive an SMS notification about the removal.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteRiderMutation.mutate({ 
                                  riderId: rider.id, 
                                  riderName: rider.name || rider.phoneNumber 
                                })}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={deleteRiderMutation.isPending}
                              >
                                {deleteRiderMutation.isPending ? "Removing..." : "Remove Rider"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateRouteMutation.isPending}
                data-testid="button-update-route"
              >
                {updateRouteMutation.isPending ? "Updating..." : "Update Route"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}