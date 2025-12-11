import twilio from 'twilio';

// Replit Twilio Integration - fetch credentials from Replit Connector
async function getTwilioCredentials(): Promise<{
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
} | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!hostname || !xReplitToken) {
      console.log('Replit Connector environment not available, trying legacy credentials...');
      return null;
    }

    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    console.log('Twilio connector settings keys:', connectionSettings?.settings ? Object.keys(connectionSettings.settings) : 'none');
    
    if (!connectionSettings || !connectionSettings.settings) {
      console.log('Twilio connector not configured');
      return null;
    }

    const settings = connectionSettings.settings;
    
    // Log what we received (mask sensitive data)
    console.log('Twilio settings received:', {
      hasAccountSid: !!settings.account_sid,
      accountSidPrefix: settings.account_sid?.substring(0, 4),
      hasApiKey: !!settings.api_key,
      apiKeyPrefix: settings.api_key?.substring(0, 4),
      hasApiKeySecret: !!settings.api_key_secret,
      hasPhoneNumber: !!settings.phone_number
    });

    if (!settings.account_sid || !settings.api_key || !settings.api_key_secret) {
      console.log('Twilio connector missing required credentials');
      return null;
    }

    // The Replit connector field mapping can be inconsistent:
    // - account_sid may contain API Key SID (starts with SK) instead of Account SID (AC)
    // - api_key may contain something else
    // We need to figure out the correct mapping
    
    let accountSid: string | null = null;
    let apiKeySid: string | null = null;
    
    // Find the Account SID (must start with AC)
    if (settings.account_sid?.startsWith('AC')) {
      accountSid = settings.account_sid;
    } else if (settings.api_key?.startsWith('AC')) {
      accountSid = settings.api_key;
    } else {
      // Fallback to environment variable if connector doesn't have proper Account SID
      accountSid = process.env.TWILIO_ACCOUNT_SID || null;
      console.log('Using TWILIO_ACCOUNT_SID from environment as fallback');
    }
    
    // Find the API Key SID (must start with SK)
    if (settings.account_sid?.startsWith('SK')) {
      apiKeySid = settings.account_sid;
    } else if (settings.api_key?.startsWith('SK')) {
      apiKeySid = settings.api_key;
    }
    
    console.log('Final credential mapping:', {
      accountSidPrefix: accountSid?.substring(0, 4),
      apiKeySidPrefix: apiKeySid?.substring(0, 4),
      hasApiKeySecret: !!settings.api_key_secret,
      hasPhoneNumber: !!settings.phone_number
    });
    
    if (!accountSid || !apiKeySid || !settings.api_key_secret) {
      console.log('Missing required credentials after mapping');
      return null;
    }

    return {
      accountSid: accountSid,
      apiKey: apiKeySid,
      apiKeySecret: settings.api_key_secret,
      phoneNumber: settings.phone_number
    };
  } catch (error) {
    console.error('Error fetching Twilio credentials from Replit Connector:', error);
    return null;
  }
}

// SMS service for sending notifications to riders
export class SmsService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Primary method: Use environment variables (Account SID + Auth Token)
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        console.log('Initializing Twilio with Account SID + Auth Token...');
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
        console.log('✅ Twilio SMS service initialized successfully');
        console.log(`   From number: ${this.fromNumber}`);
        this.initialized = true;
        return;
      }

      // Fallback: Try Replit Twilio Connector
      const connectorCreds = await getTwilioCredentials();
      
      if (connectorCreds) {
        console.log('Initializing Twilio with Replit Connector...');
        this.client = twilio(connectorCreds.apiKey, connectorCreds.apiKeySecret, {
          accountSid: connectorCreds.accountSid
        });
        this.fromNumber = connectorCreds.phoneNumber;
        console.log('✅ Twilio SMS service initialized via Replit Connector');
        this.initialized = true;
        return;
      }

      console.warn('⚠️ Twilio credentials not found. SMS notifications will be disabled.');
      console.warn('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in secrets.');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Twilio client:', error instanceof Error ? error.message : error);
      this.client = null;
      this.fromNumber = null;
      this.initialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async isConfigured(): Promise<boolean> {
    await this.ensureInitialized();
    return this.client !== null && this.fromNumber !== null;
  }

  async sendSms(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    await this.ensureInitialized();
    
    if (!this.client || !this.fromNumber) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const phoneStr = String(to);
      const formattedTo = phoneStr.startsWith('+') ? phoneStr : `+1${phoneStr.replace(/\D/g, '')}`;
      
      console.log(`SMS Debug: Original: ${to}, Formatted: ${formattedTo}, From: ${this.fromNumber}`);
      
      const twilioMessage = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedTo,
      });

      console.log(`SMS sent successfully to ${formattedTo}: ${twilioMessage.sid}`);
      return { success: true, messageId: twilioMessage.sid };
    } catch (error) {
      console.error('SMS send error:', error);
      const phoneStr = String(to);
      console.error(`Failed to send SMS to: ${phoneStr}`);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown SMS error' 
      };
    }
  }

  async sendRouteStartedNotification(to: string, routeName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: The ${routeName} route has started! Track your bus in real-time.`;
    return this.sendSms(to, message);
  }

  async sendApproachingStopNotification(to: string, routeName: string, stopName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: Your ${routeName} bus is approaching ${stopName} in about 2-3 minutes!`;
    return this.sendSms(to, message);
  }

  async sendArrivedAtStopNotification(to: string, routeName: string, stopName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy: Your ${routeName} bus has arrived at ${stopName}!`;
    return this.sendSms(to, message);
  }

  async sendWelcomeMessage(to: string, routeName: string, organizationName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Welcome to ${organizationName}! You're now subscribed to notifications for the ${routeName} route. You'll receive SMS updates when your bus is approaching your selected stops. Reply STOP to opt out anytime.`;
    return this.sendSms(to, message);
  }

  async sendRiderRemovedMessage(to: string, routeName: string, organizationName: string, riderName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const firstName = riderName ? riderName.trim().split(' ')[0] : '';
    const greeting = firstName ? `Hey ${firstName}, ` : '';
    
    const message = `${greeting}just to let you know - you're no longer receiving notifications for the ${routeName} route. Thanks for using ${organizationName}! If this was a mistake, please contact support.`;
    return this.sendSms(to, message);
  }

  async sendServiceAlertNotification(to: string, routeName: string, alertTitle: string, alertMessage: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `🚌 Bus Buddy Alert: ${routeName} - ${alertTitle}: ${alertMessage}`;
    return this.sendSms(to, message);
  }
}

export const smsService = new SmsService();
