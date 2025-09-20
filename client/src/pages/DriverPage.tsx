import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DriverControls } from "@/components/DriverControls";
import { LiveMap } from "@/components/LiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Route, MapPin, Star, StarOff, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Route as RouteType, User } from "@shared/schema";
import driverAvatarUrl from "@assets/generated_images/Bus_driver_avatar_a7c98208.png";

export default function DriverPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const { toast } = useToast();

  // Get current driver (mock for now)
  const { data: currentUser } = useQuery({
    queryKey: ["/api/dev/mock-user", "driver"],
    select: (data: User) => data,
  });

  // Get active routes for the driver's organization
  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["/api/routes"],
    select: (data: RouteType[]) => {
      // Filter to only active routes from driver's org
      return data.filter(route => 
        route.isActive && 
        route.status === "active" &&
        route.organizationId === currentUser?.organizationId
      );
    },
    enabled: !!currentUser?.organizationId,
  });

  // Find user's favorite route if they have one
  const favoriteRoute = routes.find(route => route.id === currentUser?.favoriteRouteId);
  
  // Set initial selected route to favorite if available
  if (!selectedRoute && favoriteRoute) {
    setSelectedRoute(favoriteRoute.id);
  }

  // Mutation to set/unset favorite route
  const favoriteRouteMutation = useMutation({
    mutationFn: async ({ routeId }: { routeId: string | null }) => {
      if (!currentUser) throw new Error("User not found");
      
      return apiRequest(`/api/users/${currentUser.id}/favorite-route`, {
        method: "PATCH",
        body: { routeId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dev/mock-user"] });
      toast({ description: "Favorite route updated!" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error?.message || "Failed to update favorite route",
      });
    },
  });

  const handleFavoriteToggle = (routeId: string) => {
    const isFavorite = currentUser?.favoriteRouteId === routeId;
    favoriteRouteMutation.mutate({ 
      routeId: isFavorite ? null : routeId 
    });
  };

  const currentRoute = routes.find(r => r.id === selectedRoute);
  
  // Mock bus data for the map (would be real GPS data in production)
  const mockBuses = currentRoute ? [{
    id: "current-bus", 
    name: currentRoute.vehicleNumber || "Unknown",
    status: "active" as const,
    lat: 40.7128,
    lng: -74.0060,
    eta: "N/A", // Would come from real GPS tracking
    nextStop: "Unknown" // Would come from route progress
  }] : [];

  if (routesLoading) {
    return <div className="flex justify-center p-8">Loading routes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Driver Control Panel</h1>
          <p className="text-muted-foreground">
            Welcome back, {currentUser?.name || "Driver"}
          </p>
        </div>
      </div>

      {/* Favorite Route Card */}
      {favoriteRoute ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary fill-primary" />
              Your Default Route
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{favoriteRoute.name}</p>
                <p className="text-sm text-muted-foreground">
                  {favoriteRoute.vehicleNumber} • {favoriteRoute.type}
                </p>
              </div>
              <Badge variant="default">Favorite</Badge>
            </div>
            {selectedRoute !== favoriteRoute.id && (
              <Button 
                className="mt-3 w-full" 
                onClick={() => setSelectedRoute(favoriteRoute.id)}
                data-testid="button-select-favorite"
              >
                Select This Route
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No favorite route set. Star a route below to make it your default.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Routes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Available Routes ({routes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No active routes available for your organization.
            </p>
          ) : (
            <div className="space-y-3">
              {routes.map((route) => {
                const isFavorite = currentUser?.favoriteRouteId === route.id;
                const isSelected = selectedRoute === route.id;
                
                return (
                  <div
                    key={route.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`card-route-${route.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{route.name}</p>
                        {isFavorite && (
                          <Heart className="w-4 h-4 text-primary fill-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {route.vehicleNumber} • {route.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant={isFavorite ? "default" : "ghost"}
                        onClick={() => handleFavoriteToggle(route.id)}
                        disabled={favoriteRouteMutation.isPending}
                        data-testid={`button-favorite-${route.id}`}
                      >
                        {isFavorite ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => setSelectedRoute(route.id)}
                        disabled={isSelected}
                        data-testid={`button-select-${route.id}`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Controls and Map */}
      {currentRoute && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <DriverControls
              routeName={currentRoute.name}
              currentStop={undefined} // Would come from real GPS tracking
              nextStop={undefined} // Would come from real route progress
              eta={undefined} // Would come from real GPS tracking
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Live Route Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LiveMap buses={mockBuses} className="h-64" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}