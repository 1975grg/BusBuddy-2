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
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          <div className="absolute inset-0 opacity-20">
            {/* Street pattern */}
            <svg className="w-full h-full">
              <defs>
                <pattern id="streets" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                  {/* Main streets */}
                  <path d="M0,40 L80,40 M40,0 L40,80" stroke="currentColor" strokeWidth="3" className="text-slate-400 dark:text-slate-600"/>
                  {/* Side streets */}
                  <path d="M0,20 L80,20 M0,60 L80,60 M20,0 L20,80 M60,0 L60,80" stroke="currentColor" strokeWidth="1.5" className="text-slate-300 dark:text-slate-700" opacity="0.6"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#streets)" />
            </svg>
          </div>
        </div>
        
        {/* Bus markers */}
        {buses.map((bus, index) => {
          // For mock map, center the first bus and offset others slightly
          const left = index === 0 ? 50 : 50 + (index * 10);
          const top = index === 0 ? 50 : 50 + (index * 10);
          
          return (
            <div
              key={bus.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
            >
              <div className={`w-6 h-6 rounded-full ${getStatusColor(bus.status)} border-3 border-white shadow-lg animate-pulse`} />
            
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
          );
        })}
        
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