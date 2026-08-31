import { Resend } from 'resend';

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM || 'BFP Benguet Reporting <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Fails silently (logs only) — a broken email provider must never break the report/notification
// flow it's attached to, since email is a notification channel, not the source of truth.
export async function sendEmail({ to, subject, html }) {
  if (!resendClient) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }
  if (!to) return;

  try {
    await resendClient.emails.send({ from: FROM, to, subject, html });
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
  }
}

const layout = (bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <div style="background: #1A2B4A; padding: 20px 24px; border-radius: 8px 8px 0 0;">
      <span style="color: #D4AF37; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
        BFP Benguet
      </span>
      <h1 style="color: #fff; font-size: 18px; margin: 4px 0 0;">Incident Reporting System</h1>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      ${bodyHtml}
    </div>
  </div>
`;

export function welcomeAccountEmail({ name, email, password, roleLabel }) {
  return {
    subject: 'Your BFP Benguet Reporting System account',
    html: layout(`
      <p>Hi ${name},</p>
      <p>An administrator has created an account for you on the BFP Benguet Fire Incident Reporting System.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #6b7280;">Role</td><td style="padding: 4px 0; font-weight: bold;">${roleLabel}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Email</td><td style="padding: 4px 0; font-weight: bold;">${email}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Temporary Password</td><td style="padding: 4px 0; font-weight: bold;">${password}</td></tr>
      </table>
      <p>Please log in and change your password as soon as possible.</p>
      <p><a href="${APP_URL}/login" style="display: inline-block; background: #CC0000; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Log In</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you weren't expecting this account, please contact your administrator.</p>
    `),
  };
}

export function notificationEmail({ message, reportUrl }) {
  return {
    subject: 'BFP Benguet — New Notification',
    html: layout(`
      <p>${message}</p>
      ${reportUrl ? `<p><a href="${reportUrl}" style="display: inline-block; background: #1A2B4A; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View in System</a></p>` : ''}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You're receiving this because you have an account on the BFP Benguet Fire Incident Reporting System.</p>
    `),
  };
}
