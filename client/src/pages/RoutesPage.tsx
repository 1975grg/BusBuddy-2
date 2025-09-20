import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Search } from "lucide-react";
import { RouteCard } from "@/components/RouteCard";
import { CreateRouteDialog } from "@/components/CreateRouteDialog";
import { EditRouteDialog } from "@/components/EditRouteDialog";
import { SendAlertDialog } from "@/components/SendAlertDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Route, RouteStop, Organization } from "@shared/schema";

interface RouteWithStops extends Route {
  stops: RouteStop[];
}

type StatusFilter = "all" | "active" | "inactive";

export default function RoutesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [alertRoute, setAlertRoute] = useState<Route | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get the default organization for now - in a real app this would be from user context
  const { data: routes = [], isLoading, error } = useQuery<RouteWithStops[]>({
    queryKey: ["/api/routes"],
  });

  const filteredRoutes = routes.filter(route => {
    // Filter by search term
    const matchesSearch = searchTerm === "" || 
      route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by status
    const matchesStatus = statusFilter === "all" || route.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get the first organization from system admin API for now - in real app this would come from user context
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/system/organizations"],
  });
  
  const organizationId = organizations[0]?.id || "";

  // Toggle route status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ routeId, newStatus }: { routeId: string; newStatus: "active" | "inactive" }) => {
      return await apiRequest("PUT", `/api/routes/${routeId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({
        title: "Route updated",
        description: "Route status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating route status:", error);
      toast({
        title: "Error",
        description: "Failed to update route status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendAlert = (route: Route) => {
    setAlertRoute(route);
    setAlertDialogOpen(true);
  };

  const handleToggleStatus = (routeId: string, currentStatus: "active" | "inactive") => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    toggleStatusMutation.mutate({ routeId, newStatus });
  };

  const handleEditRoute = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      setEditingRoute(route);
      setEditDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routes</h1>
          <p className="text-muted-foreground">Manage your bus and shuttle routes</p>
        </div>
        <CreateRouteDialog organizationId={organizationId} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-routes"
          />
        </div>
        
        <ToggleGroup 
          type="single" 
          value={statusFilter} 
          onValueChange={(value) => {
            if (value) {
              setStatusFilter(value as StatusFilter);
            }
          }}
          data-testid="toggle-status-filter"
        >
          <ToggleGroupItem value="all" data-testid="toggle-all">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="active" data-testid="toggle-active">
            Active
          </ToggleGroupItem>
          <ToggleGroupItem value="inactive" data-testid="toggle-inactive">
            Inactive
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading routes. Please try again.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRoutes.map((route) => {
              // Transform stops for RouteCard component
              const transformedStops = route.stops.map(stop => ({
                id: stop.id,
                name: stop.name,
                eta: undefined, // ETA removed in favor of geofencing
              }));

              return (
                <RouteCard
                  key={route.id}
                  id={route.id}
                  name={route.name}
                  type={route.type as "shuttle" | "bus"}
                  status={route.status as "active" | "inactive"}
                  vehicleNumber={route.vehicleNumber || undefined}
                  stops={transformedStops}
                  ridersCount={0} // TODO: Add riders count to API
                  onEdit={() => handleEditRoute(route.id)}
                  onToggleStatus={() => handleToggleStatus(route.id, route.status as "active" | "inactive")}
                  onSendAlert={() => handleSendAlert(route)}
                />
              );
            })}
          </div>

          {filteredRoutes.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm ? "No routes found matching your search." : "No routes created yet."}
              </p>
              {!searchTerm && (
                <CreateRouteDialog 
                  organizationId={organizationId}
                  trigger={
                    <Button className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Route
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}
      
      {/* Edit Route Dialog */}
      {editingRoute && (
        <EditRouteDialog
          route={editingRoute}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            setEditingRoute(null);
            setEditDialogOpen(false);
          }}
        />
      )}

      {/* Send Alert Dialog */}
      {alertRoute && (
        <SendAlertDialog
          route={alertRoute}
          open={alertDialogOpen}
          onOpenChange={(open) => {
            setAlertDialogOpen(open);
            if (!open) {
              setAlertRoute(null);
            }
          }}
        />
      )}
    </div>
  );
}