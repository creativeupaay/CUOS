import { useParams, Link, useNavigate } from 'react-router-dom';
import { useGetClientQuery, useGetClientProjectsQuery } from '@/features/client/clientApi';
import { ArrowLeft, Mail, Phone, MapPin, DollarSign, Edit, FolderKanban } from 'lucide-react';

export default function ClientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: clientData, isLoading, error } = useGetClientQuery(id!);
    const { data: projectsData } = useGetClientProjectsQuery(id!);

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-neutral-600 mt-4">Loading client...</p>
                </div>
            </div>
        );
    }

    if (error || !clientData) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    Client not found or failed to load.
                </div>
            </div>
        );
    }

    const client = clientData.data.client;
    const projects = projectsData?.data.projects || [];

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/crm/clients')}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-neutral-900">{client.name}</h1>
                    {client.companyName && (
                        <p className="text-neutral-600 mt-1">{client.companyName}</p>
                    )}
                </div>
                <span
                    className={`px-3 py-1 text-sm font-medium rounded ${client.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : client.status === 'inactive'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}
                >
                    {client.status}
                </span>
                <Link
                    to={`/crm/clients/${id}/edit`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                    <Edit size={20} />
                    Edit Client
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Client Info */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Contact Information */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Contact Information</h2>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <Mail size={20} className="text-neutral-400 mt-0.5" />
                                <div>
                                    <p className="text-xs text-neutral-500">Email</p>
                                    <p className="text-sm text-neutral-900">{client.email}</p>
                                </div>
                            </div>
                            {client.phone && (
                                <div className="flex items-start gap-3">
                                    <Phone size={20} className="text-neutral-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-neutral-500">Phone</p>
                                        <p className="text-sm text-neutral-900">{client.phone}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Address */}
                    {client.address && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Address</h2>
                            <div className="flex items-start gap-3">
                                <MapPin size={20} className="text-neutral-400 mt-0.5" />
                                <div className="text-sm text-neutral-900">
                                    {client.address.street && <p>{client.address.street}</p>}
                                    <p>
                                        {[client.address.city, client.address.state, client.address.postalCode]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </p>
                                    {client.address.country && <p>{client.address.country}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Billing Details */}
                    {client.billingDetails && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Billing Details</h2>
                            <div className="space-y-3">
                                {client.billingDetails.billingEmail && (
                                    <div className="flex items-start gap-3">
                                        <Mail size={20} className="text-neutral-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-neutral-500">Billing Email</p>
                                            <p className="text-sm text-neutral-900">{client.billingDetails.billingEmail}</p>
                                        </div>
                                    </div>
                                )}
                                {client.billingDetails.currency && (
                                    <div className="flex items-start gap-3">
                                        <DollarSign size={20} className="text-neutral-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-neutral-500">Currency</p>
                                            <p className="text-sm text-neutral-900">{client.billingDetails.currency}</p>
                                        </div>
                                    </div>
                                )}
                                {client.billingDetails.taxId && (
                                    <div>
                                        <p className="text-xs text-neutral-500">Tax ID</p>
                                        <p className="text-sm text-neutral-900">{client.billingDetails.taxId}</p>
                                    </div>
                                )}
                                {client.billingDetails.paymentTerms && (
                                    <div>
                                        <p className="text-xs text-neutral-500">Payment Terms</p>
                                        <p className="text-sm text-neutral-900">{client.billingDetails.paymentTerms}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Contacts */}
                    {client.contacts.length > 0 && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Contacts</h2>
                            <div className="space-y-4">
                                {client.contacts.map((contact, index) => (
                                    <div
                                        key={index}
                                        className={`p-3 rounded-lg ${contact.isPrimary ? 'bg-primary-light border border-primary' : 'bg-neutral-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="font-medium text-neutral-900">{contact.name}</p>
                                            {contact.isPrimary && (
                                                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                                                    Primary
                                                </span>
                                            )}
                                        </div>
                                        {contact.role && (
                                            <p className="text-xs text-neutral-600 mb-1">{contact.role}</p>
                                        )}
                                        {contact.email && (
                                            <p className="text-sm text-neutral-700">{contact.email}</p>
                                        )}
                                        {contact.phone && (
                                            <p className="text-sm text-neutral-700">{contact.phone}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {client.notes && (
                        <div className="bg-white rounded-lg border border-neutral-200 p-6">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Notes</h2>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{client.notes}</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Projects */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-neutral-900">Projects</h2>
                            <Link
                                to={`/projects/new?clientId=${id}`}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                            >
                                New Project
                            </Link>
                        </div>

                        {projects.length === 0 ? (
                            <div className="text-center py-12">
                                <FolderKanban size={48} className="mx-auto text-neutral-400 mb-4" />
                                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No projects yet</h3>
                                <p className="text-neutral-600 mb-6">Create your first project for this client</p>
                                <Link
                                    to={`/projects/new?clientId=${id}`}
                                    className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                                >
                                    Create Project
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {projects.map((project: any) => (
                                    <Link
                                        key={project._id}
                                        to={`/projects/${project._id}`}
                                        className="block p-4 border border-neutral-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-neutral-900">{project.name}</h3>
                                            <span
                                                className={`px-2 py-1 text-xs font-medium rounded ${project.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : project.status === 'completed'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-neutral-100 text-neutral-800'
                                                    }`}
                                            >
                                                {project.status}
                                            </span>
                                        </div>
                                        {project.description && (
                                            <p className="text-sm text-neutral-600 line-clamp-2">{project.description}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
