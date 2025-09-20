import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { RouteCard } from "@/components/RouteCard";

export default function RoutesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // TODO: remove mock functionality - replace with real route data
  const mockRoutes = [
    {
      id: "1",
      name: "Main Campus Loop",
      type: "shuttle" as const,
      status: "active" as const,
      vehicleNumber: "SHUTTLE-001",
      stops: [
        { id: "1", name: "Main Entrance", eta: "2 min" },
        { id: "2", name: "Student Center", eta: "7 min" },
        { id: "3", name: "Library", eta: "12 min" },
        { id: "4", name: "Cafeteria", eta: "15 min" }
      ],
      ridersCount: 23
    },
    {
      id: "2", 
      name: "West Campus Express",
      type: "bus" as const,
      status: "active" as const,
      vehicleNumber: "BUS-105",
      stops: [
        { id: "5", name: "West Gate", eta: "5 min" },
        { id: "6", name: "Engineering Building" },
        { id: "7", name: "Research Center" },
        { id: "8", name: "Parking Garage B" },
        { id: "9", name: "Athletics Complex" }
      ],
      ridersCount: 41
    },
    {
      id: "3",
      name: "Hospital Shuttle",
      type: "shuttle" as const, 
      status: "inactive" as const,
      vehicleNumber: "MED-001",
      stops: [
        { id: "10", name: "Main Hospital", eta: "N/A" },
        { id: "11", name: "Emergency Entrance", eta: "N/A" }
      ],
      ridersCount: 0
    }
  ];

  const filteredRoutes = mockRoutes.filter(route =>
    route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routes</h1>
          <p className="text-muted-foreground">Manage your bus and shuttle routes</p>
        </div>
        <Button data-testid="button-add-route">
          <Plus className="w-4 h-4 mr-2" />
          Add Route
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-routes"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRoutes.map((route) => (
          <RouteCard
            key={route.id}
            {...route}
            onEdit={() => console.log(`Edit route ${route.id}`)}
            onToggleStatus={() => console.log(`Toggle status for route ${route.id}`)}
          />
        ))}
      </div>

      {filteredRoutes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No routes found matching your search.</p>
        </div>
      )}
    </div>
  );
}