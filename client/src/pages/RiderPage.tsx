import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiderTracker } from "@/components/RiderTracker";
import { SendRiderMessageDialog } from "@/components/SendRiderMessageDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useRequireRole } from "@/contexts/UserContext";
import type { ServiceAlert } from "@shared/schema";

export default function RiderPage() {
  const { user, isLoading: authLoading } = useRequireRole("rider");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);

  // Extract route ID from URL query parameter - riders are locked to their assigned route
  const urlParams = new URLSearchParams(window.location.search);
  const routeId = urlParams.get('route');
  
  // No route switching allowed - riders only see their assigned route
  // Default to Cheat lake Test route for mock testing (matches driver route)
  const selectedRoute = routeId || "4fde6b54-ff96-4aa8-bb26-7c80aaea7221";

  // ALL HOOKS MUST BE BEFORE EARLY RETURNS
  // Always fetch real route data from database
  const { data: realRoute } = useQuery({
    queryKey: ["/api/routes", selectedRoute],
    queryFn: async () => {
      const response = await fetch("/api/routes");
      const routes = await response.json();
      // Try to find by ID first, then by name slug
      return routes.find((r: any) => r.id === selectedRoute || r.name.toLowerCase().replace(/\s+/g, '-') === selectedRoute);
    },
    enabled: !!selectedRoute && !authLoading,
  });
  
  // Fetch active service alerts for the current route
  const { data: serviceAlerts = [], isLoading: alertsLoading } = useQuery<ServiceAlert[]>({
    queryKey: ["/api/service-alerts", selectedRoute],
    queryFn: () => fetch(`/api/service-alerts?route_id=${selectedRoute}`).then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!selectedRoute && !authLoading, // Only fetch if we have a route ID
  });

  // Early return AFTER all hooks
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Use real route data from database (ignore mock data to ensure consistency)
  const currentRoute = realRoute ? {
    id: realRoute.id,
    name: realRoute.name,
    busName: realRoute.vehicleNumber || `${realRoute.type.toUpperCase()}-001`,
    status: "active" as const,
    isFavorite: false,
    stops: [
      { id: "1", name: "Main Entrance", eta: "5 min", isNext: true },
      { id: "2", name: "Next Stop", eta: "10 min", isNext: false }
    ]
  } : null;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Track Your Bus</h1>
        <p className="text-muted-foreground">Real-time location and arrival estimates for your route</p>
      </div>

      {currentRoute && (
        <RiderTracker
          routeId={currentRoute.id}
          routeName={currentRoute.name}
          busName={currentRoute.busName}
          status={currentRoute.status}
          stops={currentRoute.stops}
          defaultStop="1"
          isNotificationsEnabled={true}
          serviceAlerts={serviceAlerts}
        />
      )}

      {/* Contact Support Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Have a question about your route or transportation services? Contact our support team.
          </p>
          <Button 
            onClick={() => setMessageDialogOpen(true)}
            className="w-full"
            data-testid="button-contact-support"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        </CardContent>
      </Card>

      {/* Contact Support Dialog */}
      {currentRoute && (
        <SendRiderMessageDialog
          route={{
            id: currentRoute.id,
            name: currentRoute.name,
            organizationId: "org-1", // TODO: Get from context  
            vehicleNumber: currentRoute.busName,
            type: "shuttle",
            status: "active",
            isActive: true,
            createdAt: new Date()
          }}
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
        />
      )}
    </div>
  );
}