import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Link2, RefreshCcw, CheckCircle } from 'lucide-react';
import {
    useCreatePartnerMutation,
    useGetPartnerByIdQuery,
    useRegeneratePartnerTokenMutation,
    useUpdatePartnerMutation,
} from '@/features/partners/partnersApi';

interface PartnerFormState {
    name: string;
    email: string;
    companyName: string;
    companyLogo: string;
    contactPerson: string;
    contactPersonPhone: string;
    phone: string;
    websiteLink: string;
    address: {
        street: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
    };
}

const initialForm: PartnerFormState = {
    name: '',
    email: '',
    companyName: '',
    companyLogo: '',
    contactPerson: '',
    contactPersonPhone: '',
    phone: '',
    websiteLink: '',
    address: {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
    },
};

export default function PartnerFormPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;

    const [form, setForm] = useState<PartnerFormState>(initialForm);
    const [registrationLink, setRegistrationLink] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const { data: partnerData, isLoading: isPartnerLoading } = useGetPartnerByIdQuery(id!, { skip: !isEdit });

    const [createPartner, { isLoading: isCreating }] = useCreatePartnerMutation();
    const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation();
    const [regenerateToken, { isLoading: isRegenerating }] = useRegeneratePartnerTokenMutation();

    useEffect(() => {
        const partner = partnerData?.data;
        if (!partner || !isEdit) return;

        setForm({
            name: partner.userId?.name || '',
            email: partner.userId?.email || partner.email || '',
            companyName: partner.companyName || '',
            companyLogo: partner.companyLogo || '',
            contactPerson: partner.contactPerson || '',
            contactPersonPhone: partner.contactPersonPhone || '',
            phone: partner.phone || '',
            websiteLink: partner.websiteLink || '',
            address: {
                street: partner.address?.street || '',
                city: partner.address?.city || '',
                state: partner.address?.state || '',
                country: partner.address?.country || '',
                postalCode: partner.address?.postalCode || '',
            },
        });
    }, [partnerData, isEdit]);

    const title = useMemo(() => (isEdit ? 'Edit Partner' : 'Add New Partner'), [isEdit]);

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('Link copied to clipboard!');
        } catch {
            alert('Could not copy link. Please copy manually.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isEdit && id) {
                await updatePartner({
                    id,
                    data: {
                        email: form.email,
                        companyName: form.companyName,
                        companyLogo: form.companyLogo,
                        contactPerson: form.contactPerson,
                        contactPersonPhone: form.contactPersonPhone,
                        phone: form.phone,
                        websiteLink: form.websiteLink,
                        address: form.address,
                    },
                }).unwrap();
                alert('Partner updated successfully');
                navigate(`/admin/partners/manage/${id}`);
                return;
            }

            // For new partner - just send name and email
            const result = await createPartner({
                name: form.name,
                email: form.email,
            }).unwrap();

            const link = result?.data?.registrationLink || '';
            setRegistrationLink(link);
            setShowSuccess(true);
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to save partner');
        }
    };

    const handleRegenerate = async () => {
        if (!id) return;

        try {
            const result = await regenerateToken(id).unwrap();
            const link = result?.data?.registrationLink || '';
            setRegistrationLink(link);
            if (link) {
                await handleCopy(link);
            }
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to regenerate link');
        }
    };

    if (isEdit && isPartnerLoading) {
        return <div className="p-8">Loading partner...</div>;
    }

    // Success screen after creating partner
    if (showSuccess && registrationLink) {
        return (
            <div className="p-8 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Partner Created Successfully!</h1>
                    <p className="text-gray-600 mb-6">
                        An onboarding form link has been generated. Share this link with <strong>{form.name}</strong> to complete their registration.
                    </p>

                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        The onboarding email has also been sent to <strong>{form.email}</strong>.
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                        <p className="text-xs font-semibold text-indigo-800 uppercase mb-2">Onboarding Form Link</p>
                        <p className="text-sm text-indigo-700 break-all mb-3">{registrationLink}</p>
                        <button
                            type="button"
                            onClick={() => handleCopy(registrationLink)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                        >
                            <Copy size={16} /> Copy Link
                        </button>
                    </div>

                    <p className="text-sm text-gray-500 mb-6">
                        The partner will fill out their company details and set their password using this link.
                    </p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => navigate('/admin/partners/manage')}
                            className="px-6 py-2.5 rounded-xl border text-sm font-medium transition-all hover:bg-gray-50"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            Back to Partners
                        </button>
                        <button
                            onClick={() => {
                                setShowSuccess(false);
                                setRegistrationLink('');
                                setForm(initialForm);
                            }}
                            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            Add Another Partner
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '960px' }}>
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate(isEdit ? `/admin/partners/manage/${id}` : '/admin/partners/manage')}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={22} />
                </button>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* For new partner creation - simplified form */}
                {!isEdit && (
                    <div className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Partner Information</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Enter the partner's name and email. They will receive a link to complete their registration with company details and password setup.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Partner Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter partner's full name"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Address *</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="partner@company.com"
                                    value={form.email}
                                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* For edit mode - show all fields */}
                {isEdit && (
                    <>
                        <div className="bg-white rounded-xl border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Partner Account</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={form.name}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Company Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        value={form.companyName}
                                        onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Company Logo URL</label>
                                    <input
                                        type="url"
                                        value={form.companyLogo}
                                        onChange={(e) => setForm((prev) => ({ ...prev, companyLogo: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        value={form.contactPerson}
                                        onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contact Person Phone</label>
                                    <input
                                        type="text"
                                        value={form.contactPersonPhone}
                                        onChange={(e) => setForm((prev) => ({ ...prev, contactPersonPhone: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Phone</label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Website</label>
                                    <input
                                        type="url"
                                        value={form.websiteLink}
                                        onChange={(e) => setForm((prev) => ({ ...prev, websiteLink: e.target.value }))}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Address</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="Street"
                                    value={form.address.street}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="City"
                                    value={form.address.city}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="State"
                                    value={form.address.state}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, state: e.target.value } }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="Country"
                                    value={form.address.country}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, country: e.target.value } }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="Postal Code"
                                    value={form.address.postalCode}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                            </div>
                        </div>
                    </>
                )}

                {registrationLink && !showSuccess && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-cyan-800">Onboarding Link Generated</p>
                                <p className="text-xs text-cyan-700 mt-1 break-all">{registrationLink}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(registrationLink)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-cyan-300 text-cyan-800 hover:bg-cyan-100"
                            >
                                <Copy size={14} /> Copy
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        {isEdit && (
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-sm"
                            >
                                {isRegenerating ? <RefreshCcw size={14} className="animate-spin" /> : <Link2 size={14} />}
                                Regenerate Onboarding Link
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isCreating || isUpdating}
                        className="px-6 py-2.5 rounded-xl text-white font-semibold disabled:opacity-60"
                        style={{ background: isEdit ? 'var(--color-primary)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                    >
                        {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Partner & Generate Link'}
                    </button>
                </div>
            </form>
        </div>
    );
}
