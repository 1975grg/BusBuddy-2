import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.error('Missing Twilio credentials');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

const to = '+14093703944';
const message = '🚌 Bus Buddy Test: This is a test SMS to verify delivery. Please reply "received" if you get this message!';

console.log(`Sending test SMS...`);
console.log(`From: ${fromNumber}`);
console.log(`To: ${to}`);
console.log(`Message: ${message}`);

try {
  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: to,
  });
  
  console.log('\n✅ SMS SENT SUCCESSFULLY');
  console.log('Message SID:', result.sid);
  console.log('Status:', result.status);
  console.log('Date Created:', result.dateCreated);
  console.log('\nNow fetching detailed status...\n');
  
  // Wait a moment for status to update
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Fetch the message to get current status
  const messageStatus = await client.messages(result.sid).fetch();
  console.log('Updated Status:', messageStatus.status);
  console.log('Error Code:', messageStatus.errorCode || 'None');
  console.log('Error Message:', messageStatus.errorMessage || 'None');
  console.log('Price:', messageStatus.price || 'N/A');
  console.log('Price Unit:', messageStatus.priceUnit || 'N/A');
  
} catch (error) {
  console.error('\n❌ SMS SEND FAILED');
  console.error('Error:', error.message);
  if (error.code) console.error('Twilio Error Code:', error.code);
  if (error.moreInfo) console.error('More Info:', error.moreInfo);
}
