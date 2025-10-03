// Suppress harmless MapLibre tile abort errors that occur during normal map operation
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (event.reason?.message?.includes('signal is aborted') || 
      event.reason?.message?.includes('user aborted') ||
      event.reason?.name === 'AbortError') {
    event.stopImmediatePropagation();
    event.preventDefault();
    return false;
  }
}, true);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
