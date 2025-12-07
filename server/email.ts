import sgMail from "@sendgrid/mail";

// Initialize SendGrid if API key is available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_SENDER = process.env.SENDGRID_SENDER || "noreply@busbuddy.app";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("✅ SendGrid email service initialized");
} else {
  console.warn("⚠️ SENDGRID_API_KEY not set - emails will be logged to console only");
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log("📧 Email (dev mode - not sent):");
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body: ${options.text}`);
    return true; // Return success in dev mode
  }

  try {
    await sgMail.send({
      to: options.to,
      from: SENDGRID_SENDER,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`✅ Email sent to ${options.to}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${options.to}:`, error.message);
    if (error.response) {
      console.error("SendGrid error details:", JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
): Promise<boolean> {
  const appBaseUrl = process.env.APP_BASE_URL || "https://bus-buddy-v-3-user-interface-1975grg.replit.app";
  const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;

  const subject = "Reset Your Bus Buddy Password";
  const text = `
Hi${userName ? ` ${userName}` : ""},

You requested to reset your Bus Buddy password. Click the link below to set a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

Thanks,
The Bus Buddy Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚌 Bus Buddy</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
    <p>Hi${userName ? ` ${userName}` : ""},</p>
    <p>You requested to reset your Bus Buddy password. Click the button below to set a new password:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">This link will expire in 1 hour.</p>
    <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      Bus Buddy - Real-time bus tracking for your institution
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to: email, subject, text, html });
}

export async function sendWelcomeEmail(
  email: string,
  userName: string,
  routeName?: string
): Promise<boolean> {
  const appBaseUrl = process.env.APP_BASE_URL || "https://bus-buddy-v-3-user-interface-1975grg.replit.app";
  const loginUrl = `${appBaseUrl}/login`;

  const subject = "Welcome to Bus Buddy!";
  const text = `
Hi ${userName},

Welcome to Bus Buddy! Your account has been created successfully.

${routeName ? `You're now subscribed to the "${routeName}" route. You'll receive SMS notifications when your bus is approaching your stop.` : ""}

To log in anytime, visit: ${loginUrl}

Thanks for joining Bus Buddy!
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🚌 Bus Buddy</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${userName}!</h2>
    <p>Your Bus Buddy account has been created successfully.</p>
    ${routeName ? `
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-weight: 600; color: #1f2937;">📍 Route Subscription</p>
      <p style="margin: 8px 0 0 0; color: #6b7280;">You're now subscribed to the "${routeName}" route. You'll receive SMS notifications when your bus is approaching your stop.</p>
    </div>
    ` : ""}
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Log In to Bus Buddy</a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">Thanks for joining Bus Buddy!</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      Bus Buddy - Real-time bus tracking for your institution
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to: email, subject, text, html });
}

export async function sendMagicLinkEmail(
  email: string,
  magicLink: string,
  userName?: string
): Promise<boolean> {
  const subject = "Your Bus Buddy Login Link";
  const text = `
Hi${userName ? ` ${userName}` : ""},

Click the link below to log in to Bus Buddy:

${magicLink}

This link will expire in 15 minutes.

If you didn't request this, you can safely ignore this email.

Thanks,
The Bus Buddy Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Bus Buddy</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Your Login Link</h2>
    <p>Hi${userName ? ` ${userName}` : ""},</p>
    <p>Click the button below to log in to Bus Buddy. No password needed!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Log In to Bus Buddy</a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">This link will expire in 15 minutes.</p>
    <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      Bus Buddy - Real-time bus tracking for your institution
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to: email, subject, text, html });
}
