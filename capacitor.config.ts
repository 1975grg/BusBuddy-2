import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  ios: {
    contentInset: 'automatic'
  },
  server: {
    // Load from local bundled files (more reliable across all devices)
    cleartext: true
  }
};

export default config;
