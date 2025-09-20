import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";

interface Bus {
  id: string;
  name: string;
  status: "active" | "delayed" | "offline";
  lat: number;
  lng: number;
  eta: string;
  nextStop: string;
}

interface LiveMapProps {
  buses: Bus[];
  className?: string;
}

export function LiveMap({ buses, className }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);

  // TODO: remove mock functionality - replace with real MapLibre integration
  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Mock map initialization
    console.log("Map initialized with buses:", buses);
  }, [buses]);

  const getStatusColor = (status: Bus["status"]) => {
    switch (status) {
      case "active": return "bg-bus-active";
      case "delayed": return "bg-bus-delayed";
      case "offline": return "bg-bus-offline";
    }
  };

  return (
    <div className={className}>
      <div 
        ref={mapContainer} 
        className="w-full h-full bg-muted rounded-md relative overflow-hidden"
      >
        {/* Mock map background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <div className="absolute inset-0 opacity-10">
            {/* Street pattern */}
            <svg className="w-full h-full">
              <defs>
                <pattern id="streets" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M0,50 L100,50 M50,0 L50,100" stroke="currentColor" strokeWidth="2"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#streets)" />
            </svg>
          </div>
        </div>
        
        {/* Bus markers */}
        {buses.map((bus, index) => (
          <div
            key={bus.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${30 + index * 20}%`,
              top: `${40 + index * 10}%`,
            }}
          >
            <div className={`w-4 h-4 rounded-full ${getStatusColor(bus.status)} border-2 border-white shadow-lg`} />
            
            {/* ETA card on hover */}
            <Card className="absolute bottom-6 left-1/2 transform -translate-x-1/2 p-2 min-w-32 opacity-0 hover:opacity-100 transition-opacity z-10">
              <div className="text-sm font-medium">{bus.name}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {bus.eta}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {bus.nextStop}
              </div>
            </Card>
          </div>
        ))}
        
        {/* Legend */}
        <Card className="absolute top-4 right-4 p-3">
          <div className="text-sm font-medium mb-2">Bus Status</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-bus-active" />
              On Time
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-bus-delayed" />
              Delayed
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-bus-offline" />
              Offline
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}