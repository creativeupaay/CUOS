import { useParams, useNavigate } from 'react-router-dom';
import {
    useGetEmployeeQuery,
    useGetSalaryByEmployeeQuery,
    useCreateSalaryMutation,
    useUpdateSalaryMutation,
} from '@/features/hrms/hrmsApi';
import {
    ArrowLeft, Edit, User, Briefcase, DollarSign,
    Plus, X, Loader2, Eye, EyeOff, Calendar,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ── Status badge helper ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { bg: string; color: string }> = {
        active: { bg: '#DCFCE7', color: '#16A34A' },
        'on-notice': { bg: '#FEF3C7', color: '#92400E' },
        relieved: { bg: '#F3F4F6', color: '#6B7280' },
        terminated: { bg: '#FEE2E2', color: '#991B1B' },
    };
    const s = cfg[status] || cfg.relieved;
    return (
        <span
            className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize"
            style={{ backgroundColor: s.bg, color: s.color }}
        >
            {status.replace('-', ' ')}
        </span>
    );
}

// ── Field row helper ─────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </dt>
            <dd className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {children}
            </dd>
        </div>
    );
}

export default function HrmsEmployeeDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data, isLoading } = useGetEmployeeQuery(id!);
    const { data: salaryData } = useGetSalaryByEmployeeQuery(id!);

    const employee = data?.data?.employee;
    const salary = salaryData?.data?.salary;

    const [createSalary, { isLoading: isCreatingSalary }] = useCreateSalaryMutation();
    const [updateSalary, { isLoading: isUpdatingSalary }] = useUpdateSalaryMutation();

    // ── Bank visibility toggle ───────────────────────────────────────
    const [showBankDetails, setShowBankDetails] = useState(false);

    // ── Salary modal ─────────────────────────────────────────────────
    const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
    const [salaryForm, setSalaryForm] = useState({
        basic: 0, hra: 0, da: 0, specialAllowance: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (salary && isSalaryModalOpen) {
            setSalaryForm({
                basic: salary.basic || 0,
                hra: salary.hra || 0,
                da: salary.da || 0,
                specialAllowance: salary.specialAllowance || 0,
                effectiveFrom: salary.effectiveFrom
                    ? salary.effectiveFrom.split('T')[0]
                    : new Date().toISOString().split('T')[0],
            });
        }
    }, [salary, isSalaryModalOpen]);

    const handleSaveSalary = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (salary) {
                await updateSalary({ id: salary._id, data: salaryForm }).unwrap();
            } else {
                await createSalary({ employeeId: id!, ...salaryForm, currency: 'INR' }).unwrap();
            }
            setIsSalaryModalOpen(false);
        } catch (err: any) {
            alert(err?.data?.message || err?.message || 'Failed to save salary');
        }
    };

    // ── Guards ───────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Loading employee…
            </div>
        );
    }
    if (!employee) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Employee not found
            </div>
        );
    }

    const bankFields = [
        { label: 'Bank Name', raw: employee.bankDetails?.bankName, masked: employee.bankDetails?.bankName || '—' },
        {
            label: 'Account Number',
            raw: employee.bankDetails?.accountNumber,
            masked: employee.bankDetails?.accountNumber
                ? '•••• ' + employee.bankDetails.accountNumber.slice(-4)
                : '—',
        },
        { label: 'IFSC Code', raw: employee.bankDetails?.ifscCode, masked: employee.bankDetails?.ifscCode || '—' },
        {
            label: 'PAN Number',
            raw: employee.bankDetails?.panNumber,
            masked: employee.bankDetails?.panNumber
                ? employee.bankDetails.panNumber.slice(0, 3) + '••••' + employee.bankDetails.panNumber.slice(-3)
                : '—',
        },
    ];

    return (
        <div className="mx-auto" style={{ maxWidth: '1100px' }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/hrms/employees')}
                        className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <ArrowLeft size={17} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {(employee.userId as any)?.name}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {employee.employeeId} · {employee.designation}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate(`/hrms/employees/${id}/edit`)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                >
                    <Edit size={15} /> Edit
                </button>
            </div>

            {/* ── Grid ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-5">

                {/* Left column — Employee details + Salary */}
                <div className="col-span-2 space-y-5">

                    {/* Employee Details */}
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center gap-2 mb-5">
                            <User size={17} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Employee Details
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                            <FieldRow label="Email">
                                {(employee.userId as any)?.email || '—'}
                            </FieldRow>
                            <FieldRow label="Department">
                                <span className="capitalize">{employee.department}</span>
                            </FieldRow>
                            <FieldRow label="Employment Type">
                                <span className="capitalize">{employee.employmentType}</span>
                            </FieldRow>
                            <FieldRow label="Status">
                                <StatusBadge status={employee.status} />
                            </FieldRow>
                            <FieldRow label="Joining Date">
                                {new Date(employee.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </FieldRow>
                            <FieldRow label="Probation End">
                                {employee.probationEndDate
                                    ? new Date(employee.probationEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—'}
                            </FieldRow>
                            <FieldRow label="Working Days / Week">
                                {employee.workSchedule?.workingDaysPerWeek ?? 5} days
                            </FieldRow>
                            <FieldRow label="Hours / Day">
                                {employee.workSchedule?.hoursPerDay ?? 8} hrs
                            </FieldRow>
                            <FieldRow label="Phone">
                                {employee.personalInfo?.phone || '—'}
                            </FieldRow>
                            <FieldRow label="Gender">
                                <span className="capitalize">{employee.personalInfo?.gender || '—'}</span>
                            </FieldRow>
                            <FieldRow label="Date of Birth">
                                {employee.personalInfo?.dob
                                    ? new Date(employee.personalInfo.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—'}
                            </FieldRow>
                            <FieldRow label="Paid Leaves / Year">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium">
                                        {(employee as any).paidLeavesPerYear ?? 12} days
                                    </span>
                                </div>
                            </FieldRow>
                        </div>
                    </div>

                    {/* Salary Structure */}
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <DollarSign size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Salary Structure
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsSalaryModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            >
                                {salary ? <><Edit size={13} /> Edit Salary</> : <><Plus size={13} /> Add Salary</>}
                            </button>
                        </div>

                        {salary ? (
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Basic', value: salary.basic },
                                    { label: 'HRA', value: salary.hra },
                                    { label: 'DA', value: salary.da },
                                    { label: 'Special Allowance', value: salary.specialAllowance },
                                    {
                                        label: 'Gross Total',
                                        value: salary.basic + salary.hra + salary.da + salary.specialAllowance,
                                        highlight: true,
                                    },
                                ].map(({ label, value, highlight }) => (
                                    <div
                                        key={label}
                                        className="rounded-lg p-3"
                                        style={{ backgroundColor: highlight ? '#F0FDF4' : 'var(--color-bg-subtle)' }}
                                    >
                                        <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                                        <div
                                            className="text-base font-semibold tabular-nums"
                                            style={{ color: highlight ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
                                        >
                                            ₹{value.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                ))}
                                <div
                                    className="rounded-lg p-3"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Effective From</div>
                                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {new Date(salary.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                                No salary structure defined yet. Click "Add Salary" to set one.
                            </p>
                        )}
                    </div>
                </div>

                {/* Right column — Bank Details */}
                <div className="space-y-5">
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        {/* Bank header with toggle */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Briefcase size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Bank Details
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowBankDetails((v) => !v)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                title={showBankDetails ? 'Hide bank details' : 'Show bank details'}
                            >
                                {showBankDetails ? <EyeOff size={13} /> : <Eye size={13} />}
                                {showBankDetails ? 'Hide' : 'Show'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {bankFields.map(({ label, raw, masked }) => (
                                <div
                                    key={label}
                                    className="flex justify-between items-center py-2 border-b last:border-0"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {label}
                                    </span>
                                    <span
                                        className="text-sm font-medium"
                                        style={{
                                            color: showBankDetails && raw
                                                ? 'var(--color-text-primary)'
                                                : 'var(--color-text-muted)',
                                            fontFamily: !showBankDetails && raw ? 'monospace' : 'inherit',
                                            letterSpacing: !showBankDetails && raw ? '0.05em' : 'normal',
                                        }}
                                    >
                                        {showBankDetails ? (raw || '—') : masked}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {!showBankDetails && (
                            <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                                Click "Show" to reveal account details.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Salary Modal ────────────────────────────────────── */}
            {isSalaryModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                    <div
                        className="w-full max-w-md rounded-xl border p-6 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {salary ? 'Edit Salary Structure' : 'Add Salary Structure'}
                            </h2>
                            <button
                                onClick={() => setIsSalaryModalOpen(false)}
                                className="p-1 rounded-md hover:bg-gray-100 cursor-pointer"
                            >
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSalary} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {([
                                    ['basic', 'Basic (₹)', true],
                                    ['hra', 'HRA (₹)', true],
                                    ['da', 'DA (₹)', false],
                                    ['specialAllowance', 'Special Allowance (₹)', false],
                                ] as const).map(([key, label, required]) => (
                                    <div key={key}>
                                        <label
                                            className="block text-xs font-medium mb-1.5"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {label}{required ? ' *' : ''}
                                        </label>
                                        <input
                                            type="number"
                                            required={required}
                                            min="0"
                                            value={salaryForm[key]}
                                            onChange={(e) => setSalaryForm({ ...salaryForm, [key]: Number(e.target.value) })}
                                            className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                                color: 'var(--color-text-primary)',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Gross preview */}
                            <div
                                className="rounded-lg px-4 py-3 flex justify-between items-center"
                                style={{ backgroundColor: '#F0FDF4' }}
                            >
                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    Gross Total
                                </span>
                                <span className="text-base font-bold tabular-nums" style={{ color: '#16A34A' }}>
                                    ₹{(salaryForm.basic + salaryForm.hra + salaryForm.da + salaryForm.specialAllowance).toLocaleString('en-IN')}
                                </span>
                            </div>

                            <div>
                                <label
                                    className="block text-xs font-medium mb-1.5"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Effective From *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={salaryForm.effectiveFrom}
                                    onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isCreatingSalary || isUpdatingSalary}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {(isCreatingSalary || isUpdatingSalary)
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : <DollarSign size={15} />}
                                    Save Salary
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsSalaryModalOpen(false)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
