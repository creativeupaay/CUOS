import mongoose, { Schema, Document, Types } from 'mongoose';

export type ExchangeRateSource = 'exact-provider' | 'manual';

export interface IExchangeRate extends Document {
    _id: Types.ObjectId;
    base: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    quote: 'INR';
    rate: number;
    rateDate: Date;
    provider: string;
    source: ExchangeRateSource;
    createdAt: Date;
    updatedAt: Date;
}

const ExchangeRateSchema = new Schema<IExchangeRate>(
    {
        base: {
            type: String,
            enum: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
            required: true,
        },
        quote: {
            type: String,
            enum: ['INR'],
            required: true,
            default: 'INR',
        },
        rate: { type: Number, required: true, min: 0 },
        rateDate: { type: Date, required: true },
        provider: { type: String, required: true, trim: true },
        source: {
            type: String,
            enum: ['exact-provider', 'manual'],
            required: true,
        },
    },
    { timestamps: true }
);

ExchangeRateSchema.index({ base: 1, quote: 1, rateDate: 1, source: 1 }, { unique: true });
ExchangeRateSchema.index({ base: 1, quote: 1, rateDate: -1, createdAt: -1 });

export const ExchangeRate = mongoose.model<IExchangeRate>('ExchangeRate', ExchangeRateSchema);
