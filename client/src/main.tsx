// Global error handlers - MUST run before ANY other code to catch early crashes
(function() {
  const originalAddEventListener = window.addEventListener.bind(window);
  let errorHandlerInstalled = false;
  
  // Global error handler to prevent app crashes from unhandled errors
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('[GLOBAL-ERROR] Caught error:', { message, source, lineno, colno, error: error?.message });
    // Return true to prevent the error from propagating and crashing the app
    return true;
  };
  
  const installErrorHandler = () => {
    if (errorHandlerInstalled) return;
    errorHandlerInstalled = true;
    
    // Handle unhandled promise rejections
    originalAddEventListener('unhandledrejection', ((event: PromiseRejectionEvent) => {
      const message = event.reason?.message || '';
      const name = event.reason?.name || '';
      console.error('[GLOBAL-PROMISE] Unhandled rejection:', { message, name, reason: event.reason });
      
      // Suppress harmless errors
      if (message.includes('signal is aborted') || 
          message.includes('user aborted') ||
          name === 'AbortError') {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
      
      // Prevent all unhandled rejections from crashing the app on iOS
      event.preventDefault();
    }) as EventListener, true);
    
    // Catch all uncaught errors
    originalAddEventListener('error', ((event: ErrorEvent) => {
      console.error('[GLOBAL-ERROR] Caught error event:', { 
        message: event.message, 
        filename: event.filename, 
        lineno: event.lineno 
      });
      // Prevent the error from crashing the app
      event.preventDefault();
    }) as EventListener, true);
  };
  
  // Install immediately
  installErrorHandler();
  
  // Also intercept addEventListener to install before Replit's overlay
  window.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    installErrorHandler();
    return originalAddEventListener(type, listener, options);
  };
})();

console.log('[MAIN-EARLY] Starting main.tsx imports...');

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeSessionToken } from "./lib/queryClient";

console.log('[MAIN] Before push notification import...');

// Force import push notification service to prevent tree-shaking
// This MUST be at the top level so the module gets bundled
import { pushNotificationService } from "./lib/pushNotifications";

// Execute immediately to force the module to be retained in the bundle
console.log('[MAIN] Push notification service imported:', typeof pushNotificationService);
console.log('[MAIN] Push service initialize method exists:', typeof pushNotificationService?.initialize);

// Initialize session token from persistent storage before rendering
// This ensures the token is loaded from Capacitor Preferences on native apps
initializeSessionToken().then(() => {
  console.log("[APP] Session token initialized, rendering app...");
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((e) => {
  console.log("[APP] Session token initialization failed, rendering anyway:", e);
  createRoot(document.getElementById("root")!).render(<App />);
});
