import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Revenue } from '../modules/finance/models/Revenue.model';
import { Project } from '../modules/project/models/Project.model';
import { BankTransactionService } from '../modules/finance/services/bankTransaction.service';
import { ExchangeRateService } from '../modules/finance/services/exchangeRate.service';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

const roundMoney = (value: number) => Math.round(Number(value || 0) * 100) / 100;

async function backfillRevenueExchangeRates() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const candidates = await Revenue.find({
        currency: { $ne: 'INR' },
        $or: [
            { exchangeRate: { $in: [0, 1, null] } },
            { $expr: { $eq: ['$amountINR', '$amount'] } },
        ],
    });

    console.log(`Found ${candidates.length} suspicious non-INR revenue records`);

    let updated = 0;
    let skipped = 0;

    for (const revenue of candidates) {
        try {
            if (!revenue.date || !revenue.amount || !revenue.currency) {
                skipped += 1;
                console.log(`Skipped ${revenue._id}: missing date, amount, or currency`);
                continue;
            }

            const conversion = await ExchangeRateService.convertToINR(revenue.amount, revenue.currency, revenue.date);
            const gstApplicable = revenue.gstApplicable ?? true;
            const gstRate = revenue.gstRate || 18;
            const gst = gstApplicable ? roundMoney((conversion.amountINR * gstRate) / 100) : 0;
            const tdsDeducted = roundMoney(revenue.tdsDeducted || 0);
            const totalAmount = roundMoney(conversion.amountINR + gst - tdsDeducted);
            const oldReceivedAmount = Number(revenue.receivedAmount || 0);
            const receivedAmount = oldReceivedAmount > 0
                ? roundMoney(oldReceivedAmount * conversion.rate)
                : 0;

            revenue.exchangeRate = conversion.rate;
            revenue.exchangeRateDate = conversion.date;
            revenue.exchangeRateProvider = conversion.provider;
            revenue.amountINR = conversion.amountINR;
            revenue.gst = gst;
            revenue.totalAmount = totalAmount;
            revenue.receivedAmount = receivedAmount;
            revenue.pendingAmount = Math.max(0, roundMoney(totalAmount - receivedAmount));
            await revenue.save();

            if (revenue.projectId && revenue.phaseId) {
                const project = await Project.findById(revenue.projectId);
                const phase = project?.phases?.find((item: unknown) => (item as { _id?: { toString: () => string } })._id?.toString() === revenue.phaseId?.toString());

                if (project && phase) {
                    phase.paymentExpectedAmountINR = conversion.amountINR;
                    phase.paymentReceivedAmountINR = receivedAmount;
                    phase.paymentReceivedAmount = receivedAmount;
                    phase.paymentExchangeRate = conversion.rate;
                    phase.paymentExchangeRateDate = conversion.date;
                    phase.paymentSettlementCurrency = 'INR';
                    phase.paymentStatus = receivedAmount >= totalAmount ? 'received' : receivedAmount > 0 ? 'partial' : 'pending';

                    await project.save();

                    if (phase.bankTransactionId && receivedAmount > 0 && revenue.createdBy) {
                        await BankTransactionService.update(phase.bankTransactionId, {
                            amount: receivedAmount,
                            updatedBy: revenue.createdBy,
                        });
                    }
                }
            }

            updated += 1;
            console.log(`Updated ${revenue._id}: ${revenue.currency} ${revenue.amount} -> INR ${conversion.amountINR} @ ${conversion.rate}`);
        } catch (error: unknown) {
            skipped += 1;
            console.log(`Skipped ${revenue._id}: ${(error as Error)?.message || error}`);
        }
    }

    console.log(`Backfill complete. Updated: ${updated}. Skipped: ${skipped}.`);
    await mongoose.disconnect();
}

backfillRevenueExchangeRates().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
