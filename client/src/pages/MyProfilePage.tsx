import { useState } from 'react';
import {
    useGetMyProfileQuery,
    useUpdateMyProfileMutation,
} from '@/features/hrms/hrmsApi';
import {
    User, Briefcase, ShieldCheck, Eye, EyeOff,
    Edit, X, Loader2, Save,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// ── Small helpers ────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </dt>
            <dd className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {children || '—'}
            </dd>
        </div>
    );
}

function SectionHeader({
    icon,
    title,
    onEdit,
}: {
    icon: React.ReactNode;
    title: string;
    onEdit?: () => void;
}) {
    return (
        <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {title}
                </h2>
            </div>
            {onEdit && (
                <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                >
                    <Edit size={12} /> Edit
                </button>
            )}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function MyProfilePage() {
    const { data, isLoading, refetch } = useGetMyProfileQuery();
    const [updateMyProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();

    const employee = data?.data?.employee as any;

    // ── Modal state ──────────────────────────────────────────────────
    type ModalType = null | 'personal' | 'bank';
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    // ── Personal Info Form ───────────────────────────────────────────
    const [personalForm, setPersonalForm] = useState({
        phone: '',
        alternatePhone: '',
        fatherName: '',
        fatherPhone: '',
        gender: '',
        dob: '',
        bloodGroup: '',
        address_street: '',
        address_state: '',
        address_postalCode: '',
        emergencyContact_name: '',
        emergencyContact_phone: '',
        emergencyContact_relation: '',
    });

    // ── Bank Details Form ────────────────────────────────────────────
    const [bankForm, setBankForm] = useState({
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        panNumber: '',
        bankBranch: '',
        upiId: '',
    });

    // ── Bank visibility ──────────────────────────────────────────────
    const [showBank, setShowBank] = useState(false);
    const [showIdNumber, setShowIdNumber] = useState(false);

    const openPersonalModal = () => {
        const pi = employee?.personalInfo || {};
        setPersonalForm({
            phone: pi.phone || '',
            alternatePhone: pi.alternatePhone || '',
            fatherName: pi.fatherName || '',
            fatherPhone: pi.fatherPhone || '',
            gender: pi.gender || '',
            dob: pi.dob ? pi.dob.split('T')[0] : '',
            bloodGroup: pi.bloodGroup || '',
            address_street: pi.address?.street || '',
            address_state: pi.address?.state || '',
            address_postalCode: pi.address?.postalCode || '',
            emergencyContact_name: pi.emergencyContact?.name || '',
            emergencyContact_phone: pi.emergencyContact?.phone || '',
            emergencyContact_relation: pi.emergencyContact?.relation || '',
        });
        setActiveModal('personal');
    };

    const openBankModal = () => {
        const bd = employee?.bankDetails || {};
        setBankForm({
            bankName: bd.bankName || '',
            accountNumber: bd.accountNumber || '',
            ifscCode: bd.ifscCode || '',
            panNumber: bd.panNumber || '',
            bankBranch: bd.bankBranch || '',
            upiId: bd.upiId || '',
        });
        setActiveModal('bank');
    };

    const handleSavePersonal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMyProfile({
                personalInfo: {
                    phone: personalForm.phone || undefined,
                    alternatePhone: personalForm.alternatePhone || undefined,
                    fatherName: personalForm.fatherName || undefined,
                    fatherPhone: personalForm.fatherPhone || undefined,
                    gender: (personalForm.gender as any) || undefined,
                    dob: personalForm.dob || undefined,
                    bloodGroup: personalForm.bloodGroup || undefined,
                    address: {
                        street: personalForm.address_street || undefined,
                        state: personalForm.address_state || undefined,
                        postalCode: personalForm.address_postalCode || undefined,
                    },
                    emergencyContact: {
                        name: personalForm.emergencyContact_name || undefined,
                        phone: personalForm.emergencyContact_phone || undefined,
                        relation: personalForm.emergencyContact_relation || undefined,
                    },
                },
            }).unwrap();
            setActiveModal(null);
            refetch();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save personal info');
        }
    };

    const handleSaveBank = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMyProfile({ bankDetails: bankForm }).unwrap();
            setActiveModal(null);
            refetch();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save bank details');
        }
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Loading your profile…
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No employee profile found. Contact HR.
            </div>
        );
    }

    const bankMasked = [
        { label: 'Bank Name', raw: employee.bankDetails?.bankName },
        {
            label: 'Account Number',
            raw: employee.bankDetails?.accountNumber,
            masked: employee.bankDetails?.accountNumber
                ? '•••• ' + employee.bankDetails.accountNumber.slice(-4)
                : null,
        },
        { label: 'IFSC Code', raw: employee.bankDetails?.ifscCode },
        { label: 'Bank Branch', raw: employee.bankDetails?.bankBranch },
        { label: 'UPI ID', raw: employee.bankDetails?.upiId },
        {
            label: 'PAN Number',
            raw: employee.bankDetails?.panNumber,
            masked: employee.bankDetails?.panNumber
                ? employee.bankDetails.panNumber.slice(0, 3) + '••••' + employee.bankDetails.panNumber.slice(-3)
                : null,
        },
    ];

    const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border';
    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '1000px' }}>

            {/* ── Profile Header ──────────────────────────────────── */}
            <div
                className="rounded-xl border p-6 mb-6 flex items-center gap-5"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                {employee.profilePhoto?.url ? (
                    <img
                        src={employee.profilePhoto.url}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover shrink-0"
                        style={{ border: '3px solid var(--color-border-default)' }}
                    />
                ) : (
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                    >
                        {employee.userId?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                    </div>
                )}
                <div>
                    <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {employee.userId?.name}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {employee.designation}
                        {employee.employeeId && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-mono"
                                style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                                {employee.employeeId}
                            </span>
                        )}
                    </p>
                    <p className="text-xs mt-1 capitalize" style={{ color: 'var(--color-text-muted)' }}>
                        {employee.department} · {employee.employmentType}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-5">

                {/* Left — Employee Details + Personal Info */}
                <div className="col-span-2 space-y-5">

                    {/* Employee Details — read-only */}
                    <div className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <SectionHeader
                            icon={<User size={17} style={{ color: 'var(--color-primary)' }} />}
                            title="Employee Details"
                        />
                        <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                            <FieldRow label="Email">{employee.userId?.email}</FieldRow>
                            <FieldRow label="Department">
                                <span className="capitalize">{employee.department}</span>
                            </FieldRow>
                            <FieldRow label="Employment Type">
                                <span className="capitalize">{employee.employmentType}</span>
                            </FieldRow>
                            <FieldRow label="Status">
                                <span className="capitalize">{employee.status?.replace('-', ' ')}</span>
                            </FieldRow>
                            <FieldRow label="Joining Date">
                                {employee.joiningDate
                                    ? new Date(employee.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—'}
                            </FieldRow>
                            <FieldRow label="Working Days / Week">
                                {employee.workSchedule?.workingDaysPerWeek ?? 5} days
                            </FieldRow>
                        </div>
                    </div>

                    {/* Personal Information — editable */}
                    <div className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <SectionHeader
                            icon={<User size={17} style={{ color: 'var(--color-primary)' }} />}
                            title="Personal Information"
                            onEdit={openPersonalModal}
                        />
                        <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                            <FieldRow label="Mobile">{employee.personalInfo?.phone}</FieldRow>
                            <FieldRow label="Alternate Mobile">{employee.personalInfo?.alternatePhone}</FieldRow>
                            <FieldRow label="Gender">
                                <span className="capitalize">{employee.personalInfo?.gender}</span>
                            </FieldRow>
                            <FieldRow label="Date of Birth">
                                {employee.personalInfo?.dob
                                    ? new Date(employee.personalInfo.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '—'}
                            </FieldRow>
                            <FieldRow label="Father's Name">{employee.personalInfo?.fatherName}</FieldRow>
                            <FieldRow label="Father's Contact">{employee.personalInfo?.fatherPhone}</FieldRow>
                            <FieldRow label="Blood Group">{employee.personalInfo?.bloodGroup}</FieldRow>
                            <FieldRow label="Address">{employee.personalInfo?.address?.street}</FieldRow>
                            <FieldRow label="State">{employee.personalInfo?.address?.state}</FieldRow>
                            <FieldRow label="Pincode">{employee.personalInfo?.address?.postalCode}</FieldRow>
                            <FieldRow label="Emergency Contact">
                                {employee.personalInfo?.emergencyContact?.name
                                    ? `${employee.personalInfo.emergencyContact.name} (${employee.personalInfo.emergencyContact.relation}) — ${employee.personalInfo.emergencyContact.phone}`
                                    : '—'}
                            </FieldRow>
                        </div>
                    </div>
                </div>

                {/* Right — Bank Details + Identity */}
                <div className="space-y-5">

                    {/* Bank Details — editable */}
                    <div className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Briefcase size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Bank Details
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowBank(v => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    {showBank ? <EyeOff size={12} /> : <Eye size={12} />}
                                    {showBank ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    onClick={openBankModal}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    <Edit size={12} /> Edit
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {bankMasked.map(({ label, raw, masked }) => (
                                <div key={label} className="flex justify-between items-center py-2 border-b last:border-0"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                                    <span className="text-sm font-medium"
                                        style={{
                                            color: showBank && raw ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                            fontFamily: !showBank && raw ? 'monospace' : undefined,
                                        }}>
                                        {showBank ? (raw || '—') : (masked || raw ? (masked || raw) : '—')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Identity Verification — view only */}
                    {employee.identityVerification?.type && (
                        <div className="rounded-xl border p-6"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldCheck size={17} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Identity Verification
                                </h2>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Type</span>
                                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--color-text-primary)' }}>
                                        {employee.identityVerification.type}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>ID Number</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                            {employee.identityVerification.idNumber
                                                ? showIdNumber
                                                    ? String(employee.identityVerification.idNumber)
                                                    : '•••• ' + String(employee.identityVerification.idNumber).slice(-4)
                                                : '—'}
                                        </span>
                                        {employee.identityVerification.idNumber && (
                                            <button
                                                onClick={() => setShowIdNumber(v => !v)}
                                                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border cursor-pointer hover:bg-gray-50"
                                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                            >
                                                {showIdNumber ? <EyeOff size={10} /> : <Eye size={10} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {employee.identityVerification.documentCloudinaryId && (
                                    <div className="pt-1">
                                        <a
                                            href={`${API_BASE}/hrms/employees/${employee._id}/identity-document`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs flex items-center gap-1.5"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            <Eye size={12} /> View Document
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Personal Info Modal ──────────────────────────────── */}
            {activeModal === 'personal' && (
                <div className="modal-overlay">
                    <div className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Personal Information
                            </h2>
                            <button onClick={() => setActiveModal(null)}
                                className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePersonal} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    ['phone', 'Mobile'],
                                    ['alternatePhone', 'Alternate Mobile'],
                                    ['fatherName', "Father's Name"],
                                    ['fatherPhone', "Father's Contact"],
                                    ['bloodGroup', 'Blood Group'],
                                    ['address_street', 'Address / Street'],
                                    ['address_state', 'State'],
                                    ['address_postalCode', 'Pincode'],
                                    ['emergencyContact_name', 'Emergency Contact Name'],
                                    ['emergencyContact_phone', 'Emergency Contact Phone'],
                                    ['emergencyContact_relation', 'Relation'],
                                ].map(([key, label]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium mb-1.5"
                                            style={{ color: 'var(--color-text-secondary)' }}>
                                            {label}
                                        </label>
                                        <input
                                            type="text"
                                            value={(personalForm as any)[key]}
                                            onChange={e => setPersonalForm({ ...personalForm, [key]: e.target.value })}
                                            className={inputCls}
                                            style={inputStyle}
                                        />
                                    </div>
                                ))}
                                {/* Gender */}
                                <div>
                                    <label className="block text-xs font-medium mb-1.5"
                                        style={{ color: 'var(--color-text-secondary)' }}>Gender</label>
                                    <select
                                        value={personalForm.gender}
                                        onChange={e => setPersonalForm({ ...personalForm, gender: e.target.value })}
                                        className={inputCls}
                                        style={inputStyle}
                                    >
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                {/* DOB */}
                                <div>
                                    <label className="block text-xs font-medium mb-1.5"
                                        style={{ color: 'var(--color-text-secondary)' }}>Date of Birth</label>
                                    <input
                                        type="date"
                                        value={personalForm.dob}
                                        onChange={e => setPersonalForm({ ...personalForm, dob: e.target.value })}
                                        className={inputCls}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setActiveModal(null)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Bank Details Modal ────────────────────────────────── */}
            {activeModal === 'bank' && (
                <div className="modal-overlay">
                    <div className="w-full max-w-md rounded-xl border p-6 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Bank Details
                            </h2>
                            <button onClick={() => setActiveModal(null)}
                                className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBank} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    ['bankName', 'Bank Name'],
                                    ['accountNumber', 'Account Number'],
                                    ['ifscCode', 'IFSC Code'],
                                    ['bankBranch', 'Branch'],
                                    ['panNumber', 'PAN Number'],
                                    ['upiId', 'UPI ID'],
                                ].map(([key, label]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium mb-1.5"
                                            style={{ color: 'var(--color-text-secondary)' }}>
                                            {label}
                                        </label>
                                        <input
                                            type="text"
                                            value={(bankForm as any)[key]}
                                            onChange={e => setBankForm({ ...bankForm, [key]: e.target.value })}
                                            className={inputCls}
                                            style={inputStyle}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Save Changes
                                </button>
                                <button type="button" onClick={() => setActiveModal(null)}
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
