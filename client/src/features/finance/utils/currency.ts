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

