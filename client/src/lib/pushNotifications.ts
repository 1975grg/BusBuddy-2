import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { getStoredSessionToken } from './queryClient';

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
}

class PushNotificationService {
  private isInitialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;
    
    // Only run on native platforms (iOS/Android)
    if (!Capacitor.isNativePlatform()) {
      console.log('[PUSH] Push notifications only available on native platforms');
      return;
    }

    try {
      // Initialize Firebase Messaging plugin first (required on iOS to wire native delegates)
      console.log('[PUSH] Initializing Firebase Messaging plugin...');
      
      // Request permission
      const permissionResult = await FirebaseMessaging.requestPermissions();
      console.log('[PUSH] Permission result:', permissionResult.receive);
      
      if (permissionResult.receive === 'granted') {
        // Get the FCM token (this is the key difference - Firebase SDK gives us FCM token, not APNS token)
        const tokenResult = await FirebaseMessaging.getToken();
        console.log('[PUSH] FCM token received:', tokenResult.token.substring(0, 20) + '...');
        
        // Send token to backend
        await this.registerDeviceToken(tokenResult.token, userId);

        // Listen for token refresh
        await FirebaseMessaging.addListener('tokenReceived', async (event) => {
          console.log('[PUSH] Token refreshed:', event.token.substring(0, 20) + '...');
          await this.registerDeviceToken(event.token, userId);
        });

        // Listen for push notifications when app is in foreground
        await FirebaseMessaging.addListener('notificationReceived', (event) => {
          console.log('[PUSH] Notification received in foreground:', event.notification);
        });

        // Listen for notification taps
        await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
          console.log('[PUSH] Notification action performed:', event);
          
          // Handle notification tap - could navigate to specific page
          const data = event.notification?.data;
          if (data?.route) {
            window.location.href = data.route as string;
          }
        });

        this.isInitialized = true;
        console.log('[PUSH] Firebase messaging initialized successfully');
      } else {
        console.log('[PUSH] Push notification permission denied');
      }
    } catch (error) {
      console.error('[PUSH] Error initializing push notifications:', error);
    }
  }

  private async registerDeviceToken(token: string, userId: string): Promise<void> {
    try {
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      
      // Build headers with auth token for native platforms
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Include Bearer token for native app authentication
      const sessionToken = getStoredSessionToken();
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
        console.log('[PUSH] Including auth token in push registration request');
      } else {
        console.warn('[PUSH] No session token available for push registration');
      }
      
      const response = await fetch('/api/push-tokens', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token,
          platform,
          userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PUSH] Registration failed:', response.status, errorText);
        throw new Error(`Failed to register device token: ${response.status}`);
      }

      console.log('[PUSH] FCM device token registered successfully');
    } catch (error) {
      console.error('[PUSH] Error registering device token:', error);
    }
  }

  async removeAllListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    await FirebaseMessaging.removeAllListeners();
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
