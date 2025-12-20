import { Capacitor } from '@capacitor/core';
import { getStoredSessionToken } from './queryClient';
import type { FirebaseMessaging as FirebaseMessagingType } from '@capacitor-firebase/messaging';

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
}

class PushNotificationService {
  private isInitialized = false;
  private firebaseMessaging: typeof FirebaseMessagingType | null = null;

  private async getFirebaseMessaging(): Promise<typeof FirebaseMessagingType | null> {
    if (this.firebaseMessaging) return this.firebaseMessaging;
    
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      const module = await import('@capacitor-firebase/messaging');
      this.firebaseMessaging = module.FirebaseMessaging;
      return this.firebaseMessaging;
    } catch (error) {
      console.error('[PUSH] Failed to load Firebase Messaging module:', error);
      return null;
    }
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;
    
    if (!Capacitor.isNativePlatform()) {
      console.log('[PUSH] Push notifications only available on native platforms');
      return;
    }

    try {
      const FirebaseMessaging = await this.getFirebaseMessaging();
      if (!FirebaseMessaging) {
        console.error('[PUSH] Firebase Messaging not available');
        return;
      }

      console.log('[PUSH] Initializing Firebase Messaging plugin...');
      
      const permissionResult = await FirebaseMessaging.requestPermissions();
      console.log('[PUSH] Permission result:', permissionResult.receive);
      
      if (permissionResult.receive === 'granted') {
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
        console.log('[PUSH] Push notification permission denied');
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
    
    const FirebaseMessaging = await this.getFirebaseMessaging();
    if (FirebaseMessaging) {
      await FirebaseMessaging.removeAllListeners();
    }
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
