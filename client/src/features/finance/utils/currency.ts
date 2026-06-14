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

export const formatShortCurrency = (value: number | string | undefined | null, currencyCode: string = 'INR'): string => {
    if (value === undefined || value === null) return '₹0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return '₹0';
    
    if (numValue >= 10000000) {
        return `₹${(numValue / 10000000).toFixed(2)} Cr`;
    }
    if (numValue >= 100000) {
        return `₹${(numValue / 100000).toFixed(2)} L`;
    }
    if (numValue >= 1000) {
        return `₹${(numValue / 1000).toFixed(1)} K`;
    }
    
    return formatCurrency(numValue, currencyCode);
};
