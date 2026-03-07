import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    User, CreditCard, ShieldCheck, Shirt, CheckCircle2,
    Loader2, Upload, AlertCircle, ChevronRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────
interface FormInfo {
    employeeId: string;
    name: string;
    designation: string;
    department: string;
    formSubmitted: boolean;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli',
    'Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ── Field component ──────────────────────────────────────────────────
function Field({
    label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
};

const SELECT_STYLE: React.CSSProperties = {
    ...INPUT_STYLE,
    cursor: 'pointer',
};

// ── Main Component ───────────────────────────────────────────────────
export default function EmployeeOnboardingFormPage() {
    const { token } = useParams<{ token: string }>();

    const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [infoError, setInfoError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // File previews
    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
    const [identityDocName, setIdentityDocName] = useState<string>('');
    const profilePhotoRef = useRef<HTMLInputElement>(null);
    const identityDocRef = useRef<HTMLInputElement>(null);

    // Form state
    const [form, setForm] = useState({
        // Personal
        phone: '',
        alternatePhone: '',
        gender: '',
        dob: '',
        fatherName: '',
        fatherPhone: '',
        fullAddress: '',
        state: '',
        pincode: '',
        // Bank
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        bankBranch: '',
        panNumber: '',
        upiId: '',
        // Identity
        identityType: '',
        identityIdNumber: '',
        // T-shirt size
        tshirtSize: '',
    });

    // ── Load form info ───────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        setLoadingInfo(true);
        fetch(`${API_BASE}/employee-form/${token}`)
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || 'Invalid form link');
                setFormInfo(json.data);
                if (json.data.formSubmitted) setSubmitted(true);
            })
            .catch((err) => setInfoError(err.message))
            .finally(() => setLoadingInfo(false));
    }, [token]);

    // ── Handle photo preview ─────────────────────────────────────────
    const handleProfilePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setProfilePhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // ── Handle submit ────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        // Build FormData
        const fd = new FormData();
        Object.entries(form).forEach(([key, val]) => {
            if (val) fd.append(key, val);
        });

        const profilePhotoFile = profilePhotoRef.current?.files?.[0];
        const identityDocFile = identityDocRef.current?.files?.[0];

        if (!profilePhotoFile) { setSubmitError('Profile photo is required.'); return; }
        if (!identityDocFile) { setSubmitError('Identity document upload is required.'); return; }
        if (!form.identityType) { setSubmitError('Identity verification type is required.'); return; }
        if (!form.identityIdNumber) { setSubmitError('Identity ID number is required.'); return; }
        if (!form.panNumber) { setSubmitError('PAN number is required.'); return; }
        fd.append('profilePhoto', profilePhotoFile);
        fd.append('identityDocument', identityDocFile);

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/employee-form/${token}/submit`, {
                method: 'POST',
                body: fd,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Submission failed');
            setSubmitted(true);
        } catch (err: any) {
            setSubmitError(err.message || 'An error occurred during submission.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── States ───────────────────────────────────────────────────────
    if (loadingInfo) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
                <Loader2 className="animate-spin" size={28} style={{ color: '#22C55E' }} />
            </div>
        );
    }

    if (infoError) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: '24px' }}>
                <div style={{ maxWidth: '420px', textAlign: 'center' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <AlertCircle size={28} style={{ color: '#DC2626' }} />
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Invalid Form Link</h2>
                    <p style={{ fontSize: '14px', color: '#6B7280' }}>{infoError}</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        const loginUrl = (import.meta as any).env?.VITE_FRONTEND_URL
            ? `${(import.meta as any).env.VITE_FRONTEND_URL}/login`
            : `${window.location.origin}/login`;
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: '24px' }}>
                <div style={{ maxWidth: '480px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <CheckCircle2 size={32} style={{ color: '#16A34A' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                        Form Submitted!
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: '1.6', marginBottom: '28px' }}>
                        Thank you, <strong>{formInfo?.name}</strong>. Your details have been submitted successfully.
                        The HR team will review them shortly.
                    </p>
                    {formInfo?.formSubmitted && !submitting && (
                        <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>
                            (This form was already submitted earlier.)
                        </p>
                    )}
                    <a
                        href={loginUrl}
                        style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '12px 28px', fontSize: '14px', fontWeight: 600,
                            color: '#FFFFFF', backgroundColor: '#22C55E',
                            borderRadius: '10px', textDecoration: 'none',
                            transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16A34A')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22C55E')}
                    >
                        Go to Login &rarr;
                    </a>
                </div>
            </div>
        );
    }

    const sectionCard = (icon: React.ReactNode, title: string, children: React.ReactNode) => (
        <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                {icon}
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {children}
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '32px 16px' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#DCFCE7', marginBottom: '16px' }}>
                        <User size={24} style={{ color: '#16A34A' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                        Employee Onboarding Form
                    </h1>
                    <p style={{ fontSize: '14px', color: '#6B7280' }}>
                        Hi <strong>{formInfo?.name}</strong>! Please fill in all the details below.
                        This form can only be submitted once.
                    </p>
                    <div style={{ display: 'inline-flex', gap: '12px', marginTop: '12px' }}>
                        <span style={{ fontSize: '12px', backgroundColor: '#F3F4F6', padding: '4px 10px', borderRadius: '20px', color: '#374151' }}>
                            {formInfo?.employeeId}
                        </span>
                        <span style={{ fontSize: '12px', backgroundColor: '#F3F4F6', padding: '4px 10px', borderRadius: '20px', color: '#374151', textTransform: 'capitalize' }}>
                            {formInfo?.designation} · {formInfo?.department}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>

                    {/* ── Section 1: Personal Information ─────────── */}
                    {sectionCard(
                        <User size={18} style={{ color: '#22C55E' }} />,
                        'Personal Information',
                        <>
                            {/* Profile Photo — full width */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="Profile Photo" required>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {profilePhotoPreview ? (
                                            <img src={profilePhotoPreview} alt="Preview"
                                                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB' }} />
                                        ) : (
                                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #E5E7EB' }}>
                                                <User size={24} style={{ color: '#9CA3AF' }} />
                                            </div>
                                        )}
                                        <div>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                ref={profilePhotoRef}
                                                onChange={handleProfilePhoto}
                                                style={{ display: 'none' }}
                                                id="profile-photo-input"
                                            />
                                            <label htmlFor="profile-photo-input" style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                                                borderRadius: '8px', border: '1px solid #E5E7EB',
                                                backgroundColor: '#FFFFFF', color: '#374151', cursor: 'pointer',
                                            }}>
                                                <Upload size={14} /> Upload Photo
                                            </label>
                                            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                                                JPG, PNG or WEBP · Max 5MB
                                            </p>
                                        </div>
                                    </div>
                                </Field>
                            </div>

                            <Field label="Mobile Number" required>
                                <input type="tel" maxLength={10} required value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    style={INPUT_STYLE} placeholder="10-digit mobile number" />
                            </Field>

                            <Field label="Alternate Mobile Number">
                                <input type="tel" maxLength={10} value={form.alternatePhone}
                                    onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
                                    style={INPUT_STYLE} placeholder="Optional" />
                            </Field>

                            <Field label="Gender" required>
                                <select required value={form.gender}
                                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                                    style={SELECT_STYLE}>
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </Field>

                            <Field label="Date of Birth" required>
                                <input type="date" required value={form.dob}
                                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                                    style={INPUT_STYLE} max={new Date().toISOString().split('T')[0]} />
                            </Field>

                            <Field label="Father's Name" required>
                                <input type="text" required value={form.fatherName}
                                    onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                                    style={INPUT_STYLE} placeholder="Father's full name" />
                            </Field>

                            <Field label="Father's Contact Number" required>
                                <input type="tel" required maxLength={10} value={form.fatherPhone}
                                    onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })}
                                    style={INPUT_STYLE} placeholder="Father's mobile" />
                            </Field>

                            {/* Full Address — spans 2 cols */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="Full Address" required>
                                    <textarea required value={form.fullAddress}
                                        onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
                                        rows={3}
                                        style={{ ...INPUT_STYLE, resize: 'vertical' }}
                                        placeholder="House no., Street, Area, City..." />
                                </Field>
                            </div>

                            <Field label="State" required>
                                <select required value={form.state}
                                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                                    style={SELECT_STYLE}>
                                    <option value="">Select state</option>
                                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </Field>

                            <Field label="Pincode" required>
                                <input type="text" required maxLength={6} pattern="[0-9]{6}" value={form.pincode}
                                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                                    style={INPUT_STYLE} placeholder="6-digit pincode" />
                            </Field>
                        </>
                    )}

                    {/* ── Section 2: Bank Details ──────────────────── */}
                    {sectionCard(
                        <CreditCard size={18} style={{ color: '#22C55E' }} />,
                        'Bank Details',
                        <>
                            <Field label="Bank Name" required>
                                <input type="text" required value={form.bankName}
                                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                    style={INPUT_STYLE} placeholder="e.g. State Bank of India" />
                            </Field>

                            <Field label="Account Number" required>
                                <input type="text" required value={form.accountNumber}
                                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                                    style={INPUT_STYLE} placeholder="Bank account number" />
                            </Field>

                            <Field label="IFSC Code" required>
                                <input type="text" required value={form.ifscCode}
                                    onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                                    style={INPUT_STYLE} placeholder="e.g. SBIN0001234" />
                            </Field>

                            <Field label="Bank Branch" required>
                                <input type="text" required value={form.bankBranch}
                                    onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                                    style={INPUT_STYLE} placeholder="Branch name" />
                            </Field>

                            <Field label="PAN Number" required>
                                <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                                    title="Enter a valid PAN (e.g. ABCDE1234F)"
                                    value={form.panNumber}
                                    onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                                    style={INPUT_STYLE}
                                    placeholder="e.g. ABCDE1234F"
                                />
                            </Field>

                            <Field label="UPI ID">
                                <input type="text" value={form.upiId}
                                    onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                                    style={INPUT_STYLE} placeholder="e.g. name@upi (optional)" />
                            </Field>
                        </>
                    )}

                    {/* ── Section 3: Identity Verification ────────── */}
                    {sectionCard(
                        <ShieldCheck size={18} style={{ color: '#22C55E' }} />,
                        'Identity Verification',
                        <>
                            <Field label="Identity Type" required>
                                <select required value={form.identityType}
                                    onChange={(e) => setForm({ ...form, identityType: e.target.value })}
                                    style={SELECT_STYLE}>
                                    <option value="">Select type</option>
                                    <option value="aadhaar">Aadhaar Card</option>
                                    <option value="pan">PAN Card</option>
                                    <option value="voter">Voter ID</option>
                                    <option value="other">Other</option>
                                </select>
                            </Field>

                            <Field label="ID Number" required>
                                <input type="text" required value={form.identityIdNumber}
                                    onChange={(e) => setForm({ ...form, identityIdNumber: e.target.value.toUpperCase() })}
                                    style={INPUT_STYLE} placeholder="Enter ID number" />
                            </Field>

                            {/* Document upload — full width */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Field label="Upload Document" required>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            ref={identityDocRef}
                                            onChange={(e) => setIdentityDocName(e.target.files?.[0]?.name || '')}
                                            style={{ display: 'none' }}
                                            id="identity-doc-input"
                                        />
                                        <label htmlFor="identity-doc-input" style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                                            borderRadius: '8px', border: '1px solid #E5E7EB',
                                            backgroundColor: '#FFFFFF', color: '#374151', cursor: 'pointer',
                                        }}>
                                            <Upload size={14} />
                                            {identityDocName ? 'Change File' : 'Upload Document'}
                                        </label>
                                        {identityDocName && (
                                            <span style={{ fontSize: '13px', color: '#374151' }}>{identityDocName}</span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
                                        JPG, PNG, WEBP or PDF · Max 5MB
                                    </p>
                                </Field>
                            </div>
                        </>
                    )}

                    {/* ── Section 4: T-Shirt Size ──────────────────── */}
                    <div style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '24px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <Shirt size={18} style={{ color: '#22C55E' }} />
                            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>T-Shirt Size</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {(['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    onClick={() => setForm({ ...form, tshirtSize: size })}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        borderColor: form.tshirtSize === size ? '#22C55E' : '#E5E7EB',
                                        backgroundColor: form.tshirtSize === size ? '#DCFCE7' : '#FFFFFF',
                                        color: form.tshirtSize === size ? '#16A34A' : '#374151',
                                    }}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                        {!form.tshirtSize && (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '10px' }}>Please select a size (optional)</p>
                        )}
                    </div>

                    {/* Error Banner */}
                    {submitError && (
                        <div style={{
                            padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                            backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
                            fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            <AlertCircle size={16} /> {submitError}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#FFFFFF',
                            backgroundColor: submitting ? '#86EFAC' : '#22C55E',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginBottom: '40px',
                        }}
                    >
                        {submitting
                            ? <><Loader2 size={18} className="animate-spin" /> Submitting…</>
                            : <><ChevronRight size={18} /> Submit Onboarding Form</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
