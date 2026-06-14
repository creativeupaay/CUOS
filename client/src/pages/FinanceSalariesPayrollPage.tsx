import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Briefcase,
    Building2,
    Check,
    CreditCard,
    ChevronDown,
    IndianRupee,
    Landmark,
    Loader2,
    Plus,
    Receipt,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import {
    useCreateSalaryMutation,
    useGenerateBulkPayrollMutation,
    useGeneratePayrollMutation,
    useGetEmployeesQuery,
    useGetPayrollsQuery,
    useGetSalariesQuery,
    useUpdatePayrollMutation,
    useUpdatePayrollStatusMutation,
    useUpdateSalaryMutation,
} from '@/features/hrms/hrmsApi';
import { formatCurrency } from '@/features/finance/utils/currency';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAYOUT_ACCOUNT_OPTIONS = [
    { value: 'hdfc_gst', label: 'HDFC (GST)', icon: Landmark },
    { value: 'sbi_non_gst', label: 'SBI (non GST)', icon: Building2 },
    { value: 'cash', label: 'Cash in Company', icon: Wallet },
] as const;

type PayoutAccountKey = (typeof PAYOUT_ACCOUNT_OPTIONS)[number]['value'];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: '#FEF9C3', color: '#92400E', label: 'Draft' },
    approved: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Approved' },
    paid: { bg: '#D1FAE5', color: '#059669', label: 'Paid' },
};

// Currency Formatters imported from @/features/finance/utils/currency

const buildPayDate = (month: number, year: number) => new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];

export default function FinanceSalariesPayrollPage() {
    const currentDate = new Date();
    const defaultPayrollDate = new Date(currentDate);
    defaultPayrollDate.setMonth(defaultPayrollDate.getMonth() - 1);
    const defaultPayrollMonth = defaultPayrollDate.getMonth() + 1;
    const defaultPayrollYear = defaultPayrollDate.getFullYear();

    const [month, setMonth] = useState(defaultPayrollMonth);
    const [year, setYear] = useState(defaultPayrollYear);
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showGenerateAllModal, setShowGenerateAllModal] = useState(false);
    const [showPayrollEditModal, setShowPayrollEditModal] = useState(false);
    const [showSalaryStructures, setShowSalaryStructures] = useState(false);
    const [editingSalary, setEditingSalary] = useState<any | null>(null);
    const [editingPayroll, setEditingPayroll] = useState<any | null>(null);
    const [salaryForm, setSalaryForm] = useState({
        employeeId: '',
        basic: 0,
        specialAllowance: 0,
        payoutAccountKey: 'hdfc_gst' as PayoutAccountKey,
        effectiveFrom: new Date().toISOString().split('T')[0],
    });
    const [genForm, setGenForm] = useState({
        employeeId: '',
        month: defaultPayrollMonth,
        year: defaultPayrollYear,
        payDate: buildPayDate(defaultPayrollMonth, defaultPayrollYear),
    });
    const [bulkForm, setBulkForm] = useState({
        month: defaultPayrollMonth,
        year: defaultPayrollYear,
        payDate: buildPayDate(defaultPayrollMonth, defaultPayrollYear),
    });
    const [payrollEditForm, setPayrollEditForm] = useState({
        incentiveAmount: 0,
        payoutAccountKey: 'hdfc_gst' as PayoutAccountKey,
        tax: 0,
        other: 0,
    });

    const { data: salaryData, isLoading: isLoadingSalaries } = useGetSalariesQuery({ page: 1, limit: 200 });
    const { data: payrollData, isLoading: isLoadingPayrolls } = useGetPayrollsQuery({ month, year, page: 1 });
    const { data: employeeData } = useGetEmployeesQuery({ limit: 200 });
    const [createSalary, { isLoading: isCreatingSalary }] = useCreateSalaryMutation();
    const [updateSalary, { isLoading: isUpdatingSalary }] = useUpdateSalaryMutation();
    const [generatePayroll, { isLoading: isGeneratingSingle }] = useGeneratePayrollMutation();
    const [generateBulkPayroll, { isLoading: isGeneratingBulk }] = useGenerateBulkPayrollMutation();
    const [updatePayroll, { isLoading: isUpdatingPayroll }] = useUpdatePayrollMutation();
    const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdatePayrollStatusMutation();

    const salaries = salaryData?.data?.salaries || [];
    const payrolls = payrollData?.data?.payrolls || [];
    const employees = employeeData?.data?.employees || [];

    const metrics = useMemo(() => ({
        employeesWithSalary: salaries.length,
        payrollGenerated: payrolls.length,
        totalNetSalary: payrolls.reduce((sum, item) => sum + item.netSalary, 0),
        totalGrossSalary: payrolls.reduce((sum, item) => sum + item.grossSalary, 0),
    }), [payrolls, salaries.length]);

    const openCreateSalaryModal = () => {
        setEditingSalary(null);
        setSalaryForm({
            employeeId: '',
            basic: 0,
            specialAllowance: 0,
            payoutAccountKey: 'hdfc_gst',
            effectiveFrom: new Date().toISOString().split('T')[0],
        });
        setShowSalaryModal(true);
    };

    const openEditSalaryModal = (salary: any) => {
        setEditingSalary(salary);
        setSalaryForm({
            employeeId: typeof salary.employeeId === 'object' ? salary.employeeId._id : salary.employeeId,
            basic: salary.basic || 0,
            specialAllowance: salary.specialAllowance || 0,
            payoutAccountKey: salary.payoutAccountKey || 'hdfc_gst',
            effectiveFrom: salary.effectiveFrom?.split('T')[0] || new Date().toISOString().split('T')[0],
        });
        setShowSalaryModal(true);
    };

    const handleSaveSalary = async (event: React.FormEvent) => {
        event.preventDefault();

        const payload = {
            employeeId: salaryForm.employeeId,
            basic: Number(salaryForm.basic),
            specialAllowance: Number(salaryForm.specialAllowance),
            payoutAccountKey: salaryForm.payoutAccountKey,
            effectiveFrom: salaryForm.effectiveFrom,
            currency: 'INR',
        };

        if (editingSalary) {
            await updateSalary({ id: editingSalary._id, data: payload }).unwrap();
        } else {
            await createSalary(payload).unwrap();
        }

        setShowSalaryModal(false);
    };

    const handleGenerateSingle = async (event: React.FormEvent) => {
        event.preventDefault();
        await generatePayroll(genForm).unwrap();
        setShowGenerateModal(false);
    };

    const handleGenerateAll = async (event: React.FormEvent) => {
        event.preventDefault();
        await generateBulkPayroll(bulkForm).unwrap();
        setMonth(bulkForm.month);
        setYear(bulkForm.year);
        setShowGenerateAllModal(false);
    };

    const openPayrollEditModal = (payroll: any) => {
        setEditingPayroll(payroll);
        setPayrollEditForm({
            incentiveAmount: payroll.incentiveAmount || 0,
            payoutAccountKey: payroll.payoutAccountKey || 'hdfc_gst',
            tax: payroll.deductions?.tax || 0,
            other: payroll.deductions?.other || 0,
        });
        setShowPayrollEditModal(true);
    };

    const handleSavePayrollEdit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingPayroll) return;

        await updatePayroll({
            id: editingPayroll._id,
            data: {
                incentiveAmount: Number(payrollEditForm.incentiveAmount),
                payoutAccountKey: payrollEditForm.payoutAccountKey,
                deductions: {
                    tax: Number(payrollEditForm.tax),
                    other: Number(payrollEditForm.other),
                },
            },
        }).unwrap();

        setShowPayrollEditModal(false);
        setEditingPayroll(null);
    };

    const metricCards = [
        { label: 'Salary Structures', value: metrics.employeesWithSalary, icon: Users, bg: '#EFF6FF', color: '#2563EB' },
        { label: 'Payroll Entries', value: metrics.payrollGenerated, icon: Receipt, bg: '#ECFDF5', color: '#059669' },
        { label: 'Gross Payroll', value: formatCurrency(metrics.totalGrossSalary), icon: IndianRupee, bg: '#FFFBEB', color: '#D97706' },
        { label: 'Net Payout', value: formatCurrency(metrics.totalNetSalary), icon: Briefcase, bg: '#F5F3FF', color: '#7C3AED' },
    ];

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <Link to="/finance" className="transition-colors hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                    Finance Dashboard
                </Link>
                <span>{'>'}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Salaries & Payrolls</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Salaries & Payrolls</h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Finance view of HRMS salary structures and payroll payouts. All changes stay synced with HRMS.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            const nextGenMonth = defaultPayrollMonth;
                            const nextGenYear = defaultPayrollYear;
                            setGenForm({
                                employeeId: '',
                                month: nextGenMonth,
                                year: nextGenYear,
                                payDate: buildPayDate(nextGenMonth, nextGenYear),
                            });
                            setShowGenerateModal(true);
                        }}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                    >
                        <Plus size={15} />
                        Generate Single
                    </button>
                    <button
                        onClick={() => {
                            setBulkForm({ month, year, payDate: buildPayDate(month, year) });
                            setShowGenerateAllModal(true);
                        }}
                        disabled={isGeneratingBulk}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
                    >
                        {isGeneratingBulk ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
                        Generate All
                    </button>
                    <button
                        onClick={openCreateSalaryModal}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
                    >
                        <Briefcase size={15} />
                        Add Salary
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {metricCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
                                    <div className="mt-2 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{card.value}</div>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: card.bg, color: card.color }}>
                                    <Icon size={20} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-6">
                <section className="rounded-2xl border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}>
                    <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Payroll Ledger</h2>
                                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    Salary period is tracked by payroll month. Example: payment on 1 April 2026 should be generated as March 2026 payroll.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={month}
                                    onChange={(event) => setMonth(Number(event.target.value))}
                                    className="rounded-xl border px-3 py-2 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                                </select>
                                <select
                                    value={year}
                                    onChange={(event) => setYear(Number(event.target.value))}
                                    className="rounded-xl border px-3 py-2 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    {Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index).map((optionYear) => (
                                        <option key={optionYear} value={optionYear}>{optionYear}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                    {['Employee', 'Payable', 'Gross', 'Bonus', 'Net', 'Paid From', 'Pay Date', 'Status', ''].map((header) => (
                                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isLoadingPayrolls ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            <Loader2 size={16} className="mx-auto mb-2 animate-spin" />
                                            Loading payroll...
                                        </td>
                                    </tr>
                                ) : payrolls.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            No payroll entries for {MONTHS[month - 1]} {year}.
                                        </td>
                                    </tr>
                                ) : payrolls.map((payroll) => {
                                    const statusMeta = STATUS_STYLE[payroll.status] || STATUS_STYLE.draft;
                                    return (
                                        <tr key={payroll._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {typeof payroll.employeeId === 'object' ? (payroll.employeeId as any)?.userId?.name || 'Employee' : 'Employee'}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{payroll.payableDays}/30 days</td>
                                            <td className="px-4 py-3 text-sm">{formatCurrency(payroll.grossSalary)}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: payroll.incentiveAmount > 0 ? '#059669' : 'var(--color-text-secondary)' }}>
                                                {formatCurrency(payroll.incentiveAmount || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(payroll.netSalary)}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {PAYOUT_ACCOUNT_OPTIONS.find((option) => option.value === payroll.payoutAccountKey)?.label || 'HDFC (GST)'}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {payroll.payDate ? new Date(payroll.payDate).toLocaleDateString('en-IN') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => openPayrollEditModal(payroll)}
                                                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                                    >
                                                        Edit
                                                    </button>
                                                    {payroll.status === 'draft' && (
                                                        <button
                                                            onClick={() => updateStatus({ id: payroll._id, data: { status: 'approved' } })}
                                                            disabled={isUpdatingStatus}
                                                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                                            style={{ backgroundColor: '#2563EB' }}
                                                        >
                                                            <Check size={12} />
                                                            Approve
                                                        </button>
                                                    )}
                                                    {payroll.status === 'approved' && (
                                                        <button
                                                            onClick={() => updateStatus({ id: payroll._id, data: { status: 'paid' } })}
                                                            disabled={isUpdatingStatus}
                                                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                                            style={{ backgroundColor: '#059669' }}
                                                        >
                                                            <CreditCard size={12} />
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="rounded-2xl border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}>
                    <button
                        type="button"
                        onClick={() => setShowSalaryStructures((current) => !current)}
                        className="flex w-full items-center justify-between gap-4 border-b px-5 py-4 text-left"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Salary Structures</h2>
                                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                                    {salaries.length}
                                </span>
                            </div>
                            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Folded by default so the payroll ledger stays in focus.
                            </p>
                        </div>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                            <ChevronDown size={16} className={`transition-transform ${showSalaryStructures ? 'rotate-180' : ''}`} />
                        </span>
                    </button>
                    {showSalaryStructures ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                        {['Employee', 'Basic', 'Special', 'Gross', 'Paid From', 'Effective', ''].map((header) => (
                                            <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingSalaries ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                <Loader2 size={16} className="mx-auto mb-2 animate-spin" />
                                                Loading salary structures...
                                            </td>
                                        </tr>
                                    ) : salaries.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                No salary structures found.
                                            </td>
                                        </tr>
                                    ) : salaries.map((salary) => (
                                        <tr key={salary._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {typeof salary.employeeId === 'object' ? (salary.employeeId as any)?.userId?.name || 'Employee' : 'Employee'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{formatCurrency(salary.basic)}</td>
                                            <td className="px-4 py-3 text-sm">{formatCurrency(salary.specialAllowance || 0)}</td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                {formatCurrency((salary.basic || 0) + (salary.specialAllowance || 0))}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {PAYOUT_ACCOUNT_OPTIONS.find((option) => option.value === salary.payoutAccountKey)?.label || 'HDFC (GST)'}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {new Date(salary.effectiveFrom).toLocaleDateString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => openEditSalaryModal(salary)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold border"
                                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Salary structures are hidden. Expand this section when you need to review or edit them.
                        </div>
                    )}
                </section>
            </div>

            {showSalaryModal && (
                <ModalPortal>
                    <div className="w-full max-w-lg rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {editingSalary ? 'Edit Salary Structure' : 'Add Salary Structure'}
                            </h2>
                            <button onClick={() => setShowSalaryModal(false)} style={{ color: 'var(--color-text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSalary} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Employee</label>
                                <select
                                    required
                                    disabled={!!editingSalary}
                                    value={salaryForm.employeeId}
                                    onChange={(event) => setSalaryForm((current) => ({ ...current, employeeId: event.target.value }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    <option value="">Select employee</option>
                                    {employees.map((employee) => (
                                        <option key={employee._id} value={employee._id}>
                                            {(employee.userId as any)?.name || employee.employeeId} - {employee.designation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Basic Salary</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={salaryForm.basic}
                                        onChange={(event) => setSalaryForm((current) => ({ ...current, basic: Number(event.target.value) }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Special Allowance</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={salaryForm.specialAllowance}
                                        onChange={(event) => setSalaryForm((current) => ({ ...current, specialAllowance: Number(event.target.value) }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Salary Paid From</label>
                                <select
                                    required
                                    value={salaryForm.payoutAccountKey}
                                    onChange={(event) => setSalaryForm((current) => ({ ...current, payoutAccountKey: event.target.value as PayoutAccountKey }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    {PAYOUT_ACCOUNT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Effective From</label>
                                <input
                                    type="date"
                                    required
                                    value={salaryForm.effectiveFrom}
                                    onChange={(event) => setSalaryForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                />
                            </div>
                            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#F0FDF4' }}>
                                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#166534' }}>Gross preview</div>
                                <div className="mt-1 text-lg font-bold" style={{ color: '#15803D' }}>
                                    {formatCurrency(Number(salaryForm.basic) + Number(salaryForm.specialAllowance))}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isCreatingSalary || isUpdatingSalary}
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {(isCreatingSalary || isUpdatingSalary) ? <Loader2 size={15} className="animate-spin" /> : <Briefcase size={15} />}
                                Save Salary
                            </button>
                        </form>
                    </div>
                </ModalPortal>
            )}

            {showGenerateModal && (
                <ModalPortal>
                    <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Generate Single Payroll</h2>
                            <button onClick={() => setShowGenerateModal(false)} style={{ color: 'var(--color-text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleGenerateSingle} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Employee</label>
                                <select
                                    required
                                    value={genForm.employeeId}
                                    onChange={(event) => setGenForm((current) => ({ ...current, employeeId: event.target.value }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    <option value="">Select employee</option>
                                    {employees.map((employee) => (
                                        <option key={employee._id} value={employee._id}>
                                            {(employee.userId as any)?.name || employee.employeeId} - {employee.designation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Payroll Month</label>
                                    <select
                                        value={genForm.month}
                                        onChange={(event) => setGenForm((current) => {
                                            const nextMonth = Number(event.target.value);
                                            return { ...current, month: nextMonth, payDate: buildPayDate(nextMonth, current.year) };
                                        })}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    >
                                        {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Payroll Year</label>
                                    <select
                                        value={genForm.year}
                                        onChange={(event) => setGenForm((current) => {
                                            const nextYear = Number(event.target.value);
                                            return { ...current, year: nextYear, payDate: buildPayDate(current.month, nextYear) };
                                        })}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    >
                                        {Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index).map((optionYear) => (
                                            <option key={optionYear} value={optionYear}>{optionYear}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Pay Date</label>
                                    <input
                                        type="date"
                                        value={genForm.payDate}
                                        onChange={(event) => setGenForm((current) => ({ ...current, payDate: event.target.value }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                            </div>
                            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                This creates payroll for the selected salary month and schedules a pay date for the payout.
                            </div>
                            <button
                                type="submit"
                                disabled={isGeneratingSingle}
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {isGeneratingSingle ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                                Generate Payroll
                            </button>
                        </form>
                    </div>
                </ModalPortal>
            )}

            {showGenerateAllModal && (
                <ModalPortal>
                    <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Generate Payroll For All</h2>
                            <button onClick={() => setShowGenerateAllModal(false)} style={{ color: 'var(--color-text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleGenerateAll} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Payroll Month</label>
                                    <select
                                        value={bulkForm.month}
                                        onChange={(event) => setBulkForm((current) => {
                                            const nextMonth = Number(event.target.value);
                                            return { ...current, month: nextMonth, payDate: buildPayDate(nextMonth, current.year) };
                                        })}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    >
                                        {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Payroll Year</label>
                                    <select
                                        value={bulkForm.year}
                                        onChange={(event) => setBulkForm((current) => {
                                            const nextYear = Number(event.target.value);
                                            return { ...current, year: nextYear, payDate: buildPayDate(current.month, nextYear) };
                                        })}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    >
                                        {Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index).map((optionYear) => (
                                            <option key={optionYear} value={optionYear}>{optionYear}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Pay Date</label>
                                    <input
                                        type="date"
                                        value={bulkForm.payDate}
                                        onChange={(event) => setBulkForm((current) => ({ ...current, payDate: event.target.value }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                            </div>
                            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                                Approve first, then mark paid. Once paid, the selected employee payout account is debited automatically.
                            </div>
                            <button
                                type="submit"
                                disabled={isGeneratingBulk}
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {isGeneratingBulk ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
                                Generate All Payrolls
                            </button>
                        </form>
                    </div>
                </ModalPortal>
            )}

            {showPayrollEditModal && editingPayroll && (
                <ModalPortal>
                    <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Payroll</h2>
                            <button onClick={() => setShowPayrollEditModal(false)} style={{ color: 'var(--color-text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePayrollEdit} className="space-y-4">
                            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#F8FAFC', color: 'var(--color-text-secondary)' }}>
                                Editing this payroll updates the same record used in HRMS and the employee payslip. If already marked paid, the bank transaction is updated too.
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Bonus</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={payrollEditForm.incentiveAmount}
                                    onChange={(event) => setPayrollEditForm((current) => ({ ...current, incentiveAmount: Number(event.target.value) }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Paid From</label>
                                <select
                                    value={payrollEditForm.payoutAccountKey}
                                    onChange={(event) => setPayrollEditForm((current) => ({ ...current, payoutAccountKey: event.target.value as PayoutAccountKey }))}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    {PAYOUT_ACCOUNT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Tax Deduction</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={payrollEditForm.tax}
                                        onChange={(event) => setPayrollEditForm((current) => ({ ...current, tax: Number(event.target.value) }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Other Deduction</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={payrollEditForm.other}
                                        onChange={(event) => setPayrollEditForm((current) => ({ ...current, other: Number(event.target.value) }))}
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isUpdatingPayroll}
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {isUpdatingPayroll ? <Loader2 size={15} className="animate-spin" /> : <Briefcase size={15} />}
                                Save Payroll Changes
                            </button>
                        </form>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}
