import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmployeeDocument extends Document {
    _id: Types.ObjectId;
    employeeId: Types.ObjectId;
    type: 'aadhar' | 'pan' | 'passport' | 'offer-letter' | 'experience' | 'education' | 'other';
    name: string;
    cloudinaryId: string;
    cloudinaryUrl: string;
    isEncrypted: boolean;
    uploadedBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const EmployeeDocumentSchema = new Schema<IEmployeeDocument>(
    {
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['aadhar', 'pan', 'passport', 'offer-letter', 'experience', 'education', 'other'],
        },
        name: { type: String, required: true, trim: true },
        cloudinaryId: { type: String, required: true },
        cloudinaryUrl: { type: String, required: true },
        isEncrypted: { type: Boolean, default: true },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
EmployeeDocumentSchema.index({ employeeId: 1 });
EmployeeDocumentSchema.index({ type: 1 });

export const EmployeeDocument = mongoose.model<IEmployeeDocument>(
    'EmployeeDocument',
    EmployeeDocumentSchema
);
