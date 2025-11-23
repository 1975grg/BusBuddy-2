import QRCode from 'qrcode';

const driverLoginUrl = 'https://replit.dev/@1975grg/BusBuddy-v3-user-interface/driver/onboard?token=rG7Jv7Rv9S-plDOaz_1tVKdT1xSBP6b9WQjlRcDCo7k';

try {
  await QRCode.toFile('driver_login_qr.png', driverLoginUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  console.log('QR code generated successfully');
} catch (err) {
  console.error('Error generating QR code:', err);
  process.exit(1);
}
