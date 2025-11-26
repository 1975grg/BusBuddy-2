import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, MapPin, CheckCircle, XCircle, AlertCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { useRequireRole } from "@/contexts/UserContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Link } from "wouter";

type PermissionStatus = "granted" | "denied" | "prompt" | "unknown" | "checking";

export default function DriverSettingsPage() {
  const { user: currentUser, isLoading: authLoading } = useRequireRole("driver");
  const [locationPermission, setLocationPermission] = useState<PermissionStatus>("checking");
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    setLocationPermission("checking");
    
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Geolocation for native
        const status = await Geolocation.checkPermissions();
        console.log("[Settings] Capacitor permission status:", status);
        setLocationPermission(status.location as PermissionStatus);
      } else {
        // Web browser permissions API
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          console.log("[Settings] Web permission status:", result.state);
          setLocationPermission(result.state as PermissionStatus);
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setLocationPermission(result.state as PermissionStatus);
          });
        } else {
          setLocationPermission("unknown");
        }
      }
    } catch (error) {
      console.error("[Settings] Error checking permission:", error);
      setLocationPermission("unknown");
    }
  };

  const requestLocationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Request permission using Capacitor
        const result = await Geolocation.requestPermissions();
        console.log("[Settings] Permission request result:", result);
        setLocationPermission(result.location as PermissionStatus);
        
        if (result.location === "denied") {
          // On iOS, if denied, we need to guide user to settings
          openAppSettings();
        }
      } else {
        // Web: Request via getCurrentPosition
        navigator.geolocation.getCurrentPosition(
          () => {
            setLocationPermission("granted");
          },
          (error) => {
            if (error.code === 1) {
              setLocationPermission("denied");
            }
          }
        );
      }
    } catch (error) {
      console.error("[Settings] Error requesting permission:", error);
    }
  };

  const openAppSettings = () => {
    // Show instructions for enabling location in iOS Settings
    alert("To enable location:\n\n1. Open Settings app\n2. Tap Privacy & Security\n3. Tap Location Services\n4. Find Bus Buddy\n5. Select 'While Using the App'");
  };

  const getStatusBadge = () => {
    switch (locationPermission) {
      case "granted":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">
            <CheckCircle className="w-3 h-3 mr-1" />
            Enabled
          </Badge>
        );
      case "denied":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/30" variant="outline">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      case "prompt":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30" variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Asked
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="outline">
            Checking...
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Link href="/driver">
          <Button variant="ghost" size="icon" data-testid="button-back-driver">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Driver Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your app permissions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location Permission
          </CardTitle>
          <CardDescription>
            GPS tracking requires location access to share your position with riders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Current Status</p>
              <p className="text-sm text-muted-foreground">
                {isNative ? "iOS App" : "Web Browser"}
              </p>
            </div>
            {getStatusBadge()}
          </div>

          {locationPermission === "denied" && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 font-medium mb-2">Location Access Denied</p>
              <p className="text-sm text-red-600/80 mb-3">
                GPS tracking won't work until you enable location access. 
                {isNative 
                  ? " Please open your device settings to enable it."
                  : " Please allow location access in your browser."
                }
              </p>
              {isNative && (
                <Button 
                  onClick={openAppSettings}
                  variant="outline"
                  className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                  data-testid="button-open-settings"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  How to Enable Location
                </Button>
              )}
            </div>
          )}

          {locationPermission === "prompt" && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium mb-2">Location Not Yet Requested</p>
              <p className="text-sm text-yellow-600/80 mb-3">
                Click below to enable GPS tracking for your trips.
              </p>
              <Button 
                onClick={requestLocationPermission}
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                data-testid="button-request-permission"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Enable Location
              </Button>
            </div>
          )}

          {locationPermission === "granted" && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-600 font-medium mb-1">Location Access Enabled</p>
              <p className="text-sm text-green-600/80">
                GPS tracking is ready. Your position will be shared with riders when you start a trip.
              </p>
            </div>
          )}

          <Button 
            onClick={checkLocationPermission} 
            variant="outline" 
            className="w-full"
            data-testid="button-refresh-status"
          >
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p className="font-medium">GPS not working?</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Make sure Location Services are enabled in device settings</li>
              <li>Grant "While Using the App" permission for Bus Buddy</li>
              <li>Try refreshing the status above</li>
              <li>Restart the app if issues persist</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
