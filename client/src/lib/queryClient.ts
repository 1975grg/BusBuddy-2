import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// Session token storage key for native app persistence
const SESSION_TOKEN_KEY = "busbuddy_session_token";

// Production API URL for native apps with embedded JavaScript
const PRODUCTION_API_URL = "https://bus-buddy-v-3-user-interface-1975grg.replit.app";

// Get the base URL for API calls
// On native platforms with embedded JS, we need to call the production server
// On web, relative URLs work fine
export function getApiBaseUrl(): string {
  try {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    console.log("[API-BASE] Platform check:", { platform, isNative });
    
    if (isNative) {
      console.log("[API-BASE] Using production URL:", PRODUCTION_API_URL);
      return PRODUCTION_API_URL;
    }
    console.log("[API-BASE] Using relative URLs (web)");
    return "";
  } catch (e) {
    console.error("[API-BASE] Error checking platform:", e);
    return "";
  }
}

// Build full API URL
export function buildApiUrl(path: string): string {
  console.log("[API-URL] Building URL for path:", path);
  const baseUrl = getApiBaseUrl();
  console.log("[API-URL] Base URL:", baseUrl || "(empty - relative)");
  
  // If path already starts with http, return as-is
  if (path.startsWith("http")) {
    console.log("[API-URL] Path is already absolute, returning as-is");
    return path;
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${baseUrl}${normalizedPath}`;
  console.log("[API-URL] Final URL:", fullUrl);
  return fullUrl;
}

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
  try {
    const fullUrl = buildApiUrl(url);
    console.log("[API-REQUEST] Starting request:", { method, url, fullUrl });
    console.log("[API-REQUEST] Request body:", data ? JSON.stringify(data).substring(0, 100) : "(none)");
    
    const headers = getAuthHeaders(!!data);
    console.log("[API-REQUEST] Headers:", JSON.stringify(headers));
    
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log("[API-REQUEST] Response status:", res.status);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error("[API-REQUEST] Error caught:", error);
    console.error("[API-REQUEST] Error name:", (error as Error)?.name);
    console.error("[API-REQUEST] Error message:", (error as Error)?.message);
    console.error("[API-REQUEST] Error stack:", (error as Error)?.stack);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const fullUrl = buildApiUrl(path);
    console.log("[API] Query:", fullUrl);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: getAuthHeaders(false),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Helper function for GET requests that works on both web and native
// Use this instead of direct fetch() in queryFn implementations
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = buildApiUrl(url);
  const headers = {
    ...getAuthHeaders(false),
    ...options.headers,
  };
  
  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include",
  });
}

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
