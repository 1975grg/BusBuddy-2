import { LiveMap } from '../LiveMap';

export default function LiveMapExample() {
  const mockBuses = [
    {
      id: "bus-1",
      name: "School Bus A",
      status: "active" as const,
      lat: 40.7128,
      lng: -74.0060,
      eta: "3 min",
      nextStop: "Main Street Elementary"
    },
    {
      id: "bus-2", 
      name: "Shuttle B",
      status: "delayed" as const,
      lat: 40.7589,
      lng: -73.9851,
      eta: "8 min",
      nextStop: "Hospital Parking"
    },
    {
      id: "bus-3",
      name: "Route C",
      status: "offline" as const,
      lat: 40.7505,
      lng: -73.9934,
      eta: "N/A",
      nextStop: "Downtown Terminal"
    }
  ];

  return (
    <div className="h-96">
      <LiveMap buses={mockBuses} />
    </div>
  );
}