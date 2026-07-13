const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter.
 * Uses Gmail SMTP if EMAIL_USER / EMAIL_PASS are configured in .env,
 * otherwise falls back to Ethereal (fake SMTP) for development/demo.
 */
const createTransporter = async () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Production: Real Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS   // Gmail App Password
      }
    });
    return { transporter, testAccount: null };
  }

  // Development fallback: Ethereal test account (emails are captured, not actually sent)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  return { transporter, testAccount };
};

/**
 * Sends an OTP email for emergency complaint verification.
 * @param {string} toEmail - recipient email address
 * @param {string} name    - recipient name
 * @param {string} otp     - 6-digit OTP code
 */
const sendOtpEmail = async (toEmail, name, otp) => {
  try {
    const { transporter, testAccount } = await createTransporter();

    const mailOptions = {
      from: `"CivicPulse Emergency System" <${process.env.EMAIL_USER || 'noreply@civicpulse.gov.in'}>`,
      to: toEmail,
      subject: '🚨 CivicPulse — Your Emergency Report OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#dc3545,#b02a37);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">🚨 Emergency Civic Report</h1>
                      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">CivicPulse Municipal Emergency Response</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
                      <p style="font-size:15px;color:#555;margin:0 0 24px;">
                        You are submitting an <strong style="color:#dc3545;">Emergency Civic Issue Report</strong>. 
                        Please use the OTP below to verify your identity. This code is valid for <strong>10 minutes</strong>.
                      </p>
                      <!-- OTP Box -->
                      <div style="background:#fff5f5;border:2px dashed #dc3545;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                        <p style="color:#dc3545;font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Your One-Time Password</p>
                        <h1 style="color:#dc3545;font-size:52px;font-weight:800;margin:0;letter-spacing:12px;font-family:monospace;">${otp}</h1>
                      </div>
                      <p style="font-size:13px;color:#888;margin:0 0 8px;">⚠️ Do not share this OTP with anyone.</p>
                      <p style="font-size:13px;color:#888;margin:0 0 24px;">If you did not request this, please ignore this email.</p>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                      <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                        CivicPulse Municipal Corporation &bull; Emergency Response Division<br>
                        <a href="http://civicpulse.gov.in" style="color:#aaa;">civicpulse.gov.in</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    // In development, print the preview URL for the Ethereal test email
    if (testAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n📧 OTP Email Preview (Development): ${previewUrl}`);
      console.log(`🔑 OTP for ${toEmail}: ${otp}\n`);
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Fallback: Log OTP to console if email fails (development only)
    console.error('Email send failed:', err.message);
    console.log(`🔑 [FALLBACK] OTP for ${toEmail}: ${otp}`);
    return { success: false, error: err.message };
  }
};

/**
 * Sends an email notification to the citizen when their complaint is registered.
 * @param {string} toEmail - recipient email address
 * @param {string} name    - recipient name
 * @param {object} complaint - complaint details object
 */
const sendComplaintRegisteredEmail = async (toEmail, name, complaint) => {
  try {
    const { transporter, testAccount } = await createTransporter();

    const mailOptions = {
      from: `"CivicPulse Notifications" <${process.env.EMAIL_USER || 'noreply@civicpulse.gov.in'}>`,
      to: toEmail,
      subject: `📝 CivicPulse — Complaint Registered [ID: ${complaint.complaintId}]`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">📝 Complaint Registered</h1>
                      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">CivicPulse Smart Issue Monitoring</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
                      <p style="font-size:15px;color:#555;margin:0 0 24px;">
                        Thank you for reporting a civic issue. Your complaint has been successfully registered in our system and routed to the assigned department.
                      </p>
                      <!-- Details Table -->
                      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px;font-size:14px;color:#444;border:1px solid #eee;">
                        <tr style="background:#f9f9f9;border-bottom:1px solid #eee;">
                          <td width="35%" style="font-weight:600;padding:10px;">Tracking ID</td>
                          <td style="padding:10px;font-family:monospace;font-weight:700;color:#2563eb;">${complaint.complaintId}</td>
                        </tr>
                        <tr style="border-bottom:1px solid #eee;">
                          <td style="font-weight:600;padding:10px;">Issue Title</td>
                          <td style="padding:10px;">${complaint.title}</td>
                        </tr>
                        <tr style="background:#f9f9f9;border-bottom:1px solid #eee;">
                          <td style="font-weight:600;padding:10px;">Category</td>
                          <td style="padding:10px;">${complaint.category}</td>
                        </tr>
                        <tr style="border-bottom:1px solid #eee;">
                          <td style="font-weight:600;padding:10px;">Urgency</td>
                          <td style="padding:10px;">
                            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;color:#fff;background-color:${
                              complaint.priority === 'Emergency' ? '#dc3545' : 
                              complaint.priority === 'High' ? '#fd7e14' : 
                              complaint.priority === 'Medium' ? '#0d6efd' : '#198754'
                            };">${complaint.priority}</span>
                          </td>
                        </tr>
                        <tr style="background:#f9f9f9;">
                          <td style="font-weight:600;padding:10px;">Status</td>
                          <td style="padding:10px;font-weight:bold;color:#0d6efd;">${complaint.status}</td>
                        </tr>
                      </table>
                      
                      <!-- Call to Action Button -->
                      <div style="text-align:center;margin:30px 0 20px;">
                        <a href="http://localhost:3000/complaint-details.html?ref=${complaint.complaintId}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 30px;font-weight:bold;border-radius:6px;font-size:15px;display:inline-block;box-shadow:0 2px 8px rgba(37,99,235,0.3);">Track Complaint Progress</a>
                      </div>
                      
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                      <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                        CivicPulse Municipal Corporation &bull; Citizen Grievance Department<br>
                        <a href="http://localhost:3000" style="color:#aaa;">civicpulse.gov.in</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    if (testAccount) {
      console.log(`\n📧 Registration Email Preview (Development): ${nodemailer.getTestMessageUrl(info)}`);
    }
    return { success: true };
  } catch (err) {
    console.error('Registration email failed:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Sends an email notification when a complaint's status is updated.
 * @param {string} toEmail - recipient email address
 * @param {string} name    - recipient name
 * @param {object} complaint - complaint details object
 * @param {string} oldStatus - previous status
 * @param {string} newStatus - updated status
 * @param {string} remarks   - authority field remarks
 */
const sendComplaintStatusUpdateEmail = async (toEmail, name, complaint, oldStatus, newStatus, remarks) => {
  try {
    const { transporter, testAccount } = await createTransporter();

    // Map status colors for visual cues
    const statusColors = {
      'Submitted': '#0d6efd',
      'Assigned': '#6f42c1',
      'In Progress': '#ffc107',
      'Resolved': '#198754',
      'Closed': '#6c757d',
      'Rejected': '#dc3545'
    };

    const statusColor = statusColors[newStatus] || '#212529';

    const mailOptions = {
      from: `"CivicPulse Notifications" <${process.env.EMAIL_USER || 'noreply@civicpulse.gov.in'}>`,
      to: toEmail,
      subject: `🔔 CivicPulse — Status Updated: ${newStatus} [ID: ${complaint.complaintId}]`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg, ${statusColor}, #212529);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">🔔 Status Updated</h1>
                      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Complaint Reference: ${complaint.complaintId}</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
                      <p style="font-size:15px;color:#555;margin:0 0 24px;">
                        The status of your reported issue "<strong>${complaint.title}</strong>" has been updated.
                      </p>
                      
                      <!-- Status Banner -->
                      <div style="background:#f9f9f9;border-left:4px solid ${statusColor};border-radius:4px;padding:20px;margin:0 0 28px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="50%">
                              <span style="font-size:12px;color:#777;text-transform:uppercase;font-weight:600;display:block;">Previous Status</span>
                              <strong style="color:#777;font-size:18px;">${oldStatus}</strong>
                            </td>
                            <td width="50%">
                              <span style="font-size:12px;color:#777;text-transform:uppercase;font-weight:600;display:block;">New Status</span>
                              <strong style="color:${statusColor};font-size:18px;">${newStatus}</strong>
                            </td>
                          </tr>
                        </table>
                        <hr style="border:none;border-top:1px solid #eef;margin:15px 0;">
                        <span style="font-size:12px;color:#777;text-transform:uppercase;font-weight:600;display:block;margin-bottom:5px;">Officer Remarks</span>
                        <p style="font-size:14px;color:#444;margin:0;line-height:1.5;font-style:italic;">"${remarks || 'No remarks provided by the department.'}"</p>
                      </div>

                      <!-- Call to Action Button -->
                      <div style="text-align:center;margin:30px 0 20px;">
                        <a href="http://localhost:3000/complaint-details.html?ref=${complaint.complaintId}" style="background:${statusColor};color:#fff;text-decoration:none;padding:12px 30px;font-weight:bold;border-radius:6px;font-size:15px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.15);">View Live Progress Timeline</a>
                      </div>

                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                      <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                        CivicPulse Municipal Corporation &bull; Citizen Grievance Department<br>
                        <a href="http://localhost:3000" style="color:#aaa;">civicpulse.gov.in</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    if (testAccount) {
      console.log(`\n📧 Status Update Email Preview (Development): ${nodemailer.getTestMessageUrl(info)}`);
    }
    return { success: true };
  } catch (err) {
    console.error('Status update email failed:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Sends a password reset OTP email.
 * @param {string} toEmail - recipient email address
 * @param {string} name    - recipient name
 * @param {string} otp     - 6-digit OTP code
 */
const sendForgotPasswordEmail = async (toEmail, name, otp) => {
  try {
    const { transporter, testAccount } = await createTransporter();

    const mailOptions = {
      from: `"CivicPulse Account Security" <${process.env.EMAIL_USER || 'noreply@civicpulse.gov.in'}>`,
      to: toEmail,
      subject: '🔑 CivicPulse — Reset Your Password OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">🔑 Password Reset Request</h1>
                      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">CivicPulse Account Security</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
                      <p style="font-size:15px;color:#555;margin:0 0 24px;">
                        We received a request to reset your password. Use the verification code below to complete the reset. This code is valid for <strong>10 minutes</strong>.
                      </p>
                      <!-- OTP Box -->
                      <div style="background:#eef2ff;border:2px dashed #2563eb;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                        <p style="color:#2563eb;font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Reset Verification Code</p>
                        <h1 style="color:#2563eb;font-size:52px;font-weight:800;margin:0;letter-spacing:12px;font-family:monospace;">${otp}</h1>
                      </div>
                      <p style="font-size:13px;color:#888;margin:0 0 8px;">⚠️ Do not share this OTP with anyone. CivicPulse staff will never ask for your code.</p>
                      <p style="font-size:13px;color:#888;margin:0 0 24px;">If you did not request a password reset, please ignore this email.</p>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                      <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                        CivicPulse Municipal Corporation &bull; Citizen Grievance Department<br>
                        <a href="http://civicpulse.gov.in" style="color:#aaa;">civicpulse.gov.in</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    if (testAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n📧 Password Reset Email Preview (Development): ${previewUrl}`);
      console.log(`🔑 Reset OTP for ${toEmail}: ${otp}\n`);
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Password reset email failed:', err.message);
    console.log(`🔑 [FALLBACK] Reset OTP for ${toEmail}: ${otp}`);
    return { success: false, error: err.message };
  }
};

/**
 * Sends an email notification to the department officer when a complaint is escalated.
 * @param {string} officerEmail   - recipient officer email address
 * @param {string} officerName    - officer name
 * @param {object} complaint      - complaint details
 */
const sendComplaintEscalatedEmail = async (officerEmail, officerName, complaint) => {
  try {
    const { transporter, testAccount } = await createTransporter();

    const mailOptions = {
      from: `"CivicPulse Administrator" <${process.env.EMAIL_USER || 'noreply@civicpulse.gov.in'}>`,
      to: officerEmail,
      subject: `🚨 URGENT ESCALATION: Complaint ${complaint.complaintId} escalated to Emergency`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#fff5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 28px rgba(220,53,69,0.12);border: 1px solid #f5c2c7;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#dc3545,#721c24);padding:32px 40px;text-align:center;">
                      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">🚨 Ticket Escalation Alert</h1>
                      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Urgent Municipal Response Required</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <p style="font-size:16px;color:#333;margin:0 0 16px;">Dear Officer <strong>${officerName}</strong>,</p>
                      <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.6;">
                        The Administrator has escalated the following complaint assigned to your division to <strong style="color:#dc3545;">EMERGENCY priority</strong>. 
                        Please review the details and initiate an inspection or dispatch workers immediately.
                      </p>
                      <!-- Complaint Card -->
                      <div style="background:#f8fafc;border-left:4px solid #dc3545;border-radius:6px;padding:20px;margin-bottom:28px;font-size:14px;">
                        <table width="100%">
                          <tr><td style="font-weight:600;padding-bottom:6px;width:120px;color:#64748b;">Complaint ID:</td><td style="font-weight:700;color:#1e3a8a;">${complaint.complaintId}</td></tr>
                          <tr><td style="font-weight:600;padding-bottom:6px;color:#64748b;">Title:</td><td style="font-weight:600;color:#334155;">${complaint.title}</td></tr>
                          <tr><td style="font-weight:600;padding-bottom:6px;color:#64748b;">Category:</td><td>${complaint.category}</td></tr>
                          <tr><td style="font-weight:600;padding-bottom:6px;color:#64748b;">Priority:</td><td><span style="background:#f8d7da;color:#842029;padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px;">Emergency</span></td></tr>
                          <tr><td style="font-weight:600;padding-bottom:6px;color:#64748b;">Description:</td><td style="color:#475569;line-height:1.4;">${complaint.description}</td></tr>
                        </table>
                      </div>
                      <p style="font-size:14px;color:#333;margin:0 0 24px;">
                        Track or update the status from your Department Dashboard or access the tracking portal at:
                        <br><a href="http://localhost:3000/complaint-details.html?ref=${complaint.complaintId}" style="color:#2563eb;font-weight:600;text-decoration:none;">http://localhost:3000/complaint-details.html?ref=${complaint.complaintId}</a>
                      </p>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
                      <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                        CivicPulse Municipal Corporation &bull; Smart Monitoring Dashboard<br>
                        This is an administrative alert.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    if (testAccount) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`\n📧 Escalation Email Preview (Development): ${previewUrl}`);
      console.log(`🚨 Escalated alert sent to ${officerEmail} for ${complaint.complaintId}\n`);
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Escalation email failed:', err.message);
    console.log(`🚨 [FALLBACK] Escalation Alert for ${complaint.complaintId} to ${officerEmail}`);
    return { success: false, error: err.message };
  }
};

module.exports = { 
  sendOtpEmail,
  sendComplaintRegisteredEmail,
  sendComplaintStatusUpdateEmail,
  sendForgotPasswordEmail,
  sendComplaintEscalatedEmail
};

