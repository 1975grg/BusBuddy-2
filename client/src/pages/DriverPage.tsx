import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DriverControls } from "@/components/DriverControls";
import { LiveMap } from "@/components/LiveMap";
import { SendDriverMessageDialog } from "@/components/SendDriverMessageDialog";
import { MessageHistory } from "@/components/MessageHistory";
import { DriverServiceAlerts } from "@/components/DriverServiceAlerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Route, MapPin, Star, StarOff, Heart, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Route as RouteType, User, RouteSession } from "@shared/schema";
import driverAvatarUrl from "@assets/generated_images/Bus_driver_avatar_a7c98208.png";

export default function DriverPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
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
      
      return apiRequest("PATCH", `/api/users/${currentUser.id}/favorite-route`, { routeId });
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

  // Query for active session when route is selected
  const { data: activeSession, isLoading: sessionLoading } = useQuery({
    queryKey: ["/api/route-sessions/active", selectedRoute],
    queryFn: async () => {
      if (!selectedRoute) return null;
      
      try {
        const response = await fetch(`/api/route-sessions/active/${selectedRoute}`);
        if (response.status === 404) {
          // No active session found - this is normal
          return null;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch active session: ${response.statusText}`);
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching active session:", error);
        return null;
      }
    },
    enabled: !!selectedRoute,
    refetchInterval: 10000, // Refetch every 10 seconds to stay in sync
  });
  
  // Bus data for the map - uses real GPS from active session
  const buses = currentRoute && activeSession ? [{
    id: "current-bus", 
    name: currentRoute.vehicleNumber || "Unknown",
    status: "active" as const,
    lat: activeSession.currentLatitude || 40.7128,
    lng: activeSession.currentLongitude || -74.0060,
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
              {favoriteRoute.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
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

      {/* Driver Controls and Map */}
      {currentRoute && currentUser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <DriverControls
              routeId={currentRoute.id}
              routeName={currentRoute.name}
              driverUserId={currentUser.id}
              existingSession={activeSession}
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
              <LiveMap buses={buses} className="h-64" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available Routes Dropdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Switch Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No active routes available for your organization.
            </p>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedRoute}
                onValueChange={setSelectedRoute}
                data-testid="select-route-dropdown"
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a route to operate..." />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => {
                    const isFavorite = currentUser?.favoriteRouteId === route.id;
                    return (
                      <SelectItem 
                        key={route.id} 
                        value={route.id}
                        data-testid={`option-route-${route.id}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{route.name}</span>
                            {isFavorite && (
                              <Heart className="w-3 h-3 text-primary fill-primary" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">
                            {route.vehicleNumber} • {route.type}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* Favorite Controls */}
              {selectedRoute && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {routes.find(r => r.id === selectedRoute)?.name}
                    </span>
                    {currentUser?.favoriteRouteId === selectedRoute && (
                      <Badge variant="secondary" className="text-xs">
                        <Heart className="w-3 h-3 mr-1 fill-current" />
                        Favorite
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={currentUser?.favoriteRouteId === selectedRoute ? "default" : "outline"}
                    onClick={() => handleFavoriteToggle(selectedRoute)}
                    disabled={favoriteRouteMutation.isPending}
                    data-testid={`button-favorite-${selectedRoute}`}
                  >
                    {currentUser?.favoriteRouteId === selectedRoute ? (
                      <>
                        <Star className="w-4 h-4 mr-1 fill-current" />
                        Favorited
                      </>
                    ) : (
                      <>
                        <StarOff className="w-4 h-4 mr-1" />
                        Add to Favorites
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Admin Section */}
      {currentRoute && currentUser && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Report issues with the route, vehicle, or schedule to the admin team.
              </p>
              <Button 
                onClick={() => setMessageDialogOpen(true)}
                className="w-full"
                data-testid="button-contact-admin"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Contact Admin
              </Button>
            </CardContent>
          </Card>

          <SendDriverMessageDialog
            route={currentRoute}
            driverUserId={currentUser.id}
            open={messageDialogOpen}
            onOpenChange={setMessageDialogOpen}
          />

          <DriverServiceAlerts routeId={selectedRoute} />

          <MessageHistory userType="driver" routeId={selectedRoute} userId={currentUser.id} />
        </>
      )}
    </div>
  );
}