import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "@/components/ui/card";

interface Bus {
  id: string;
  name: string;
  status: "active" | "delayed" | "offline";
  lat: number | string;
  lng: number | string;
  eta: string;
  nextStop: string;
}

interface LiveMapProps {
  buses: Bus[];
  className?: string;
  followBus?: boolean; // If true, map will follow the first active bus
}

export function LiveMap({ buses, className, followBus = false }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapError, setMapError] = useState<string | null>(null);
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Default center (will adjust to first bus location)
      const defaultCenter: [number, number] = [-79.9481, 39.6567]; // Morgantown, WV area
      
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors',
              maxzoom: 19
            }
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 22
            }
          ]
        },
        center: defaultCenter,
        zoom: 13,
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Failed to load map. Please check your connection.');
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError('Failed to initialize map.');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update bus markers when buses change
  useEffect(() => {
    if (!map.current) return;

    const currentBusIds = new Set(buses.map(b => b.id));
    
    // Remove markers for buses that no longer exist
    markers.current.forEach((marker, id) => {
      if (!currentBusIds.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    });

    // Find the first active bus to potentially follow
    const activeBus = buses.find(b => b.status === 'active');

    // Add or update markers for current buses
    buses.forEach((bus) => {
      const lat = typeof bus.lat === 'string' ? parseFloat(bus.lat) : bus.lat;
      const lng = typeof bus.lng === 'string' ? parseFloat(bus.lng) : bus.lng;

      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`Invalid coordinates for bus ${bus.id}:`, { lat: bus.lat, lng: bus.lng });
        return;
      }

      let marker = markers.current.get(bus.id);

      if (!marker) {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        
        // Set color based on status
        const statusColors = {
          active: '#22c55e',
          delayed: '#f59e0b',
          offline: '#ef4444',
        };
        el.style.backgroundColor = statusColors[bus.status];

        // Create popup with bus info
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${bus.name}</div>
            <div style="font-size: 12px; color: #666;">
              <div style="margin-bottom: 2px;">⏱️ ${bus.eta}</div>
              <div>📍 ${bus.nextStop}</div>
            </div>
          </div>
        `);

        marker = new maplibregl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current.set(bus.id, marker);

        // Center map on first bus (initial load)
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          map.current?.flyTo({
            center: [lng, lat],
            zoom: 14,
            duration: 1000,
          });
          lastCenterRef.current = { lat, lng };
        }
      } else {
        // Update existing marker position
        marker.setLngLat([lng, lat]);
        
        // Update marker color if status changed
        const el = marker.getElement();
        const statusColors = {
          active: '#22c55e',
          delayed: '#f59e0b',
          offline: '#ef4444',
        };
        el.style.backgroundColor = statusColors[bus.status];

        // Update popup content
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(`
            <div style="padding: 8px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${bus.name}</div>
              <div style="font-size: 12px; color: #666;">
                <div style="margin-bottom: 2px;">⏱️ ${bus.eta}</div>
                <div>📍 ${bus.nextStop}</div>
              </div>
            </div>
          `);
        }
      }
    });

    // Follow the first bus with valid coordinates if followBus is enabled
    if (followBus && buses.length > 0) {
      // Find first bus with valid coordinates (prioritize active, then delayed, then any)
      const busToFollow = buses.find(b => b.status === 'active') || 
                          buses.find(b => b.status === 'delayed') || 
                          buses[0];
      
      if (busToFollow) {
        const lat = typeof busToFollow.lat === 'string' ? parseFloat(busToFollow.lat) : busToFollow.lat;
        const lng = typeof busToFollow.lng === 'string' ? parseFloat(busToFollow.lng) : busToFollow.lng;
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const lastCenter = lastCenterRef.current;
          
          // Check if position changed significantly (more than ~100 meters)
          const significantChange = !lastCenter || 
            Math.abs(lastCenter.lat - lat) > 0.001 || 
            Math.abs(lastCenter.lng - lng) > 0.001;
          
          if (significantChange) {
            map.current?.flyTo({
              center: [lng, lat],
              zoom: 14,
              duration: 1000,
            });
            lastCenterRef.current = { lat, lng };
          }
        }
      }
    }
  }, [buses, followBus]);

  return (
    <div className={className}>
      <div 
        ref={mapContainer} 
        className="w-full h-full bg-muted rounded-md relative overflow-hidden"
        data-testid="map-container"
      >
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Card className="p-4 max-w-sm">
              <p className="text-sm text-destructive">{mapError}</p>
            </Card>
          </div>
        )}
        
        {/* Legend */}
        <Card className="absolute top-4 right-4 p-3 z-10" data-testid="map-legend">
          <div className="text-sm font-medium mb-2">Bus Status</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-bus-active" />
              Active
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
