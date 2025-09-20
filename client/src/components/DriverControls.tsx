import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, MapPin, Clock, AlertTriangle } from "lucide-react";

interface DriverControlsProps {
  routeName: string;
  currentStop?: string;
  nextStop?: string;
  eta?: string;
}

export function DriverControls({ routeName, currentStop, nextStop, eta }: DriverControlsProps) {
  const [tripStatus, setTripStatus] = useState<"stopped" | "active" | "paused">("stopped");
  
  const handleStartTrip = () => {
    setTripStatus("active");
    console.log("Trip started");
  };
  
  const handlePauseTrip = () => {
    setTripStatus("paused");
    console.log("Trip paused");
  };
  
  const handleResumeTrip = () => {
    setTripStatus("active");
    console.log("Trip resumed");
  };
  
  const handleEndTrip = () => {
    setTripStatus("stopped");
    console.log("Trip ended");
  };

  const getStatusBadge = () => {
    switch (tripStatus) {
      case "active":
        return <Badge className="bg-bus-active text-white">Active</Badge>;
      case "paused":
        return <Badge className="bg-bus-delayed text-white">Paused</Badge>;
      case "stopped":
        return <Badge variant="secondary">Stopped</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{routeName}</CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tripStatus !== "stopped" && (
            <div className="space-y-3">
              {currentStop && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Current: {currentStop}</span>
                </div>
              )}
              {nextStop && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm">Next: {nextStop}</span>
                  {eta && (
                    <Badge variant="outline" className="ml-auto">
                      <Clock className="w-3 h-3 mr-1" />
                      {eta}
                    </Badge>
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
                data-testid="button-start-trip"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Trip
              </Button>
            )}
            
            {tripStatus === "active" && (
              <>
                <Button 
                  onClick={handlePauseTrip} 
                  variant="outline" 
                  className="flex-1"
                  data-testid="button-pause-trip"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
                <Button 
                  onClick={handleEndTrip} 
                  variant="destructive" 
                  className="flex-1"
                  data-testid="button-end-trip"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End Trip
                </Button>
              </>
            )}
            
            {tripStatus === "paused" && (
              <>
                <Button 
                  onClick={handleResumeTrip} 
                  className="flex-1"
                  data-testid="button-resume-trip"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button 
                  onClick={handleEndTrip} 
                  variant="destructive" 
                  className="flex-1"
                  data-testid="button-end-trip"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End Trip
                </Button>
              </>
            )}
          </div>
          
          {tripStatus !== "stopped" && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => console.log("Report issue")}
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