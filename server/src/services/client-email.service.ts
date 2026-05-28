import { env } from '../config/env.config';
import { getResend, sendEmailOrThrow } from './email-base';

// ============================================================
// Send client onboarding form link
// ============================================================
export async function sendClientOnboardingEmail(opts: {
    to: string;
    clientName: string;
    formUrl: string;
    expiresAt: Date;
}): Promise<void> {
    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.to,
        subject: `Welcome to Creative Upaay - Let's Get Started!`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome, ${opts.clientName}!</h2>
                <p>We're thrilled to have you on board. To help us hit the ground running, please complete our onboarding form.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${opts.formUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Complete Onboarding Form</a>
                </div>
                <p><em>Note: This link will expire on ${opts.expiresAt.toLocaleDateString()}.</em></p>
                <hr style="border: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666;">If you have any questions, feel free to reply to this email.</p>
            </div>
        `,
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
    if (!opts.adminEmails.length) return;

    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.adminEmails,
        subject: `New Onboarding Submitted: ${opts.clientName}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Onboarding Form Completed</h2>
                <p><strong>${opts.clientName}</strong> has just completed their onboarding form.</p>
                <p>You can review their details in the admin dashboard:</p>
                <a href="${opts.dashboardUrl}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">View Client Details</a>
            </div>
        `,
    });
}

// ============================================================
// Send client portal access credentials
// ============================================================
export async function sendClientPortalAccessEmail(opts: {
    to: string;
    clientName: string;
    portalUrl: string;
}): Promise<void> {
    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.to,
        subject: 'Access your Creative Upaay Client Portal',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Hello ${opts.clientName},</h2>
                <p>Your client portal is ready! You can now track your projects, view invoices, and communicate with our team all in one place.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${opts.portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Access Portal</a>
                </div>
                <hr style="border: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666;">We look forward to working with you!</p>
            </div>
        `,
    });
}
