import nodemailer from 'nodemailer';

/**
 * Helper to get a configured Nodemailer transporter.
 */
async function getTransporter() {
  if (
    process.env.SMTP_HOST &&
    !process.env.SMTP_HOST.includes("xxxx") &&
    !process.env.SMTP_PASS?.includes("xxxx")
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  }

  // Fallback to Ethereal test account with timeout
  try {
    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Ethereal setup timed out")), 4000)
      ),
    ]);

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  } catch (err) {
    console.warn("[Email Service] SMTP setup failed or timed out:", err.message);
    throw err;
  }
}

/**
 * Sends password reset link email to recipient.
 */
export async function sendPasswordResetEmail(recipientEmail, resetToken) {
  const transporter = await getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const fromEmail = process.env.EMAIL_FROM || "noreply@boatlift.app";

  const mailOptions = {
    from: `"Boat Lift Protection" <${fromEmail}>`,
    to: recipientEmail,
    subject: "Reset Your Password - Boat Lift Protection",
    text: `Hello,\n\nYou requested a password reset for your Boat Lift Protection account.\n\nPlease click the link below or paste it into your browser to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email.\n\nRegards,\nBoat Lift Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #0f172a;">Password Reset Request</h2>
        <p style="color: #475569; font-size: 15px;">Hello,</p>
        <p style="color: #475569; font-size: 15px;">You requested a password reset for your Boat Lift Protection account.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Or copy and paste this URL into your browser:</p>
        <p style="color: #0284c7; font-size: 13px; word-break: break-all;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  
  if (info && typeof nodemailer.getTestMessageUrl === "function") {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Password Reset Email] Ethereal Preview URL: ${previewUrl}`);
      info.previewUrl = previewUrl;
    }
  }

  return info;
}
