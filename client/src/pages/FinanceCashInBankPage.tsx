import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Building2,
    Calendar,
    CreditCard,
    Eye,
    IndianRupee,
    Landmark,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ModalPortal from '@/components/ui/ModalPortal';
import {
    useGetBankAccountsQuery,
    useCreateBankTransactionMutation,
    useDeleteBankTransactionMutation,
    useGetBankTransactionsQuery,
    useUpdateBankAccountMutation,
    useUpdateBankTransactionMutation,
} from '@/features/finance/api/financeApi';
import type {
    BankAccountKey,
    BankTransaction,
    BankTransactionType,
} from '@/features/finance/api/financeApi';

interface TransactionFormData {
    accountKey: BankAccountKey;
    transactionType: BankTransactionType;
    amount: number;
    date: string;
    description: string;
    referenceNumber: string;
    notes: string;
}

interface AccountFormData {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode: string;
    notes: string;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(value);

const formatCompactCurrency = (value: number) => {
    if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return formatCurrency(value);
};

const ACCOUNT_TABS: { key: BankAccountKey; label: string; subtitle: string; icon: typeof Landmark }[] = [
    { key: 'hdfc_gst', label: 'HDFC (GST)', subtitle: 'GST receipts account', icon: Landmark },
    { key: 'sbi_non_gst', label: 'SBI (non-GST)', subtitle: 'Non-GST receipts account', icon: Building2 },
    { key: 'cash', label: 'Cash in Company', subtitle: 'Cash in company', icon: Wallet },
];

const TYPE_OPTIONS: Array<{ value: 'all' | BankTransactionType; label: string }> = [
    { value: 'all', label: 'All Transactions' },
    { value: 'credit', label: 'Credit Only' },
    { value: 'debit', label: 'Debit Only' },
];

const EmptyState = ({ activeTabLabel }: { activeTabLabel: string }) => (
    <div className="rounded-2xl border border-dashed px-6 py-14 text-center" style={{ borderColor: '#D1D5DB', backgroundColor: 'white' }}>
        <Wallet size={42} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No transactions found in {activeTabLabel}</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Add your first manual transaction from the floating button below.</p>
    </div>
);

export default function FinanceCashInBankPage() {
    const today = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState<BankAccountKey>('hdfc_gst');
    const [hoveredAccountKey, setHoveredAccountKey] = useState<BankAccountKey | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
    const [editingAccountKey, setEditingAccountKey] = useState<BankAccountKey | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | BankTransactionType>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [limit, setLimit] = useState(15);

    useEffect(() => {
        setLimit(15);
    }, [activeTab, searchQuery, transactionTypeFilter, startDate, endDate]);

    const [formData, setFormData] = useState<TransactionFormData>({
        accountKey: activeTab,
        transactionType: 'credit',
        amount: 0,
        date: today,
        description: '',
        referenceNumber: '',
        notes: '',
    });
    const [accountFormData, setAccountFormData] = useState<AccountFormData>({
        accountName: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        swiftCode: '',
        notes: '',
    });

    const bankAccountsQuery = useGetBankAccountsQuery();
    const summaryQuery = useGetBankTransactionsQuery({
        transactionType: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 1,
    });

    const transactionsQuery = useGetBankTransactionsQuery({
        accountKey: activeTab,
        transactionType: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
        search: searchQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit,
    });

    const [createBankTransaction, { isLoading: isCreating }] = useCreateBankTransactionMutation();
    const [updateBankTransaction, { isLoading: isUpdating }] = useUpdateBankTransactionMutation();
    const [updateBankAccount, { isLoading: isUpdatingAccount }] = useUpdateBankAccountMutation();
    const [deleteBankTransaction] = useDeleteBankTransactionMutation();

    const bankAccounts = bankAccountsQuery.data?.data || [];
    const summary = summaryQuery.data?.data?.summary;
    const transactions = transactionsQuery.data?.data?.transactions || [];
    const activeTabMeta = ACCOUNT_TABS.find((tab) => tab.key === activeTab) || ACCOUNT_TABS[0];

    const metricCards = useMemo(() => ([
        {
            label: 'Total Cash in Bank',
            value: formatCompactCurrency(summary?.totalCashInBank || 0),
            fullValue: formatCurrency(summary?.totalCashInBank || 0),
            icon: Wallet,
            color: '#0EA5E9',
            bg: '#F0F9FF',
        },
        {
            label: 'Total Credit',
            value: formatCompactCurrency(summary?.totalCredit || 0),
            fullValue: formatCurrency(summary?.totalCredit || 0),
            icon: ArrowDownLeft,
            color: '#16A34A',
            bg: '#F0FDF4',
        },
        {
            label: 'Total Debit',
            value: formatCompactCurrency(summary?.totalDebit || 0),
            fullValue: formatCurrency(summary?.totalDebit || 0),
            icon: ArrowUpRight,
            color: '#DC2626',
            bg: '#FEF2F2',
        },
    ]), [summary]);

    const getAccountDetail = (accountKey: BankAccountKey) => {
        return bankAccounts.find((account) => {
            if (account.accountKey) {
                return account.accountKey === accountKey;
            }
            if (accountKey === 'hdfc_gst') return account.accountName === 'HDFC (GST)' || account.bankName === 'HDFC';
            if (accountKey === 'sbi_non_gst') return account.accountName === 'SBI (non-GST)' || account.bankName === 'SBI';
            return account.accountType === 'cash' || account.accountName === 'Cash in Company';
        });
    };

    const openCreateModal = () => {
        setEditingTransaction(null);
        setFormData({
            accountKey: activeTab,
            transactionType: 'credit',
            amount: 0,
            date: today,
            description: '',
            referenceNumber: '',
            notes: '',
        });
        setShowAddModal(true);
    };

    const openEditModal = (transaction: BankTransaction) => {
        setEditingTransaction(transaction);
        setFormData({
            accountKey: transaction.accountKey,
            transactionType: transaction.transactionType,
            amount: transaction.amount,
            date: transaction.date.split('T')[0],
            description: transaction.description,
            referenceNumber: transaction.referenceNumber || '',
            notes: transaction.notes || '',
        });
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditingTransaction(null);
    };

    const openAccountModal = (accountKey: BankAccountKey) => {
        const account = getAccountDetail(accountKey);
        setEditingAccountKey(accountKey);
        setAccountFormData({
            accountName: account?.accountName || '',
            bankName: account?.bankName || '',
            accountNumber: account?.accountNumber || '',
            ifscCode: account?.ifscCode || '',
            swiftCode: account?.swiftCode || '',
            notes: account?.notes || '',
        });
        setShowAccountModal(true);
    };

    const closeAccountModal = () => {
        setShowAccountModal(false);
        setEditingAccountKey(null);
    };

    const handleSubmit = async () => {
        if (!formData.description.trim() || !formData.date || formData.amount <= 0) {
            return;
        }

        const payload = {
            ...formData,
            amount: Number(formData.amount),
        };

        try {
            if (editingTransaction) {
                await updateBankTransaction({ id: editingTransaction._id, ...payload }).unwrap();
            } else {
                await createBankTransaction(payload).unwrap();
            }
            closeModal();
        } catch (error) {
            console.error('Failed to save bank transaction:', error);
        }
    };

    const handleDelete = async (transactionId: string) => {
        if (!window.confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            await deleteBankTransaction(transactionId).unwrap();
        } catch (error) {
            console.error('Failed to delete bank transaction:', error);
        }
    };

    const handleAccountUpdate = async () => {
        if (!editingAccountKey || !accountFormData.accountName.trim() || !accountFormData.bankName.trim()) {
            return;
        }

        try {
            await updateBankAccount({
                accountKey: editingAccountKey,
                ...accountFormData,
            }).unwrap();
            closeAccountModal();
        } catch (error) {
            console.error('Failed to update bank account:', error);
        }
    };

    const isMutating = isCreating || isUpdating;
    const isInitialLoading = summaryQuery.isLoading || transactionsQuery.isLoading || bankAccountsQuery.isLoading;

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <Link to="/finance" className="transition-colors hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                    Finance Dashboard
                </Link>
                <span>{'>'}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Cash in Bank</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Cash in Bank</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Manage company balances and transactions across bank and cash accounts.
                    </p>
                </div>

                <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative sm:col-span-2 xl:col-span-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search transactions"
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <select
                        value={transactionTypeFilter}
                        onChange={(event) => setTransactionTypeFilter(event.target.value as 'all' | BankTransactionType)}
                        className="rounded-xl border px-3 py-2.5 text-sm"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                    >
                        {TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {metricCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-xl border p-4"
                        style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: card.bg }}>
                                <card.icon size={20} style={{ color: card.color }} />
                            </div>
                        </div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                        <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }} title={card.fullValue}>{card.value}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <IndianRupee size={14} />
                            {card.fullValue}
                        </div>
                    </div>
                ))}
            </div>

            <section className="rounded-xl border p-3" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Accounts</h2>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Switch between your tracked cash sources.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {ACCOUNT_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const balance = summary?.accountBalances?.[tab.key] || 0;
                        const canViewAccountDetails = tab.key !== 'cash';
                        const isActive = tab.key === activeTab;
                        const accountDetail = getAccountDetail(tab.key);

                        return (
                            <div
                                key={tab.key}
                                role="button"
                                tabIndex={0}
                                onClick={() => setActiveTab(tab.key)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setActiveTab(tab.key);
                                    }
                                }}
                                className="flex items-start justify-between rounded-xl border px-4 py-3 text-left transition-all cursor-pointer"
                                style={{
                                    backgroundColor: isActive ? 'var(--color-primary)' : 'white',
                                    color: isActive ? 'white' : 'var(--color-text-primary)',
                                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-default)',
                                }}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.14)' : '#F3F4F6' }}>
                                            <Icon size={16} />
                                        </span>
                                        {tab.label}
                                    </div>
                                    <p className="mt-2 max-w-[16rem] text-xs leading-5" style={{ color: isActive ? 'rgba(255,255,255,0.74)' : 'var(--color-text-muted)' }}>{tab.subtitle}</p>
                                </div>
                                <div className="ml-3 flex shrink-0 items-start gap-2">
                                    <div className="text-right">
                                        <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: isActive ? 'rgba(255,255,255,0.70)' : '#9CA3AF' }}>Balance</p>
                                        <p className="mt-1 text-sm font-semibold">{formatCompactCurrency(balance)}</p>
                                    </div>
                                    {canViewAccountDetails && (
                                        <div
                                            className="relative"
                                            onMouseEnter={() => setHoveredAccountKey(tab.key)}
                                            onMouseLeave={() => setHoveredAccountKey((current) => (current === tab.key ? null : current))}
                                        >
                                            <button
                                                type="button"
                                                onClick={(event) => event.stopPropagation()}
                                                className="rounded-lg border p-2"
                                                style={{
                                                    borderColor: isActive ? 'rgba(255,255,255,0.18)' : '#E5E7EB',
                                                    backgroundColor: isActive ? 'rgba(255,255,255,0.10)' : 'white',
                                                    color: isActive ? 'white' : '#4B5563',
                                                }}
                                                aria-label={`View ${tab.label} account details`}
                                            >
                                                <Eye size={14} />
                                            </button>

                                            {hoveredAccountKey === tab.key && (
                                                <div className="absolute right-0 top-full z-20 pt-1" onClick={(event) => event.stopPropagation()}>
                                                    <div className="h-2 w-full" />
                                                    <div
                                                        className="w-72 rounded-xl border p-4 text-left shadow-xl"
                                                        style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}
                                                    >
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{accountDetail?.accountName || tab.label}</p>
                                                        <div className="mt-3 space-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                            <div className="flex justify-between gap-3">
                                                                <span>Bank</span>
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{accountDetail?.bankName || '—'}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-3">
                                                                <span>Account No.</span>
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{accountDetail?.accountNumber || '—'}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-3">
                                                                <span>IFSC</span>
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{accountDetail?.ifscCode || '—'}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-3">
                                                                <span>Balance</span>
                                                                <span style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(balance)}</span>
                                                            </div>
                                                        </div>
                                                        {accountDetail?.notes && (
                                                            <p className="mt-3 text-xs leading-5" style={{ color: 'var(--color-text-muted)' }}>{accountDetail.notes}</p>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setHoveredAccountKey(null);
                                                                openAccountModal(tab.key);
                                                            }}
                                                            className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
                                                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: '#F9FAFB' }}
                                                        >
                                                            <Pencil size={13} />
                                                            Edit Account
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{activeTabMeta.label} Transactions</h2>
                        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Showing manual entries for the selected account{transactionTypeFilter !== 'all' ? ` (${transactionTypeFilter})` : ''}.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#F8FAFC', color: '#475569' }}>
                            <CreditCard size={14} />
                            {transactionsQuery.data?.data?.total || 0} transactions
                        </div>
                        {(startDate || endDate || transactionTypeFilter !== 'all') && (
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                Filtered View
                            </div>
                        )}
                    </div>
                </div>

                {isInitialLoading ? (
                    <div className="flex items-center justify-center px-6 py-16">
                        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-5">
                        <EmptyState activeTabLabel={activeTabMeta.label} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y" style={{ divideColor: 'var(--color-border-default)' } as CSSProperties}>
                            <thead style={{ backgroundColor: '#F9FAFB' }}>
                                <tr>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Date</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Description</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Type</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Reference</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Amount</th>
                                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((transaction) => {
                                    const isCredit = transaction.transactionType === 'credit';
                                    return (
                                        <tr key={transaction._id} className="border-t transition-colors hover:bg-slate-50/70" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <td className="px-5 py-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {new Date(transaction.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{transaction.description}</p>
                                                {transaction.notes && (
                                                    <p className="mt-1 max-w-md text-xs leading-5" style={{ color: 'var(--color-text-muted)' }}>{transaction.notes}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: isCredit ? '#ECFDF5' : '#FEF2F2',
                                                        color: isCredit ? '#166534' : '#B91C1C',
                                                    }}
                                                >
                                                    {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                                    {isCredit ? 'Credit' : 'Debit'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm" style={{ color: '#64748B' }}>{transaction.referenceNumber || '—'}</td>
                                            <td className="px-5 py-4 text-right text-sm font-semibold" style={{ color: isCredit ? '#166534' : '#B91C1C' }}>
                                                {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(transaction)}
                                                        className="rounded-lg border p-2 transition-colors hover:bg-slate-50"
                                                        style={{ borderColor: 'var(--color-border-default)', color: '#334155' }}
                                                        aria-label="Edit transaction"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(transaction._id)}
                                                        className="rounded-lg border p-2 transition-colors hover:bg-red-50"
                                                        style={{ borderColor: '#FECACA', color: '#DC2626' }}
                                                        aria-label="Delete transaction"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {transactionsQuery.data?.data?.total !== undefined && transactions.length < transactionsQuery.data.data.total && (
                            <div className="flex justify-center p-6 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button
                                    type="button"
                                    onClick={() => setLimit(prev => prev + 15)}
                                    className="px-5 py-2.5 text-sm font-semibold transition-colors rounded-full"
                                    style={{ backgroundColor: '#EEF2FF', color: '#4338CA' }}
                                >
                                    Show More
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {typeof document !== 'undefined' && createPortal(
                <button
                    type="button"
                    onClick={openCreateModal}
                    className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] z-50"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                    <Plus size={18} />
                    Add Transaction
                </button>,
                document.body
            )}

            {showAddModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-2xl rounded-2xl border shadow-2xl" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: '#111827' }}>
                                        {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
                                    </h3>
                                    <p className="mt-1 text-sm" style={{ color: '#6B7280' }}>
                                        {editingTransaction ? 'Update the selected transaction details.' : `New transaction will open for ${activeTabMeta.label} by default.`}
                                    </p>
                                </div>
                                <button type="button" onClick={closeModal} className="rounded-lg p-2 hover:bg-slate-50" style={{ color: '#6B7280' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Account</label>
                                    <select
                                        value={formData.accountKey}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, accountKey: event.target.value as BankAccountKey }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    >
                                        {ACCOUNT_TABS.map((tab) => (
                                            <option key={tab.key} value={tab.key}>{tab.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Transaction Type</label>
                                    <select
                                        value={formData.transactionType}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, transactionType: event.target.value as BankTransactionType }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    >
                                        <option value="credit">Credit</option>
                                        <option value="debit">Debit</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Amount</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.amount || ''}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                        placeholder="Enter transaction description"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Reference Number</label>
                                    <input
                                        type="text"
                                        value={formData.referenceNumber}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Notes</label>
                                    <input
                                        type="text"
                                        value={formData.notes}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                                        className="w-full rounded-2xl border px-4 py-3 text-sm"
                                        style={{ borderColor: '#E5EAF1', backgroundColor: '#FCFDFE', color: '#111827' }}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-xl border px-4 py-2 text-sm font-medium"
                                    style={{ borderColor: 'var(--color-border-default)', color: '#374151' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isMutating || !formData.description.trim() || formData.amount <= 0 || !formData.date}
                                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                                >
                                    {isMutating && <Loader2 size={16} className="animate-spin" />}
                                    {editingTransaction ? 'Save Changes' : 'Add Transaction'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {showAccountModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-xl rounded-2xl border shadow-2xl" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Account Details</h3>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        Update the selected account information used in Cash in Bank.
                                    </p>
                                </div>
                                <button type="button" onClick={closeAccountModal} className="rounded-lg p-2 hover:bg-slate-50" style={{ color: '#6B7280' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Account Name</label>
                                    <input
                                        type="text"
                                        value={accountFormData.accountName}
                                        onChange={(event) => setAccountFormData((prev) => ({ ...prev, accountName: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Bank Name</label>
                                    <input
                                        type="text"
                                        value={accountFormData.bankName}
                                        onChange={(event) => setAccountFormData((prev) => ({ ...prev, bankName: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Account Number</label>
                                    <input
                                        type="text"
                                        value={accountFormData.accountNumber}
                                        onChange={(event) => setAccountFormData((prev) => ({ ...prev, accountNumber: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>IFSC Code</label>
                                    <input
                                        type="text"
                                        value={accountFormData.ifscCode}
                                        onChange={(event) => setAccountFormData((prev) => ({ ...prev, ifscCode: event.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm font-medium" style={{ color: '#374151' }}>Notes</label>
                                    <textarea
                                        value={accountFormData.notes}
                                        onChange={(event) => setAccountFormData((prev) => ({ ...prev, notes: event.target.value }))}
                                        rows={3}
                                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: '#111827' }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button
                                    type="button"
                                    onClick={closeAccountModal}
                                    className="rounded-xl border px-4 py-2 text-sm font-medium"
                                    style={{ borderColor: 'var(--color-border-default)', color: '#374151' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAccountUpdate}
                                    disabled={isUpdatingAccount || !accountFormData.accountName.trim() || !accountFormData.bankName.trim()}
                                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                                >
                                    {isUpdatingAccount && <Loader2 size={16} className="animate-spin" />}
                                    Save Account
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}
