import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { RouteCard } from "@/components/RouteCard";
import { CreateRouteDialog } from "@/components/CreateRouteDialog";
import { useQuery } from "@tanstack/react-query";
import type { Route, RouteStop } from "@shared/schema";

interface RouteWithStops extends Route {
  stops: RouteStop[];
}

export default function RoutesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Get the default organization for now - in a real app this would be from user context
  const { data: routes = [], isLoading, error } = useQuery<RouteWithStops[]>({
    queryKey: ["/api/routes"],
  });

  const filteredRoutes = routes.filter(route =>
    route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get the first organization from system admin API for now - in real app this would come from user context
  const { data: organizations = [] } = useQuery({
    queryKey: ["/api/system/organizations"],
  });
  
  const organizationId = organizations[0]?.id || "";

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
                eta: stop.estimatedArrival || undefined,
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
                  onEdit={() => console.log(`Edit route ${route.id}`)}
                  onToggleStatus={() => console.log(`Toggle status for route ${route.id}`)}
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
    </div>
  );
}