const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

let client = null;
const isTwilioConfigured = !!(accountSid && authToken && fromPhone);

if (isTwilioConfigured) {
  try {
    client = twilio(accountSid, authToken);
    console.log('[Twilio] SMS Client successfully initialized.');
  } catch (err) {
    console.error('[Twilio] Failed to initialize Twilio client:', err);
  }
} else {
  console.log('[Twilio] Credentials not set in .env. Falling back to Mock OTP Console logging.');
}

const smsService = {
  sendOtp: async (phoneNumber, otp) => {
    const messageBody = `Your VoxConnect login verification code is: ${otp}. Valid for 5 minutes.`;
    
    if (isTwilioConfigured && client) {
      try {
        console.log(`[Twilio] Sending SMS to ${phoneNumber}...`);
        const message = await client.messages.create({
          body: messageBody,
          from: fromPhone,
          to: phoneNumber
        });
        console.log(`[Twilio] SMS sent successfully. Message SID: ${message.sid}`);
        return { success: true, sid: message.sid };
      } catch (err) {
        console.error(`[Twilio] Error sending SMS to ${phoneNumber}:`, err);
        // Do not throw so the user can still use the mock OTP print in terminal or fallback
        return { success: false, error: err.message };
      }
    } else {
      console.log('\n=======================================');
      console.log(`[Mock SMS Service]`);
      console.log(`To: ${phoneNumber}`);
      console.log(`Message: ${messageBody}`);
      console.log('=======================================\n');
      return { success: true, isMock: true };
    }
  }
};

module.exports = smsService;
