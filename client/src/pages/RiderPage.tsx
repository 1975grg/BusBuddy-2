import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RiderTracker } from "@/components/RiderTracker";
import { SendRiderMessageDialog } from "@/components/SendRiderMessageDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import type { ServiceAlert } from "@shared/schema";

export default function RiderPage() {
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  
  // Extract route ID from URL query parameter - riders are locked to their assigned route
  const urlParams = new URLSearchParams(window.location.search);
  const routeId = urlParams.get('route');
  
  // No route switching allowed - riders only see their assigned route
  const selectedRoute = routeId || "main-campus-loop";
  
  // TODO: remove mock functionality - replace with real rider data and preferences
  const mockSavedRoutes = [
    {
      id: "main-campus-loop",
      name: "Main Campus Shuttle",
      busName: "Shuttle A",
      status: "active" as const,
      isFavorite: true,
      stops: [
        { id: "1", name: "Main Entrance", eta: "3 min", isNext: true },
        { id: "2", name: "Student Center", eta: "7 min", isNext: false },
        { id: "3", name: "Library", eta: "12 min", isNext: false },
        { id: "4", name: "Cafeteria", eta: "15 min", isNext: false }
      ]
    },
    {
      id: "west-campus",
      name: "West Campus Express",
      busName: "Bus 105", 
      status: "delayed" as const,
      isFavorite: false,
      stops: [
        { id: "5", name: "West Gate", eta: "8 min", isNext: true },
        { id: "6", name: "Engineering Building", eta: "12 min", isNext: false },
        { id: "7", name: "Research Center", eta: "18 min", isNext: false }
      ]
    }
  ];

  // Fetch route data if using a real route ID
  const { data: realRoute } = useQuery({
    queryKey: ["/api/routes", selectedRoute],
    queryFn: async () => {
      const response = await fetch("/api/routes");
      const routes = await response.json();
      return routes.find((r: any) => r.id === selectedRoute || r.name.toLowerCase().replace(/\s+/g, '-') === selectedRoute);
    },
    enabled: !!selectedRoute && !mockSavedRoutes.find(r => r.id === selectedRoute), // Only fetch if route not in mock data
  });
  
  // Fetch active service alerts for the current route
  const { data: serviceAlerts = [], isLoading: alertsLoading } = useQuery<ServiceAlert[]>({
    queryKey: ["/api/service-alerts", selectedRoute],
    queryFn: () => fetch(`/api/service-alerts?route_id=${selectedRoute}`).then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!selectedRoute, // Only fetch if we have a route ID
  });

  // Use mock route data if available, otherwise create route data from real route
  const currentRoute = mockSavedRoutes.find(r => r.id === selectedRoute) || 
    (realRoute ? {
      id: realRoute.id,
      name: realRoute.name,
      busName: realRoute.vehicleNumber || `${realRoute.type.toUpperCase()}-001`,
      status: "active" as const,
      isFavorite: false,
      stops: [
        { id: "1", name: "Main Entrance", eta: "5 min", isNext: true },
        { id: "2", name: "Next Stop", eta: "10 min", isNext: false }
      ]
    } : null);


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