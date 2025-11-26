import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, MapPin, Clock, AlertTriangle, Navigation, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getStoredSessionToken } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";
import type { RouteSession } from "@shared/schema";

// GPS status for debugging
interface GPSStatus {
  lastLat: number | null;
  lastLng: number | null;
  lastUpdate: Date | null;
  updateCount: number;
  errorCount: number;
  lastError: string | null;
}

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
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>({
    lastLat: null,
    lastLng: null,
    lastUpdate: null,
    updateCount: 0,
    errorCount: 0,
    lastError: null,
  });
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
    console.log("DriverControls useEffect - existingSession:", {
      hasSession: !!existingSession,
      sessionId: existingSession?.id,
      status: existingSession?.status,
      watchIdExists: !!watchIdRef.current
    });
    
    if (existingSession) {
      setSessionId(existingSession.id);
      
      // Map session status to trip status appropriately
      switch (existingSession.status) {
        case "active":
          setTripStatus("active");
          // CRITICAL: Update refs IMMEDIATELY before starting GPS tracking
          // This fixes the race condition where GPS callback fires before React state updates
          sessionIdRef.current = existingSession.id;
          tripStatusRef.current = "active";
          
          // Start GPS tracking for existing active sessions
          // Guard: Only start if not already tracking to prevent duplicate watchers
          if (!watchIdRef.current) {
            console.log("DriverControls: Starting GPS tracking for active session", existingSession.id);
            startGPSTracking(existingSession.id);
          } else {
            console.log("DriverControls: GPS already tracking, skipping start");
          }
          break;
        case "pending":
          // Treat pending sessions as paused - driver can resume
          // Stop GPS tracking if it was running (e.g., server-side pause)
          stopGPSTracking();
          setTripStatus("paused");
          break;
        case "completed":
        case "cancelled":
          stopGPSTracking();
          setTripStatus("stopped");
          setSessionId(null);
          break;
        default:
          setTripStatus("stopped");
      }
    } else {
      // Clean up GPS tracking if session is cleared
      stopGPSTracking();
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

  // Track consecutive auth failures to avoid spamming the user
  const authFailureCountRef = useRef<number>(0);
  const authErrorShownRef = useRef<boolean>(false);

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ sessionId, latitude, longitude }: { sessionId: string; latitude: number; longitude: number }) => {
      if (!sessionId) throw new Error("No active session");
      console.log("[GPS] Sending location to server:", { sessionId: sessionId.substring(0, 8) + "...", latitude, longitude });
      const response = await apiRequest("PATCH", `/api/route-sessions/${sessionId}/location`, {
        latitude,
        longitude,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log("[GPS] Location update SUCCESS - server stored coordinates");
      // Reset auth failure count on success
      authFailureCountRef.current = 0;
      // Update GPS status to show success
      setGpsStatus(prev => ({
        ...prev,
        lastUpdate: new Date(),
        updateCount: prev.updateCount + 1,
        lastError: null,
      }));
    },
    onError: (error: any) => {
      console.error("[GPS] Location update FAILED:", error?.message || error);
      
      // Update GPS status to show error
      setGpsStatus(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1,
        lastError: error?.message || "Unknown error",
      }));
      
      // Check if this is a 401 authentication error
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("Authentication")) {
        authFailureCountRef.current++;
        console.log("[GPS] Auth failure count:", authFailureCountRef.current);
        
        // After 3 consecutive auth failures, stop GPS and show error
        if (authFailureCountRef.current >= 3 && !authErrorShownRef.current) {
          authErrorShownRef.current = true;
          console.log("[GPS] Too many auth failures, stopping GPS and prompting re-login");
          stopGPSTracking();
          toast({
            variant: "destructive",
            title: "Session Expired",
            description: "Please log out and log back in to continue tracking.",
          });
        }
      }
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
      // Clear refs FIRST before stopping GPS tracking
      sessionIdRef.current = null;
      tripStatusRef.current = "stopped";
      
      // Then stop GPS tracking
      stopGPSTracking();
      
      // Finally update state
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
      // Clear refs FIRST
      tripStatusRef.current = "paused";
      
      // Then stop GPS tracking
      stopGPSTracking();
      
      // Finally update state
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
    console.log("[GPS] startGPSTracking called with sessionId:", activeSessionId);
    
    // Check if we're on native and need a token for auth
    const isNative = Capacitor.isNativePlatform();
    console.log("[GPS] Platform check - isNative:", isNative);
    
    if (isNative) {
      const token = getStoredSessionToken();
      console.log("[GPS] Native token check:", token ? "present" : "missing");
      
      if (!token) {
        console.log("[GPS] CRITICAL: No auth token on native platform! GPS updates will fail.");
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please log out and log back in to enable GPS tracking.",
        });
        // Don't start GPS tracking without auth - it will just fail silently
        return;
      }
    }
    
    // Reset auth failure tracking
    authFailureCountRef.current = 0;
    authErrorShownRef.current = false;
    
    // Guard: Clean up any existing tracking before starting new
    stopGPSTracking();
    
    // Set refs IMMEDIATELY so callbacks can use current values
    sessionIdRef.current = activeSessionId;
    tripStatusRef.current = "active";
    
    // Reset GPS state when starting tracking
    gpsErrorShownRef.current = false;
    watchPositionSucceededRef.current = false;
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
      console.log("[GPS] Geolocation API not available!");
      toast({
        variant: "destructive",
        title: "GPS not available",
        description: "Your device does not support GPS tracking. Trip started but location won't update.",
      });
      // Don't cancel the trip - just warn the user
      return;
    }

    console.log("[GPS] Setting up GPS tracking...");
    
    // IMPORTANT: Start backup interval IMMEDIATELY - don't wait for watchPosition
    // In WebViews, watchPosition callbacks may not fire reliably
    console.log("[GPS] Starting 5-second backup polling interval immediately");
    locationIntervalRef.current = setInterval(() => {
      // Check if session is still active before attempting to get location
      if (!sessionIdRef.current || tripStatusRef.current !== "active") {
        console.log("[GPS] Interval: Session not active, skipping", { sessionId: sessionIdRef.current, status: tripStatusRef.current });
        return;
      }
      
      console.log("[GPS] Interval: Requesting current position...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log("[GPS] Interval success:", latitude, longitude);
          
          // Update GPS status with received coordinates
          setGpsStatus(prev => ({
            ...prev,
            lastLat: latitude,
            lastLng: longitude,
          }));
          
          // Double-check session is still active before sending update
          if (sessionIdRef.current && tripStatusRef.current === "active" && !updateLocationMutation.isPending) {
            console.log("[GPS] Sending location update to server...");
            updateLocationMutation.mutate({ sessionId: sessionIdRef.current, latitude, longitude });
          }
        },
        (error) => {
          // Log GPS errors but DON'T cancel the trip - keep retrying
          console.log("[GPS] Interval error (will retry):", error.code, error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Longer timeout for WebView
          maximumAge: 5000, // Allow slightly cached positions
        }
      );
    }, 5000);
    
    // Also try to get an immediate position
    console.log("[GPS] Requesting immediate position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log("[GPS] Immediate position success:", latitude, longitude);
        
        if (sessionIdRef.current && tripStatusRef.current === "active" && !updateLocationMutation.isPending) {
          updateLocationMutation.mutate({ sessionId: activeSessionId, latitude, longitude });
        }
      },
      (error) => {
        console.log("[GPS] Immediate position failed (interval will retry):", error.code, error.message);
        // Don't show toast or cancel trip - the interval will keep trying
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    // Also set up watchPosition as an additional source (but don't rely on it)
    console.log("[GPS] Setting up watchPosition as additional source...");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log("[GPS] watchPosition update:", latitude, longitude);
        watchPositionSucceededRef.current = true;
        
        // Only send update if session is still active and previous mutation is not pending
        if (sessionIdRef.current && tripStatusRef.current === "active" && !updateLocationMutation.isPending) {
          updateLocationMutation.mutate({ sessionId: activeSessionId, latitude, longitude });
        }
      },
      (error) => {
        // Log but DON'T cancel the trip - the interval will keep trying
        console.log("[GPS] watchPosition error (interval will retry):", error.code, error.message);
        
        // Show error toast only once to help user understand
        if (!gpsErrorShownRef.current && error.code === 1) {
          gpsErrorShownRef.current = true;
          toast({
            variant: "destructive",
            title: "GPS Permission",
            description: "Please enable location access for better tracking accuracy.",
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
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
  
  // Helper to check if we have valid auth for native platform
  const checkNativeAuth = (): boolean => {
    const isNative = Capacitor.isNativePlatform();
    if (isNative && !getStoredSessionToken()) {
      console.log("[AUTH] Native platform but no token - prompting re-login");
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Please log out and log back in to continue.",
      });
      return false;
    }
    return true;
  };

  const handleStartTrip = () => {
    // Check auth before starting trip on native
    if (!checkNativeAuth()) return;
    startTripMutation.mutate();
  };
  
  const handlePauseTrip = () => {
    pauseTripMutation.mutate();
  };
  
  const handleResumeTrip = () => {
    // Check auth before resuming trip on native
    if (!checkNativeAuth()) return;
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
              
              {/* GPS Status Indicator */}
              {tripStatus === "active" && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">GPS Tracking</span>
                    {gpsStatus.lastUpdate ? (
                      <Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-600 border-green-500/30">
                        <Wifi className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        <WifiOff className="w-3 h-3 mr-1" />
                        Waiting...
                      </Badge>
                    )}
                  </div>
                  
                  {gpsStatus.lastLat && gpsStatus.lastLng && (
                    <div className="text-xs text-muted-foreground">
                      Last: {gpsStatus.lastLat.toFixed(4)}, {gpsStatus.lastLng.toFixed(4)}
                    </div>
                  )}
                  
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Updates: {gpsStatus.updateCount}</span>
                    {gpsStatus.errorCount > 0 && (
                      <span className="text-red-500">Errors: {gpsStatus.errorCount}</span>
                    )}
                  </div>
                  
                  {gpsStatus.lastError && (
                    <div className="text-xs text-red-500 truncate">
                      Error: {gpsStatus.lastError}
                    </div>
                  )}
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