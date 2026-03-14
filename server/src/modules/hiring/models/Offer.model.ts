import mongoose, { Document, Schema, Types } from 'mongoose';

export type OfferStatus = 'sent' | 'accepted' | 'declined';

export interface IOffer extends Document {
    _id: Types.ObjectId;
    applicationId: Types.ObjectId;
    salary: string;
    position: string;
    offerLetterUrl: string;
    offerLetterCloudinaryId?: string;
    status: OfferStatus;
    createdAt: Date;
    updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
    {
        applicationId: {
            type: Schema.Types.ObjectId,
            ref: 'Application',
            required: true,
            unique: true,
            index: true,
        },
        salary: { type: String, required: true, trim: true },
        position: { type: String, required: true, trim: true },
        offerLetterUrl: { type: String, required: true, trim: true },
        offerLetterCloudinaryId: { type: String, trim: true },
        status: {
            type: String,
            enum: ['sent', 'accepted', 'declined'],
            default: 'sent',
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

OfferSchema.index({ createdAt: -1 });

export const Offer = mongoose.model<IOffer>('Offer', OfferSchema);