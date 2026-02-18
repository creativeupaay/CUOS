import mongoose, { Schema, Document } from 'mongoose';

export interface ICurrencyRate extends Document {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}

const CurrencyRateSchema = new Schema<ICurrencyRate>(
    {
        fromCurrency: { type: String, required: true, trim: true, uppercase: true },
        toCurrency: { type: String, required: true, trim: true, uppercase: true },
        rate: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true },
    },
    { timestamps: true }
);

// Unique rate per currency pair per day
CurrencyRateSchema.index(
    { fromCurrency: 1, toCurrency: 1, date: 1 },
    { unique: true }
);
CurrencyRateSchema.index({ date: -1 });

export const CurrencyRate = mongoose.model<ICurrencyRate>('CurrencyRate', CurrencyRateSchema);
