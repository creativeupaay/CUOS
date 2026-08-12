import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useCreateClientMutation, useUpdateClientMutation, useGetClientQuery } from '@/features/client/clientApi';
import type { ClientContact, ClientPhone, ClientCustomDetail, ClientDocument, ClientLink } from '@/features/client/types/types';
import { Plus, X, Trash2, Info } from 'lucide-react';
import SelectCurrency from '@/components/ui/CurrencySelect';
import { useGetLeadByIdQuery } from '@/features/crm';
import { useAppSelector } from '@/app/hooks';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { logger } from '@/utils/logger';

export default function ClientFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const fromLeadId = searchParams.get('fromLead') || undefined;
    const isEdit = !!id;
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? String((user.role as any).name || '')
            : String(user.role)
        : '';
    const isPartnerUser = roleName.toLowerCase() === 'partner';
    const isAdminUser = ['super-admin', 'super_admin', 'admin'].includes(roleName.toLowerCase());
    const userPartnerId = typeof user?.partnerId === 'object' ? (user.partnerId as any)?._id : user?.partnerId;

    const { data: clientData } = useGetClientQuery(id!, { skip: !id });
    const { data: leadData } = useGetLeadByIdQuery(fromLeadId!, { skip: !fromLeadId });
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const partners = partnersData?.data?.partners || [];
    const [createClient, { isLoading: isCreating }] = useCreateClientMutation();
    const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

    const [sendOnboardingForm, setSendOnboardingForm] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        otherPhones: [] as ClientPhone[],
        registrationType: 'Unregistered' as 'Registered' | 'Unregistered' | 'Overseas',
        gstNumber: '',
        vatNumber: '',
        customDetails: [] as ClientCustomDetail[],
        status: 'active' as 'active' | 'inactive' | 'archived',
        notes: '',
        address: {
            street: '' as string | undefined,
            city: '' as string | undefined,
            state: '' as string | undefined,
            country: '' as string | undefined,
            postalCode: '' as string | undefined,
        },
        billingDetails: {
            billingEmail: '' as string | undefined,
            taxId: '' as string | undefined,
            paymentTerms: '' as string | undefined,
            currency: 'USD',
        },
        contacts: [] as ClientContact[],
        partnerId: (isPartnerUser && userPartnerId ? String(userPartnerId) : '') as string,
    });

    const [hasGst, setHasGst] = useState(false);

    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    const fallbackReturnPath = isEdit && id ? `/crm/clients/${id}` : '/crm/clients';
    const closeTarget = returnTo || fallbackReturnPath;

    useBodyScrollLock(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsDrawerVisible(true), 12);
        return () => window.clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsDrawerVisible(false);
        window.setTimeout(() => {
            navigate(closeTarget, { replace: true });
        }, 280);
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [closeTarget]);

    const normalizeLeadDocumentsForClient = (): ClientDocument[] | undefined => {
        const lead = leadData?.data.lead;
        if (!lead?.documents?.length) return undefined;
        return lead.documents
            .filter((doc) => doc?.name && doc?.url)
            .map((doc) => ({
                name: doc.name,
                url: doc.url,
                cloudinaryId: doc.cloudinaryId,
                size: doc.size,
                mimeType: doc.mimeType,
                uploadedAt: doc.uploadedAt,
                uploadedBy: typeof doc.uploadedBy === 'object' ? (doc.uploadedBy as any)?._id : doc.uploadedBy,
            }));
    };

    const normalizeLeadLinksForClient = (): ClientLink[] | undefined => {
        const lead = leadData?.data.lead;
        if (!lead?.links?.length) return undefined;
        return lead.links
            .filter((link) => link?.name && link?.url)
            .map((link) => ({
                name: link.name,
                url: link.url,
                addedAt: link.addedAt || new Date().toISOString(),
            }));
    };

    useEffect(() => {
        if (clientData?.data.client) {
            const client = clientData.data.client;
            setFormData({
                name: client.name,
                companyName: client.companyName || '',
                email: client.email || '',
                phone: client.phone || '',
                otherPhones: client.otherPhones || [],
                registrationType: client.registrationType || 'Unregistered',
                gstNumber: client.gstNumber || '',
                vatNumber: client.vatNumber || '',
                customDetails: client.customDetails || [],
                status: client.status,
                notes: client.notes || '',
                address: {
                    street: client.address?.street || '',
                    city: client.address?.city || '',
                    state: client.address?.state || '',
                    country: client.address?.country || '',
                    postalCode: client.address?.postalCode || '',
                },
                billingDetails: {
                    billingEmail: client.billingDetails?.billingEmail || '',
                    taxId: client.billingDetails?.taxId || '',
                    paymentTerms: client.billingDetails?.paymentTerms || '',
                    currency: client.billingDetails?.currency || 'USD',
                },
                contacts: client.contacts || [],
                partnerId:
                    (typeof client.partnerId === 'object' ? (client.partnerId as any)?._id : client.partnerId) ||
                    (isPartnerUser && userPartnerId ? String(userPartnerId) : ''),
            });
            setHasGst(!!client.gstNumber);
        }
    }, [clientData, isPartnerUser, userPartnerId]);

    useEffect(() => {
        if (!isEdit && isPartnerUser && userPartnerId) {
            setFormData((prev) => ({ ...prev, partnerId: String(userPartnerId) }));
        }
    }, [isEdit, isPartnerUser, userPartnerId]);

    // Pre-fill from lead when converting a closed lead to a client
    useEffect(() => {
        if (fromLeadId && leadData?.data.lead && !isEdit) {
            const lead = leadData.data.lead;
            setFormData((prev) => ({
                ...prev,
                name: lead.company || lead.name || prev.name,
                companyName: lead.company || prev.companyName,
                email: lead.email || prev.email,
                phone: lead.phone || prev.phone,
                billingDetails: {
                    ...prev.billingDetails,
                    currency: lead.currency || prev.billingDetails.currency,
                },
                contacts:
                    lead.name
                        ? [
                              {
                                  name: lead.name,
                                  email: lead.email || '',
                                  phone: lead.phone || '',
                                  role: 'Primary Contact',
                                  isPrimary: true,
                              },
                          ]
                        : prev.contacts,
                notes: lead.notes
                    ? `[From Lead] ${lead.notes}`
                    : `Converted from lead. Estimated value: ${lead.currency || 'INR'} ${lead.estimatedValue || 0}`,
            }));
        }
    }, [fromLeadId, leadData, isEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);

        try {
            if (isEdit) {
                await updateClient({
                    id: id!,
                    data: {
                        ...formData,
                        partnerId: isPartnerUser ? String(userPartnerId || '') : formData.partnerId || undefined,
                    },
                }).unwrap();
                navigate(closeTarget, { replace: true });
            } else {
                const leadDocuments = fromLeadId ? normalizeLeadDocumentsForClient() : undefined;
                const leadLinks = fromLeadId ? normalizeLeadLinksForClient() : undefined;
                const result = await createClient({
                    ...formData,
                    partnerId: isPartnerUser ? String(userPartnerId || '') : formData.partnerId || undefined,
                    ...(fromLeadId ? { leadId: fromLeadId } : {}),
                    ...(leadDocuments ? { documents: leadDocuments } : {}),
                    ...(leadLinks ? { links: leadLinks } : {}),
                    sendOnboardingForm,
                }).unwrap();
                const createTarget = returnTo || `/crm/clients/${result.data.client._id}`;
                navigate(createTarget, { replace: true });
            }
        } catch (err: any) {
            logger.error('Failed to save client:', err);
            const errorMessage = err.data?.message || err.message || 'Failed to save client. Please try again.';
            setServerError(errorMessage);
        }
    };

    const addContact = () => {
        setFormData({
            ...formData,
            contacts: [
                ...formData.contacts,
                { name: '', email: '', phone: '', role: '', isPrimary: formData.contacts.length === 0 },
            ],
        });
    };

    const removeContact = (index: number) => {
        setFormData({
            ...formData,
            contacts: formData.contacts.filter((_, i) => i !== index),
        });
    };

    const updateContact = (index: number, field: keyof ClientContact, value: any) => {
        const newContacts = [...formData.contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };

        // If setting isPrimary, unset others
        if (field === 'isPrimary' && value === true) {
            newContacts.forEach((c, i) => {
                if (i !== index) c.isPrimary = false;
            });
        }

        setFormData({ ...formData, contacts: newContacts });
    };

    const addPhone = () => {
        setFormData({
            ...formData,
            otherPhones: [...formData.otherPhones, { number: '', label: '' }],
        });
    };

    const removePhone = (index: number) => {
        setFormData({
            ...formData,
            otherPhones: formData.otherPhones.filter((_, i) => i !== index),
        });
    };

    const updatePhone = (index: number, field: keyof ClientPhone, value: string) => {
        const newPhones = [...formData.otherPhones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        setFormData({ ...formData, otherPhones: newPhones });
    };

    const addCustomDetail = () => {
        setFormData({
            ...formData,
            customDetails: [...formData.customDetails, { key: '', value: '' }],
        });
    };

    const removeCustomDetail = (index: number) => {
        setFormData({
            ...formData,
            customDetails: formData.customDetails.filter((_, i) => i !== index),
        });
    };

    const updateCustomDetail = (index: number, field: keyof ClientCustomDetail, value: string) => {
        const newDetails = [...formData.customDetails];
        newDetails[index] = { ...newDetails[index], [field]: value };
        setFormData({ ...formData, customDetails: newDetails });
    };

    return (
        <div className="fixed inset-0 z-[220] flex justify-end overflow-hidden">
            <button
                onClick={handleClose}
                className={`fixed inset-0 bg-slate-950/10 backdrop-blur-[1px] transition-opacity duration-200 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'}`}
                aria-label="Close client form"
            />

            <aside
                className={`relative h-full w-full max-w-[980px] bg-white border-l border-neutral-200 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? 'Edit client' : 'Create client'}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
                    <div>
                        
                        <p className="text-sm text-neutral-600 mt-1">
                            {isEdit ? 'Update client profile details' : 'Add and onboard a new client record'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="max-w-4xl mx-auto">
                {/* Header */}
                {serverError && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {serverError}
                    </div>
                )}

                {/* Lead conversion info banner */}
                {fromLeadId && !isEdit && (
                    <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-blue-800">Lead details pre-filled</p>
                            <p className="text-sm text-blue-600 mt-0.5">
                                The form has been pre-filled with the lead's information. Review and complete any missing details before saving.
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Basic Information</h2>

                        {/* Registration Type Chips */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-neutral-700 mb-2">Registration Type</label>
                            <div className="flex gap-3">
                                {(['Registered', 'Unregistered', 'Overseas'] as const).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, registrationType: type })}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${formData.registrationType === type
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Client Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.companyName}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            {isAdminUser && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Referred By Partner</label>
                                    <select
                                        value={formData.partnerId || ''}
                                        onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    >
                                        <option value="">No Partner</option>
                                        {partners.map((partner: any) => (
                                            <option key={partner._id} value={partner._id}>
                                                {partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Additional Phones */}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-neutral-700 mb-2">Additional Phone Numbers</label>
                            {formData.otherPhones.map((phone, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder="Label (e.g. Work, Home)"
                                        value={phone.label}
                                        onChange={(e) => updatePhone(index, 'label', e.target.value)}
                                        className="w-1/3 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Number"
                                        value={phone.number}
                                        onChange={(e) => updatePhone(index, 'number', e.target.value)}
                                        className="w-2/3 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhone(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addPhone}
                                className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                            >
                                <Plus size={16} /> Add Another Number
                            </button>
                        </div>
                    </div>

                    {/* Specific Registration Details */}
                    {(formData.registrationType === 'Registered' || formData.registrationType === 'Unregistered' || formData.registrationType === 'Overseas') && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Registration Details ({formData.registrationType})</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(formData.registrationType === 'Registered' || formData.registrationType === 'Unregistered') && (
                                    <div className="md:col-span-2">
                                        <label className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={hasGst}
                                                onChange={(e) => {
                                                    setHasGst(e.target.checked);
                                                    if (!e.target.checked) setFormData({ ...formData, gstNumber: '' });
                                                }}
                                                className="rounded border-neutral-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm font-medium text-neutral-700">Have GST?</span>
                                        </label>
                                        {hasGst && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-sm font-medium text-neutral-700 mb-1">GST Number</label>
                                                <input
                                                    type="text"
                                                    value={formData.gstNumber}
                                                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formData.registrationType === 'Overseas' && (
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-1">VAT Number</label>
                                        <input
                                            type="text"
                                            value={formData.vatNumber}
                                            onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Custom Details */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Other Details</h2>
                        <div className="space-y-3">
                            {formData.customDetails.map((detail, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Key (e.g. Website)"
                                        value={detail.key}
                                        onChange={(e) => updateCustomDetail(index, 'key', e.target.value)}
                                        className="w-1/3 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Value"
                                        value={detail.value}
                                        onChange={(e) => updateCustomDetail(index, 'value', e.target.value)}
                                        className="w-2/3 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeCustomDetail(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addCustomDetail}
                                className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                            >
                                <Plus size={16} /> Add Detail
                            </button>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Address</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Street</label>
                                <input
                                    type="text"
                                    value={formData.address.street}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: { ...formData.address, street: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
                                <input
                                    type="text"
                                    value={formData.address.city}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: { ...formData.address, city: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
                                <input
                                    type="text"
                                    value={formData.address.state}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: { ...formData.address, state: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Country</label>
                                <input
                                    type="text"
                                    value={formData.address.country}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: { ...formData.address, country: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Postal Code</label>
                                <input
                                    type="text"
                                    value={formData.address.postalCode}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            address: { ...formData.address, postalCode: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Billing Details */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Billing Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Billing Email</label>
                                <input
                                    type="email"
                                    value={formData.billingDetails.billingEmail}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            billingDetails: { ...formData.billingDetails, billingEmail: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Currency</label>
                                <SelectCurrency
                                    value={formData.billingDetails.currency}
                                    onCurrencySelected={(currencyAbbrev: string) =>
                                        setFormData({
                                            ...formData,
                                            billingDetails: { ...formData.billingDetails, currency: currencyAbbrev },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Tax ID</label>
                                <input
                                    type="text"
                                    value={formData.billingDetails.taxId}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            billingDetails: { ...formData.billingDetails, taxId: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Terms</label>
                                <input
                                    type="text"
                                    value={formData.billingDetails.paymentTerms}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            billingDetails: { ...formData.billingDetails, paymentTerms: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contacts */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-neutral-900">Contacts</h2>
                            <button
                                type="button"
                                onClick={addContact}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <Plus size={16} />
                                Add Contact
                            </button>
                        </div>
                        {formData.contacts.length === 0 ? (
                            <p className="text-sm text-neutral-600">No contacts added yet</p>
                        ) : (
                            <div className="space-y-4">
                                {formData.contacts.map((contact, index) => (
                                    <div key={index} className="p-4 border border-neutral-200 rounded-lg">
                                        <div className="flex items-start justify-between mb-3">
                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={contact.isPrimary}
                                                    onChange={(e) => updateContact(index, 'isPrimary', e.target.checked)}
                                                    className="rounded border-neutral-300 text-primary focus:ring-primary"
                                                />
                                                <span className="font-medium">Primary Contact</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeContact(index)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-700 mb-1">
                                                    Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={contact.name}
                                                    onChange={(e) => updateContact(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-700 mb-1">
                                                    Designation/Role
                                                </label>
                                                <input
                                                    type="text"
                                                    value={contact.role || ''}
                                                    onChange={(e) => updateContact(index, 'role', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-700 mb-1">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    value={contact.email || ''}
                                                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-neutral-700 mb-1">
                                                    Phone
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={contact.phone || ''}
                                                    onChange={(e) => updateContact(index, 'phone', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Notes</h2>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Additional notes about this client..."
                        />
                    </div>

                    {/* Onboarding Form — only on create */}
                    {!isEdit && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Client Onboarding</h2>
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={sendOnboardingForm}
                                    onChange={(e) => setSendOnboardingForm(e.target.checked)}
                                    className="mt-0.5 rounded border-neutral-300 text-primary focus:ring-primary"
                                    disabled={!formData.email}
                                />
                                <span className="text-sm text-neutral-700">
                                    Send detail fill form to{' '}
                                    <span className="font-medium text-neutral-900">
                                        {formData.email || '(add an email above)'}
                                    </span>
                                    <span className="block mt-1 text-neutral-500 text-xs">
                                        An email will be sent to the client with a secure link to fill in their full details.
                                        The link will expire in <strong>30 days</strong>.
                                    </span>
                                </span>
                            </label>
                            {sendOnboardingForm && !formData.email && (
                                <p className="mt-2 text-xs text-amber-600">
                                    Please enter a client email address above to enable this option.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || isUpdating}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Update Client' : 'Create Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
            </aside>
        </div>
    );
}
