import { useMemo } from 'react';
import { TrendingUp, IndianRupee, Clock, Receipt } from 'lucide-react';
import type { Revenue } from '../api/financeApi';
import type { MetricCard } from '@/components/organisms/finance/MetricCardSet';

export const useRevenueMetrics = (revenues: Revenue[]): MetricCard[] => {
    return useMemo(() => {
        const totalRevenue = revenues.reduce((acc, e) => acc + (e.totalAmount || e.amountINR || e.amount || 0), 0);
        const received = revenues.reduce((acc, e) => acc + (e.receivedAmount || 0), 0);
        const pending = revenues.reduce((acc, e) => {
            const total = e.totalAmount || e.amountINR || e.amount || 0;
            const received = e.receivedAmount || 0;
            return acc + (total - received);
        }, 0);
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
                label: 'Pending', 
                amount: pending, 
                icon: Clock, 
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
