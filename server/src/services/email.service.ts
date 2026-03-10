import { Resend } from 'resend';
import { env } from '../config/env.config';

// ============================================================
// Email Service — powered by Resend
// Set RESEND_API_KEY in your .env to enable email sending.
// ============================================================

let resend: Resend | null = null;

function getResend(): Resend {
    if (!env.RESEND_API_KEY) {
        throw new Error(
            'RESEND_API_KEY is not set. Please add it to your .env file to enable email sending.'
        );
    }
    if (!resend) {
        resend = new Resend(env.RESEND_API_KEY);
    }
    return resend;
}

// ============================================================
// Send client onboarding form link
// ============================================================
export async function sendClientOnboardingEmail(opts: {
    to: string;
    clientName: string;
    formUrl: string;
    expiresAt: Date;
}): Promise<void> {
    const { to, clientName, formUrl, expiresAt } = opts;
    const client = getResend();

    const expiryFormatted = expiresAt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    await client.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: 'Please complete your onboarding details — Creative Upaay',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">CUOS — Operating System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${clientName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                We'd like you to complete your onboarding details so we can set up your account correctly.
                Please click the button below to fill in your information.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#22C55E;border-radius:6px;">
                    <a href="${formUrl}" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:500;text-decoration:none;">
                      Fill Onboarding Form
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">
                Or copy this link into your browser:<br/>
                <a href="${formUrl}" style="color:#2563EB;word-break:break-all;">${formUrl}</a>
              </p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB;"/>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                This link is valid until <strong>${expiryFormatted}</strong>.
                Please do not share this link with anyone.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                &copy; Creative Upaay. This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ============================================================
// Send employee self-onboarding form link
// ============================================================
export async function sendEmployeeOnboardingEmail(opts: {
    to: string;
    employeeName: string;
    formUrl: string;
}): Promise<void> {
    const { to, employeeName, formUrl } = opts;
    const client = getResend();

    await client.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: 'Complete your employee onboarding — Creative Upaay',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">CUOS — Employee Onboarding</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${employeeName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Welcome to Creative Upaay! Please complete your employee onboarding by filling in your
                personal, bank, and other required details using the link below.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#6366F1;border-radius:6px;">
                    <a href="${formUrl}" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:500;text-decoration:none;">
                      Fill Onboarding Form
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">
                Or copy this link into your browser:<br/>
                <a href="${formUrl}" style="color:#2563EB;word-break:break-all;">${formUrl}</a>
              </p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB;"/>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Please do not share this link with anyone. If you did not expect this email,
                please contact your HR administrator.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                &copy; Creative Upaay. This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}

// ============================================================
// Notify all admins when client submits the onboarding form
// ============================================================
export async function sendOnboardingSubmittedNotification(opts: {
    adminEmails: string[];
    clientName: string;
    clientId: string;
    dashboardUrl: string;
}): Promise<void> {
    if (opts.adminEmails.length === 0) return;

    const client = getResend();

    await client.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: opts.adminEmails,
        subject: `Onboarding form submitted — ${opts.clientName}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">CUOS — Onboarding Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Onboarding form submitted</p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                <strong>${opts.clientName}</strong> has filled and submitted their onboarding form.
                The client details have been updated in CUOS.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#22C55E;border-radius:6px;">
                    <a href="${opts.dashboardUrl}" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:500;text-decoration:none;">
                      View Client in CUOS
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
}
