import { useState, useEffect, useRef, useCallback } from "react";

interface WakeLockState {
  isActive: boolean;
  isSupported: boolean;
  error: string | null;
  autoReleasedReason: string | null;
}

interface MovementState {
  lastLat: number | null;
  lastLng: number | null;
  lastMovementTime: number | null;
}

interface UseWakeLockOptions {
  enabled: boolean;
  inactivityTimeoutMs?: number;
  movementThresholdMeters?: number;
  onAutoRelease?: (reason: string) => void;
}

const EARTH_RADIUS_METERS = 6371000;

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function useWakeLock({
  enabled,
  inactivityTimeoutMs = 30 * 60 * 1000,
  movementThresholdMeters = 50,
  onAutoRelease,
}: UseWakeLockOptions) {
  const [state, setState] = useState<WakeLockState>({
    isActive: false,
    isSupported: false,
    error: null,
    autoReleasedReason: null,
  });
  
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const movementRef = useRef<MovementState>({
    lastLat: null,
    lastLng: null,
    lastMovementTime: null,
  });
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  const isSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      setState(prev => ({ 
        ...prev, 
        isSupported: false, 
        error: "Wake Lock not supported on this device" 
      }));
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      
      wakeLockRef.current.addEventListener("release", () => {
        console.log("[WakeLock] Released");
        setState(prev => ({ ...prev, isActive: false }));
      });
      
      console.log("[WakeLock] Acquired - screen will stay on");
      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isSupported: true, 
        error: null,
        autoReleasedReason: null,
      }));
      
      movementRef.current = {
        lastLat: null,
        lastLng: null,
        lastMovementTime: Date.now(),
      };
      
      return true;
    } catch (err: any) {
      console.error("[WakeLock] Failed to acquire:", err);
      setState(prev => ({ 
        ...prev, 
        isActive: false, 
        error: err?.message || "Failed to acquire wake lock" 
      }));
      return false;
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async (reason?: string) => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        console.log("[WakeLock] Released manually" + (reason ? `: ${reason}` : ""));
      } catch (err) {
        console.error("[WakeLock] Error releasing:", err);
      }
      wakeLockRef.current = null;
    }
    
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current);
      inactivityCheckRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isActive: false,
      autoReleasedReason: reason || null,
    }));
  }, []);

  const updatePosition = useCallback((lat: number, lng: number) => {
    const now = Date.now();
    const prev = movementRef.current;
    
    if (prev.lastLat !== null && prev.lastLng !== null) {
      const distance = calculateDistance(prev.lastLat, prev.lastLng, lat, lng);
      
      if (distance >= movementThresholdMeters) {
        movementRef.current = {
          lastLat: lat,
          lastLng: lng,
          lastMovementTime: now,
        };
        console.log(`[WakeLock] Movement detected: ${distance.toFixed(1)}m`);
        
        if (state.autoReleasedReason) {
          console.log("[WakeLock] Movement detected - clearing auto-release state");
          setState(prev => ({ ...prev, autoReleasedReason: null }));
        }
      }
    } else {
      movementRef.current = {
        lastLat: lat,
        lastLng: lng,
        lastMovementTime: now,
      };
    }
  }, [movementThresholdMeters, state.autoReleasedReason]);

  useEffect(() => {
    if (enabled && !state.isActive && !state.autoReleasedReason) {
      requestWakeLock();
    } else if (!enabled && state.isActive) {
      releaseWakeLock("Trip ended");
    } else if (!enabled && state.autoReleasedReason) {
      setState(prev => ({ ...prev, autoReleasedReason: null }));
    }
  }, [enabled, state.isActive, state.autoReleasedReason, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!enabled || !state.isActive) {
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
        inactivityCheckRef.current = null;
      }
      return;
    }

    inactivityCheckRef.current = setInterval(() => {
      const lastMovement = movementRef.current.lastMovementTime;
      if (lastMovement === null) return;
      
      const timeSinceMovement = Date.now() - lastMovement;
      
      if (timeSinceMovement >= inactivityTimeoutMs) {
        const reason = "Bus stationary for 30 minutes";
        console.log(`[WakeLock] Auto-releasing: ${reason}`);
        releaseWakeLock(reason);
        onAutoRelease?.(reason);
      }
    }, 60000);

    return () => {
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
        inactivityCheckRef.current = null;
      }
    };
  }, [enabled, state.isActive, inactivityTimeoutMs, releaseWakeLock, onAutoRelease]);

  useEffect(() => {
    if (!enabled || !state.isActive) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && enabled && !wakeLockRef.current && !state.autoReleasedReason) {
        console.log("[WakeLock] Re-acquiring after visibility change");
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, state.isActive, state.autoReleasedReason, requestWakeLock]);

  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
      }
    };
  }, []);

  return {
    ...state,
    isSupported,
    updatePosition,
    requestWakeLock,
    releaseWakeLock,
  };
}
