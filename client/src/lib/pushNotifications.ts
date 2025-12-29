import { Capacitor, registerPlugin } from '@capacitor/core';
import { getStoredSessionToken, buildApiUrl } from './queryClient';
import type { FirebaseMessagingPlugin } from '@capacitor-firebase/messaging';

const FirebaseMessaging = registerPlugin<FirebaseMessagingPlugin>('FirebaseMessaging');

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
}

class PushNotificationService {
  private isInitialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const permissionResult = await FirebaseMessaging.requestPermissions();
      
      if (permissionResult.receive === 'granted') {
        const tokenResult = await FirebaseMessaging.getToken();
        
        await this.registerDeviceToken(tokenResult.token, userId);

        await FirebaseMessaging.addListener('tokenReceived', async (event) => {
          await this.registerDeviceToken(event.token, userId);
        });

        await FirebaseMessaging.addListener('notificationReceived', (event) => {
          console.log('[PUSH] Notification received:', event.notification?.title);
        });

        await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
          const data = event.notification?.data as Record<string, unknown> | undefined;
          if (data?.route) {
            window.location.href = data.route as string;
          }
        });

        this.isInitialized = true;
        console.log('[PUSH] Push notifications initialized successfully');
      } else {
        console.warn('[PUSH] Push notification permission not granted');
      }
    } catch (error) {
      console.error('[PUSH] Error initializing push notifications:', error);
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
      } else {
        console.warn('[PUSH] No session token available for push registration');
      }
      
      const url = buildApiUrl('/api/push-tokens');
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          token,
          platform,
          userId,
        }),
      });
      
      console.log('[PUSH] Registration response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PUSH] Registration failed:', response.status, errorText);
        throw new Error(`Failed to register device token: ${response.status}`);
      }
    } catch (error) {
      console.error('[PUSH] Error registering device token:', error);
    }
  }

  async removeAllListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await FirebaseMessaging.removeAllListeners();
    } catch (error) {
      console.error('[PUSH] Error removing listeners:', error);
    }
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
