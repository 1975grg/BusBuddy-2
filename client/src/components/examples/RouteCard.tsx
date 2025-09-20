import { RouteCard } from '../RouteCard';

export default function RouteCardExample() {
  const mockStops = [
    { id: "1", name: "Main Entrance", eta: "2 min" },
    { id: "2", name: "Cafeteria", eta: "5 min" },
    { id: "3", name: "Library", eta: "8 min" },
    { id: "4", name: "Gymnasium" },
    { id: "5", name: "Science Building" }
  ];

  return (
    <div className="max-w-md">
      <RouteCard
        id="route-1"
        name="Main Campus Loop"
        type="shuttle"
        status="active"
        vehicleNumber="BUS-001"
        stops={mockStops}
        ridersCount={23}
        onEdit={() => console.log('Edit route')}
        onToggleStatus={() => console.log('Toggle status')}
      />
    </div>
  );
}