import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAnnouncement extends Document {
    _id: Types.ObjectId;
    content: string;
    publishedBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
    {
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
        },
        publishedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

AnnouncementSchema.index({ createdAt: -1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
