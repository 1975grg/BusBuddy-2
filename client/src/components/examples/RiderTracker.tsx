import { RiderTracker } from '../RiderTracker';

export default function RiderTrackerExample() {
  const mockStops = [
    { id: "1", name: "Main Entrance", eta: "3 min", isNext: true },
    { id: "2", name: "Student Center", eta: "7 min", isNext: false },
    { id: "3", name: "Library", eta: "12 min", isNext: false },
    { id: "4", name: "Cafeteria", eta: "15 min", isNext: false }
  ];

  return (
    <div className="max-w-md">
      <RiderTracker
        routeName="Campus Shuttle"
        busName="Shuttle A"
        status="active"
        stops={mockStops}
        defaultStop="1"
        isNotificationsEnabled={true}
      />
    </div>
  );
}