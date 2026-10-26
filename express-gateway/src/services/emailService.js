// express-gateway/src/services/emailService.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false, // true for 465, false for other ports like 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendVerificationEmail(email, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: `"Job Recommendation System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">Welcome to Career Intelligence!</h2>
          <p style="color: #334155;">Please click the button below to verify your email address and activate your account:</p>
          <a href="${verificationUrl}" target="_blank" style="display: inline-block; background-color: #0d9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Verify Email Address</a>
          <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email. This link expires in 15 minutes.</p>
        </div>
      `,
    });
    console.log("Verification email successfully sent to:", email);
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("Nodemailer failed to send email:", error);
    throw new Error("Failed to send verification email. Check backend terminal.");
  }
}