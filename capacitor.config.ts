import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  server: {
    url: 'https://bus-buddy-v-3-user-interface-1975grg.replit.app',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
