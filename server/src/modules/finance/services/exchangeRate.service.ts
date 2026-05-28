import axios from 'axios';
import AppError from '../../../utils/appError';
import { ExchangeRate } from '../models/ExchangeRate.model';

type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
type ExchangeRateProvider = 'frankfurter' | 'manual' | 'stored';
type ExchangeRateSource = 'exact-provider' | 'exact-cache' | 'manual' | 'latest-known';

export interface ExchangeRateResult {
    base: SupportedCurrency;
    quote: 'INR';
    rate: number;
    date: Date;
    provider: ExchangeRateProvider;
    source: ExchangeRateSource;
    requestedDate: Date;
    fallbackUsed: boolean;
}

interface FrankfurterRateRow {
    date?: string;
    base?: string;
    quote?: string;
    rate?: number | string;
}

const API_BASE_URL = 'https://api.frankfurter.dev/v2';
const TARGET_CURRENCY = 'INR' as const;
const rateCache = new Map<string, ExchangeRateResult>();

const formatDateKey = (date: Date) => {
    const normalized = new Date(date);
    if (Number.isNaN(normalized.getTime())) {
        throw new AppError('Invalid exchange rate date', 400);
    }
    return normalized.toISOString().slice(0, 10);
};

const normalizeCurrency = (currency?: string): SupportedCurrency => {
    const code = String(currency || 'INR').toUpperCase();
    if (code === 'INR' || code === 'USD' || code === 'EUR' || code === 'GBP' || code === 'AED') {
        return code;
    }
    throw new AppError(`Unsupported currency for INR conversion: ${code}`, 400);
};

export class ExchangeRateService {
    private static async persistRate(result: ExchangeRateResult, source: 'exact-provider' | 'manual'): Promise<void> {
        if (result.base === TARGET_CURRENCY) return;

        await ExchangeRate.findOneAndUpdate(
            {
                base: result.base,
                quote: TARGET_CURRENCY,
                rateDate: result.date,
                source,
            },
            {
                $set: {
                    rate: result.rate,
                    provider: result.provider,
                    source,
                },
            },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    private static async getStoredExactRate(base: SupportedCurrency, dateKey: string): Promise<ExchangeRateResult | null> {
        const stored = await ExchangeRate.findOne({
            base,
            quote: TARGET_CURRENCY,
            rateDate: new Date(`${dateKey}T00:00:00.000Z`),
        }).sort({ source: 1, createdAt: -1 }).lean();

        if (!stored) return null;

        return {
            base,
            quote: TARGET_CURRENCY,
            rate: stored.rate,
            date: stored.rateDate,
            provider: stored.provider === 'manual' ? 'manual' : 'stored',
            source: 'exact-cache',
            requestedDate: new Date(`${dateKey}T00:00:00.000Z`),
            fallbackUsed: false,
        };
    }

    private static async getLatestStoredRate(base: SupportedCurrency, requestedDate: Date): Promise<ExchangeRateResult | null> {
        const stored = await ExchangeRate.findOne({
            base,
            quote: TARGET_CURRENCY,
        }).sort({ rateDate: -1, createdAt: -1 }).lean();

        if (!stored) return null;

        return {
            base,
            quote: TARGET_CURRENCY,
            rate: stored.rate,
            date: stored.rateDate,
            provider: stored.provider === 'manual' ? 'manual' : 'stored',
            source: 'latest-known',
            requestedDate,
            fallbackUsed: true,
        };
    }

    static async getRateToINR(
        currency: string | undefined,
        date: Date,
        options: { manualRate?: number; allowLatestFallback?: boolean } = {}
    ): Promise<ExchangeRateResult> {
        const base = normalizeCurrency(currency);
        const dateKey = formatDateKey(date);
        const requestedDate = new Date(`${dateKey}T00:00:00.000Z`);

        if (base === TARGET_CURRENCY) {
            return {
                base,
                quote: TARGET_CURRENCY,
                rate: 1,
                date: requestedDate,
                provider: 'stored',
                source: 'exact-cache',
                requestedDate,
                fallbackUsed: false,
            };
        }

        const manualRate = Number(options.manualRate || 0);
        if (Number.isFinite(manualRate) && manualRate > 0) {
            const result: ExchangeRateResult = {
                base,
                quote: TARGET_CURRENCY,
                rate: manualRate,
                date: requestedDate,
                provider: 'manual',
                source: 'manual',
                requestedDate,
                fallbackUsed: false,
            };
            await this.persistRate(result, 'manual');
            return result;
        }

        const cacheKey = `${dateKey}|${base}|${TARGET_CURRENCY}`;
        const cached = rateCache.get(cacheKey);
        if (cached) return cached;

        const storedExact = await this.getStoredExactRate(base, dateKey);
        if (storedExact) {
            rateCache.set(cacheKey, storedExact);
            return storedExact;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/rates`, {
                params: {
                    date: dateKey,
                    base,
                    quotes: TARGET_CURRENCY,
                },
                timeout: 8000,
            });

            const row = Array.isArray(response.data)
                ? response.data.find((item: FrankfurterRateRow) => String(item?.quote || '').toUpperCase() === TARGET_CURRENCY)
                : null;
            const legacyRate = !row && response.data?.rates ? response.data.rates[TARGET_CURRENCY] : undefined;
            const rate = Number(row?.rate ?? legacyRate);
            const responseDateKey = row?.date || response.data?.date || dateKey;
            const responseDate = new Date(`${responseDateKey}T00:00:00.000Z`);

            if (!Number.isFinite(rate) || rate <= 0) {
                throw new Error(`Missing ${base} to ${TARGET_CURRENCY} rate`);
            }

            const result: ExchangeRateResult = {
                base,
                quote: TARGET_CURRENCY,
                rate,
                date: responseDate,
                provider: 'frankfurter',
                source: 'exact-provider',
                requestedDate,
                fallbackUsed: false,
            };
            await this.persistRate(result, 'exact-provider');
            rateCache.set(cacheKey, result);
            return result;
        } catch (error: any) {
            if (options.allowLatestFallback) {
                const latest = await this.getLatestStoredRate(base, requestedDate);
                if (latest) return latest;
            }

            throw new AppError(
                `Unable to fetch ${base} to INR exchange rate for ${dateKey}: ${error?.message || 'Unknown FX error'}`,
                502,
                'FX_RATE_UNAVAILABLE',
                { currency: base, date: dateKey }
            );
        }
    }

    static async convertToINR(
        amount: number,
        currency: string | undefined,
        date: Date,
        options: { manualRate?: number; allowLatestFallback?: boolean } = {}
    ): Promise<ExchangeRateResult & { amountINR: number }> {
        const numericAmount = Number(amount || 0);
        if (!Number.isFinite(numericAmount) || numericAmount < 0) {
            throw new AppError('Amount must be a valid non-negative number', 400);
        }

        const rate = await this.getRateToINR(currency, date, options);
        return {
            ...rate,
            amountINR: Math.round(numericAmount * rate.rate * 100) / 100,
        };
    }
}
