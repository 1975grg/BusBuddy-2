/**
 * Firebase Cloud Messaging (FCM) service for sending push notifications
 * Works for both iOS and Android devices
 */

import admin from 'firebase-admin';
import { db } from './db';
import { pushTokens } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

let isInitialized = false;

/**
 * Notification Rate Limiting System
 * Prevents duplicate/spam notifications while ensuring important ones get through
 */

// In-memory cache for tracking recent notifications
// Key format: "userId:notificationType:uniqueKey"
const recentNotifications = new Map<string, number>();

// Cooldown periods in milliseconds
const COOLDOWN_PERIODS = {
  proximity_alert: 60 * 1000,      // 60 seconds for same stop alert
  admin_direct_message: 30 * 1000, // 30 seconds for same message thread
  admin_response: 30 * 1000,       // 30 seconds for admin responses
  service_alert: 5 * 60 * 1000,    // 5 minutes for same service alert type
  default: 10 * 1000,              // 10 seconds default
};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  recentNotifications.forEach((timestamp, key) => {
    // Remove entries older than 10 minutes
    if (now - timestamp > 10 * 60 * 1000) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => recentNotifications.delete(key));
}, 5 * 60 * 1000);

/**
 * Check if a notification should be rate-limited
 * Returns true if the notification should be sent, false if it should be skipped
 */
export function shouldSendNotification(
  userId: string,
  notificationType: string,
  uniqueKey: string
): boolean {
  const cacheKey = `${userId}:${notificationType}:${uniqueKey}`;
  const lastSent = recentNotifications.get(cacheKey);
  const now = Date.now();
  
  // Get cooldown period for this notification type
  const cooldownMs = COOLDOWN_PERIODS[notificationType as keyof typeof COOLDOWN_PERIODS] 
    || COOLDOWN_PERIODS.default;
  
  if (lastSent && (now - lastSent) < cooldownMs) {
    console.log(`[Rate Limit] Skipping duplicate notification for ${userId} (${notificationType}:${uniqueKey}) - last sent ${Math.round((now - lastSent) / 1000)}s ago`);
    return false;
  }
  
  // Record this notification
  recentNotifications.set(cacheKey, now);
  return true;
}

/**
 * Clear rate limit for a specific notification (useful for testing or manual override)
 */
export function clearNotificationRateLimit(
  userId: string,
  notificationType: string,
  uniqueKey: string
): void {
  const cacheKey = `${userId}:${notificationType}:${uniqueKey}`;
  recentNotifications.delete(cacheKey);
}

/**
 * Initialize Firebase Admin SDK
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY environment variable with the JSON key
 */
export function initializeFirebase(): boolean {
  if (isInitialized) return true;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    console.warn('Firebase Admin SDK not initialized: FIREBASE_SERVICE_ACCOUNT_KEY not set');
    console.warn('Push notifications will not work until Firebase is configured');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    
    // Validate that required fields exist
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      console.error('Firebase service account key is missing required fields (project_id, client_email, or private_key)');
      return false;
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    
    isInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return false;
  }
}

/**
 * Check if Firebase is ready to send notifications
 */
export function isFirebaseReady(): boolean {
  return isInitialized;
}

/**
 * Send push notification to a specific device token
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isInitialized) {
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'bus_buddy_alerts',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`Push notification sent successfully: ${response}`);
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    
    // Handle invalid/expired tokens by deactivating them
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      await deactivateInvalidToken(token);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to all devices of a specific user
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ sent: number; failed: number }> {
  if (!isInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return { sent: 0, failed: 0 };
  }

  try {
    // Get all active push tokens for this user
    const tokens = await db.select()
      .from(pushTokens)
      .where(and(
        eq(pushTokens.userId, userId),
        eq(pushTokens.isActive, true)
      ));

    if (tokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Send to all devices
    for (const tokenRecord of tokens) {
      const result = await sendPushNotification(tokenRecord.token, title, body, data);
      if (result.success) {
        sent++;
        // Update lastUsedAt
        await db.update(pushTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushTokens.id, tokenRecord.id));
      } else {
        failed++;
      }
    }

    return { sent, failed };
  } catch (error) {
    console.error('Error sending push to user:', error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Send push notification to multiple users at once
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, title, body, data);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}

/**
 * Deactivate an invalid or expired token
 */
async function deactivateInvalidToken(token: string): Promise<void> {
  try {
    await db.update(pushTokens)
      .set({ isActive: false })
      .where(eq(pushTokens.token, token));
    console.log(`Deactivated invalid push token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error('Error deactivating token:', error);
  }
}

/**
 * Send proximity alert push notification with rate limiting
 * @param routeId - Required to distinguish notifications for same stop on different routes
 * @param sessionId - Required to distinguish notifications within same route across different trip sessions
 */
export async function sendProximityAlertPush(
  userId: string,
  alertType: 'approaching' | 'arrived',
  stopName: string,
  routeName: string,
  routeId?: string,
  sessionId?: string
): Promise<{ sent: number; failed: number; rateLimited?: boolean }> {
  // Rate limit by user + route + session + stop name + alert type to prevent spam
  // This ensures different routes with same stop names still get notifications
  const uniqueKey = `${routeId || 'no-route'}:${sessionId || 'no-session'}:${stopName}:${alertType}`;
  if (!shouldSendNotification(userId, 'proximity_alert', uniqueKey)) {
    return { sent: 0, failed: 0, rateLimited: true };
  }
  
  const title = alertType === 'approaching' 
    ? '🚌 Bus Approaching!' 
    : '🚌 Bus Arrived!';
  
  const body = alertType === 'approaching'
    ? `Your bus on ${routeName} is approaching ${stopName}`
    : `Your bus on ${routeName} has arrived at ${stopName}`;

  return sendPushToUser(userId, title, body, {
    type: 'proximity_alert',
    alertType,
    stopName,
    routeName,
  });
}

/**
 * Send service alert push notification to all users on a route with rate limiting
 * @param alertId - Optional alert ID to distinguish different alert instances (e.g., updated details)
 */
export async function sendServiceAlertPush(
  userIds: string[],
  alertType: string,
  title: string,
  message: string,
  routeName: string,
  alertId?: string | number
): Promise<{ totalSent: number; totalFailed: number; rateLimited: number }> {
  const emoji = alertType === 'cancelled' ? '❌' : alertType === 'delayed' ? '⏰' : '📢';
  const pushTitle = `${emoji} ${title}`;
  
  let totalSent = 0;
  let totalFailed = 0;
  let rateLimited = 0;
  
  // Rate limit by user + route + alert type + alert ID
  // Include alert ID so updated messages with same type can still be sent
  const uniqueKey = alertId ? `${routeName}:${alertType}:${alertId}` : `${routeName}:${alertType}`;
  
  for (const userId of userIds) {
    if (!shouldSendNotification(userId, 'service_alert', uniqueKey)) {
      rateLimited++;
      continue;
    }
    
    const result = await sendPushToUser(userId, pushTitle, message, {
      type: 'service_alert',
      alertType,
      routeName,
    });
    totalSent += result.sent;
    totalFailed += result.failed;
  }
  
  if (rateLimited > 0) {
    console.log(`[Rate Limit] Service alert: ${rateLimited} users rate-limited`);
  }
  
  return { totalSent, totalFailed, rateLimited };
}

/**
 * Send admin message push notification to a driver with rate limiting
 */
export async function sendAdminMessagePush(
  userId: string,
  messageId: number | string,
  messageContent: string,
  isResponse: boolean = false
): Promise<{ sent: number; failed: number; rateLimited?: boolean }> {
  const notificationType = isResponse ? 'admin_response' : 'admin_direct_message';
  
  // Rate limit by user + message type (allows one notification per 30 seconds per thread)
  if (!shouldSendNotification(userId, notificationType, String(messageId))) {
    return { sent: 0, failed: 0, rateLimited: true };
  }
  
  const title = "New Message from Admin";
  const body = messageContent.length > 100 
    ? messageContent.substring(0, 100) + "..." 
    : messageContent;
  
  return sendPushToUser(userId, title, body, {
    type: notificationType,
    messageId: String(messageId),
  });
}
