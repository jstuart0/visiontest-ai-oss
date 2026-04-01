import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@visiontest.dev';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';

const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

if (!isConfigured) {
  logger.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email sending. Password reset links will be logged to console instead.');
}

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  if (!transporter) {
    logger.info(`[EMAIL - NOT SENT] Password reset for ${to}: ${resetUrl}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: 'VisionTest.ai - Password Reset',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset</h2>
          <p>You requested a password reset for your VisionTest.ai account.</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #999; font-size: 12px;">VisionTest.ai</p>
        </div>
      `,
      text: `Reset your VisionTest.ai password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });
    logger.info(`Password reset email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${to}:`, error);
    throw error;
  }
}

export async function sendOrgInviteEmail(
  to: string,
  orgName: string,
  inviterName: string,
  inviteToken: string
): Promise<void> {
  const inviteUrl = `${FRONTEND_URL}/register?invite=${inviteToken}`;

  if (!transporter) {
    logger.info(`[EMAIL - NOT SENT] Org invite for ${to} to ${orgName}: ${inviteUrl}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: `You've been invited to ${orgName} on VisionTest.ai`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">You're Invited!</h2>
          <p>${inviterName} invited you to join <strong>${orgName}</strong> on VisionTest.ai.</p>
          <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
          <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
          <p style="color: #999; font-size: 12px;">VisionTest.ai</p>
        </div>
      `,
      text: `${inviterName} invited you to join ${orgName} on VisionTest.ai. Accept: ${inviteUrl}`,
    });
    logger.info(`Org invite email sent to ${to} for ${orgName}`);
  } catch (error) {
    logger.error(`Failed to send invite email to ${to}:`, error);
    throw error;
  }
}
