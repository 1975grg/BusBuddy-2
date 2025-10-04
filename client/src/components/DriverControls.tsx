import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, MapPin, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RouteSession } from "@shared/schema";

interface DriverControlsProps {
  routeId: string;
  routeName: string;
  driverUserId: string;
  existingSession?: RouteSession | null;
  currentStop?: string;
  nextStop?: string;
  eta?: string;
}

export function DriverControls({ 
  routeId,
  routeName, 
  driverUserId,
  existingSession,
  currentStop, 
  nextStop, 
  eta 
}: DriverControlsProps) {
  const [tripStatus, setTripStatus] = useState<"stopped" | "active" | "paused">("stopped");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const gpsErrorShownRef = useRef<boolean>(false);
  const watchPositionSucceededRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const tripStatusRef = useRef<"stopped" | "active" | "paused">("stopped");

  // Sync refs with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
    tripStatusRef.current = tripStatus;
  }, [sessionId, tripStatus]);

  // Initialize state from existing session - handle all session statuses
  useEffect(() => {
    if (existingSession) {
      setSessionId(existingSession.id);
      
      // Map session status to trip status appropriately
      switch (existingSession.status) {
        case "active":
          setTripStatus("active");
          break;
        case "pending":
          // Treat pending sessions as paused - driver can resume
          setTripStatus("paused");
          break;
        case "completed":
        case "cancelled":
          setTripStatus("stopped");
          setSessionId(null);
          break;
        default:
          setTripStatus("stopped");
      }
    } else {
      setTripStatus("stopped");
      setSessionId(null);
    }
  }, [existingSession]);

  // Start trip mutation
  const startTripMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/route-sessions/start", {
        routeId,
        driverUserId,
      });
      return response.json();
    },
    onSuccess: (data: RouteSession) => {
      setSessionId(data.id);
      setTripStatus("active");
      startGPSTracking(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/route-sessions/active", routeId] });
      toast({ 
        description: "Trip started successfully! GPS tracking is now active." 
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to start trip",
        description: error?.message || "An error occurred while starting the trip",
      });
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ sessionId, latitude, longitude }: { sessionId: string; latitude: number; longitude: number }) => {
      if (!sessionId) throw new Error("No active session");
      const response = await apiRequest("PATCH", `/api/route-sessions/${sessionId}/location`, {
        latitude,
        longitude,
      });
      return response.json();
    },
    onError: (error: any) => {
      console.error("Failed to update location:", error);
    },
  });

  // End trip mutation
  const endTripMutation = useMutation({
    mutationFn: async (status: "completed" | "cancelled") => {
      if (!sessionId) throw new Error("No active session");
      const response = await apiRequest("PATCH", `/api/route-sessions/${sessionId}/status`, {
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      stopGPSTracking();
      setTripStatus("stopped");
      setSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/route-sessions/active", routeId] });
      toast({ 
        description: "Trip ended successfully." 
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to end trip",
        description: error?.message || "An error occurred while ending the trip",
      });
    },
  });

  // Pause trip mutation - updates backend session status to 'pending'
  const pauseTripMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No active session");
      const response = await apiRequest("PATCH", `/api/route-sessions/${sessionId}/status`, {
        status: "pending",
      });
      return response.json();
    },
    onSuccess: () => {
      stopGPSTracking();
      setTripStatus("paused");
      queryClient.invalidateQueries({ queryKey: ["/api/route-sessions/active", routeId] });
      toast({ 
        description: "Trip paused. GPS tracking stopped." 
      });
    },
    onError: (error: any) => {
      stopGPSTracking();
      setTripStatus("paused");
      toast({
        variant: "destructive",
        title: "Failed to sync pause state",
        description: "Trip paused locally, but backend update failed.",
      });
    },
  });

  // Resume trip mutation - updates backend session status to 'active'
  const resumeTripMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No active session");
      const response = await apiRequest("PATCH", `/api/route-sessions/${sessionId}/status`, {
        status: "active",
      });
      return response.json();
    },
    onSuccess: () => {
      setTripStatus("active");
      if (sessionId) {
        startGPSTracking(sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/route-sessions/active", routeId] });
      toast({ 
        description: "Trip resumed. GPS tracking restarted." 
      });
    },
    onError: (error: any) => {
      setTripStatus("active");
      if (sessionId) {
        startGPSTracking(sessionId);
      }
      toast({
        variant: "destructive",
        title: "Failed to sync resume state",
        description: "Trip resumed locally, but backend update failed.",
      });
    },
  });

  // GPS tracking functions with fail-safe logic
  const startGPSTracking = async (activeSessionId: string) => {
    // Reset GPS state when starting tracking
    gpsErrorShownRef.current = false;
    watchPositionSucceededRef.current = false;
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "GPS not available",
        description: "Your device does not support GPS tracking",
      });
      
      // Cancel the backend session if one exists
      if (activeSessionId) {
        try {
          await apiRequest("PATCH", `/api/route-sessions/${activeSessionId}/status`, {
            status: "cancelled",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/route-sessions"] });
        } catch (cancelError) {
          console.error("Failed to cancel session after geolocation unavailable:", cancelError);
        }
      }
      
      // Reset local state
      setSessionId(null);
      setTripStatus("stopped");
      return;
    }

    // Start watching position with fail-safe logic
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log("GPS update:", latitude, longitude);
        
        // On first successful GPS reading, start the backup interval
        if (!watchPositionSucceededRef.current) {
          watchPositionSucceededRef.current = true;
          
          // Set up 5-second interval as backup ONLY after watchPosition succeeds
          locationIntervalRef.current = setInterval(() => {
            // Check if session is still active before attempting to get location (use refs for current state)
            if (!sessionIdRef.current || tripStatusRef.current !== "active") {
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                
                // Double-check session is still active before sending update (use refs for current state)
                if (sessionIdRef.current && tripStatusRef.current === "active" && !updateLocationMutation.isPending) {
                  updateLocationMutation.mutate({ sessionId: sessionIdRef.current, latitude, longitude });
                }
              },
              (error) => {
                // Only log GPS errors if session is still active (use refs for current state)
                if (sessionIdRef.current && tripStatusRef.current === "active") {
                  console.error("GPS interval error:", error);
                }
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              }
            );
          }, 5000);
        }
        
        // Don't send update if previous mutation is still pending (prevents pile-up)
        if (!updateLocationMutation.isPending) {
          updateLocationMutation.mutate({ sessionId: activeSessionId, latitude, longitude });
        }
      },
      async (error) => {
        console.error("GPS error:", error);
        
        // Show error toast only once to prevent spam
        if (!gpsErrorShownRef.current) {
          gpsErrorShownRef.current = true;
          toast({
            variant: "destructive",
            title: "GPS error",
            description: getGPSErrorMessage(error.code),
          });
        }
        
        // If watchPosition fails, cancel the backend session before resetting state
        stopGPSTracking();
        
        // Cancel the backend session if one exists
        if (activeSessionId) {
          try {
            await apiRequest("PATCH", `/api/route-sessions/${activeSessionId}/status`, {
              status: "cancelled",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/route-sessions/active", routeId] });
          } catch (cancelError) {
            console.error("Failed to cancel session after GPS error:", cancelError);
          }
        }
        
        // Reset local state
        setTripStatus("stopped");
        setSessionId(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const stopGPSTracking = () => {
    // Clear watch position
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Clear interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const getGPSErrorMessage = (code: number): string => {
    switch (code) {
      case 1:
        return "GPS permission denied. Please enable location access in your browser settings.";
      case 2:
        return "GPS position unavailable. Please check your device's location settings.";
      case 3:
        return "GPS request timed out. Please try again.";
      default:
        return "Unknown GPS error occurred.";
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, []);

  // Restart GPS tracking if session becomes active
  useEffect(() => {
    if (tripStatus === "active" && sessionId && !watchIdRef.current) {
      startGPSTracking(sessionId);
    }
  }, [tripStatus, sessionId]);
  
  const handleStartTrip = () => {
    startTripMutation.mutate();
  };
  
  const handlePauseTrip = () => {
    pauseTripMutation.mutate();
  };
  
  const handleResumeTrip = () => {
    resumeTripMutation.mutate();
  };
  
  const handleEndTrip = () => {
    endTripMutation.mutate("completed");
  };

  const getStatusBadge = () => {
    switch (tripStatus) {
      case "active":
        return <Badge className="bg-bus-active text-white" data-testid="badge-trip-active">Active</Badge>;
      case "paused":
        return <Badge className="bg-bus-delayed text-white" data-testid="badge-trip-paused">Paused</Badge>;
      case "stopped":
        return <Badge variant="secondary" data-testid="badge-trip-stopped">Stopped</Badge>;
    }
  };

  const isLoading = startTripMutation.isPending || endTripMutation.isPending || 
                    pauseTripMutation.isPending || resumeTripMutation.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="text-route-name">{routeName}</CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tripStatus !== "stopped" && (
            <div className="space-y-3">
              {currentStop && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-current-stop">Current: {currentStop}</span>
                </div>
              )}
              {nextStop && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm" data-testid="text-next-stop">Next: {nextStop}</span>
                  {eta && (
                    <Badge variant="outline" className="ml-auto" data-testid="badge-eta">
                      <Clock className="w-3 h-3 mr-1" />
                      {eta}
                    </Badge>
                  )}
                </div>
              )}
              {sessionId && (
                <div className="text-xs text-muted-foreground">
                  Session ID: {sessionId.slice(0, 8)}...
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            {tripStatus === "stopped" && (
              <Button 
                onClick={handleStartTrip} 
                className="flex-1"
                disabled={isLoading}
                data-testid="button-start-trip"
              >
                <Play className="w-4 h-4 mr-2" />
                {startTripMutation.isPending ? "Starting..." : "Start Trip"}
              </Button>
            )}
            
            {tripStatus === "active" && (
              <>
                <Button 
                  onClick={handlePauseTrip} 
                  variant="outline" 
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-pause-trip"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
                <Button 
                  onClick={handleEndTrip} 
                  variant="destructive" 
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-end-trip"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {endTripMutation.isPending ? "Ending..." : "End Trip"}
                </Button>
              </>
            )}
            
            {tripStatus === "paused" && (
              <>
                <Button 
                  onClick={handleResumeTrip} 
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-resume-trip"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button 
                  onClick={handleEndTrip} 
                  variant="destructive" 
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-end-trip"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {endTripMutation.isPending ? "Ending..." : "End Trip"}
                </Button>
              </>
            )}
          </div>
          
          {tripStatus !== "stopped" && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => toast({ description: "Issue reporting feature coming soon!" })}
              data-testid="button-report-issue"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Issue
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}