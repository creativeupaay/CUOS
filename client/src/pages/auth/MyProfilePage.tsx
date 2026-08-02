import { useState, useEffect, useRef } from 'react';
import {
    useGetMyProfileQuery,
    useUpdateMyProfileMutation,
    useUpdateMyProfilePhotoMutation,
} from '@/features/hrms/hrmsApi';
import {
    User, Briefcase, ShieldCheck, Eye, EyeOff,
    Edit, X, Loader2, Save, Camera, Building2, UserCircle2
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAppSelector } from '@/app/hooks';
import { useGetPartnerByIdQuery, useUpdatePartnerMutation, useUploadPartnerImageMutation } from '@/features/partners/partnersApi';
import { useGetPartnerEmployeeByIdQuery, useUpdatePartnerEmployeeMutation } from '@/features/partners/partnerEmployeeApi';

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

function InfoField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <p className="mt-2 text-sm font-medium break-words" style={{ color: 'var(--color-text-primary)' }}>
                {value && String(value).trim() ? value : '-'}
            </p>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function MyProfilePage() {
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role ? (typeof user.role === 'object' ? (user.role as any).name : String(user.role)) : '';
    const isPartner = roleName.toLowerCase() === 'partner';
    const isPartnerEmployee = !!user?.isPartnerEmployee;
    const isRegularEmployee = !isPartner;

    const { data: empData, isLoading: empLoading, refetch: empRefetch } = useGetMyProfileQuery(undefined, { skip: !isRegularEmployee });
    const { data: partnerDataPayload, isLoading: partnerLoading, refetch: partnerRefetch } = useGetPartnerByIdQuery((user?.partnerId as any) || '', { skip: (!isPartner || isPartnerEmployee || !user?.partnerId) });
    const { data: peDataPayload, isLoading: peLoading, refetch: peRefetch } = useGetPartnerEmployeeByIdQuery(user?._id || '', { skip: (!isPartnerEmployee || !user?._id) });

    const [updateMyProfile, { isLoading: isSavingEmp }] = useUpdateMyProfileMutation();
    const [updatePartner, { isLoading: isSavingPartner }] = useUpdatePartnerMutation();
    const [uploadPartnerImage, { isLoading: isUploadingPartnerImage }] = useUploadPartnerImageMutation();
    const [updatePartnerEmployee, { isLoading: isSavingPe }] = useUpdatePartnerEmployeeMutation();
    const [updateMyProfilePhoto, { isLoading: isUploadingPhoto }] = useUpdateMyProfilePhotoMutation();
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const partnerLogoInputRef = useRef<HTMLInputElement | null>(null);
    const partnerPhotoInputRef = useRef<HTMLInputElement | null>(null);

    const isLoading = empLoading || partnerLoading || peLoading;
    const isSaving = isSavingEmp || isSavingPartner || isSavingPe || isUploadingPartnerImage;

    const employee = empData?.data?.employee as any;
    const partnerInfo = partnerDataPayload?.data as any;
    const partnerEmployeeInfo = peDataPayload?.data as any;

    // ── Modal state ──────────────────────────────────────────────────
    type ModalType = null | 'personal' | 'bank';
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    // ── Tab state for Partner ────────────────────────────────────────
    const [tab, setTab] = useState<'company' | 'personal'>('company');

    // ── Personal Info Form ───────────────────────────────────────────
    const [personalForm, setPersonalForm] = useState({
        phone: '',
        alternatePhone: '',
        fatherName: '',
        fatherPhone: '',
        gender: '',
        dob: '',
        address_street: '',
        address_state: '',
        address_postalCode: '',
        // Partner additional fields
        companyName: '',
        contactPerson: '',
        websiteLink: '',
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

    const hasOpenModal = activeModal !== null;

    useEffect(() => {
        if (!hasOpenModal) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [hasOpenModal]);

    const openPersonalModal = () => {
        if (isPartner && !isPartnerEmployee) {
            setPersonalForm({
                ...personalForm,
                phone: partnerInfo?.phone || partnerInfo?.contactPersonPhone || '',
                companyName: partnerInfo?.companyName || '',
                contactPerson: partnerInfo?.contactPerson || '',
                websiteLink: partnerInfo?.websiteLink || '',
                address_street: partnerInfo?.address?.street || '',
                address_state: partnerInfo?.address?.state || '',
                address_postalCode: partnerInfo?.address?.postalCode || '',
            });
        } else if (isPartnerEmployee) {
            setPersonalForm({
                ...personalForm,
                phone: partnerEmployeeInfo?.phone || '',
            });
        } else {
            const pi = employee?.personalInfo || {};
            setPersonalForm({
                ...personalForm,
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
        }
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
            if (isPartner && !isPartnerEmployee) {
                await updatePartner({
                    id: user?.partnerId as string,
                    data: {
                        phone: personalForm.phone || undefined,
                        contactPersonPhone: personalForm.phone || undefined,
                        companyName: personalForm.companyName || undefined,
                        contactPerson: personalForm.contactPerson || undefined,
                        websiteLink: personalForm.websiteLink || undefined,
                        address: {
                            street: personalForm.address_street || undefined,
                            state: personalForm.address_state || undefined,
                            postalCode: personalForm.address_postalCode || undefined,
                        }
                    }
                }).unwrap();
                partnerRefetch();
            } else if (isPartnerEmployee) {
                await updatePartnerEmployee({
                    id: user?._id as string,
                    data: {
                        phone: personalForm.phone || undefined,
                    }
                }).unwrap();
                peRefetch();
            } else {
                await updateMyProfile({
                    personalInfo: {
                        phone: personalForm.phone || undefined,
                        alternatePhone: personalForm.alternatePhone || undefined,
                        fatherName: personalForm.fatherName || undefined,
                        fatherPhone: personalForm.fatherPhone || undefined,
                        gender: (personalForm.gender as any) || undefined,
                        dob: personalForm.dob || undefined,
                        address: {
                            street: personalForm.address_street || undefined,
                            state: personalForm.address_state || undefined,
                            postalCode: personalForm.address_postalCode || undefined,
                        },
                    },
                }).unwrap();
                empRefetch();
            }
            setActiveModal(null);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save personal info');
        }
    };

    const handleSaveBank = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMyProfile({ bankDetails: bankForm }).unwrap();
            setActiveModal(null);
            empRefetch();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save bank details');
        }
    };

    const handlePartnerImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'photo') => {
        const file = e.target.files?.[0];
        if (!file || !user?.partnerId) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            await uploadPartnerImage({ id: user.partnerId as string, type, data: formData }).unwrap();
            partnerRefetch();
        } catch (err: any) {
            alert(err?.data?.message || `Failed to update ${type === 'logo' ? 'company logo' : 'profile photo'}`);
        } finally {
            e.target.value = '';
        }
    };

    const handleMyPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('profilePhoto', file);
            await updateMyProfilePhoto(formData).unwrap();
            empRefetch();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to update profile photo');
        } finally {
            e.target.value = '';
        }
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Loading your profile…
            </div>
        );
    }

    const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border';
    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    // ── PARTNER OWNER EARLY RETURN ──────────────────────────────────
    if (isPartner && !isPartnerEmployee && partnerInfo) {
        return (
            <div className="mx-auto" style={{ maxWidth: '1000px' }}>
                <div className="col-span-3 rounded-[28px] border bg-white shadow-sm mb-6" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div
                        className="flex flex-wrap gap-2 border-b px-4 pt-4"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}
                    >
                        {(['company', 'personal'] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className="rounded-t-2xl px-5 py-3 text-sm font-semibold transition-all cursor-pointer"
                                style={
                                    tab === key
                                        ? {
                                            backgroundColor: 'white',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderBottomColor: 'white',
                                        }
                                        : {
                                            color: 'var(--color-text-secondary)',
                                            backgroundColor: 'transparent',
                                            border: '1px solid transparent',
                                        }
                                }
                            >
                                {key === 'company' ? 'Company Info' : 'Personal Info'}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 md:p-7">
                        {tab === 'company' && (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                                <div className="rounded-3xl border p-6 text-center relative" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <div className="mx-auto flex h-40 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-3xl border bg-white relative group" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {partnerInfo.companyLogo ? (
                                            <img src={partnerInfo.companyLogo} alt={partnerInfo.companyName || 'Company logo'} className="h-full w-full object-contain p-5" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <Building2 size={40} style={{ color: '#94A3B8' }} />
                                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No logo</span>
                                            </div>
                                        )}
                                        <input type="file" accept="image/*" className="hidden" ref={partnerLogoInputRef} onChange={e => handlePartnerImageChange(e, 'logo')} />
                                        <button onClick={() => partnerLogoInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            {isUploadingPartnerImage ? <Loader2 className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
                                        </button>
                                    </div>
                                    <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        {partnerInfo.companyName || 'Company name not added'}
                                    </p>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {partnerInfo.websiteLink || 'Website not added yet'}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Company Details</h2>
                                          <button onClick={openPersonalModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}><Edit size={12}/> Edit Info</button>
                                     </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <InfoField label="Company Name" value={partnerInfo.companyName} />
                                        <InfoField label="Website" value={partnerInfo.websiteLink} />
                                        <InfoField label="Contact Person" value={partnerInfo.contactPerson} />
                                        <InfoField label="Contact Person Phone" value={partnerInfo.phone || partnerInfo.contactPersonPhone} />
                                        <div className="md:col-span-2">
                                            <InfoField label="Address" value={`${partnerInfo.address?.street || ''} ${partnerInfo.address?.state || ''} ${partnerInfo.address?.postalCode || ''}`.trim() || '-'} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'personal' && (
                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                                <div className="rounded-3xl border p-6 text-center relative" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-3xl border bg-white relative group" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {partnerInfo.photo ? (
                                            <img src={partnerInfo.photo} alt={partnerInfo.contactPerson || 'Partner'} className="h-full w-full object-cover" />
                                        ) : (
                                            <UserCircle2 size={72} style={{ color: '#94A3B8' }} />
                                        )}
                                        <input type="file" accept="image/*" className="hidden" ref={partnerPhotoInputRef} onChange={e => handlePartnerImageChange(e, 'photo')} />
                                        <button onClick={() => partnerPhotoInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            {isUploadingPartnerImage ? <Loader2 className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
                                        </button>
                                    </div>
                                    <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        {partnerInfo.contactPerson || partnerInfo.userId?.name || 'Name not available'}
                                    </p>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {partnerInfo.email || partnerInfo.userId?.email || 'No email added'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Personal Details</h2>
                                          <button onClick={openPersonalModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}><Edit size={12}/> Edit Info</button>
                                     </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <InfoField label="Primary Name" value={partnerInfo.userId?.name || partnerInfo.contactPerson} />
                                        <InfoField label="Primary Email" value={partnerInfo.userId?.email || partnerInfo.email} />
                                        <InfoField label="Phone" value={partnerInfo.phone || partnerInfo.contactPersonPhone} />
                                        <InfoField label="Contact Person" value={partnerInfo.contactPerson} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Personal Info Modal ──────────────────────────────── */}
                {activeModal === 'personal' && (
                    <ModalPortal>
                        <div className="w-full max-w-4xl rounded-xl border p-5 shadow-xl"
                            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    Edit Contact Information
                                </h2>
                                <button onClick={() => setActiveModal(null)}
                                    className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                    <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                                </button>
                            </div>
                            <form onSubmit={handleSavePersonal} className="space-y-3">
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'companyName', label: "Company Name" },
                                        { key: 'contactPerson', label: "Contact Person" },
                                        { key: 'phone', label: "Phone" },
                                        { key: 'websiteLink', label: "Website" },
                                        { key: 'address_street', label: 'Address / Street' },
                                        { key: 'address_state', label: 'State' },
                                        { key: 'address_postalCode', label: 'Pincode' },
                                    ].map(({ key, label }) => (
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
                    </ModalPortal>
                )}
            </div>
        );
    }

    // ── EMPLOYEE & TEAM MEMBER UI ───────────────────────────────────

    if (isPartnerEmployee && !partnerEmployeeInfo) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No team member profile found.
            </div>
        );
    }

    if (!employee && isRegularEmployee) {
        return (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No employee profile found. Contact HR.
            </div>
        );
    }

    const bankMasked = [
        { label: 'Bank Name', raw: employee?.bankDetails?.bankName },
        {
            label: 'Account Number',
            raw: employee?.bankDetails?.accountNumber,
            masked: employee?.bankDetails?.accountNumber
                ? '•••• ' + employee.bankDetails.accountNumber.slice(-4)
                : null,
        },
        { label: 'IFSC Code', raw: employee?.bankDetails?.ifscCode },
        { label: 'Bank Branch', raw: employee?.bankDetails?.bankBranch },
        { label: 'UPI ID', raw: employee?.bankDetails?.upiId },
        {
            label: 'PAN Number',
            raw: employee?.bankDetails?.panNumber,
            masked: employee?.bankDetails?.panNumber
                ? employee.bankDetails.panNumber.slice(0, 3) + '••••' + employee.bankDetails.panNumber.slice(-3)
                : null,
        },
    ];

    return (
        <div className="mx-auto" style={{ maxWidth: '1000px' }}>
            {/* ── Profile Header ──────────────────────────────────── */}
            <div
                className="rounded-xl border p-6 mb-6 flex items-center gap-5"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                {isPartnerEmployee ? (
                    // Partner Employee Header
                    <>
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                        >
                            {partnerEmployeeInfo?.name?.substring(0, 2).toUpperCase() || 'P'}
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {partnerEmployeeInfo?.name}
                            </h1>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                {partnerEmployeeInfo?.designation || 'Partner Team Member'}
                            </p>
                        </div>
                    </>
                ) : (
                    // Employee Header
                    <>
                        {employee?.profilePhoto?.url ? (
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
                                {employee?.userId?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {employee?.userId?.name}
                            </h1>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                {employee?.designation}
                                {employee?.employeeId && (
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-mono"
                                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                                        {employee.employeeId}
                                    </span>
                                )}
                            </p>
                            <p className="text-xs mt-1 capitalize" style={{ color: 'var(--color-text-muted)' }}>
                                {employee?.department} · {employee?.employmentType}
                            </p>
                            <div className="mt-3">
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={isUploadingPhoto}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50 disabled:opacity-60"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    {isUploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                    Change Photo
                                </button>
                                <input
                                    ref={photoInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={handleMyPhotoChange}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="grid grid-cols-3 gap-5">

                {/* Left — Employee Details + Personal Info */}
                <div className="col-span-2 space-y-5">
                    {/* Employee/Partner Details — read-only */}
                    {isPartnerEmployee ? (
                        <div className="rounded-xl border p-6"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <SectionHeader
                                icon={<User size={17} style={{ color: 'var(--color-primary)' }} />}
                                title="Account Profile"
                            />
                            <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                                <FieldRow label="Email">{partnerEmployeeInfo?.email}</FieldRow>
                                <FieldRow label="Designation">{partnerEmployeeInfo?.designation}</FieldRow>
                                <FieldRow label="Status">
                                    <span className="capitalize">{partnerEmployeeInfo?.isActive ? 'Active' : 'Inactive'}</span>
                                </FieldRow>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border p-6"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <SectionHeader
                                icon={<User size={17} style={{ color: 'var(--color-primary)' }} />}
                                title="Employee Details"
                            />
                            <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                                <FieldRow label="Email">{employee?.userId?.email}</FieldRow>
                                <FieldRow label="Department">
                                    <span className="capitalize">{employee?.department}</span>
                                </FieldRow>
                                <FieldRow label="Employment Type">
                                    <span className="capitalize">{employee?.employmentType}</span>
                                </FieldRow>
                                <FieldRow label="Status">
                                    <span className="capitalize">{employee?.status?.replace('-', ' ')}</span>
                                </FieldRow>
                                <FieldRow label="Joining Date">
                                    {employee?.joiningDate
                                        ? new Date(employee.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : '—'}
                                </FieldRow>
                                <FieldRow label="Working Days / Week">
                                    {employee?.workSchedule?.workingDaysPerWeek ?? 5} days
                                </FieldRow>
                            </div>
                        </div>
                    )}

                    {/* Personal Information — editable */}
                    <div className="rounded-xl border p-6"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <SectionHeader
                            icon={<User size={17} style={{ color: 'var(--color-primary)' }} />}
                            title={'Personal Information'}
                            onEdit={openPersonalModal}
                        />
                        <div className="grid grid-cols-2 gap-y-5 gap-x-10">
                            {isPartnerEmployee ? (
                                <>
                                    <FieldRow label="Mobile">{partnerEmployeeInfo?.phone}</FieldRow>
                                </>
                            ) : (
                                <>
                                    <FieldRow label="Mobile">{employee?.personalInfo?.phone}</FieldRow>
                                    <FieldRow label="Alternate Mobile">{employee?.personalInfo?.alternatePhone}</FieldRow>
                                    <FieldRow label="Gender">
                                        <span className="capitalize">{employee?.personalInfo?.gender}</span>
                                    </FieldRow>
                                    <FieldRow label="Date of Birth">
                                        {employee?.personalInfo?.dob
                                            ? new Date(employee.personalInfo.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : '—'}
                                    </FieldRow>
                                    <FieldRow label="Father's Name">{employee?.personalInfo?.fatherName}</FieldRow>
                                    <FieldRow label="Father's Contact">{employee?.personalInfo?.fatherPhone}</FieldRow>
                                    <FieldRow label="Address">{employee?.personalInfo?.address?.street}</FieldRow>
                                    <FieldRow label="State">{employee?.personalInfo?.address?.state}</FieldRow>
                                    <FieldRow label="Pincode">{employee?.personalInfo?.address?.postalCode}</FieldRow>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right — Bank Details + Identity */}
                <div className="space-y-5">
                    {isRegularEmployee && (
                        <>
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
                            {employee?.identityVerification?.type && (
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
                        </>
                    )}
                </div>
            </div>

            {/* ── Personal Info Modal ──────────────────────────────── */}
            {activeModal === 'personal' && (
                <ModalPortal>
                    <div className="w-full max-w-4xl rounded-xl border p-5 shadow-xl"
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
                        <form onSubmit={handleSavePersonal} className="space-y-3">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { key: 'phone', label: 'Mobile', show: true },
                                    { key: 'alternatePhone', label: 'Alternate Mobile', show: isRegularEmployee },
                                    { key: 'fatherName', label: "Father's Name", show: isRegularEmployee },
                                    { key: 'fatherPhone', label: "Father's Contact", show: isRegularEmployee },
                                    { key: 'address_street', label: 'Address / Street', show: !isPartnerEmployee },
                                    { key: 'address_state', label: 'State', show: !isPartnerEmployee },
                                    { key: 'address_postalCode', label: 'Pincode', show: !isPartnerEmployee },
                                ].filter(f => f.show).map(({ key, label }) => (
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
                                {isRegularEmployee && (
                                    <>
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
                                    </>
                                )}
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
                </ModalPortal>
            )}

            {/* ── Bank Details Modal ────────────────────────────────── */}
            {activeModal === 'bank' && (
                <ModalPortal>
                    <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
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
                        <form onSubmit={handleSaveBank} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
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
                </ModalPortal>
            )}
        </div>
    );
}
