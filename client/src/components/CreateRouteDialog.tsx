import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableRouteStops } from "./SortableRouteStops";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { RouteType, RouteStatus } from "@shared/schema";

const createRouteSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  type: z.enum(["shuttle", "bus"]),
  status: z.enum(["active", "inactive"]).default("active"),
  vehicleNumber: z.string().optional(),
  organizationId: z.string().min(1, "Organization is required"),
  stops: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Stop name is required"),
    address: z.string().optional(),
    placeId: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    estimatedArrival: z.string().optional(),
  })).min(1, "At least one stop is required"),
});

type CreateRouteData = z.infer<typeof createRouteSchema>;

interface CreateRouteDialogProps {
  organizationId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateRouteDialog({ organizationId, trigger, onSuccess }: CreateRouteDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateRouteData>({
    resolver: zodResolver(createRouteSchema),
    defaultValues: {
      name: "",
      type: "shuttle",
      status: "active",
      vehicleNumber: "",
      organizationId,
      stops: [{ id: crypto.randomUUID(), name: "", estimatedArrival: "" }],
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (data: CreateRouteData) => {
      // First create the route
      const routeData = {
        name: data.name,
        type: data.type,
        status: data.status,
        vehicleNumber: data.vehicleNumber || null,
        organizationId: data.organizationId,
      };
      
      console.log("Creating route with data:", routeData);
      
      const routeResponse = await apiRequest("POST", "/api/routes", routeData);
      
      const route = await routeResponse.json();

      // Then create the stops
      for (let i = 0; i < data.stops.length; i++) {
        const stop = data.stops[i];
        await apiRequest("POST", `/api/routes/${route.id}/stops`, {
          name: stop.name,
          address: stop.address || null,
          placeId: stop.placeId || null,
          latitude: stop.latitude || null,
          longitude: stop.longitude || null,
          orderIndex: i + 1,
          estimatedArrival: stop.estimatedArrival || null,
        });
      }

      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route created",
        description: "Your new route has been created successfully.",
      });
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error creating route:", error);
      toast({
        title: "Error",
        description: "Failed to create route. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateRouteData) => {
    createRouteMutation.mutate(data);
  };

  const stops = form.watch("stops");

  const addStop = () => {
    const currentStops = form.getValues("stops");
    form.setValue("stops", [...currentStops, { 
      id: crypto.randomUUID(), 
      name: "", 
      estimatedArrival: "" 
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="button-create-route">
            <Plus className="w-4 h-4 mr-2" />
            Add Route
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Route</DialogTitle>
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
                      <Input {...field} placeholder="e.g., Main Campus Loop" data-testid="input-route-name" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-route-type">
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
                      <Input {...field} placeholder="e.g., SHUTTLE-001" data-testid="input-vehicle-number" />
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
                    <FormLabel>Initial Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-route-status">
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
              stops={stops}
              control={form.control}
              setValue={form.setValue}
              watch={form.watch}
              onStopsChange={handleStopsChange}
              onAddStop={addStop}
              onRemoveStop={removeStop}
            />
            
            <FormMessage>{form.formState.errors.stops?.message}</FormMessage>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createRouteMutation.isPending}
                data-testid="button-submit-route"
              >
                {createRouteMutation.isPending ? "Creating..." : "Create Route"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}