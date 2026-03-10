import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────
interface OnboardingFormData {
    name: string;
    companyName: string;
    email: string;
    phone: string;
    otherPhones: { number: string; label: string }[];
    registrationType: 'Registered' | 'Unregistered' | 'Overseas';
    gstNumber: string;
    vatNumber: string;
    address: {
        street: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
    };
    billingDetails: {
        billingEmail: string;
        taxId: string;
        paymentTerms: string;
        currency: string;
    };
    contacts: {
        name: string;
        email: string;
        phone: string;
        role: string;
        isPrimary: boolean;
    }[];

}

// ── Helpers ───────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

const INPUT = 'w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white text-neutral-900 placeholder:text-neutral-400';
const LABEL = 'block text-xs font-medium text-neutral-600 mb-1.5';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className={LABEL}>
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

const emptyForm = (): OnboardingFormData => ({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    otherPhones: [],
    registrationType: 'Unregistered',
    gstNumber: '',
    vatNumber: '',
    address: { street: '', city: '', state: '', country: '', postalCode: '' },
    billingDetails: { billingEmail: '', taxId: '', paymentTerms: '', currency: 'INR' },
    contacts: [],

});

// ── Page ──────────────────────────────────────────────────────────────
export default function ClientOnboardingPage() {
    const { token } = useParams<{ token: string }>();

    const [status, setStatus] = useState<'loading' | 'ready' | 'submitted' | 'expired' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [formData, setFormData] = useState<OnboardingFormData>(emptyForm());
    const [saving, setSaving] = useState(false);

    // ── Load form data from token ──
    useEffect(() => {
        if (!token) return;

        fetch(`${API_BASE}/client-onboarding/${token}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.status !== 'success') {
                    const msg: string = json.message || '';
                    if (msg.toLowerCase().includes('expired')) setStatus('expired');
                    else if (msg.toLowerCase().includes('already been submitted')) setStatus('submitted');
                    else { setErrorMsg(msg || 'Invalid link.'); setStatus('error'); }
                    return;
                }

                const d = json.data;
                setFormData({
                    name: d.name ?? '',
                    companyName: d.companyName ?? '',
                    email: d.email ?? '',
                    phone: d.phone ?? '',
                    otherPhones: d.otherPhones ?? [],
                    registrationType: d.registrationType ?? 'Unregistered',
                    gstNumber: d.gstNumber ?? '',
                    vatNumber: d.vatNumber ?? '',
                    address: {
                        street: d.address?.street ?? '',
                        city: d.address?.city ?? '',
                        state: d.address?.state ?? '',
                        country: d.address?.country ?? '',
                        postalCode: d.address?.postalCode ?? '',
                    },
                    billingDetails: {
                        billingEmail: d.billingDetails?.billingEmail ?? '',
                        taxId: d.billingDetails?.taxId ?? '',
                        paymentTerms: d.billingDetails?.paymentTerms ?? '',
                        currency: d.billingDetails?.currency ?? 'INR',
                    },
                    contacts: (d.contacts ?? []).map((c: any) => ({
                        name: c.name ?? '',
                        email: c.email ?? '',
                        phone: c.phone ?? '',
                        role: c.role ?? '',
                        isPrimary: c.isPrimary ?? false,
                    })),

                });
                setStatus('ready');
            })
            .catch(() => {
                setErrorMsg('Unable to load the form. Please try again later.');
                setStatus('error');
            });
    }, [token]);

    // ── Submit ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch(`${API_BASE}/client-onboarding/${token}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const json = await res.json();

            if (json.status === 'success') {
                setStatus('submitted');
            } else {
                alert(json.message || 'Submission failed. Please try again.');
            }
        } catch {
            alert('Network error. Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    // ── Field helpers ──
    const setField = (path: string, value: any) => {
        setFormData((prev) => {
            const parts = path.split('.');
            if (parts.length === 1) return { ...prev, [path]: value };
            if (parts.length === 2) return { ...prev, [parts[0]]: { ...(prev as any)[parts[0]], [parts[1]]: value } };
            return prev;
        });
    };

    const addContact = () =>
        setFormData((p) => ({
            ...p,
            contacts: [...p.contacts, { name: '', email: '', phone: '', role: '', isPrimary: p.contacts.length === 0 }],
        }));

    const removeContact = (i: number) =>
        setFormData((p) => ({ ...p, contacts: p.contacts.filter((_, idx) => idx !== i) }));

    const updateContact = (i: number, field: string, value: any) =>
        setFormData((p) => {
            const contacts = [...p.contacts];
            contacts[i] = { ...contacts[i], [field]: value };
            if (field === 'isPrimary' && value) contacts.forEach((c, idx) => { if (idx !== i) c.isPrimary = false; });
            return { ...p, contacts };
        });

    const addPhone = () =>
        setFormData((p) => ({ ...p, otherPhones: [...p.otherPhones, { number: '', label: '' }] }));

    const removePhone = (i: number) =>
        setFormData((p) => ({ ...p, otherPhones: p.otherPhones.filter((_, idx) => idx !== i) }));

    const updatePhone = (i: number, field: 'number' | 'label', value: string) =>
        setFormData((p) => {
            const phones = [...p.otherPhones];
            phones[i] = { ...phones[i], [field]: value };
            return { ...p, otherPhones: phones };
        });

    // ── Render states ──
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <div className="flex items-center gap-3 text-neutral-500">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm">Loading your form...</span>
                </div>
            </div>
        );
    }

    if (status === 'submitted') {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-neutral-900 mb-2">Details Submitted</h2>
                    <p className="text-sm text-neutral-500">
                        Thank you! Your details have been saved successfully. Our team will be in touch shortly.
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'expired') {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-amber-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-neutral-900 mb-2">Link Expired</h2>
                    <p className="text-sm text-neutral-500">
                        This onboarding link has expired. Please contact Creative Upaay to request a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-neutral-900 mb-2">Invalid Link</h2>
                    <p className="text-sm text-neutral-500">{errorMsg || 'This onboarding link is invalid or has already been used.'}</p>
                </div>
            </div>
        );
    }

    // ── Main Form ──
    return (
        <div className="min-h-screen bg-neutral-50 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">Creative Upaay</p>
                    <h1 className="text-2xl font-semibold text-neutral-900">Client Onboarding</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Please fill in your details below. All fields marked <span className="text-red-500">*</span> are required.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-base font-semibold text-neutral-900 mb-5">Basic Information</h2>



                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Full Name / Contact Name" required>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    className={INPUT}
                                    placeholder="Your name"
                                />
                            </Field>
                            <Field label="Company Name">
                                <input
                                    type="text"
                                    value={formData.companyName}
                                    onChange={(e) => setField('companyName', e.target.value)}
                                    className={INPUT}
                                    placeholder="Company or business name"
                                />
                            </Field>
                            <Field label="Email" required>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setField('email', e.target.value)}
                                    className={INPUT}
                                    placeholder="your@email.com"
                                />
                            </Field>
                            <Field label="Phone">
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setField('phone', e.target.value)}
                                    className={INPUT}
                                    placeholder="+91 98765 43210"
                                />
                            </Field>

                            {/* GST / VAT */}
                            {(formData.registrationType === 'Registered' || formData.registrationType === 'Unregistered') && (
                                <Field label="GST Number">
                                    <input
                                        type="text"
                                        value={formData.gstNumber}
                                        onChange={(e) => setField('gstNumber', e.target.value)}
                                        className={INPUT}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                    />
                                </Field>
                            )}
                            {formData.registrationType === 'Overseas' && (
                                <Field label="VAT Number">
                                    <input
                                        type="text"
                                        value={formData.vatNumber}
                                        onChange={(e) => setField('vatNumber', e.target.value)}
                                        className={INPUT}
                                        placeholder="VAT / Tax ID"
                                    />
                                </Field>
                            )}
                        </div>

                        {/* Additional phones */}
                        <div className="mt-4">
                            <p className={LABEL}>Additional Phone Numbers</p>
                            {formData.otherPhones.map((ph, i) => (
                                <div key={i} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder="Label (e.g. Work)"
                                        value={ph.label}
                                        onChange={(e) => updatePhone(i, 'label', e.target.value)}
                                        className={`${INPUT} w-1/3`}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Number"
                                        value={ph.number}
                                        onChange={(e) => updatePhone(i, 'number', e.target.value)}
                                        className={`${INPUT} flex-1`}
                                    />
                                    <button type="button" onClick={() => removePhone(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addPhone}
                                className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1"
                            >
                                <Plus size={14} /> Add Number
                            </button>
                        </div>
                    </section>

                    {/* Address */}
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-base font-semibold text-neutral-900 mb-5">Address</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Street">
                                <input type="text" value={formData.address.street} onChange={(e) => setField('address.street', e.target.value)} className={INPUT} placeholder="Street address" />
                            </Field>
                            <Field label="City">
                                <input type="text" value={formData.address.city} onChange={(e) => setField('address.city', e.target.value)} className={INPUT} placeholder="City" />
                            </Field>
                            <Field label="State / Province">
                                <input type="text" value={formData.address.state} onChange={(e) => setField('address.state', e.target.value)} className={INPUT} placeholder="State" />
                            </Field>
                            <Field label="Country">
                                <input type="text" value={formData.address.country} onChange={(e) => setField('address.country', e.target.value)} className={INPUT} placeholder="Country" />
                            </Field>
                            <Field label="Postal Code">
                                <input type="text" value={formData.address.postalCode} onChange={(e) => setField('address.postalCode', e.target.value)} className={INPUT} placeholder="Postal code" />
                            </Field>
                        </div>
                    </section>

                    {/* Billing */}
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-base font-semibold text-neutral-900 mb-5">Billing Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Billing Email">
                                <input type="email" value={formData.billingDetails.billingEmail} onChange={(e) => setField('billingDetails.billingEmail', e.target.value)} className={INPUT} placeholder="billing@company.com" />
                            </Field>
                            <Field label="Currency">
                                <input type="text" value={formData.billingDetails.currency} onChange={(e) => setField('billingDetails.currency', e.target.value)} className={INPUT} placeholder="INR" />
                            </Field>
                            <Field label="Tax ID">
                                <input type="text" value={formData.billingDetails.taxId} onChange={(e) => setField('billingDetails.taxId', e.target.value)} className={INPUT} placeholder="PAN / TAN / Other" />
                            </Field>
                            <Field label="Payment Terms">
                                <input type="text" value={formData.billingDetails.paymentTerms} onChange={(e) => setField('billingDetails.paymentTerms', e.target.value)} className={INPUT} placeholder="e.g. Net 30" />
                            </Field>
                        </div>
                    </section>

                    {/* Contacts */}
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-semibold text-neutral-900">Contacts</h2>
                            <button type="button" onClick={addContact} className="text-xs text-emerald-600 font-medium flex items-center gap-1 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-50">
                                <Plus size={14} /> Add Contact
                            </button>
                        </div>
                        {formData.contacts.length === 0 && (
                            <p className="text-sm text-neutral-400">No contacts added yet. Click "Add Contact" to add one.</p>
                        )}
                        <div className="space-y-4">
                            {formData.contacts.map((contact, i) => (
                                <div key={i} className="p-4 border border-neutral-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={contact.isPrimary}
                                                onChange={(e) => updateContact(i, 'isPrimary', e.target.checked)}
                                                className="rounded border-neutral-300 text-emerald-500 focus:ring-emerald-400"
                                            />
                                            Primary Contact
                                        </label>
                                        <button type="button" onClick={() => removeContact(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <Field label="Name" required>
                                            <input type="text" value={contact.name} onChange={(e) => updateContact(i, 'name', e.target.value)} className={INPUT} />
                                        </Field>
                                        <Field label="Role / Designation">
                                            <input type="text" value={contact.role} onChange={(e) => updateContact(i, 'role', e.target.value)} className={INPUT} />
                                        </Field>
                                        <Field label="Email">
                                            <input type="email" value={contact.email} onChange={(e) => updateContact(i, 'email', e.target.value)} className={INPUT} />
                                        </Field>
                                        <Field label="Phone">
                                            <input type="tel" value={contact.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)} className={INPUT} />
                                        </Field>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Submit */}
                    <div className="flex justify-end pb-8">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-3 bg-emerald-500 text-white font-medium text-sm rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {saving ? 'Submitting...' : 'Submit Details'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
