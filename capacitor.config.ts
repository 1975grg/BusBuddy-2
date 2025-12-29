import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  ios: {
    contentInset: 'automatic'
  },
  server: {
    // Cache-busting: increment version after each publish to force fresh load
    url: 'https://bus-buddy-v-3-user-interface-1975grg.replit.app?v=20251228c',
    cleartext: true
  }
};

export default config;
