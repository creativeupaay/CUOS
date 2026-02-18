import { CurrencyRate, ICurrencyRate } from '../models/CurrencyRate.model';
import AppError from '../../../utils/appError';

/**
 * Set/update a currency rate for a specific date
 */
export const setRate = async (
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    date: Date
): Promise<ICurrencyRate> => {
    const normalizedDate = new Date(date.toISOString().split('T')[0]); // Strip time

    const existing = await CurrencyRate.findOneAndUpdate(
        { fromCurrency, toCurrency, date: normalizedDate },
        { rate },
        { upsert: true, new: true, runValidators: true }
    );

    return existing;
};

/**
 * Get exchange rate for a currency pair on a specific date (or latest before date)
 */
export const getRate = async (
    fromCurrency: string,
    toCurrency: string,
    date?: Date
): Promise<number> => {
    if (fromCurrency === toCurrency) return 1;

    const targetDate = date || new Date();

    const rate = await CurrencyRate.findOne({
        fromCurrency,
        toCurrency,
        date: { $lte: targetDate },
    }).sort({ date: -1 });

    if (!rate) {
        // Try reverse pair
        const reverseRate = await CurrencyRate.findOne({
            fromCurrency: toCurrency,
            toCurrency: fromCurrency,
            date: { $lte: targetDate },
        }).sort({ date: -1 });

        if (reverseRate) return Math.round((1 / reverseRate.rate) * 10000) / 10000;

        throw new AppError(
            `No exchange rate found for ${fromCurrency} → ${toCurrency}`,
            404
        );
    }

    return rate.rate;
};

/**
 * Convert an amount between currencies
 */
export const convertAmount = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: Date
): Promise<{ convertedAmount: number; rate: number }> => {
    const rate = await getRate(fromCurrency, toCurrency, date);
    const convertedAmount = Math.round(amount * rate * 100) / 100;
    return { convertedAmount, rate };
};

/**
 * Get all rates for a currency pair (history)
 */
export const getRateHistory = async (
    fromCurrency: string,
    toCurrency: string,
    limit = 30
) => {
    const rates = await CurrencyRate.find({ fromCurrency, toCurrency })
        .sort({ date: -1 })
        .limit(limit);

    return rates;
};

/**
 * Get all latest rates (for a dashboard)
 */
export const getLatestRates = async (baseCurrency = 'INR') => {
    const rates = await CurrencyRate.aggregate([
        { $match: { toCurrency: baseCurrency } },
        { $sort: { date: -1 } },
        {
            $group: {
                _id: '$fromCurrency',
                rate: { $first: '$rate' },
                date: { $first: '$date' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return rates;
};
