import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Briefcase,
    IndianRupee,
    Loader2,
    Plus,
    Users,
    Check,
    CreditCard,
    Trash2,
    Eye,
    X,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import AddSalaryStructureModal from '@/components/organisms/hrms/AddSalaryStructureModal';
import GeneratePayrollModal from '@/components/organisms/hrms/GeneratePayrollModal';
import GenerateBulkPayrollModal from '@/components/organisms/hrms/GenerateBulkPayrollModal';
import PayslipModal from '@/components/organisms/hrms/PayslipModal';
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
    useDeletePayrollMutation,
} from '@/features/hrms/hrmsApi';
import { formatCurrency } from '@/features/finance';
import {
    MONTHS,
    PAYOUT_ACCOUNT_OPTIONS,
    PAYOUT_ACCOUNT_LABELS,
} from '@/features/hrms';
import type { Employee, Payroll, SalaryStructure, CreateSalaryRequest, UpdateSalaryRequest } from '@/features/hrms';

type PayoutAccountKey = (typeof PAYOUT_ACCOUNT_OPTIONS)[number]['value'];

export default function FinanceSalariesPayrollPage() {
    const currentDate = new Date();
    const defaultPayrollDate = new Date(currentDate);
    defaultPayrollDate.setMonth(defaultPayrollDate.getMonth() - 1);
    const defaultPayrollMonth = defaultPayrollDate.getMonth() + 1;
    const defaultPayrollYear = defaultPayrollDate.getFullYear();

    const [month, setMonth] = useState(defaultPayrollMonth);
    const [year, setYear] = useState(defaultPayrollYear);

    // Modals visibility
    const [showSalaryModal, setShowSalaryModal] = useState(false);
    const [showEmployeeSelectModal, setShowEmployeeSelectModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showGenerateAllModal, setShowGenerateAllModal] = useState(false);
    const [showPayrollEditModal, setShowPayrollEditModal] = useState(false);

    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);

    // Selected items
    const [editingSalary, setEditingSalary] = useState<SalaryStructure | null>(null);
    const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = useState<Employee | null>(null);
    const [selectedEmployeeIdForNewSalary, setSelectedEmployeeIdForNewSalary] = useState<string>('');
    const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);

    const [payrollEditForm, setPayrollEditForm] = useState({
        incentiveAmount: 0,
        payoutAccountKey: 'hdfc_gst' as PayoutAccountKey,
        tax: 0,
        other: 0,
    });

    const { data: salaryData } = useGetSalariesQuery({ page: 1, limit: 200 });
    const { data: payrollData, isLoading: isLoadingPayrolls } = useGetPayrollsQuery({ month, year, page: 1 });
    const { data: employeeData } = useGetEmployeesQuery({ limit: 200 });
    const [createSalary, { isLoading: isCreatingSalary }] = useCreateSalaryMutation();
    const [updateSalary, { isLoading: isUpdatingSalary }] = useUpdateSalaryMutation();
    const [generatePayroll, { isLoading: isGeneratingSingle }] = useGeneratePayrollMutation();
    const [generateBulkPayroll, { isLoading: isGeneratingBulk }] = useGenerateBulkPayrollMutation();
    const [updatePayroll, { isLoading: isUpdatingPayroll }] = useUpdatePayrollMutation();
    const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdatePayrollStatusMutation();
    const [deletePayroll] = useDeletePayrollMutation();

    const salaries = useMemo(() => salaryData?.data?.salaries || [], [salaryData]);
    const payrolls = useMemo(() => payrollData?.data?.payrolls || [], [payrollData]);
    const employees = useMemo(() => employeeData?.data?.employees || [], [employeeData]);

    const metrics = useMemo(() => ({
        employeesWithSalary: salaries.length,
        payrollGenerated: payrolls.length,
        totalNetSalary: payrolls.reduce((sum, item) => sum + item.netSalary, 0),
        totalGrossSalary: payrolls.reduce((sum, item) => sum + item.grossSalary, 0),
    }), [payrolls, salaries.length]);

    // Filter employees who do not have a salary structure yet (for the creation step)
    const employeesWithoutSalary = useMemo(() => {
        return employees.filter(emp => !salaries.some((sal) => {
            const salEmpId = typeof sal.employeeId === 'object' ? sal.employeeId._id : sal.employeeId;
            return salEmpId === emp._id;
        }));
    }, [employees, salaries]);

    const openCreateSalaryModal = () => {
        setEditingSalary(null);
        setSelectedEmployeeIdForNewSalary('');
        setSelectedEmployeeForSalary(null);
        setShowEmployeeSelectModal(true);
    };

    const handleEmployeeSelectNext = () => {
        if (!selectedEmployeeIdForNewSalary) return;
        const emp = employees.find(e => e._id === selectedEmployeeIdForNewSalary);
        if (emp) {
            setSelectedEmployeeForSalary(emp);
            setShowEmployeeSelectModal(false);
            setShowSalaryModal(true);
        }
    };



    const handleSaveSalary = async (data: Partial<CreateSalaryRequest> & { isDraft: boolean }, isDraft: boolean) => {
        const payload = {
            ...data,
            isDraft,
            currency: 'INR',
        };

        if (editingSalary) {
            await updateSalary({ id: editingSalary._id, data: payload as UpdateSalaryRequest }).unwrap();
        } else if (selectedEmployeeForSalary) {
            await createSalary({ employeeId: selectedEmployeeForSalary._id, ...payload } as CreateSalaryRequest).unwrap();
        }

        setShowSalaryModal(false);
        setEditingSalary(null);
        setSelectedEmployeeForSalary(null);
    };

    const handleGenerateSingle = async (form: { employeeId: string; month: number; year: number; payDate?: string }) => {
        await generatePayroll(form).unwrap();
        setShowGenerateModal(false);
    };

    const handleGenerateAll = async (form: { month: number; year: number; payDate?: string }) => {
        const response = await generateBulkPayroll(form).unwrap();
        setMonth(form.month);
        setYear(form.year);
        setShowGenerateAllModal(false);
        return response.data;
    };

    const handleDeletePayroll = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payroll? This will reverse any expenses or bank transactions.')) return;
        try {
            await deletePayroll(id).unwrap();
        } catch (err: unknown) {
            const apiErr = err as { data?: { message?: string } };
            alert(apiErr?.data?.message || 'Failed to delete payroll');
        }
    };

    const openPayrollEditModal = (payroll: Payroll) => {
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
        { label: 'Payroll Entries', value: metrics.payrollGenerated, icon: Briefcase, bg: '#ECFDF5', color: '#059669' },
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
                        onClick={() => setShowGenerateModal(true)}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
                        style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                    >
                        <Plus size={15} />
                        Generate Single
                    </button>
                    <button
                        onClick={() => setShowGenerateAllModal(true)}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border cursor-pointer"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
                    >
                        <Users size={15} />
                        Generate All
                    </button>
                    <button
                        onClick={openCreateSalaryModal}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border cursor-pointer"
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
                                    const emp = typeof payroll.employeeId === 'object' ? (payroll.employeeId as Employee) : null;
                                    return (
                                        <tr key={payroll._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {emp?.userId?.name || 'Employee'}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {payroll.payableDays}/{new Date(payroll.year, payroll.month, 0).getDate()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{formatCurrency(payroll.grossSalary)}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: payroll.incentiveAmount > 0 ? '#059669' : 'var(--color-text-secondary)' }}>
                                                {formatCurrency(payroll.incentiveAmount || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(payroll.netSalary)}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {PAYOUT_ACCOUNT_LABELS[payroll.payoutAccountKey] || 'HDFC (GST)'}
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {payroll.payDate ? new Date(payroll.payDate).toLocaleDateString('en-IN') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={payroll.status} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setSelectedPayroll(payroll)}
                                                        className="rounded-lg border p-1.5 text-xs font-semibold cursor-pointer hover:bg-gray-50"
                                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                                        title="View Details"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => openPayrollEditModal(payroll)}
                                                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-gray-50"
                                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                                    >
                                                        Edit
                                                    </button>
                                                    {payroll.status === 'draft' && (
                                                        <button
                                                            onClick={() => updateStatus({ id: payroll._id, data: { status: 'approved' } })}
                                                            disabled={isUpdatingStatus}
                                                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
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
                                                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                                                            style={{ backgroundColor: '#059669' }}
                                                        >
                                                            <CreditCard size={12} />
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeletePayroll(payroll._id)}
                                                        className="flex items-center gap-1 p-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                                                        style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
                                                        title="Delete Payroll"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>


            </div>

            {/* select employee for salary modal */}
            {showEmployeeSelectModal && (
                <ModalPortal>
                    <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Select Employee for Salary Structure</h2>
                            <button onClick={() => setShowEmployeeSelectModal(false)} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Employee</label>
                                <select
                                    required
                                    value={selectedEmployeeIdForNewSalary}
                                    onChange={(event) => setSelectedEmployeeIdForNewSalary(event.target.value)}
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                                >
                                    <option value="">Select employee</option>
                                    {employeesWithoutSalary.map((employee) => (
                                        <option key={employee._id} value={employee._id}>
                                            {employee.userId?.name || employee.employeeId} - {employee.designation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleEmployeeSelectNext}
                                disabled={!selectedEmployeeIdForNewSalary}
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* salary structure modal */}
            {showSalaryModal && selectedEmployeeForSalary && (
                <AddSalaryStructureModal
                    isOpen={showSalaryModal}
                    onClose={() => {
                        setShowSalaryModal(false);
                        setEditingSalary(null);
                        setSelectedEmployeeForSalary(null);
                    }}
                    employee={selectedEmployeeForSalary}
                    existingSalary={editingSalary}
                    onSave={handleSaveSalary}
                    isSaving={isCreatingSalary || isUpdatingSalary}
                />
            )}

            {/* generate payroll modals */}
            <GeneratePayrollModal
                key={showGenerateModal ? 'single-open' : 'single-closed'}
                isOpen={showGenerateModal}
                onClose={() => setShowGenerateModal(false)}
                employees={employees}
                onGenerate={handleGenerateSingle}
                isGenerating={isGeneratingSingle}
                showPayDate={true}
                defaultMonth={month}
                defaultYear={year}
            />

            <GenerateBulkPayrollModal
                key={showGenerateAllModal ? 'bulk-open' : 'bulk-closed'}
                isOpen={showGenerateAllModal}
                onClose={() => setShowGenerateAllModal(false)}
                onGenerate={handleGenerateAll}
                isGenerating={isGeneratingBulk}
                showPayDate={true}
                defaultMonth={month}
                defaultYear={year}
            />

            {/* edit payroll modal */}
            {showPayrollEditModal && editingPayroll && (
                <ModalPortal>
                    <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Payroll</h2>
                            <button onClick={() => setShowPayrollEditModal(false)} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
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
                                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {isUpdatingPayroll ? <Loader2 size={15} className="animate-spin" /> : <Briefcase size={15} />}
                                Save Payroll Changes
                            </button>
                        </form>
                    </div>
                </ModalPortal>
            )}

            {/* view payslip details modal */}
            {selectedPayroll && (
                <PayslipModal payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
            )}
        </div>
    );
}
