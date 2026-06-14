export const formatCurrency = (value: number | string | undefined | null, currencyCode: string = 'INR'): string => {
    if (value === undefined || value === null) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(0);
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(0);
    
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
    }).format(numValue);
};

const getCurrencySymbol = (code: string) => {
    const parts = new Intl.NumberFormat('en-IN', { style: 'currency', currency: code }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value || '₹';
};

export const formatShortCurrency = (value: number | string | undefined | null, currencyCode: string = 'INR'): string => {
    const symbol = getCurrencySymbol(currencyCode);
    if (value === undefined || value === null) return `${symbol}0`;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return `${symbol}0`;
    
    if (numValue >= 10000000) {
        return `${symbol}${(numValue / 10000000).toFixed(2)} Cr`;
    }
    if (numValue >= 100000) {
        return `${symbol}${(numValue / 100000).toFixed(2)} L`;
    }
    if (numValue >= 1000) {
        return `${symbol}${(numValue / 1000).toFixed(1)} K`;
    }
    
    return formatCurrency(numValue, currencyCode);
};
