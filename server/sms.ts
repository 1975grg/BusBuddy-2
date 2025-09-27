import twilio from 'twilio';

// SMS service for sending notifications to riders
export class SmsService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;

  constructor() {
    // Initialize Twilio client if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    }
  }

  /**
   * Check if SMS service is properly configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.fromNumber !== null;
  }

  /**
   * Send an SMS message
   */
  async sendSms(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      // Ensure phone number is in E.164 format (add +1 if missing)
      const formattedTo = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`;
      
      const twilioMessage = await this.client!.messages.create({
        body: message,
        from: this.fromNumber!,
        to: formattedTo,
      });

      return { success: true, messageId: twilioMessage.sid };
    } catch (error) {
      console.error('SMS send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown SMS error' 
      };
    }
  }

  /**
   * Send route started notification
   */
  async sendRouteStartedNotification(to: string, routeName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: The ${routeName} route has started! Track your bus in real-time.`;
    return this.sendSms(to, message);
  }

  /**
   * Send approaching stop notification
   */
  async sendApproachingStopNotification(to: string, routeName: string, stopName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: Your ${routeName} bus is approaching ${stopName} in about 2-3 minutes!`;
    return this.sendSms(to, message);
  }

  /**
   * Send arrived at stop notification
   */
  async sendArrivedAtStopNotification(to: string, routeName: string, stopName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: Your ${routeName} bus has arrived at ${stopName}!`;
    return this.sendSms(to, message);
  }

  /**
   * Send route completed notification
   */
  async sendRouteCompletedNotification(to: string, routeName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: The ${routeName} route has been completed. Thank you for riding with us!`;
    return this.sendSms(to, message);
  }

  /**
   * Send service alert notification
   */
  async sendServiceAlertNotification(to: string, routeName: string, alertTitle: string, alertMessage: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy Alert: ${routeName} - ${alertTitle}: ${alertMessage}`;
    return this.sendSms(to, message);
  }
}

// Export singleton instance
export const smsService = new SmsService();