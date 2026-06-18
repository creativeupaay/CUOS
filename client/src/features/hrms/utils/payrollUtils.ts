import type { PayrollDeductions, SalaryPayoutAccountKey } from '../types/types';

export const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

export const PAYOUT_ACCOUNT_LABELS: Record<SalaryPayoutAccountKey, string> = {
    hdfc_gst: 'HDFC (GST)',
    sbi_non_gst: 'SBI (non GST)',
    cash: 'Cash in Company',
};

export const PAYOUT_ACCOUNT_OPTIONS = [
    { value: 'hdfc_gst', label: 'HDFC (GST)' },
    { value: 'sbi_non_gst', label: 'SBI (non GST)' },
    { value: 'cash', label: 'Cash in Company' },
] as const;

/**
 * Calculates the total deductions for a payroll record
 * Sums: pf + esi + tax + leaves + penalties + other
 */
export function calculateTotalDeductions(deductions?: Partial<PayrollDeductions>): number {
    if (!deductions) return 0;
    return (
        (deductions.pf || 0) +
        (deductions.esi || 0) +
        (deductions.tax || 0) +
        (deductions.leaves || 0) +
        (deductions.penalties || 0) +
        (deductions.other || 0)
    );
}
