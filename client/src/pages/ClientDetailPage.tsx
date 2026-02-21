import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useGetClientQuery, useGetClientProjectsQuery } from '@/features/client/clientApi';
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    DollarSign,
    Edit,
    FolderKanban,
    Building2,
    Globe,
    FileText,
    Hash,
    Info,
    Plus
} from 'lucide-react';
import type { Project } from '@/features/project/types/types';

type Tab = 'info' | 'projects';

export default function ClientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('info');

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

    // Registration Type Label Helper
    const getRegistrationLabel = () => {
        if (!client.registrationType) return null;
        switch (client.registrationType) {
            case 'Registered':
                return { label: 'Registered Entity', color: 'bg-blue-100 text-blue-800', icon: <Building2 size={16} /> };
            case 'Unregistered':
                return { label: 'Unregistered Entity', color: 'bg-gray-100 text-gray-800', icon: <FileText size={16} /> };
            case 'Overseas':
                return { label: 'Overseas Entity', color: 'bg-purple-100 text-purple-800', icon: <Globe size={16} /> };
            default:
                return null;
        }
    };

    const regInfo = getRegistrationLabel();

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/crm/clients')}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-neutral-900">{client.name}</h1>
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
                    </div>
                    {client.companyName && (
                        <p className="text-neutral-600 mt-1 flex items-center gap-2">
                            <Building2 size={16} className="text-neutral-400" />
                            {client.companyName}
                        </p>
                    )}
                </div>
                <Link
                    to={`/crm/clients/${id}/edit`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                    <Edit size={20} />
                    Edit Client
                </Link>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-neutral-200 mb-6">
                <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'info'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                    >
                        Client Information
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${activeTab === 'projects'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                    >
                        Projects ({projects.length})
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary & Registration Card */}
                        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                                <Info size={20} className="text-primary" />
                                Business Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm text-neutral-500 mb-1">Registration Type</p>
                                    {regInfo ? (
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${regInfo.color}`}>
                                            {regInfo.icon}
                                            {regInfo.label}
                                        </div>
                                    ) : (
                                        <p className="text-neutral-900 font-medium">Not Specified</p>
                                    )}
                                </div>

                                {client.gstNumber && (
                                    <div>
                                        <p className="text-sm text-neutral-500 mb-1">GST Number</p>
                                        <p className="text-neutral-900 font-medium font-mono flex items-center gap-2">
                                            <Hash size={16} className="text-neutral-400" />
                                            {client.gstNumber}
                                        </p>
                                    </div>
                                )}

                                {client.vatNumber && (
                                    <div>
                                        <p className="text-sm text-neutral-500 mb-1">VAT Number</p>
                                        <p className="text-neutral-900 font-medium font-mono flex items-center gap-2">
                                            <Hash size={16} className="text-neutral-400" />
                                            {client.vatNumber}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Address */}
                            {client.address && (
                                <div className="mt-6 pt-6 border-t border-neutral-100">
                                    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                                        <MapPin size={16} className="text-neutral-400" />
                                        Address
                                    </h3>
                                    <p className="text-neutral-700">
                                        {client.address.street && <span className="block">{client.address.street}</span>}
                                        <span className="block">
                                            {[client.address.city, client.address.state, client.address.postalCode]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </span>
                                        {client.address.country && <span className="block font-medium">{client.address.country}</span>}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Additional Details (Custom Fields) */}
                        {client.customDetails && client.customDetails.length > 0 && (
                            <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                                    <FileText size={20} className="text-primary" />
                                    Additional Information
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {client.customDetails.map((detail, index) => (
                                        <div key={index} className="bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                            <p className="text-xs text-neutral-500 font-medium uppercase mb-1">{detail.key}</p>
                                            <p className="text-sm text-neutral-900">{detail.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {client.notes && (
                            <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Notes</h2>
                                <p className="text-sm text-neutral-700 whitespace-pre-wrap bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-yellow-900">
                                    {client.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Contact Info */}
                        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                                <Phone size={20} className="text-primary" />
                                Contact Details
                            </h2>
                            <div className="space-y-4">
                                {/* Email */}
                                <div>
                                    <p className="text-xs text-neutral-500 mb-1">Primary Email</p>
                                    <div className="flex items-center gap-2 text-sm text-neutral-900">
                                        <Mail size={16} className="text-neutral-400" />
                                        {client.email || 'N/A'}
                                    </div>
                                </div>

                                {/* Phone */}
                                {client.phone && (
                                    <div>
                                        <p className="text-xs text-neutral-500 mb-1">Primary Phone</p>
                                        <div className="flex items-center gap-2 text-sm text-neutral-900">
                                            <Phone size={16} className="text-neutral-400" />
                                            {client.phone}
                                        </div>
                                    </div>
                                )}

                                {/* Other Phones */}
                                {client.otherPhones && client.otherPhones.length > 0 && (
                                    <div className="pt-2 border-t border-neutral-100 mt-2">
                                        <p className="text-xs text-neutral-500 mb-2">Other Numbers</p>
                                        <div className="space-y-2">
                                            {client.otherPhones.map((p, i) => (
                                                <div key={i} className="flex justify-between items-center text-sm">
                                                    <span className="text-neutral-600 text-xs bg-neutral-100 px-2 py-0.5 rounded">{p.label}</span>
                                                    <span className="text-neutral-900">{p.number}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contacts List */}
                        {client.contacts.length > 0 && (
                            <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Contacts</h2>
                                <div className="space-y-4">
                                    {client.contacts.map((contact, index) => (
                                        <div key={index} className={`p-3 rounded-lg border ${contact.isPrimary ? 'bg-blue-50 border-blue-100' : 'bg-white border-neutral-200'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium text-neutral-900">{contact.name}</p>
                                                {contact.isPrimary && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">PRIMARY</span>}
                                            </div>
                                            {contact.role && <p className="text-xs text-neutral-500 mb-1">{contact.role}</p>}
                                            {contact.email && <p className="text-xs text-neutral-600 flex items-center gap-1.5"><Mail size={12} /> {contact.email}</p>}
                                            {contact.phone && <p className="text-xs text-neutral-600 flex items-center gap-1.5 mt-0.5"><Phone size={12} /> {contact.phone}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Billing Info */}
                        {client.billingDetails && (
                            <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                                    <DollarSign size={20} className="text-primary" />
                                    Billing
                                </h2>
                                <div className="space-y-3 text-sm">
                                    {client.billingDetails.billingEmail && (
                                        <div>
                                            <p className="text-xs text-neutral-500">Billing Email</p>
                                            <p className="text-neutral-900">{client.billingDetails.billingEmail}</p>
                                        </div>
                                    )}
                                    {client.billingDetails.taxId && (
                                        <div>
                                            <p className="text-xs text-neutral-500">Tax ID</p>
                                            <p className="text-neutral-900 font-mono">{client.billingDetails.taxId}</p>
                                        </div>
                                    )}
                                    {client.billingDetails.currency && (
                                        <div>
                                            <p className="text-xs text-neutral-500">Currency</p>
                                            <p className="text-neutral-900 font-bold">{client.billingDetails.currency}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // PROJECTS TAB
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-neutral-900">Projects</h2>
                            <p className="text-neutral-600 text-sm mt-1">Manage projects linked to {client.name}</p>
                        </div>
                        <Link
                            to={`/projects/new?clientId=${id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                            <Plus size={18} />
                            Create Project
                        </Link>
                    </div>

                    {projects.length === 0 ? (
                        <div className="text-center py-16 bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
                            <FolderKanban size={48} className="mx-auto text-neutral-400 mb-4" />
                            <h3 className="text-lg font-semibold text-neutral-900 mb-2">No projects yet</h3>
                            <p className="text-neutral-600 mb-6">Start by creating a new project for this client.</p>
                            <Link
                                to={`/projects/new?clientId=${id}`}
                                className="inline-block px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 font-medium transition-colors"
                            >
                                Create First Project
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map((project: Project) => (
                                <Link
                                    key={project._id}
                                    to={`/projects/${project._id}`}
                                    className="block group bg-white border border-neutral-200 rounded-xl hover:border-primary hover:shadow-md transition-all p-5"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-primary group-hover:text-white transition-colors">
                                            <FolderKanban size={20} />
                                        </div>
                                        <span
                                            className={`px-2 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${project.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : project.status === 'completed'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-neutral-100 text-neutral-800'
                                                }`}
                                        >
                                            {project.status.replace('-', ' ')}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-neutral-900 mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
                                    {project.description && (
                                        <p className="text-sm text-neutral-600 line-clamp-2 mb-4 h-10">{project.description}</p>
                                    )}
                                    <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                                        <span>StartDate: {new Date(project.startDate).toLocaleDateString()}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
