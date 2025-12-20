import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
