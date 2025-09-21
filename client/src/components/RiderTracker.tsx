import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff, Clock, MapPin, Star, AlertTriangle, Info, Bus, Calendar } from "lucide-react";
import { LiveMap } from "./LiveMap";
import type { ServiceAlert } from "@shared/schema";

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
  serviceAlerts?: ServiceAlert[];
}

export function RiderTracker({ 
  routeName, 
  busName, 
  status, 
  stops, 
  defaultStop,
  isNotificationsEnabled = false,
  serviceAlerts = []
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

  // Helper function to get alert type icon and styling
  const getAlertTypeInfo = (type: ServiceAlert['type']) => {
    switch (type) {
      case 'delayed':
        return {
          icon: Clock,
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          label: 'Service Delay'
        };
      case 'bus_change':
        return {
          icon: Bus,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200',
          iconColor: 'text-blue-600 dark:text-blue-400',
          label: 'Vehicle Change'
        };
      case 'cancelled':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-600 dark:text-red-400',
          label: 'Service Cancelled'
        };
      case 'general':
      default:
        return {
          icon: Info,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200',
          iconColor: 'text-blue-600 dark:text-blue-400',
          label: 'Service Notice'
        };
    }
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
            <div className="mb-4 space-y-3" role="region" aria-label="Notifications">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="font-medium">Notifications enabled</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll be alerted when the bus is 5 minutes away from your stop.
                </p>
              </div>
              
              {serviceAlerts.length > 0 && (
                <div className="space-y-2">
                  {serviceAlerts.map((alert) => {
                    const alertInfo = getAlertTypeInfo(alert.type);
                    const IconComponent = alertInfo.icon;
                    
                    return (
                      <Alert
                        key={alert.id}
                        className={`${alertInfo.bgColor} ${alertInfo.borderColor}`}
                        data-testid={`alert-${alert.type}-${alert.id}`}
                      >
                        <IconComponent className={`h-4 w-4 ${alertInfo.iconColor}`} />
                        <AlertDescription className={alertInfo.textColor}>
                          <div className="space-y-1">
                            <p className="font-medium">{alertInfo.label}</p>
                            <p>{alert.message}</p>
                            {alert.activeFrom && (
                              <p className="text-xs opacity-75 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Posted: {new Date(alert.activeFrom).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    );
                  })}
                </div>
              )}
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