import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiderTracker } from "@/components/RiderTracker";
import { SendRiderMessageDialog } from "@/components/SendRiderMessageDialog";
import { MessageHistory } from "@/components/MessageHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, MessageSquareOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRequireRole } from "@/contexts/UserContext";
import { apiFetch } from "@/lib/queryClient";
import type { ServiceAlert } from "@shared/schema";
import { SmartAppBanner } from "@/components/SmartAppBanner";

export default function RiderPage() {
  const { user, isLoading: authLoading } = useRequireRole("rider");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const { toast } = useToast();

  // Debug logging
  console.log("RiderPage Debug:", {
    user: user?.email,
    authLoading,
    routeAssignments: user?.routeAssignments,
  });

  // Get the rider's assigned route from their route assignments
  // Prefer the default route, or the first assigned route
  const defaultAssignment = user?.routeAssignments?.find(a => a.isDefault);
  const firstAssignment = user?.routeAssignments?.[0];
  const selectedRoute = defaultAssignment?.routeId || firstAssignment?.routeId || null;
  
  console.log("RiderPage selectedRoute:", selectedRoute);

  // ALL HOOKS MUST BE BEFORE EARLY RETURNS
  // Fetch route data directly by ID (public endpoint)
  const { data: realRoute, isLoading: routeLoading } = useQuery({
    queryKey: ["/api/routes", selectedRoute],
    queryFn: async () => {
      const response = await apiFetch(`/api/routes/${selectedRoute}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedRoute && !authLoading,
  });
  
  // Fetch active service alerts for the current route
  const { data: serviceAlerts = [], isLoading: alertsLoading } = useQuery<ServiceAlert[]>({
    queryKey: ["/api/service-alerts", selectedRoute],
    queryFn: async () => {
      const response = await apiFetch(`/api/service-alerts?route_id=${selectedRoute}`);
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!selectedRoute && !authLoading, // Only fetch if we have a route ID
  });

  // Query for organization messaging settings
  // Default to false (disabled) if the API call fails - safer default
  const { data: orgSettings, isLoading: orgSettingsLoading } = useQuery<{ messagingEnabled: boolean }>({
    queryKey: ["/api/organization-settings"],
    queryFn: async () => {
      const response = await apiFetch("/api/organization-settings");
      if (!response.ok) return { messagingEnabled: false };
      return response.json();
    },
    enabled: !authLoading,
  });

  // Only show messaging as enabled once we've confirmed from the server
  const messagingEnabled = !orgSettingsLoading && (orgSettings?.messagingEnabled ?? false);

  // Early return AFTER all hooks
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Show message if rider has no assigned route
  if (!selectedRoute) {
    return (
      <div className="space-y-6">
        <SmartAppBanner />
        <div>
          <h1 className="text-2xl font-bold">Track Your Bus</h1>
          <p className="text-muted-foreground">Real-time location and arrival estimates for your route</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No Route Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You don't have a route assigned yet. Please contact your administrator or scan the QR code for your route to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use real route data from database, with fallback for loading state
  // Default status is "offline" - will be overridden by active session if one exists
  const currentRoute = realRoute ? {
    id: realRoute.id,
    name: realRoute.name,
    busName: realRoute.vehicleNumber || `${realRoute.type?.toUpperCase() || 'BUS'}-001`,
    status: "offline" as const,
    isFavorite: false,
    organizationId: realRoute.organizationId,
    stops: realRoute.stops?.length > 0 
      ? realRoute.stops.map((stop: any, index: number) => ({
          id: stop.id,
          name: stop.name,
          eta: "-- min",
          isNext: index === 0
        }))
      : []
  } : {
    id: selectedRoute,
    name: "Loading route...",
    busName: "BUS-001",
    status: "offline" as const,
    isFavorite: false,
    organizationId: user?.organizationId || "",
    stops: []
  };


  return (
    <div className="space-y-6">
      {/* Smart App Banner for Mobile */}
      <SmartAppBanner />

      <div>
        <h1 className="text-2xl font-bold">Track Your Bus</h1>
        <p className="text-muted-foreground">Real-time location and arrival estimates for your route</p>
      </div>

      <RiderTracker
        routeId={currentRoute.id}
        routeName={currentRoute.name}
        busName={currentRoute.busName}
        status={currentRoute.status}
        stops={currentRoute.stops}
        defaultStop="1"
        isNotificationsEnabled={true}
        serviceAlerts={serviceAlerts}
        riderProfileId={user?.riderProfileId}
      />

      {/* Contact Support Section - Above Messages */}
      <Card className={!messagingEnabled && !orgSettingsLoading ? "opacity-60" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {messagingEnabled ? (
              <MessageSquare className="w-5 h-5" />
            ) : (
              <MessageSquareOff className="w-5 h-5 text-muted-foreground" />
            )}
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orgSettingsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                {messagingEnabled 
                  ? "Have a question about your route or transportation services? Contact our support team."
                  : "Communications are currently disabled for this organization."}
              </p>
              <Button 
                onClick={() => {
                  if (!messagingEnabled) {
                    toast({
                      variant: "destructive",
                      title: "Communications Disabled",
                      description: "Messaging has been turned off by the administrator for regulatory compliance.",
                    });
                    return;
                  }
                  setMessageDialogOpen(true);
                }}
                className={`w-full ${!messagingEnabled ? "opacity-60 cursor-not-allowed" : ""}`}
                variant={messagingEnabled ? "default" : "secondary"}
                aria-disabled={!messagingEnabled}
                data-testid="button-contact-support"
              >
                {messagingEnabled ? (
                  <MessageSquare className="w-4 h-4 mr-2" />
                ) : (
                  <MessageSquareOff className="w-4 h-4 mr-2" />
                )}
                Contact Support
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Message History - Below Need Help */}
      <MessageHistory userType="rider" routeId={currentRoute.id} userId={user?.id} messagingEnabled={messagingEnabled} />

      {/* Contact Support Dialog */}
      {messagingEnabled && !orgSettingsLoading && (
        <SendRiderMessageDialog
          route={{
            id: currentRoute.id,
            name: currentRoute.name,
            organizationId: currentRoute.organizationId || user?.organizationId || "",
            vehicleNumber: currentRoute.busName,
            type: "shuttle",
            status: "active",
            isActive: true,
            createdAt: new Date(),
            archivedAt: null,
            archivedByUserId: null
          }}
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
        />
      )}
    </div>
  );
}