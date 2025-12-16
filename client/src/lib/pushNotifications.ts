import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
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
      console.log('Push notifications only available on native platforms');
      return;
    }

    try {
      // Request permission
      const permissionResult = await PushNotifications.requestPermissions();
      
      if (permissionResult.receive === 'granted') {
        // Register with OS for push notifications
        await PushNotifications.register();
        
        // Listen for registration success
        await PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token:', token.value);
          
          // Send token to backend
          await this.registerDeviceToken(token.value, userId);
        });

        // Listen for registration errors
        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error:', error);
        });

        // Listen for push notifications
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
          // Notification is automatically shown by OS
        });

        // Listen for notification taps
        await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
          console.log('Push notification action performed:', action);
          
          // Handle notification tap - could navigate to specific page
          const data = action.notification.data;
          if (data?.route) {
            window.location.href = data.route;
          }
        });

        this.isInitialized = true;
      } else {
        console.log('Push notification permission denied');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
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

      console.log('[PUSH] Device token registered successfully');
    } catch (error) {
      console.error('[PUSH] Error registering device token:', error);
    }
  }

  async removeAllListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    await PushNotifications.removeAllListeners();
    this.isInitialized = false;
  }
}

export const pushNotificationService = new PushNotificationService();
