import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Link2, RefreshCcw } from 'lucide-react';
import {
    useCreatePartnerMutation,
    useGetPartnerByIdQuery,
    useRegeneratePartnerTokenMutation,
    useUpdatePartnerMutation,
} from '@/features/partners/partnersApi';

interface PartnerFormState {
    name: string;
    email: string;
    password: string;
    companyName: string;
    contactPerson: string;
    phone: string;
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
    password: '',
    companyName: '',
    contactPerson: '',
    phone: '',
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
            password: '',
            companyName: partner.companyName || '',
            contactPerson: partner.contactPerson || '',
            phone: partner.phone || '',
            address: {
                street: partner.address?.street || '',
                city: partner.address?.city || '',
                state: partner.address?.state || '',
                country: partner.address?.country || '',
                postalCode: partner.address?.postalCode || '',
            },
        });
    }, [partnerData, isEdit]);

    const title = useMemo(() => (isEdit ? 'Edit Partner' : 'Create Partner'), [isEdit]);

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('Registration link copied!');
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
                        contactPerson: form.contactPerson,
                        phone: form.phone,
                        address: form.address,
                    },
                }).unwrap();
                alert('Partner updated successfully');
                navigate(`/admin/partners/${id}`);
                return;
            }

            const result = await createPartner({
                name: form.name,
                email: form.email,
                password: form.password,
                companyName: form.companyName,
                contactPerson: form.contactPerson,
                phone: form.phone,
                address: form.address,
            }).unwrap();

            const link = result?.data?.registrationLink || '';
            setRegistrationLink(link);
            alert('Partner created successfully');

            // Navigate back to partners list to show the newly created partner
            // This allows RTK Query to refetch and display the updated partners list
            navigate('/admin/partners', { replace: true });
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

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '960px' }}>
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate(isEdit ? `/admin/partners/${id}` : '/admin/partners')}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={22} />
                </button>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Partner Account</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Full Name</label>
                            <input
                                type="text"
                                required={!isEdit}
                                disabled={isEdit}
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
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

                        {!isEdit && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Temporary Password</label>
                                <input
                                    type="password"
                                    minLength={8}
                                    required
                                    value={form.password}
                                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Partner Details</h2>
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
                            <label className="block text-sm font-medium mb-1">Contact Person</label>
                            <input
                                type="text"
                                value={form.contactPerson}
                                onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
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

                {registrationLink && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-cyan-800">Registration Link Generated</p>
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
                                Regenerate Registration Link
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isCreating || isUpdating}
                        className="px-6 py-2.5 rounded-lg text-white font-semibold disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Partner'}
                    </button>
                </div>
            </form>
        </div>
    );
}
