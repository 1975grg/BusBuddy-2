import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff, Clock, MapPin, AlertTriangle, Info, Bus, Calendar } from "lucide-react";
import { LiveMap } from "./LiveMap";
import { apiRequest, getStoredSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ServiceAlert, ProximityAlert } from "@shared/schema";

interface Stop {
  id: string;
  name: string;
  eta: string;
  isNext: boolean;
}

interface RiderTrackerProps {
  routeId: string;
  routeName: string;
  busName: string;
  status: "active" | "delayed" | "offline";
  stops: Stop[];
  defaultStop?: string;
  isNotificationsEnabled?: boolean;
  serviceAlerts?: ServiceAlert[];
  riderProfileId?: string | null;
}

export function RiderTracker({ 
  routeId,
  routeName, 
  busName, 
  status, 
  stops, 
  defaultStop,
  isNotificationsEnabled = false,
  serviceAlerts = [],
  riderProfileId
}: RiderTrackerProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(isNotificationsEnabled);
  const { toast } = useToast();
  const shownAlertIds = useRef<Set<string>>(new Set());

  // Poll for proximity alerts (in-app notifications)
  const { data: proximityAlerts } = useQuery<ProximityAlert[]>({
    queryKey: ["/api/proximity-alerts", riderProfileId],
    queryFn: async () => {
      if (!riderProfileId) return [];
      const headers: HeadersInit = {};
      const token = getStoredSessionToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/proximity-alerts/${riderProfileId}`, {
        credentials: "include",
        headers,
      });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!riderProfileId && notificationsEnabled,
  });

  // Show toast for new proximity alerts
  useEffect(() => {
    if (!proximityAlerts || proximityAlerts.length === 0) return;

    proximityAlerts.forEach((alert) => {
      if (shownAlertIds.current.has(alert.id)) return;
      shownAlertIds.current.add(alert.id);

      // Show toast notification
      toast({
        title: alert.alertType === 'approaching' ? 'Bus Approaching!' : 'Bus Arrived!',
        description: alert.message,
        duration: 10000,
      });

      // Mark alert as read after showing
      (async () => {
        try {
          const headers: HeadersInit = { "Content-Type": "application/json" };
          const token = getStoredSessionToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          await fetch(`/api/proximity-alerts/${alert.id}/read`, {
            method: "PATCH",
            credentials: "include",
            headers,
          });
        } catch (err) {
          console.error("Failed to mark alert as read:", err);
        }
      })();
    });
  }, [proximityAlerts, toast]);

  // Fetch active route session for live GPS tracking
  const { data: activeSession } = useQuery({
    queryKey: ["/api/route-sessions/active", routeId],
    queryFn: async () => {
      // Build headers with Bearer token for native app contexts (where cookies don't persist)
      const headers: HeadersInit = {};
      const token = getStoredSessionToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/route-sessions/active/${routeId}`, {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.log("RiderTracker: No active session found for route", routeId);
          return null;
        }
        throw new Error("Failed to fetch active session");
      }
      const data = await response.json();
      console.log("RiderTracker activeSession:", {
        routeId,
        sessionId: data?.id,
        status: data?.status,
        calculatedStatus: data?.calculatedStatus,
        lat: data?.currentLatitude,
        lng: data?.currentLongitude,
        lastUpdate: data?.lastLocationUpdate
      });
      return data;
    },
    refetchInterval: 5000, // Refresh GPS location every 5 seconds
    enabled: !!routeId,
  });

  // Use calculated status from backend, with fallback chain:
  // 1. calculatedStatus (GPS-based calculation from server)
  // 2. session.status (the actual session status - active/paused/ended)
  // 3. prop status (fallback from parent)
  // This ensures we show "Active" when a trip is running even before GPS coordinates arrive
  const sessionStatus = activeSession?.status as "active" | "paused" | "ended" | undefined;
  const calculatedStatus = activeSession?.calculatedStatus as "active" | "delayed" | "offline" | undefined;
  
  // If session is active and calculatedStatus is offline (no GPS yet), show "active" 
  // because the trip is running, we just don't have GPS coordinates yet
  let currentStatus: "active" | "delayed" | "offline";
  if (sessionStatus === "active" && (!calculatedStatus || calculatedStatus === "offline")) {
    currentStatus = "active"; // Trip is running, just waiting for GPS
  } else if (calculatedStatus) {
    currentStatus = calculatedStatus;
  } else {
    currentStatus = status; // Use prop fallback
  }
  
  // Debug status
  console.log("RiderTracker status:", { 
    currentStatus, 
    calculatedStatus, 
    sessionStatus, 
    propStatus: status,
    hasSession: !!activeSession 
  });

  // Convert active session to bus data for LiveMap
  // Use proper null checks to handle valid 0 coordinates (equator/Greenwich)
  const hasValidCoordinates = 
    activeSession?.currentLatitude !== null && 
    activeSession?.currentLatitude !== undefined &&
    activeSession?.currentLongitude !== null && 
    activeSession?.currentLongitude !== undefined &&
    !isNaN(Number(activeSession.currentLatitude)) &&
    !isNaN(Number(activeSession.currentLongitude));
  
  console.log("RiderTracker hasValidCoordinates:", hasValidCoordinates, {
    lat: activeSession?.currentLatitude,
    lng: activeSession?.currentLongitude,
    sessionExists: !!activeSession
  });
  
  const buses = hasValidCoordinates ? [
    {
      id: activeSession.id,
      name: busName,
      status: currentStatus,
      lat: Number(activeSession.currentLatitude),
      lng: Number(activeSession.currentLongitude),
      eta: stops.find(s => s.isNext)?.eta || "N/A",
      nextStop: stops.find(s => s.isNext)?.name || "Unknown"
    }
  ] : [];

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    console.log("Notifications", !notificationsEnabled ? "enabled" : "disabled");
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
    switch (currentStatus) {
      case "active":
        return <Badge className="bg-bus-active text-white" data-testid="badge-bus-active">Active</Badge>;
      case "delayed":
        return <Badge className="bg-bus-delayed text-white" data-testid="badge-bus-delayed">Delayed</Badge>;
      case "offline":
        return <Badge className="bg-bus-offline text-white" data-testid="badge-bus-offline">Offline</Badge>;
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
          <LiveMap buses={buses} className="h-48 mb-4" followBus={true} />
          
          {currentStatus === "offline" && (
            <p className="text-xs text-muted-foreground text-center mb-3">
              Waiting for driver to start route...
            </p>
          )}
          
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
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-medium">{alertInfo.label}</p>
                                <p>{alert.message}</p>
                              </div>
                              <Badge
                                variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {alert.severity}
                              </Badge>
                            </div>
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

    </div>
  );
}