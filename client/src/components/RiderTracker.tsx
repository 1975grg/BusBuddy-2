import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Clock, MapPin, Star } from "lucide-react";
import { LiveMap } from "./LiveMap";

interface Stop {
  id: string;
  name: string;
  eta: string;
  isNext: boolean;
}

interface RiderTrackerProps {
  routeName: string;
  busName: string;
  status: "active" | "delayed" | "offline";
  stops: Stop[];
  defaultStop?: string;
  isNotificationsEnabled?: boolean;
}

export function RiderTracker({ 
  routeName, 
  busName, 
  status, 
  stops, 
  defaultStop,
  isNotificationsEnabled = false 
}: RiderTrackerProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(isNotificationsEnabled);
  const [favoriteStop, setFavoriteStop] = useState<string | undefined>(defaultStop);

  // TODO: remove mock functionality - replace with real bus data
  const mockBuses = [
    {
      id: "bus-1",
      name: busName,
      status,
      lat: 40.7128,
      lng: -74.0060,
      eta: stops.find(s => s.isNext)?.eta || "5 min",
      nextStop: stops.find(s => s.isNext)?.name || "Main Street"
    }
  ];

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    console.log("Notifications", !notificationsEnabled ? "enabled" : "disabled");
  };

  const setFavorite = (stopId: string) => {
    setFavoriteStop(stopId);
    console.log("Favorite stop set:", stopId);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "active":
        return <Badge className="bg-bus-active text-white">On Time</Badge>;
      case "delayed":
        return <Badge className="bg-bus-delayed text-white">Delayed</Badge>;
      case "offline":
        return <Badge className="bg-bus-offline text-white">Offline</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{routeName}</CardTitle>
              <p className="text-sm text-muted-foreground">{busName}</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleNotifications}
                data-testid="button-toggle-notifications"
              >
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-primary" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LiveMap buses={mockBuses} className="h-48 mb-4" />
          
          {notificationsEnabled && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="w-4 h-4 text-primary" />
                <span className="font-medium">Notifications enabled</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be alerted when the bus is 5 minutes away from your stop.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Upcoming Stops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stops.map((stop) => (
              <div
                key={stop.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  stop.isNext ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    stop.isNext ? "bg-primary" : "bg-muted-foreground"
                  }`} />
                  <div>
                    <p className={`font-medium ${stop.isNext ? "text-primary" : ""}`}>
                      {stop.name}
                    </p>
                    {stop.isNext && (
                      <p className="text-xs text-muted-foreground">Next stop</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={stop.isNext ? "border-primary text-primary" : ""}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {stop.eta}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setFavorite(stop.id)}
                    data-testid={`button-favorite-${stop.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Star className={`w-4 h-4 ${
                      favoriteStop === stop.id ? "fill-yellow-400 text-yellow-400" : ""
                    }`} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}