import { useMemo } from 'react';
import { TrendingUp, IndianRupee, Wallet, Receipt } from 'lucide-react';
import type { Revenue } from '../api/financeApi';
import type { MetricCard } from '@/components/organisms/finance/MetricCardSet';

export const useRevenueMetrics = (revenues: Revenue[]): MetricCard[] => {
    return useMemo(() => {
        // Total Revenue = Gross Billed (Base + GST)
        const totalRevenue = revenues.reduce((acc, e) => acc + (e.totalAmount ?? (e.amountINR || e.amount || 0) + (e.gst || 0)), 0);
        
        // Received = Actual money received
        const received = revenues.reduce((acc, e) => acc + (e.receivedAmount || 0), 0);
        
        // FX/Bank Charges Deduction = Sum of fxFeesINR (Amount Difference Detected)
        const fxDeductions = revenues.reduce((acc, e) => acc + (e.fxFeesINR || 0), 0);
        
        const gstCollected = revenues
            .filter((e) => e.status === 'received')
            .reduce((acc, e) => acc + (e.gst || 0), 0);

        return [
            {
                label: 'Total Revenue',
                amount: totalRevenue,
                icon: TrendingUp,
                iconColor: 'text-green-500',
                iconBg: 'bg-green-50'
            },
            {
                label: 'Received',
                amount: received,
                icon: IndianRupee,
                iconColor: 'text-indigo-500',
                iconBg: 'bg-indigo-50'
            },
            {
                label: 'FX/Bank Charges Deduction',
                amount: fxDeductions,
                icon: Wallet,
                iconColor: 'text-amber-500',
                iconBg: 'bg-amber-50'
            },
            {
                label: 'GST Collected',
                amount: gstCollected,
                icon: Receipt,
                iconColor: 'text-sky-500',
                iconBg: 'bg-sky-50'
            },
        ];
    }, [revenues]);
};
