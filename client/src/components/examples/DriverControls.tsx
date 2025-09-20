import { DriverControls } from '../DriverControls';

export default function DriverControlsExample() {
  return (
    <div className="max-w-md">
      <DriverControls 
        routeName="Route 15 - Main Campus"
        currentStop="Library Stop"
        nextStop="Student Center" 
        eta="4 min"
      />
    </div>
  );
}