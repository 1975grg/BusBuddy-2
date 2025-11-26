import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// Session token storage key for native app persistence
const SESSION_TOKEN_KEY = "busbuddy_session_token";

// In-memory cache of the token for synchronous access
let cachedToken: string | null = null;
let tokenInitialized = false;

// Check if running on native platform (iOS/Android) vs web
function isNativePlatform(): boolean {
  try {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    console.log("[AUTH-PLATFORM] Platform:", platform, "isNative:", isNative);
    return isNative;
  } catch (e) {
    console.log("[AUTH-PLATFORM] Capacitor check failed:", e);
    return false;
  }
}

// Initialize token from persistent storage (call this on app start)
// Only needed for native apps - web uses HttpOnly cookies
export async function initializeSessionToken(): Promise<string | null> {
  const isNative = isNativePlatform();
  console.log("[AUTH-STORAGE] Initializing session token, isNative:", isNative);
  
  // On web, we don't need to load tokens from storage - HttpOnly cookies handle auth
  if (!isNative) {
    console.log("[AUTH-STORAGE] Web platform detected, using HttpOnly cookies");
    tokenInitialized = true;
    return null;
  }
  
  // On native, load token from Capacitor Preferences
  try {
    const { value } = await Preferences.get({ key: SESSION_TOKEN_KEY });
    if (value) {
      console.log("[AUTH-STORAGE] Found token in Capacitor Preferences");
      cachedToken = value;
      tokenInitialized = true;
      return value;
    }
  } catch (e) {
    console.log("[AUTH-STORAGE] Capacitor Preferences error:", e);
  }
  
  // Fallback to localStorage (for older native app versions)
  try {
    const value = localStorage.getItem(SESSION_TOKEN_KEY);
    if (value) {
      console.log("[AUTH-STORAGE] Found token in localStorage (legacy)");
      cachedToken = value;
      tokenInitialized = true;
      // Migrate to Capacitor Preferences
      try {
        await Preferences.set({ key: SESSION_TOKEN_KEY, value });
        localStorage.removeItem(SESSION_TOKEN_KEY); // Clean up
      } catch {}
      return value;
    }
  } catch {}
  
  console.log("[AUTH-STORAGE] No stored token found");
  tokenInitialized = true;
  return null;
}

// Get stored session token (synchronous, uses cached value)
// Returns token on native platforms for Bearer auth
export function getStoredSessionToken(): string | null {
  // On web, never return a Bearer token - let cookies handle auth
  if (!isNativePlatform()) {
    return null;
  }
  
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }
  
  // Fallback: try localStorage synchronously (in case Preferences failed)
  try {
    const value = localStorage.getItem(SESSION_TOKEN_KEY);
    if (value) {
      console.log("[AUTH-STORAGE] Retrieved token from localStorage fallback");
      cachedToken = value;
      return value;
    }
  } catch {}
  
  return null;
}

// Store session token for native app persistence
// Saves to both Capacitor Preferences AND localStorage for maximum reliability
export async function setStoredSessionToken(token: string | null): Promise<void> {
  const isNative = isNativePlatform();
  console.log("[AUTH-STORAGE] Setting session token, isNative:", isNative, "token:", token ? "present" : "null");
  
  // Update in-memory cache ALWAYS
  cachedToken = token;
  tokenInitialized = true;
  
  // ALWAYS save to localStorage as backup (works on both web and native)
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      console.log("[AUTH-STORAGE] Token saved to localStorage");
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      console.log("[AUTH-STORAGE] Token removed from localStorage");
    }
  } catch (e) {
    console.log("[AUTH-STORAGE] localStorage error:", e);
  }
  
  // On native, ALSO save to Capacitor Preferences (more reliable for app restarts)
  if (isNative) {
    try {
      if (token) {
        await Preferences.set({ key: SESSION_TOKEN_KEY, value: token });
        console.log("[AUTH-STORAGE] Token saved to Capacitor Preferences");
      } else {
        await Preferences.remove({ key: SESSION_TOKEN_KEY });
        console.log("[AUTH-STORAGE] Token removed from Capacitor Preferences");
      }
    } catch (e) {
      console.log("[AUTH-STORAGE] Capacitor Preferences error:", e);
    }
  }
}

// Build headers with optional Bearer token for native app contexts
function getAuthHeaders(includeContentType: boolean = false): HeadersInit {
  const headers: HeadersInit = {};
  
  // Add Bearer token if available (only on native - web uses cookies)
  const token = getStoredSessionToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[AUTH-CLIENT] Native: Including Bearer token in request");
  }
  // On web, no log needed - cookies handle auth silently
  
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  
  return headers;
}

// Custom error class to preserve error code from backend
export class ApiError extends Error {
  code?: string;
  
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    
    // Try to parse JSON error response for structured error info
    if (contentType?.includes("application/json")) {
      try {
        const errorData = await res.json();
        const message = errorData.message || errorData.error || res.statusText;
        throw new ApiError(`${res.status}: ${message}`, errorData.code);
      } catch (e) {
        if (e instanceof ApiError) throw e;
        // If JSON parsing fails, fall through to text handling
      }
    }
    
    const text = (await res.text()) || res.statusText;
    throw new ApiError(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(false),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
