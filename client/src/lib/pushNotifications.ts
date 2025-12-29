import { Capacitor } from '@capacitor/core';
import { getStoredSessionToken, buildApiUrl } from './queryClient';

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
}

// Lazy-loaded Firebase Messaging plugin to prevent crashes on devices where it's not properly configured
let FirebaseMessaging: any = null;
let firebaseLoadError: Error | null = null;

async function getFirebaseMessaging(): Promise<any> {
  if (firebaseLoadError) {
    throw firebaseLoadError;
  }
  
  if (FirebaseMessaging) {
    return FirebaseMessaging;
  }
  
  try {
    // Only attempt to load on native platforms
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Firebase Messaging is only available on native platforms');
    }
    
    // Dynamically import and register the plugin
    const { registerPlugin } = await import('@capacitor/core');
    const { FirebaseMessagingPlugin } = await import('@capacitor-firebase/messaging') as any;
    
    FirebaseMessaging = registerPlugin<typeof FirebaseMessagingPlugin>('FirebaseMessaging');
    console.log('[PUSH] Firebase Messaging plugin loaded successfully');
    return FirebaseMessaging;
  } catch (error) {
    console.error('[PUSH] Failed to load Firebase Messaging plugin:', error);
    firebaseLoadError = error as Error;
    throw error;
  }
}

class PushNotificationService {
  private isInitialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (!Capacitor.isNativePlatform()) {
      console.log('[PUSH] Not a native platform, skipping push notification setup');
      return;
    }

    try {
      console.log('[PUSH] Starting push notification initialization...');
      
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.warn('[PUSH] Firebase Messaging not available');
        return;
      }
      
      const permissionResult = await messaging.requestPermissions();
      console.log('[PUSH] Permission result:', permissionResult);
      
      if (permissionResult.receive === 'granted') {
        const tokenResult = await messaging.getToken();
        console.log('[PUSH] Got FCM token');
        
        await this.registerDeviceToken(tokenResult.token, userId);

        await messaging.addListener('tokenReceived', async (event: any) => {
          console.log('[PUSH] Token refreshed');
          await this.registerDeviceToken(event.token, userId);
        });

        await messaging.addListener('notificationReceived', (event: any) => {
          console.log('[PUSH] Notification received:', event.notification?.title);
        });

        await messaging.addListener('notificationActionPerformed', (event: any) => {
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
      // Don't throw - let the app continue without push notifications
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
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        await messaging.removeAllListeners();
      }
    } catch (error) {
      console.error('[PUSH] Error removing listeners:', error);
    }
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
