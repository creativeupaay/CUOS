import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Stores Google OAuth credentials per CUOS user.
 * Tokens are AES-256 encrypted before being stored.
 * NEVER return accessToken/refreshToken to the frontend.
 */
export interface IGoogleIntegration extends Document {
    _id: Types.ObjectId;
    /** CUOS User._id — one integration per user */
    userId: Types.ObjectId;
    /** Email of the connected Google account */
    googleEmail: string;
    /** Stable Google account subject ID from the ID token */
    googleUserId: string;
    /** AES-256 encrypted access token */
    accessToken: string;
    /** AES-256 encrypted refresh token */
    refreshToken: string;
    /** UTC timestamp when the current access token expires */
    tokenExpiresAt: Date;
    /** Space-separated OAuth scopes that were granted */
    scope: string;
    /** 'active' = usable; 'requires_reauth' = token refresh failed, user must reconnect */
    status: 'active' | 'requires_reauth';
    /** Last successful sync timestamp */
    lastSyncedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const GoogleIntegrationSchema = new Schema<IGoogleIntegration>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        googleEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        googleUserId: {
            type: String,
            required: true,
            trim: true,
        },
        accessToken: {
            type: String,
            required: true,
            select: false, // Never returned in normal queries
        },
        refreshToken: {
            type: String,
            required: true,
            select: false, // Never returned in normal queries
        },
        tokenExpiresAt: {
            type: Date,
            required: true,
        },
        scope: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'requires_reauth'],
            default: 'active',
        },
        lastSyncedAt: Date,
    },
    {
        timestamps: true,
    }
);

// Indexes
GoogleIntegrationSchema.index({ googleEmail: 1 }, { sparse: true });
GoogleIntegrationSchema.index({ status: 1 });
// userId is indexed via unique: true

export const GoogleIntegration = mongoose.model<IGoogleIntegration>(
    'GoogleIntegration',
    GoogleIntegrationSchema
);
