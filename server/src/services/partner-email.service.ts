import { env } from '../config/env.config';
import { getResend, sendEmailOrThrow } from './email-base';

// ============================================================
// Send partner onboarding link
// ============================================================
export async function sendPartnerOnboardingEmail(opts: {
    to: string;
    partnerName: string;
    formUrl: string;
    expiresAt: Date;
}): Promise<void> {
    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.to,
        subject: `Welcome to Creative Upaay Partner Network!`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome, ${opts.partnerName}!</h2>
                <p>We're excited to partner with you. To get your account set up, please complete our partner onboarding form.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${opts.formUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Complete Partner Profile</a>
                </div>
                <p><em>Note: This link will expire on ${opts.expiresAt.toLocaleDateString()}.</em></p>
                <hr style="border: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666;">If you have any questions, feel free to reply to this email.</p>
            </div>
        `,
    });
}

// ============================================================
// Send partner credentials after approval
// ============================================================
export async function sendPartnerCredentialsEmail(opts: {
    to: string;
    partnerName: string;
    companyName: string;
    email: string;
    password?: string;
    loginUrl: string;
}): Promise<void> {
    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.to,
        subject: 'Your Creative Upaay Partner Account is Ready',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Hello ${opts.partnerName},</h2>
                <p>Your partner account for <strong>${opts.companyName}</strong> has been created and is now active! You can log in to the partner portal to start collaborating with us.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <h3 style="margin-top: 0; color: #334155;">Your Login Credentials</h3>
                    <p style="margin-bottom: 5px;"><strong>Email:</strong> ${opts.email}</p>
                    ${opts.password ? `<p style="margin-top: 0;"><strong>Password:</strong> ${opts.password}</p>` : ''}
                    <p style="font-size: 14px; color: #64748b; margin-top: 15px;"><em>Please change your password after logging in for the first time.</em></p>
                </div>

                <div style="margin: 30px 0; text-align: center;">
                    <a href="${opts.loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Access Partner Portal</a>
                </div>
                <hr style="border: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666;">We look forward to a successful partnership!</p>
            </div>
        `,
    });
}
