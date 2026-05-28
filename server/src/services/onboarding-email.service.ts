import { env } from '../config/env.config';
import { getResend, sendEmailOrThrow } from './email-base';

// ============================================================
// Employee Onboarding Emails
// ============================================================

export async function sendEmployeeOnboardingEmail(opts: {
    to: string;
    employeeName: string;
    formUrl: string;
}): Promise<void> {
    await sendEmailOrThrow(getResend(), {
        from: env.RESEND_FROM_EMAIL,
        to: opts.to,
        subject: `Welcome to Creative Upaay, ${opts.employeeName}!`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome aboard, ${opts.employeeName}!</h2>
                <p>We are excited to have you join the Creative Upaay team.</p>
                <p>To get started, please complete your onboarding profile by clicking the button below. You'll need to provide some basic information and upload your documents.</p>
                
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${opts.formUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                        Complete Your Onboarding
                    </a>
                </div>

                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> This link is unique to you. Please complete the form as soon as possible.</p>
                </div>

                <hr style="border: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666; text-align: center;">
                    If you have any questions or need assistance, please reply directly to this email.<br/>
                    Creative Upaay HR Team
                </p>
            </div>
        `,
    });
}
