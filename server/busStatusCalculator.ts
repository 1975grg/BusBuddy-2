import type { RouteSession, RouteStop } from "@shared/schema";

export type BusStatus = "active" | "offline";

interface BusStatusCalculation {
  status: BusStatus;
}

const OFFLINE_THRESHOLD_MINUTES = 10; // Bus is offline if no GPS update in 10 minutes

export function calculateBusStatus(
  session: RouteSession | null,
  stops?: RouteStop[]
): BusStatusCalculation {
  
  // No session or session is not active = offline
  if (!session || session.status !== 'active') {
    return {
      status: "offline"
    };
  }

  const now = new Date();
  
  // Check if GPS location is recent (within last 10 minutes)
  const lastUpdate = session.lastLocationUpdate ? new Date(session.lastLocationUpdate) : null;
  const minutesSinceUpdate = lastUpdate 
    ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
    : Infinity;

  // If no recent GPS update, mark as offline
  if (minutesSinceUpdate > OFFLINE_THRESHOLD_MINUTES) {
    return {
      status: "offline"
    };
  }

  // Session is active and has recent GPS = active
  return {
    status: "active"
  };
}

export function estimateCurrentStop(
  session: RouteSession,
  stops: RouteStop[]
): RouteStop | null {
  if (!session.startedAt || stops.length === 0) {
    return null;
  }

  const startedAt = new Date(session.startedAt);
  const now = new Date();
  const minutesSinceStart = (now.getTime() - startedAt.getTime()) / (1000 * 60);

  const stopsWithSchedule = stops
    .filter(s => s.scheduledArrivalMinutes !== null && s.scheduledArrivalMinutes !== undefined)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (stopsWithSchedule.length === 0) {
    return stops.sort((a, b) => a.orderIndex - b.orderIndex)[0] || null;
  }

  for (let i = stopsWithSchedule.length - 1; i >= 0; i--) {
    const stop = stopsWithSchedule[i];
    if (minutesSinceStart >= stop.scheduledArrivalMinutes!) {
      return stop;
    }
  }

  return stopsWithSchedule[0];
}
