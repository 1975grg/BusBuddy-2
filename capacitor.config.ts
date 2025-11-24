import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bytevia.busbuddy',
  appName: 'Bus Buddy',
  webDir: 'dist/public',
  server: {
    url: 'https://4ef88b9c-6b54-4234-a553-db4658eb6432-00-1vp5rkai6vvwy.spock.replit.dev',
    // Allow clear text traffic for development
    cleartext: true
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
