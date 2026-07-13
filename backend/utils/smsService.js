const twilio = require('twilio');

// Initialize the Twilio client only if credentials exist
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Sends a real SMS containing the OTP to a phone number.
 * @param {string} toPhone - Recipient phone number (e.g. +91XXXXXXXXXX or +1XXXXXXXXXX)
 * @param {string} otp     - 6-digit OTP code
 */
const sendOtpSms = async (toPhone, otp) => {
  try {
    if (!client) {
      console.warn('⚠️ Twilio credentials missing in .env. Falling back to simulated log.');
      console.log(`🔑 [FALLBACK] OTP for ${toPhone}: ${otp}`);
      return { success: true, simulated: true };
    }

    // Format phone number with country code (e.g., prefixing +91 for India if not present)
    let formattedPhone = toPhone.trim();
    if (!formattedPhone.startsWith('+')) {
      // Defaulting to +91 (India) as an example. Adjust according to your target region
      formattedPhone = `+91${formattedPhone}`; 
    }

    const message = await client.messages.create({
      body: `🚨 CivicPulse: Your verification OTP for reporting an emergency is ${otp}. This code is valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`📱 Real SMS Sent to ${formattedPhone}. Message SID: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Twilio SMS send failed:', error.message);
    // Fallback log during development
    console.log(`🔑 [FALLBACK] OTP for ${toPhone}: ${otp}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a real SMS when a complaint is registered.
 * @param {string} toPhone     - Recipient phone number
 * @param {string} complaintId - Human-readable complaint ID
 * @param {string} title       - Title of the complaint
 */
const sendComplaintRegisteredSms = async (toPhone, complaintId, title) => {
  try {
    const cleanPhone = toPhone.trim();
    if (!cleanPhone || cleanPhone === '0000000000') {
      return { success: true, message: 'No valid phone number provided.' };
    }

    if (!client) {
      console.warn('⚠️ Twilio credentials missing in .env. Falling back to simulated log.');
      console.log(`📱 [FALLBACK SMS] Complaint Registered: ID: ${complaintId}, Title: "${title}" to: ${cleanPhone}`);
      return { success: true, simulated: true };
    }

    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone}`;
    }

    const message = await client.messages.create({
      body: `📝 CivicPulse: Your complaint has been registered successfully! ID: ${complaintId}. Title: "${title}". Track at: http://localhost:3000/complaint-details.html?ref=${complaintId}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`📱 Real SMS Sent to ${formattedPhone}. Message SID: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Twilio SMS send failed:', error.message);
    console.log(`📱 [FALLBACK SMS] Complaint Registered: ID: ${complaintId}, Title: "${title}" to: ${toPhone}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a real SMS when a complaint's status is updated.
 * @param {string} toPhone     - Recipient phone number
 * @param {string} complaintId - Human-readable complaint ID
 * @param {string} title       - Title of the complaint
 * @param {string} newStatus   - Updated status (e.g. In Progress, Resolved)
 * @param {string} remarks     - Field officer remarks
 */
const sendComplaintStatusUpdateSms = async (toPhone, complaintId, title, newStatus, remarks) => {
  try {
    const cleanPhone = toPhone.trim();
    if (!cleanPhone || cleanPhone === '0000000000') {
      return { success: true, message: 'No valid phone number provided.' };
    }

    if (!client) {
      console.warn('⚠️ Twilio credentials missing in .env. Falling back to simulated log.');
      console.log(`📱 [FALLBACK SMS] Status Update: ID: ${complaintId}, Status: ${newStatus}, Remarks: "${remarks}" to: ${cleanPhone}`);
      return { success: true, simulated: true };
    }

    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone}`;
    }

    const shortRemarks = remarks && remarks.length > 50 ? `${remarks.slice(0, 47)}...` : remarks;
    const bodyText = `🔔 CivicPulse: Complaint ID ${complaintId} ("${title.slice(0, 20)}") updated to "${newStatus}". Remarks: "${shortRemarks || 'None'}". Details: http://localhost:3000/complaint-details.html?ref=${complaintId}`;

    const message = await client.messages.create({
      body: bodyText,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`📱 Real SMS Sent to ${formattedPhone}. Message SID: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error('Twilio SMS send failed:', error.message);
    console.log(`📱 [FALLBACK SMS] Status Update: ID: ${complaintId}, Status: ${newStatus}, Remarks: "${remarks}" to: ${toPhone}`);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  sendOtpSms,
  sendComplaintRegisteredSms,
  sendComplaintStatusUpdateSms
};
