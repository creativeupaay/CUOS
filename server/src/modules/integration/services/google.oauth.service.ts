/**
 * google.oauth.service.ts
 *
 * Handles:
 * - Building the Google OAuth2 consent URL
 * - Exchanging auth code for tokens
 * - Securely encrypting/decrypting tokens for storage
 * - Refreshing access tokens
 * - Revoking tokens on disconnect
 *
 * SECURITY RULES:
 * - accessToken and refreshToken are AES-256-CBC encrypted before DB write
 * - Tokens are NEVER returned to the frontend
 * - Tokens are NEVER logged
 */

import { google } from 'googleapis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../../../config/env.config';
import { GoogleIntegration, IGoogleIntegration } from '../models/GoogleIntegration.model';
import { logger } from '../../../utils/logger';
import type { Types } from 'mongoose';

// ─── Required OAuth scopes ────────────────────────────────────────────────────
// Minimum scopes needed for Google Meet tracking.
// calendar.events.readonly: read Calendar event metadata (title, times, conference info)
// admin.reports.audit.readonly: read Meet participant join/leave data (Workspace only)
export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    // The Meet API scope for fetching individual conference records
    'https://www.googleapis.com/auth/meetings.space.readonly',
];

// ─── OAuth2 client factory ────────────────────────────────────────────────────

export function getOAuth2Client() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
        throw new Error(
            'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env'
        );
    }

    return new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI
    );
}

// ─── Token encryption ─────────────────────────────────────────────────────────
// AES-256-CBC: key (32 bytes) + random IV (16 bytes) prepended to ciphertext.
// Format stored: "<iv_hex>:<encrypted_hex>"

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const key = env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be at least 32 characters');
    }
    // Use first 32 chars as the 32-byte key
    return Buffer.from(key.slice(0, 32), 'utf-8');
}

export function encryptToken(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(encrypted: string): string {
    const [ivHex, dataHex] = encrypted.split(':');
    if (!ivHex || !dataHex) throw new Error('Invalid encrypted token format');
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
}

// ─── Auth URL generation ──────────────────────────────────────────────────────

/**
 * Build the Google OAuth consent URL.
 * @param state - CSRF state value (should be a random string tied to the user session)
 */
export function getAuthUrl(state: string): string {
    const client = getOAuth2Client();
    return client.generateAuthUrl({
        access_type: 'offline',   // request a refresh token
        prompt: 'consent',         // always show consent so refresh token is always returned
        scope: GOOGLE_SCOPES,
        state,
    });
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export interface GoogleTokenInfo {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    scope: string;
    googleEmail: string;
    googleUserId: string;
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 * Also retrieves the user's Google profile to get their email and stable ID.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenInfo> {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Google did not return the expected tokens. Ensure offline access was requested.');
    }

    // Fetch user identity
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email || !userInfo.id) {
        throw new Error('Could not retrieve Google user identity');
    }

    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scope: tokens.scope ?? GOOGLE_SCOPES.join(' '),
        googleEmail: userInfo.email,
        googleUserId: userInfo.id,
    };
}

// ─── Integration storage ──────────────────────────────────────────────────────

/**
 * Upsert a GoogleIntegration record for a CUOS user.
 * Tokens are encrypted before storage.
 * Does not return tokens in the result.
 */
export async function upsertGoogleIntegration(
    userId: string,
    tokenInfo: GoogleTokenInfo
): Promise<Omit<IGoogleIntegration, 'accessToken' | 'refreshToken'>> {
    const encryptedAccess  = encryptToken(tokenInfo.accessToken);
    const encryptedRefresh = encryptToken(tokenInfo.refreshToken);

    const doc = await GoogleIntegration.findOneAndUpdate(
        { userId },
        {
            $set: {
                userId,
                googleEmail: tokenInfo.googleEmail,
                googleUserId: tokenInfo.googleUserId,
                accessToken: encryptedAccess,
                refreshToken: encryptedRefresh,
                tokenExpiresAt: tokenInfo.tokenExpiresAt,
                scope: tokenInfo.scope,
                status: 'active',
            },
        },
        { new: true, upsert: true, runValidators: true }
    );

    return doc;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Retrieve a valid (possibly refreshed) access token for a user.
 * If the stored token is expired or close to expiry, it is refreshed automatically.
 * Marks the integration as 'requires_reauth' if refresh fails.
 *
 * @returns decrypted access token string (never stored back in plaintext)
 */
export async function getValidAccessToken(
    integration: IGoogleIntegration & { accessToken: string; refreshToken: string }
): Promise<string> {
    const now = Date.now();
    const expiresAt = integration.tokenExpiresAt.getTime();

    // Refresh if within 5 minutes of expiry
    if (expiresAt - now > 5 * 60_000) {
        return decryptToken(integration.accessToken);
    }

    logger.info({ userId: integration.userId }, '[Google] Refreshing access token');

    try {
        const client = getOAuth2Client();
        const decryptedRefresh = decryptToken(integration.refreshToken);
        client.setCredentials({ refresh_token: decryptedRefresh });

        const { credentials } = await client.refreshAccessToken();

        if (!credentials.access_token) {
            throw new Error('No access_token returned from refresh');
        }

        // Update stored tokens (refresh token may rotate)
        const updateData: Record<string, any> = {
            accessToken: encryptToken(credentials.access_token),
            tokenExpiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
            status: 'active',
        };
        if (credentials.refresh_token) {
            updateData.refreshToken = encryptToken(credentials.refresh_token);
        }

        await GoogleIntegration.updateOne({ _id: integration._id }, { $set: updateData });

        return credentials.access_token;
    } catch (err) {
        logger.error({ userId: integration.userId }, '[Google] Token refresh failed — marking requires_reauth');
        await GoogleIntegration.updateOne(
            { _id: integration._id },
            { $set: { status: 'requires_reauth' } }
        );
        throw err;
    }
}

// ─── Disconnect (revoke) ──────────────────────────────────────────────────────

/**
 * Revoke Google tokens and delete the integration record.
 * Best-effort — if revocation fails on Google's side, we still delete locally.
 */
export async function revokeAndDeleteIntegration(userId: string): Promise<void> {
    const integration = await GoogleIntegration.findOne({ userId }).select(
        '+accessToken +refreshToken'
    );
    if (!integration) return;

    try {
        const client = getOAuth2Client();
        const decryptedAccess = decryptToken(integration.accessToken);
        await client.revokeToken(decryptedAccess);
    } catch (err) {
        // Log but don't throw — we still want to delete the local record
        logger.warn({ userId }, '[Google] Token revocation failed (continuing with local deletion)');
    }

    await GoogleIntegration.deleteOne({ userId });
    logger.info({ userId }, '[Google] Integration disconnected');
}

// ─── Get integration status (safe for API response) ──────────────────────────

export interface GoogleIntegrationStatus {
    connected: boolean;
    googleEmail?: string;
    status?: 'active' | 'requires_reauth';
    connectedSince?: Date;
    lastSyncedAt?: Date;
}

export async function getIntegrationStatus(userId: string): Promise<GoogleIntegrationStatus> {
    const integration = await GoogleIntegration.findOne({ userId });
    if (!integration) return { connected: false };

    return {
        connected: true,
        googleEmail: integration.googleEmail,
        status: integration.status,
        connectedSince: integration.createdAt,
        lastSyncedAt: integration.lastSyncedAt,
    };
}
