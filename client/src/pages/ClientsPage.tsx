import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetClientsQuery, useDeleteClientMutation } from '@/features/client/clientApi';
import { Plus, Search, Building2, Mail, Phone, Trash2, Edit, Eye } from 'lucide-react';

export default function ClientsPage() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'archived' | ''>('');

    const { data, isLoading, error } = useGetClientsQuery({
        search: search || undefined,
        status: statusFilter || undefined,
    });

    const [deleteClient] = useDeleteClientMutation();

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Archive client "${name}"? This will not delete their projects.`)) {
            try {
                await deleteClient(id).unwrap();
            } catch (err) {
                console.error('Failed to delete client:', err);
            }
        }
    };

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    Failed to load clients. Please try again.
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900">Clients</h1>
                    <p className="text-neutral-600 mt-1">Manage your client relationships</p>
                </div>
                <Link
                    to="/crm/clients/new"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                    <Plus size={20} />
                    Add Client
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search clients..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
            </div>

            {/* Clients Grid */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-neutral-600 mt-4">Loading clients...</p>
                </div>
            ) : data?.data.clients.length === 0 ? (
                <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
                    <Building2 size={48} className="mx-auto text-neutral-400 mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">No clients found</h3>
                    <p className="text-neutral-600 mb-6">Get started by adding your first client</p>
                    <Link
                        to="/crm/clients/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                    >
                        <Plus size={20} />
                        Add Client
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data?.data.clients.map((client) => (
                        <div
                            key={client._id}
                            className="bg-white rounded-lg border border-neutral-200 p-6 hover:shadow-lg transition-shadow"
                        >
                            {/* Status Badge */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                                        {client.name}
                                    </h3>
                                    {client.companyName && (
                                        <p className="text-sm text-neutral-600">{client.companyName}</p>
                                    )}
                                </div>
                                <span
                                    className={`px-2 py-1 text-xs font-medium rounded ${client.status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : client.status === 'inactive'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-neutral-100 text-neutral-800'
                                        }`}
                                >
                                    {client.status}
                                </span>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-neutral-600">
                                    <Mail size={16} className="text-neutral-400" />
                                    <span className="truncate">{client.email}</span>
                                </div>
                                {client.phone && (
                                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                                        <Phone size={16} className="text-neutral-400" />
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                            </div>

                            {/* Primary Contact */}
                            {client.contacts.find((c) => c.isPrimary) && (
                                <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                                    <p className="text-xs text-neutral-500 mb-1">Primary Contact</p>
                                    <p className="text-sm font-medium text-neutral-900">
                                        {client.contacts.find((c) => c.isPrimary)?.name}
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t border-neutral-200">
                                <Link
                                    to={`/crm/clients/${client._id}`}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                                >
                                    <Eye size={16} />
                                    View
                                </Link>
                                <Link
                                    to={`/crm/clients/${client._id}/edit`}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-light text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                                >
                                    <Edit size={16} />
                                    Edit
                                </Link>
                                <button
                                    onClick={() => handleDelete(client._id, client.name)}
                                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Info */}
            {data && data.data.clients.length > 0 && (
                <div className="mt-6 text-center text-sm text-neutral-600">
                    Showing {data.data.clients.length} of {data.data.total} clients
                </div>
            )}
        </div>
    );
}
