import QRCode from 'qrcode';

const baseUrl = 'https://replit.dev/@1975grg/BusBuddy-v3-user-interface';
const token = 'SDZGxdgIIAVhL7x09FLoKGue2MpuQoDKPn_TAu3h5K4';
const magicLinkUrl = `${baseUrl}/driver/onboard?token=${token}`;

try {
  await QRCode.toFile('driver_mike_thompson_qr.png', magicLinkUrl, {
    width: 500,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  console.log('✅ QR code generated: driver_mike_thompson_qr.png');
  console.log('📱 Magic Link:', magicLinkUrl);
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
