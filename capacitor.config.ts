import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  server: {
    // Allow clear text traffic for development
    cleartext: true
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
