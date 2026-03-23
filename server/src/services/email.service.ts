import { Resend } from 'resend';
import { env } from '../config/env.config';

// ============================================================
// Email Service — powered by Resend
// Set RESEND_API_KEY in your .env to enable email sending.
// ============================================================

let resend: Resend | null = null;
const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

function normalizeMeetingUrl(url?: string | null): string {
    if (!url) return '';

    const trimmedUrl = String(url).trim();
    if (!trimmedUrl || trimmedUrl.startsWith('/')) {
        return '';
    }

    const explicitMeetingUrlMatch = trimmedUrl.match(
        /https?:\/\/(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (explicitMeetingUrlMatch) {
        return explicitMeetingUrlMatch[0].replace(/[),.;]+$/, '');
    }

    const providerOnlyMatch = trimmedUrl.match(
        /(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (providerOnlyMatch) {
        const extracted = providerOnlyMatch[0].replace(/[),.;]+$/, '');
        return `https://${extracted}`;
    }

    return '';
}

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

async function sendEmailOrThrow(
    client: Resend,
    payload: Parameters<Resend['emails']['send']>[0]
): Promise<string | undefined> {
    const result: any = await client.emails.send(payload);

    if (result?.error) {
        throw new Error(
            typeof result.error === 'string'
                ? result.error
                : result.error.message || 'Resend failed to send email'
        );
    }

    return result?.data?.id;
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

    await sendEmailOrThrow(client, {
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

    await sendEmailOrThrow(client, {
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

    await sendEmailOrThrow(client, {
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

// ============================================================
// Send candidate rejection email
// ============================================================
export async function sendHiringRejectionEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
}): Promise<void> {
    const { to, candidateName, jobTitle } = opts;
    const client = getResend();

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Update on your application — ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                Thank you for taking the time to apply for the role of <strong>${jobTitle}</strong> at Creative Upaay.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                After careful review, we have decided to move forward with other candidates whose experience more closely matches our current requirements. We appreciate your interest and encourage you to apply for future openings.
              </p>
              <p style="margin:0;font-size:13px;color:#6B7280;">We wish you the best in your job search.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
// Send interview qualified email
// ============================================================
export async function sendHiringInterviewQualifiedEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
}): Promise<void> {
    const { to, candidateName, jobTitle } = opts;
    const client = getResend();

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Interview update — ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                You have qualified the interview round for the role of <strong>${jobTitle}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Our team will contact you soon with the next update. Thank you for your time and participation in the interview process.
              </p>
              <p style="margin:0;font-size:13px;color:#6B7280;">We appreciate your interest in Creative Upaay.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
// Send candidate application confirmation email
// ============================================================
export async function sendHiringApplicationReceivedEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
}): Promise<void> {
    const { to, candidateName, jobTitle } = opts;
    const client = getResend();

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: 'Application Received',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                We have successfully received your application for the role of <strong>${jobTitle}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Our team will review your profile and contact you with next steps if shortlisted.
              </p>
              <p style="margin:0;font-size:13px;color:#6B7280;">Thank you for your interest in joining Creative Upaay.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
// Send assignment submission email with assignment link
// ============================================================
export async function sendHiringAssignmentEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
    assignmentTitle: string;
    assignmentUrl: string;
    timeLimitDays: number;
    deadlineAt: Date;
}): Promise<void> {
    const { to, candidateName, jobTitle, assignmentTitle, assignmentUrl, timeLimitDays, deadlineAt } =
        opts;
    const client = getResend();
    const deadlineLabel = new Date(deadlineAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: DISPLAY_TIME_ZONE,
    });

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Assignment Round - ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                You have moved to the assignment round for <strong>${jobTitle}</strong>.
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                Assignment: <strong>${assignmentTitle}</strong><br/>
                Submit within: <strong>${timeLimitDays} day${timeLimitDays > 1 ? 's' : ''}</strong><br/>
                Form expires on: <strong>${deadlineLabel} IST</strong>
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:#6B7280;line-height:1.6;">
                You can still submit after expiry, but your submission will be marked as late.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#22C55E;border-radius:6px;">
                    <a href="${assignmentUrl}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;">Open Assignment</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#6B7280;">If the button does not work, use this link:<br/><a href="${assignmentUrl}" style="color:#2563EB;word-break:break-all;">${assignmentUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
// Send interview invite email with slot booking link
// ============================================================
export async function sendInterviewInviteEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
    bookingUrl: string;
}): Promise<void> {
    const { to, candidateName, jobTitle, bookingUrl } = opts;
    const client = getResend();

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Select interview slot — ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#111827;padding:24px 32px;"><p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;">Creative Upaay</p><p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p></td></tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">You are shortlisted for the interview round for <strong>${jobTitle}</strong>. Please choose your preferred interview time using the link below.</p>
              <table cellpadding="0" cellspacing="0"><tr><td style="background:#22C55E;border-radius:6px;"><a href="${bookingUrl}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;">Select Interview Time</a></td></tr></table>
              <p style="margin:20px 0 0;font-size:13px;color:#6B7280;">If the button does not work, use this link:<br/><a href="${bookingUrl}" style="color:#2563EB;word-break:break-all;">${bookingUrl}</a></p>
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

export async function sendInterviewRescheduleEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
    bookingUrl: string;
    preferredTime: Date;
}): Promise<void> {
    const { to, candidateName, jobTitle, bookingUrl, preferredTime } = opts;
    const client = getResend();
    const preferredTimeLabel = preferredTime.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: DISPLAY_TIME_ZONE,
    });

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Please reschedule your interview — ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr><td style="background:#111827;padding:24px 32px;"><p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;">Creative Upaay</p><p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p></td></tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">Your interview for <strong>${jobTitle}</strong> needs to be rescheduled. Please choose a new time using the link below.</p>
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Preferred time from our team: <strong>${preferredTimeLabel} IST</strong></p>
              <table cellpadding="0" cellspacing="0"><tr><td style="background:#2563EB;border-radius:6px;"><a href="${bookingUrl}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;">Choose New Interview Time</a></td></tr></table>
              <p style="margin:20px 0 0;font-size:13px;color:#6B7280;">If the button does not work, use this link:<br/><a href="${bookingUrl}" style="color:#2563EB;word-break:break-all;">${bookingUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
// Send interview booking confirmation to candidate
// ============================================================
export async function sendInterviewScheduledForCandidateEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
}): Promise<void> {
    const { to, candidateName, jobTitle, interviewer, scheduledTime, meetLink } = opts;
    const client = getResend();
    const normalizedMeetLink = normalizeMeetingUrl(meetLink);

    const timeText = scheduledTime.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Interview confirmed — ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#111827;padding:24px 32px;"><p style="margin:0;color:#fff;font-size:18px;font-weight:600;">Creative Upaay</p></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 14px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
        <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">Your interview has been scheduled successfully.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Role:</strong> ${jobTitle}</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Interviewer:</strong> ${interviewer}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827;"><strong>Time:</strong> ${timeText}</p>
        ${
            normalizedMeetLink
                ? `<table cellpadding="0" cellspacing="0"><tr><td style="background:#2563EB;border-radius:6px;"><a href="${normalizedMeetLink}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:500;">Join Interview</a></td></tr></table>`
                : `<p style="margin:0 0 16px;font-size:13px;color:#6B7280;">The meeting link will be shared in a follow-up update if it is not available yet.</p>`
        }
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });
}

// ============================================================
// Send interview reminder to candidate
// ============================================================
export async function sendInterviewReminderForCandidateEmail(opts: {
    to: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
}): Promise<void> {
    const { to, candidateName, jobTitle, interviewer, scheduledTime, meetLink } = opts;
    const client = getResend();
    const normalizedMeetLink = normalizeMeetingUrl(meetLink);

    const timeText = scheduledTime.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Reminder: Upcoming interview for ${jobTitle}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#111827;padding:24px 32px;"><p style="margin:0;color:#fff;font-size:18px;font-weight:600;">Creative Upaay</p></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 14px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
        <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">This is a reminder for your upcoming interview.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Role:</strong> ${jobTitle}</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Interviewer:</strong> ${interviewer}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827;"><strong>Time:</strong> ${timeText}</p>
        ${
            normalizedMeetLink
                ? `<table cellpadding="0" cellspacing="0"><tr><td style="background:#2563EB;border-radius:6px;"><a href="${normalizedMeetLink}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:500;">Join Interview</a></td></tr></table>`
                : `<p style="margin:0 0 16px;font-size:13px;color:#6B7280;">The meeting link will be shared in a follow-up update if it is not available yet.</p>`
        }
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });
}

// ============================================================
// Send interview booking notification to HR
// ============================================================
export async function sendInterviewScheduledForHrEmail(opts: {
    to: string[];
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
}): Promise<void> {
    const { to, candidateName, candidateEmail, jobTitle, interviewer, scheduledTime, meetLink } = opts;
    const client = getResend();
    const normalizedMeetLink = normalizeMeetingUrl(meetLink);

    const timeText = scheduledTime.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: `Interview booked: ${candidateName} (${jobTitle})`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#111827;padding:24px 32px;"><p style="margin:0;color:#fff;font-size:18px;font-weight:600;">CUOS Hiring Notification</p></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Candidate:</strong> ${candidateName} (${candidateEmail})</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Role:</strong> ${jobTitle}</p>
        <p style="margin:0 0 10px;font-size:14px;color:#111827;"><strong>Interviewer:</strong> ${interviewer}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827;"><strong>Time:</strong> ${timeText}</p>
        ${
            normalizedMeetLink
                ? `<a href="${normalizedMeetLink}" style="color:#2563EB;font-size:14px;">${normalizedMeetLink}</a>`
                : `<p style="margin:0;font-size:13px;color:#6B7280;">Meeting link unavailable in the webhook payload.</p>`
        }
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });
}

// ============================================================
// Send offer email to candidate
// ============================================================
export async function sendHiringOfferEmail(opts: {
    to: string;
    candidateName: string;
    position: string;
    salary: string;
    offerLetterUrl: string;
}): Promise<void> {
    const { to, candidateName, position, salary, offerLetterUrl } = opts;
    const client = getResend();

    await sendEmailOrThrow(client, {
        from: env.RESEND_FROM_EMAIL,
        to,
        subject: 'Offer from Creative Upaay.',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Creative Upaay</p>
              <p style="margin:4px 0 0;color:#9CA3AF;font-size:13px;">Hiring Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;font-weight:500;">Hello ${candidateName},</p>
              <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">
                Congratulations. We are pleased to offer you the position of <strong>${position}</strong> at Creative Upaay.
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Offered compensation: <strong>${salary}</strong>
              </p>
              <table cellpadding="0" cellspacing="0"><tr><td style="background:#2563EB;border-radius:6px;"><a href="${offerLetterUrl}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;">View Offer Letter</a></td></tr></table>
              <p style="margin:20px 0 0;font-size:13px;color:#6B7280;">If the button does not work, use this link:<br/><a href="${offerLetterUrl}" style="color:#2563EB;word-break:break-all;">${offerLetterUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; Creative Upaay. This is an automated email, please do not reply.</p>
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
