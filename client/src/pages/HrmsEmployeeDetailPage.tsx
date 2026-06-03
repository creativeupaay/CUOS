import { useParams, useNavigate } from 'react-router-dom';
import {
    useGetEmployeeQuery,
    useGetSalaryByEmployeeQuery,
    useCreateSalaryMutation,
    useUpdateSalaryMutation,
    useUpdateEmployeeMutation,
    useUpdateEmployeeProfilePhotoMutation,
    useGenerateFormTokenMutation,
} from '@/features/hrms/hrmsApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
import {
    ArrowLeft, Edit, User, Briefcase, DollarSign,
    Plus, X, Loader2, Eye, EyeOff, Calendar,
    CheckCircle2, Clock, ShieldCheck, Shirt, Save, Mail, Copy, Camera,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AddSalaryStructureModal from '@/components/organisms/hrms/AddSalaryStructureModal';
import type { CreateSalaryRequest } from '@/features/hrms/types/apiTypes';
import type { Employee, MonthlyEntry, AdditionalCompensation } from '@/features/hrms/types/types';

const PAYOUT_ACCOUNT_OPTIONS = [
    { value: 'hdfc_gst', label: 'HDFC (GST)' },
    { value: 'sbi_non_gst', label: 'SBI (non GST)' },
    { value: 'cash', label: 'Cash in Company' },
] as const;


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
    const [updateEmployee, { isLoading: isUpdatingEmployee }] = useUpdateEmployeeMutation();
    const [updateEmployeeProfilePhoto, { isLoading: isUploadingPhoto }] = useUpdateEmployeeProfilePhotoMutation();
    const [generateFormToken, { isLoading: isGeneratingToken }] = useGenerateFormTokenMutation();
    const adminPhotoInputRef = useRef<HTMLInputElement | null>(null);

    // ── Bank visibility toggle ───────────────────────────────────────
    const [showBankDetails, setShowBankDetails] = useState(false); const [showIdNumber, setShowIdNumber] = useState(false);
    // ── Share form feedback state ─────────────────────────────────────
    const [emailSent, setEmailSent] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // ── Admin edit modals ────────────────────────────────────────────
    type EditModal = null | 'personal' | 'bank' | 'identity';
    const [editModal, setEditModal] = useState<EditModal>(null);

    const [personalEditForm, setPersonalEditForm] = useState({
        phone: '', alternatePhone: '', fatherName: '', fatherPhone: '',
        gender: '', dob: '',
        address_street: '', address_state: '', address_postalCode: '',
    });

    const [bankEditForm, setBankEditForm] = useState({
        bankName: '', accountNumber: '', ifscCode: '', panNumber: '', bankBranch: '', upiId: '',
    });

    const [identityEditForm, setIdentityEditForm] = useState({
        type: '', idNumber: '',
    });

    const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border';
    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    const openPersonalEdit = () => {
        const pi = (employee?.personalInfo as any) || {};
        setPersonalEditForm({
            phone: pi.phone || '',
            alternatePhone: pi.alternatePhone || '',
            fatherName: pi.fatherName || '',
            fatherPhone: pi.fatherPhone || '',
            gender: pi.gender || '',
            dob: pi.dob ? pi.dob.split('T')[0] : '',
            address_street: pi.address?.street || '',
            address_state: pi.address?.state || '',
            address_postalCode: pi.address?.postalCode || '',
        });
        setEditModal('personal');
    };

    const openBankEdit = () => {
        const bd = (employee?.bankDetails as any) || {};
        setBankEditForm({
            bankName: bd.bankName || '',
            accountNumber: bd.accountNumber || '',
            ifscCode: bd.ifscCode || '',
            panNumber: bd.panNumber || '',
            bankBranch: bd.bankBranch || '',
            upiId: bd.upiId || '',
        });
        setEditModal('bank');
    };

    const openIdentityEdit = () => {
        const iv = (employee as any)?.identityVerification || {};
        setIdentityEditForm({
            type: iv.type || '',
            idNumber: iv.idNumber || '',
        });
        setEditModal('identity');
    };

    const handleSavePersonalEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateEmployee({
                id: id!,
                data: {
                    personalInfo: {
                        phone: personalEditForm.phone || undefined,
                        alternatePhone: personalEditForm.alternatePhone || undefined,
                        fatherName: personalEditForm.fatherName || undefined,
                        fatherPhone: personalEditForm.fatherPhone || undefined,
                        gender: (personalEditForm.gender as any) || undefined,
                        dob: personalEditForm.dob || undefined,
                        address: {
                            street: personalEditForm.address_street || undefined,
                            state: personalEditForm.address_state || undefined,
                            postalCode: personalEditForm.address_postalCode || undefined,
                        },
                    } as any,
                },
            }).unwrap();
            setEditModal(null);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save personal info');
        }
    };

    const handleSaveBankEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateEmployee({ id: id!, data: { bankDetails: bankEditForm as any } }).unwrap();
            setEditModal(null);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save bank details');
        }
    };

    const handleSaveIdentityEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateEmployee({
                id: id!,
                data: { identityVerification: identityEditForm as any },
            }).unwrap();
            setEditModal(null);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save identity info');
        }
    };

    const handleShareForm = async () => {
        if (!id) return;
        try {
            const result = await generateFormToken(id).unwrap();
            const url = result.data.formUrl;
            // Copy to clipboard for backup
            try { await navigator.clipboard.writeText(url); } catch { /* ignore clipboard errors */ }
            setLinkCopied(true);
            setEmailSent(result.data.emailSent);
            setTimeout(() => { setLinkCopied(false); setEmailSent(false); }, 3000);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to generate form link');
        }
    };

    const handleCopyLink = async () => {
        const token = (employee as any)?.formToken;
        if (!token) return;
        const url = `${window.location.origin}/employee-form/${token}`;
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    // ── Salary modal ─────────────────────────────────────────────────
    const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

    const hasOpenModal = isSalaryModalOpen || editModal !== null;
    const renderModal = (content: React.ReactNode) => {
        if (typeof document === 'undefined') return null;
        return createPortal(content, document.body);
    };

    useEffect(() => {
        if (!hasOpenModal) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [hasOpenModal]);

    const handleSaveSalary = async (data: Partial<CreateSalaryRequest> & { isDraft: boolean }, isDraft: boolean) => {
        try {
            if (salary) {
                await updateSalary({ id: salary._id, data: { ...data, isDraft } }).unwrap();
            } else {
                await createSalary({ employeeId: id!, ...data, isDraft, currency: 'INR' } as CreateSalaryRequest).unwrap();
            }
            setIsSalaryModalOpen(false);
        } catch (err: any) {
            alert(err?.data?.message || err?.message || 'Failed to save salary');
        }
    };

    const handleAdminProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        try {
            const formData = new FormData();
            formData.append('profilePhoto', file);
            await updateEmployeeProfilePhoto({ id, formData }).unwrap();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to update profile photo');
        } finally {
            e.target.value = '';
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
        { label: 'Bank Branch', raw: (employee.bankDetails as any)?.bankBranch, masked: (employee.bankDetails as any)?.bankBranch || '—' },
        { label: 'UPI ID', raw: (employee.bankDetails as any)?.upiId, masked: (employee.bankDetails as any)?.upiId || '—' },
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
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {(employee.userId as any)?.name}
                            </h1>
                            {/* Form status badge */}
                            {(employee as any).formSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                                    <CheckCircle2 size={11} />
                                    Form Submitted
                                </span>
                            ) : (employee as any).formToken ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                    <Clock size={11} />
                                    Awaiting Form
                                </span>
                            ) : null}
                        </div>
                        <p className="text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                            {employee.designation}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Share Onboarding Form — hidden once form is submitted */}
                    {!(employee as any).formSubmitted && (
                        <div className="flex items-center gap-2">
                            {/* Primary — send email (+ copy to clipboard) */}
                            <button
                                onClick={handleShareForm}
                                disabled={isGeneratingToken}
                                title={(employee as any).formToken ? 'Resend onboarding email to employee' : 'Send onboarding form link via email'}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer disabled:opacity-60 transition-colors"
                                style={{
                                    backgroundColor: emailSent ? '#EEF2FF' : 'var(--color-primary-soft)',
                                    color: emailSent ? '#4F46E5' : 'var(--color-primary)',
                                    border: '1px solid',
                                    borderColor: emailSent ? '#A5B4FC' : 'var(--color-primary-soft)',
                                }}
                            >
                                {isGeneratingToken
                                    ? <Loader2 size={15} className="animate-spin" />
                                    : emailSent
                                        ? <CheckCircle2 size={15} />
                                        : <Mail size={15} />}
                                {isGeneratingToken
                                    ? 'Sending…'
                                    : emailSent
                                        ? 'Email Sent!'
                                        : (employee as any).formToken
                                            ? 'Resend Email'
                                            : 'Share Onboarding Form'}
                            </button>

                            {/* Secondary — copy link (only visible once token exists) */}
                            {(employee as any).formToken && (
                                <button
                                    onClick={handleCopyLink}
                                    title="Copy form link to clipboard"
                                    className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors"
                                    style={{
                                        backgroundColor: linkCopied ? '#DCFCE7' : 'var(--color-bg-surface)',
                                        color: linkCopied ? '#16A34A' : 'var(--color-text-secondary)',
                                        border: '1px solid',
                                        borderColor: linkCopied ? '#86EFAC' : 'var(--color-border-default)',
                                    }}
                                >
                                    {linkCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                    {linkCopied ? 'Copied!' : 'Copy Link'}
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => navigate(`/hrms/employees/${id}/edit`)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        <Edit size={15} /> Edit
                    </button>
                </div>
            </div>

            {/* ── Grid ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-5">

                {/* Left column — Employee details + Salary + Personal Info */}
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
                            <FieldRow label="Employee ID">
                                <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
                                    {(employee as any).employeeId || '—'}
                                </span>
                            </FieldRow>
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
                            <FieldRow label="Paid Leaves / Year">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium">
                                        {(employee as any).paidLeavesPerYear ?? 12} days
                                    </span>
                                </div>
                            </FieldRow>
                            {(employee as any).tshirtSize && (
                                <FieldRow label="T-Shirt Size">
                                    <div className="flex items-center gap-1.5">
                                        <Shirt size={14} style={{ color: 'var(--color-text-muted)' }} />
                                        <span>{(employee as any).tshirtSize}</span>
                                    </div>
                                </FieldRow>
                            )}
                        </div>
                    </div>

                    {/* Personal Information (from self-onboarding form) */}
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <User size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Personal Information
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                {!(employee as any).formSubmitted && (
                                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                                        To be filled by employee
                                    </span>
                                )}
                                <button
                                    onClick={openPersonalEdit}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    <Edit size={12} /> Edit
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                            <FieldRow label="Mobile">{employee.personalInfo?.phone || '—'}</FieldRow>
                            <FieldRow label="Alternate Mobile">{(employee.personalInfo as any)?.alternatePhone || '—'}</FieldRow>
                            <FieldRow label="Gender">
                                <span className="capitalize">{employee.personalInfo?.gender || '—'}</span>
                            </FieldRow>
                            <FieldRow label="Date of Birth">
                                {employee.personalInfo?.dob
                                    ? new Date(employee.personalInfo.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—'}
                            </FieldRow>
                            <FieldRow label="Father's Name">{(employee.personalInfo as any)?.fatherName || '—'}</FieldRow>
                            <FieldRow label="Father's Contact">{(employee.personalInfo as any)?.fatherPhone || '—'}</FieldRow>
                            <FieldRow label="Full Address">
                                {employee.personalInfo?.address?.street || '—'}
                            </FieldRow>
                            <FieldRow label="State">{employee.personalInfo?.address?.state || '—'}</FieldRow>
                            <FieldRow label="Pincode">{employee.personalInfo?.address?.postalCode || '—'}</FieldRow>
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
                                {salary?.isDraft && (
                                    <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full uppercase tracking-wider">
                                        Draft
                                    </span>
                                )}
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
                                    { label: 'Compensation Type', value: salary.compensationType || 'Salary', isText: true },
                                    {
                                        label: 'Fixed Total', 
                                        value: salary.salaryType === 'yearly' 
                                            ? salary.annualAmount 
                                            : salary.monthlySchedule?.reduce((acc: number, curr: MonthlyEntry) => acc + (curr.amount || 0), 0) || 0
                                    },
                                    {
                                        label: 'Payout Account',
                                        value: PAYOUT_ACCOUNT_OPTIONS.find((option) => option.value === salary.payoutAccountKey)?.label || 'HDFC (GST)',
                                        isText: true,
                                    },
                                    {
                                        label: 'Gross Total (CTC)',
                                        value: (salary.salaryType === 'yearly' ? (salary.annualAmount || 0) : (salary.monthlySchedule?.reduce((acc: number, curr: MonthlyEntry) => acc + (curr.amount || 0), 0) || 0)) +
                                               (salary.additionalCompensations?.reduce((acc: number, curr: AdditionalCompensation) => acc + (curr.amount || 0), 0) || 0),
                                        highlight: true,
                                    },
                                ].map(({ label, value, highlight, isText }) => (
                                    <div
                                        key={label}
                                        className="rounded-lg p-3"
                                        style={{ backgroundColor: highlight ? '#F0FDF4' : 'var(--color-bg-subtle)' }}
                                    >
                                        <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                                        <div
                                            className="text-base font-semibold tabular-nums capitalize"
                                            style={{ color: highlight ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
                                        >
                                            {isText ? value : `₹${Number(value).toLocaleString('en-IN')}`}
                                        </div>
                                    </div>
                                ))}
                                {salary.salaryType === 'yearly' && salary.effectiveFrom && (
                                    <div
                                        className="rounded-lg p-3"
                                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                    >
                                        <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Effective From</div>
                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {new Date(salary.effectiveFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                                No salary structure defined yet. Click "Add Salary" to set one.
                            </p>
                        )}
                    </div>
                </div>

                {/* Right column — Profile Photo + Bank Details + Identity */}
                <div className="space-y-5">

                    {/* Profile Photo */}
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Profile Photo
                            </h2>
                            <button
                                onClick={() => adminPhotoInputRef.current?.click()}
                                disabled={isUploadingPhoto}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50 disabled:opacity-60"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                            >
                                {isUploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                Change Photo
                            </button>
                            <input
                                ref={adminPhotoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={handleAdminProfilePhotoChange}
                            />
                        </div>
                        {(employee as any).profilePhoto?.url ? (
                            <div className="flex flex-col items-center gap-3">
                                <img
                                    src={(employee as any).profilePhoto.url}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-cover"
                                    style={{ border: '2px solid var(--color-border-default)' }}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <User size={28} style={{ color: 'var(--color-text-muted)' }} />
                                </div>
                                <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                                    {(employee as any).formSubmitted ? 'No photo uploaded' : 'Awaiting employee form'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bank Details */}
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowBankDetails((v) => !v)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                    title={showBankDetails ? 'Hide bank details' : 'Show bank details'}
                                >
                                    {showBankDetails ? <EyeOff size={13} /> : <Eye size={13} />}
                                    {showBankDetails ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    onClick={openBankEdit}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    <Edit size={12} /> Edit
                                </button>
                            </div>
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

                    {/* Identity Verification */}
                    <div
                        className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Identity Verification
                                </h2>
                            </div>
                            <button
                                onClick={openIdentityEdit}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                            >
                                <Edit size={12} /> Edit
                            </button>
                        </div>
                        {(employee as any).identityVerification?.type ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Type</span>
                                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--color-text-primary)' }}>
                                        {(employee as any).identityVerification.type}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ID Number</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                            {(employee as any).identityVerification.idNumber
                                                ? showIdNumber
                                                    ? String((employee as any).identityVerification.idNumber)
                                                    : '•••• ' + String((employee as any).identityVerification.idNumber).slice(-4)
                                                : '—'}
                                        </span>
                                        {(employee as any).identityVerification.idNumber && (
                                            <button
                                                onClick={() => setShowIdNumber(v => !v)}
                                                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border cursor-pointer hover:bg-gray-50 transition-colors"
                                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                            >
                                                {showIdNumber ? <EyeOff size={11} /> : <Eye size={11} />}
                                                {showIdNumber ? 'Hide' : 'Show'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {(employee as any).identityVerification.documentCloudinaryId && (
                                    <div className="pt-1">
                                        <a
                                            href={`${API_BASE}/hrms/employees/${id}/identity-document`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs flex items-center gap-1.5 cursor-pointer"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            <Eye size={12} /> View Document
                                        </a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
                                {(employee as any).formSubmitted ? 'No identity document provided' : 'Awaiting employee form'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Salary Modal ────────────────────────────────────── */}
            <AddSalaryStructureModal 
                isOpen={isSalaryModalOpen} 
                onClose={() => setIsSalaryModalOpen(false)} 
                employee={employee as Employee} 
                existingSalary={salary} 
                onSave={handleSaveSalary} 
                isSaving={isCreatingSalary || isUpdatingSalary} 
            />
            {/* ── Personal Info Edit Modal ─────────────────────────── */}
            {editModal === 'personal' && renderModal(
                <div className="modal-overlay">
                    <div className="w-full max-w-4xl rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Personal Information
                            </h2>
                            <button onClick={() => setEditModal(null)} className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePersonalEdit} className="space-y-3">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {([
                                    ['phone', 'Mobile'],
                                    ['alternatePhone', 'Alternate Mobile'],
                                    ['fatherName', "Father's Name"],
                                    ['fatherPhone', "Father's Contact"],
                                    ['address_street', 'Address / Street'],
                                    ['address_state', 'State'],
                                    ['address_postalCode', 'Pincode'],
                                ] as [string, string][]).map(([key, label]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                            {label}
                                        </label>
                                        <input type="text" value={(personalEditForm as any)[key]}
                                            onChange={e => setPersonalEditForm({ ...personalEditForm, [key]: e.target.value })}
                                            className={inputCls} style={inputStyle} />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Gender</label>
                                    <select value={personalEditForm.gender}
                                        onChange={e => setPersonalEditForm({ ...personalEditForm, gender: e.target.value })}
                                        className={inputCls} style={inputStyle}>
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date of Birth</label>
                                    <input type="date" value={personalEditForm.dob}
                                        onChange={e => setPersonalEditForm({ ...personalEditForm, dob: e.target.value })}
                                        className={inputCls} style={inputStyle} />
                                </div>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isUpdatingEmployee}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isUpdatingEmployee ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setEditModal(null)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Bank Details Edit Modal ──────────────────────────── */}
            {editModal === 'bank' && renderModal(
                <div className="modal-overlay">
                    <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Bank Details
                            </h2>
                            <button onClick={() => setEditModal(null)} className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBankEdit} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    ['bankName', 'Bank Name'],
                                    ['accountNumber', 'Account Number'],
                                    ['ifscCode', 'IFSC Code'],
                                    ['bankBranch', 'Branch'],
                                    ['panNumber', 'PAN Number'],
                                    ['upiId', 'UPI ID'],
                                ] as [string, string][]).map(([key, label]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                            {label}
                                        </label>
                                        <input type="text" value={(bankEditForm as any)[key]}
                                            onChange={e => setBankEditForm({ ...bankEditForm, [key]: e.target.value })}
                                            className={inputCls} style={inputStyle} />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isUpdatingEmployee}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isUpdatingEmployee ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setEditModal(null)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Identity Verification Edit Modal ─────────────────── */}
            {editModal === 'identity' && renderModal(
                <div className="modal-overlay">
                    <div className="w-full max-w-sm rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Identity Verification
                            </h2>
                            <button onClick={() => setEditModal(null)} className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveIdentityEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Document Type
                                </label>
                                <select value={identityEditForm.type}
                                    onChange={e => setIdentityEditForm({ ...identityEditForm, type: e.target.value })}
                                    className={inputCls} style={inputStyle}>
                                    <option value="">Select</option>
                                    <option value="aadhaar">Aadhaar</option>
                                    <option value="pan">PAN</option>
                                    <option value="voter">Voter ID</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    ID Number
                                </label>
                                <input type="text" value={identityEditForm.idNumber}
                                    onChange={e => setIdentityEditForm({ ...identityEditForm, idNumber: e.target.value })}
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isUpdatingEmployee}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isUpdatingEmployee ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setEditModal(null)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
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
