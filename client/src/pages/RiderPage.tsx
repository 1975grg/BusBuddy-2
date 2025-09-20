import { useState } from "react";
import { RiderTracker } from "@/components/RiderTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Route, Clock } from "lucide-react";

export default function RiderPage() {
  const [selectedRoute, setSelectedRoute] = useState("main-campus-loop");
  
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

  const currentRoute = mockSavedRoutes.find(r => r.id === selectedRoute);

  const toggleFavorite = (routeId: string) => {
    console.log(`Toggle favorite for route ${routeId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Track Your Bus</h1>
        <p className="text-muted-foreground">Real-time location and arrival estimates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            My Routes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockSavedRoutes.map((route) => (
              <div
                key={route.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedRoute === route.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedRoute(route.id)}
              >
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(route.id);
                    }}
                    data-testid={`button-favorite-${route.id}`}
                  >
                    <Star className={`w-4 h-4 ${
                      route.isFavorite ? "fill-yellow-400 text-yellow-400" : ""
                    }`} />
                  </Button>
                  <div>
                    <p className="font-medium">{route.name}</p>
                    <p className="text-sm text-muted-foreground">{route.busName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {route.status === "active" && (
                    <Badge className="bg-bus-active text-white">
                      <Clock className="w-3 h-3 mr-1" />
                      {route.stops.find(s => s.isNext)?.eta}
                    </Badge>
                  )}
                  {route.status === "delayed" && (
                    <Badge className="bg-bus-delayed text-white">Delayed</Badge>
                  )}
                  {selectedRoute === route.id && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentRoute && (
        <RiderTracker
          routeName={currentRoute.name}
          busName={currentRoute.busName}
          status={currentRoute.status}
          stops={currentRoute.stops}
          defaultStop="1"
          isNotificationsEnabled={true}
        />
      )}
    </div>
  );
}