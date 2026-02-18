import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateClientMutation, useUpdateClientMutation, useGetClientQuery } from '@/features/client/clientApi';
import type { ClientContact } from '@/features/client/types/types';
import { ArrowLeft, Plus, X } from 'lucide-react';

export default function ClientFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const { data: clientData } = useGetClientQuery(id!, { skip: !id });
    const [createClient, { isLoading: isCreating }] = useCreateClientMutation();
    const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

    const [formData, setFormData] = useState({
        name: '',
        companyName: '',
        email: '',
        phone: '',
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
    });

    useEffect(() => {
        if (clientData?.data.client) {
            const client = clientData.data.client;
            setFormData({
                name: client.name,
                companyName: client.companyName || '',
                email: client.email,
                phone: client.phone || '',
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
            });
        }
    }, [clientData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isEdit) {
                await updateClient({ id: id!, data: formData }).unwrap();
            } else {
                await createClient(formData).unwrap();
            }
            navigate('/projects/clients');
        } catch (err) {
            console.error('Failed to save client:', err);
            alert('Failed to save client. Please try again.');
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

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/projects/clients')}
                        className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-3xl font-bold text-neutral-900">
                        {isEdit ? 'Edit Client' : 'New Client'}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Basic Information</h2>
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
                                    required
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
                                <input
                                    type="text"
                                    value={formData.billingDetails.currency}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            billingDetails: { ...formData.billingDetails, currency: e.target.value },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                                                    Role
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

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/projects/clients')}
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
    );
}
