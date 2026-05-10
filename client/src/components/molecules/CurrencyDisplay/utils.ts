export const formatCurrencyINR = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const formatCurrencyCompact = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
    }).format(amount);
};
