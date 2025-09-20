import { useState } from "react";
import { DriverControls } from "@/components/DriverControls";
import { LiveMap } from "@/components/LiveMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, MapPin } from "lucide-react";
import driverAvatarUrl from "@assets/generated_images/Bus_driver_avatar_a7c98208.png";

export default function DriverPage() {
  const [selectedRoute, setSelectedRoute] = useState("main-campus-loop");
  
  // TODO: remove mock functionality - replace with real driver and route data
  const mockDriver = {
    name: "Mike Rodriguez",
    employeeId: "DRV-001",
    avatar: driverAvatarUrl
  };

  const mockRoutes = [
    {
      id: "main-campus-loop",
      name: "Main Campus Loop",
      vehicleNumber: "SHUTTLE-001",
      currentStop: "Student Center",
      nextStop: "Library",
      eta: "3 min"
    },
    {
      id: "west-campus",
      name: "West Campus Express", 
      vehicleNumber: "BUS-105",
      currentStop: undefined,
      nextStop: "West Gate",
      eta: undefined
    }
  ];

  const mockBuses = [
    {
      id: "current-bus",
      name: mockRoutes.find(r => r.id === selectedRoute)?.vehicleNumber || "Unknown",
      status: "active" as const,
      lat: 40.7128,
      lng: -74.0060,
      eta: mockRoutes.find(r => r.id === selectedRoute)?.eta || "N/A",
      nextStop: mockRoutes.find(r => r.id === selectedRoute)?.nextStop || "Unknown"
    }
  ];

  const currentRoute = mockRoutes.find(r => r.id === selectedRoute);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Driver Control Panel</h1>
          <p className="text-muted-foreground">Welcome back, {mockDriver.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Employee ID</p>
          <p className="font-mono">{mockDriver.employeeId}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Select Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRoute} onValueChange={setSelectedRoute}>
            <SelectTrigger data-testid="select-route">
              <SelectValue placeholder="Choose your route" />
            </SelectTrigger>
            <SelectContent>
              {mockRoutes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name} ({route.vehicleNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {currentRoute && (
            <DriverControls
              routeName={currentRoute.name}
              currentStop={currentRoute.currentStop}
              nextStop={currentRoute.nextStop}
              eta={currentRoute.eta}
            />
          )}
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
    </div>
  );
}