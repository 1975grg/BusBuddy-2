import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
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
    name: z.string().min(1, "Stop name is required"),
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
      stops: [{ name: "", estimatedArrival: "" }],
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (data: CreateRouteData) => {
      // First create the route
      const route = await apiRequest("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          status: data.status,
          vehicleNumber: data.vehicleNumber || null,
          organizationId: data.organizationId,
        }),
      });

      // Then create the stops
      for (let i = 0; i < data.stops.length; i++) {
        const stop = data.stops[i];
        await apiRequest(`/api/routes/${route.id}/stops`, {
          method: "POST",
          body: JSON.stringify({
            name: stop.name,
            orderIndex: i + 1,
            estimatedArrival: stop.estimatedArrival || null,
          }),
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
    form.setValue("stops", [...currentStops, { name: "", estimatedArrival: "" }]);
  };

  const removeStop = (index: number) => {
    const currentStops = form.getValues("stops");
    if (currentStops.length > 1) {
      form.setValue("stops", currentStops.filter((_, i) => i !== index));
    }
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Route Stops</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStop}
                  data-testid="button-add-stop"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stop
                </Button>
              </div>

              <div className="space-y-3">
                {stops.map((stop, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Badge variant="outline" className="min-w-8 h-6 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`stops.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Stop name" data-testid={`input-stop-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="w-32">
                      <FormField
                        control={form.control}
                        name={`stops.${index}.estimatedArrival`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="ETA (e.g., 5 min)" data-testid={`input-stop-eta-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {stops.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStop(index)}
                        data-testid={`button-remove-stop-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <FormMessage>{form.formState.errors.stops?.message}</FormMessage>
            </div>

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