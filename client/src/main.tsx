// Suppress harmless MapLibre tile abort errors - must run before ANY other code
(function() {
  const originalAddEventListener = window.addEventListener.bind(window);
  let errorHandlerInstalled = false;
  
  const installErrorHandler = () => {
    if (errorHandlerInstalled) return;
    errorHandlerInstalled = true;
    
    originalAddEventListener('unhandledrejection', ((event: PromiseRejectionEvent) => {
      const message = event.reason?.message || '';
      const name = event.reason?.name || '';
      if (message.includes('signal is aborted') || 
          message.includes('user aborted') ||
          name === 'AbortError') {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
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

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
