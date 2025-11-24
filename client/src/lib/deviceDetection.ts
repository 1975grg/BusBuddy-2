export interface DeviceInfo {
  platform: 'ios' | 'android' | 'desktop';
  isMobile: boolean;
  userAgent: string;
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  
  // Android detection
  const isAndroid = /android/i.test(userAgent);
  
  // Mobile detection (broader check)
  const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  let platform: 'ios' | 'android' | 'desktop' = 'desktop';
  if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = 'android';
  }

  return {
    platform,
    isMobile,
    userAgent,
  };
}

export function shouldShowAppBanner(): boolean {
  const device = detectDevice();
  
  // Only show on mobile devices
  if (!device.isMobile) {
    return false;
  }

  // Check if user has dismissed the banner
  const dismissed = localStorage.getItem('app-banner-dismissed');
  if (dismissed === 'true') {
    return false;
  }

  return true;
}

export function dismissAppBanner(): void {
  localStorage.setItem('app-banner-dismissed', 'true');
}
