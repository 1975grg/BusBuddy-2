/**
 * Geofencing utilities for GPS tracking and proximity notifications
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in feet
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 20902231; // Earth's radius in feet
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a geofence radius
 */
export function isWithinGeofence(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusFeet: number
): boolean {
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  return distance <= radiusFeet;
}

/**
 * Find the next stop the bus is approaching based on GPS location
 * Returns the stop and distance to it
 */
export function findNextStop(
  currentLat: number,
  currentLon: number,
  stops: Array<{ id: string; latitude: string | null; longitude: string | null; orderIndex: number }>
): { stopId: string; distance: number } | null {
  const stopsWithCoordinates = stops.filter(
    (stop) => stop.latitude !== null && stop.longitude !== null
  );

  if (stopsWithCoordinates.length === 0) {
    return null;
  }

  let closest: { stopId: string; distance: number } | null = null;

  for (const stop of stopsWithCoordinates) {
    const stopLat = parseFloat(stop.latitude!);
    const stopLon = parseFloat(stop.longitude!);

    const distance = calculateDistance(currentLat, currentLon, stopLat, stopLon);

    if (!closest || distance < closest.distance) {
      closest = { stopId: stop.id, distance };
    }
  }

  return closest;
}
