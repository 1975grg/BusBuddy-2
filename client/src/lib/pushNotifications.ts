import { Capacitor, registerPlugin } from '@capacitor/core';
import { getStoredSessionToken, buildApiUrl } from './queryClient';
import type { FirebaseMessagingPlugin } from '@capacitor-firebase/messaging';

console.log('[PUSH-MODULE] PushNotificationService module loaded, platform:', Capacitor.getPlatform());

const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>('FirebaseMessaging');
console.log('[PUSH-MODULE] FirebaseMessaging plugin registered:', !!FirebaseMessaging);

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
}

class PushNotificationService {
  private isInitialized = false;

  async initialize(userId: string): Promise<void> {
    console.log('[PUSH] ========== INITIALIZE CALLED ==========');
    console.log('[PUSH] userId:', userId);
    console.log('[PUSH] isInitialized:', this.isInitialized);
    console.log('[PUSH] isNativePlatform:', Capacitor.isNativePlatform());
    console.log('[PUSH] FirebaseMessaging available:', !!FirebaseMessaging);
    
    if (this.isInitialized) {
      console.log('[PUSH] Already initialized, skipping');
      return;
    }
    
    if (!Capacitor.isNativePlatform()) {
      console.log('[PUSH] Push notifications only available on native platforms');
      return;
    }

    try {
      console.log('[PUSH] Starting Firebase Messaging initialization...');
      console.log('[PUSH] About to call requestPermissions()...');
      
      const permissionResult = await FirebaseMessaging.requestPermissions();
      console.log('[PUSH] requestPermissions() returned');
      console.log('[PUSH] Permission result:', JSON.stringify(permissionResult));
      console.log('[PUSH] Permission receive value:', permissionResult.receive);
      
      if (permissionResult.receive === 'granted') {
        console.log('[PUSH] Permission granted, getting FCM token...');
        const tokenResult = await FirebaseMessaging.getToken();
        console.log('[PUSH] FCM token received:', tokenResult.token.substring(0, 20) + '...');
        
        await this.registerDeviceToken(tokenResult.token, userId);

        await FirebaseMessaging.addListener('tokenReceived', async (event) => {
          console.log('[PUSH] Token refreshed:', event.token.substring(0, 20) + '...');
          await this.registerDeviceToken(event.token, userId);
        });

        await FirebaseMessaging.addListener('notificationReceived', (event) => {
          console.log('[PUSH] Notification received in foreground:', event.notification);
        });

        await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
          console.log('[PUSH] Notification action performed:', event);
          
          const data = event.notification?.data as Record<string, unknown> | undefined;
          if (data?.route) {
            window.location.href = data.route as string;
          }
        });

        this.isInitialized = true;
        console.log('[PUSH] Firebase messaging initialized successfully');
      } else {
        console.log('[PUSH] Push notification permission denied or not granted:', permissionResult.receive);
      }
    } catch (error) {
      console.error('[PUSH] Error initializing push notifications:', error);
      console.error('[PUSH] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  }

  private async registerDeviceToken(token: string, userId: string): Promise<void> {
    try {
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      const sessionToken = getStoredSessionToken();
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
        console.log('[PUSH] Including auth token in push registration request');
      } else {
        console.warn('[PUSH] No session token available for push registration');
      }
      
      const url = buildApiUrl('/api/push-tokens');
      console.log('[PUSH] Registering token at:', url);
      
      const response = await fetch(url, {
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
