import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectDevice, shouldShowAppBanner, dismissAppBanner } from "@/lib/deviceDetection";

export function SmartAppBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [device, setDevice] = useState<ReturnType<typeof detectDevice> | null>(null);

  useEffect(() => {
    const deviceInfo = detectDevice();
    setDevice(deviceInfo);
    setIsVisible(shouldShowAppBanner());
  }, []);

  const handleDismiss = () => {
    dismissAppBanner();
    setIsVisible(false);
  };

  const handleDownload = () => {
    const iosUrl = import.meta.env.VITE_IOS_APP_STORE_URL || 'https://apps.apple.com/app/bus-buddy/id123456789';
    const androidUrl = import.meta.env.VITE_ANDROID_APP_STORE_URL || 'https://play.google.com/store/apps/details?id=com.bytevia.busbuddy';
    
    if (device?.platform === 'ios') {
      window.location.href = iosUrl;
    } else if (device?.platform === 'android') {
      window.location.href = androidUrl;
    }
  };

  if (!isVisible || !device?.isMobile) {
    return null;
  }

  return (
    <>
      {/* Spacer to prevent content from being hidden under fixed banner */}
      <div className="h-[72px]" aria-hidden="true" />
      
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg border-b border-primary-foreground/20"
        data-testid="smart-app-banner"
      >
        <div className="flex items-center gap-3 p-3 max-w-screen-lg mx-auto">
          {/* App Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              className="w-8 h-8 text-primary"
              fill="currentColor"
            >
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.87-.93-7-5.21-7-9V8.3l7-3.11 7 3.11V11c0 3.79-3.13 8.07-7 9z"/>
              <path d="M12 6L6 9v4c0 3.13 2.16 6.05 5 6.83 2.84-.78 5-3.7 5-6.83V9l-6-3z"/>
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Bus Buddy</div>
            <div className="text-xs opacity-90">Track your bus in real-time</div>
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownload}
            size="sm"
            variant="secondary"
            className="flex-shrink-0 font-semibold"
            data-testid="button-download-app"
          >
            <Download className="w-3 h-3 mr-1" />
            {device?.platform === 'ios' ? 'TestFlight' : 'Play Store'}
          </Button>

          {/* Close Button */}
          <Button
            onClick={handleDismiss}
            size="icon"
            variant="ghost"
            className="flex-shrink-0 h-8 w-8 hover:bg-primary-foreground/10"
            data-testid="button-dismiss-banner"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
