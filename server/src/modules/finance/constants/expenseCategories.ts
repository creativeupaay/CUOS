export const EXPENSE_CATEGORIES = [
    'Salaries',
    'Rent',
    'Utilities & Bills',
    'Cloud Services',
    'Software Licenses',
    'Marketing',
    'HR & Culture',
    'Food & Party',
    'Travel',
    'Office Expense & Supplies',
    'Professional Services',
    'Legal & Compliance',
    'GST Payment',
    'TDS Payment',
    'Tax Payment',
    'Reimbursements',
    'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
