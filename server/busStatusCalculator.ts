import type { RouteSession, RouteStop } from "@shared/schema";

export type BusStatus = "active" | "delayed" | "offline";

interface BusStatusCalculation {
  status: BusStatus;
  minutesBehindSchedule: number;
}

const DELAYED_THRESHOLD_MINUTES = 5; // Bus is delayed if more than 5 minutes behind schedule
const OFFLINE_THRESHOLD_MINUTES = 10; // Bus is offline if no GPS update in 10 minutes

export function calculateBusStatus(
  session: RouteSession | null,
  stops: RouteStop[]
): BusStatusCalculation {
  
  if (!session) {
    return {
      status: "offline",
      minutesBehindSchedule: 0
    };
  }

  if (session.status !== 'active') {
    return {
      status: "offline",
      minutesBehindSchedule: 0
    };
  }

  const now = new Date();
  
  const lastUpdate = session.lastLocationUpdate ? new Date(session.lastLocationUpdate) : null;
  const minutesSinceUpdate = lastUpdate 
    ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
    : Infinity;

  if (minutesSinceUpdate > OFFLINE_THRESHOLD_MINUTES) {
    return {
      status: "offline",
      minutesBehindSchedule: 0
    };
  }

  if (!session.startedAt) {
    return {
      status: "active",
      minutesBehindSchedule: 0
    };
  }

  const startedAt = new Date(session.startedAt);
  const minutesSinceStart = (now.getTime() - startedAt.getTime()) / (1000 * 60);

  const currentStopId = session.currentStopId;
  if (!currentStopId) {
    return {
      status: "active",
      minutesBehindSchedule: 0
    };
  }

  const currentStop = stops.find(s => s.id === currentStopId);
  if (!currentStop || currentStop.scheduledArrivalMinutes === null || currentStop.scheduledArrivalMinutes === undefined) {
    return {
      status: "active",
      minutesBehindSchedule: 0
    };
  }

  const scheduledMinutes = currentStop.scheduledArrivalMinutes;
  const minutesBehindSchedule = minutesSinceStart - scheduledMinutes;

  if (minutesBehindSchedule > DELAYED_THRESHOLD_MINUTES) {
    return {
      status: "delayed",
      minutesBehindSchedule: Math.round(minutesBehindSchedule)
    };
  }

  return {
    status: "active",
    minutesBehindSchedule: Math.round(minutesBehindSchedule)
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
