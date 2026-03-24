import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, RefreshCcw, ToggleLeft, ToggleRight, Copy } from 'lucide-react';
import {
    useActivatePartnerMutation,
    useDeactivatePartnerMutation,
    useGetPartnerByIdQuery,
    useGetPartnerClientsQuery,
    useGetPartnerProjectsQuery,
    useRegeneratePartnerTokenMutation,
} from '@/features/partners/partnersApi';

export default function PartnerDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [tab, setTab] = useState<'overview' | 'clients' | 'projects'>('overview');

    const { data: partnerResponse, isLoading } = useGetPartnerByIdQuery(id || '', { skip: !id });
    const { data: clientsResponse, isFetching: isClientsLoading } = useGetPartnerClientsQuery(id || '', { skip: !id || tab !== 'clients' });
    const { data: projectsResponse, isFetching: isProjectsLoading } = useGetPartnerProjectsQuery(id || '', { skip: !id || tab !== 'projects' });

    const [activatePartner, { isLoading: isActivating }] = useActivatePartnerMutation();
    const [deactivatePartner, { isLoading: isDeactivating }] = useDeactivatePartnerMutation();
    const [regenerateToken, { isLoading: isRegenerating }] = useRegeneratePartnerTokenMutation();

    const partner = partnerResponse?.data;
    const clients = clientsResponse?.data || [];
    const projects = projectsResponse?.data || [];

    const stats = useMemo(() => ({
        clients: partner?.stats?.clientsCount || clients.length,
        projects: partner?.stats?.projectsCount || projects.length,
        activeProjects: partner?.stats?.activeProjectsCount || 0,
    }), [partner, clients.length, projects.length]);

    if (isLoading) {
        return <div className="p-8">Loading partner details...</div>;
    }

    if (!partner) {
        return <div className="p-8">Partner not found.</div>;
    }

    const handleToggle = async () => {
        try {
            if (partner.isActive) {
                await deactivatePartner(partner._id).unwrap();
            } else {
                await activatePartner(partner._id).unwrap();
            }
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to update status');
        }
    };

    const handleRegenerate = async () => {
        try {
            const result = await regenerateToken(partner._id).unwrap();
            const link = result?.data?.registrationLink;
            if (link) {
                await navigator.clipboard.writeText(link);
                alert('New registration link copied to clipboard');
            }
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to regenerate registration link');
        }
    };

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1180px' }}>
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/admin/partners')} className="p-2 rounded-lg hover:bg-neutral-100">
                    <ArrowLeft size={22} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {partner.userId?.name || partner.contactPerson || 'Partner'}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {partner.userId?.email || partner.email || 'No email'}
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/admin/partners/${partner._id}/edit`)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-sm"
                >
                    <Pencil size={14} /> Edit
                </button>
                <button
                    onClick={handleToggle}
                    disabled={isActivating || isDeactivating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 text-sm"
                >
                    {partner.isActive ? <ToggleRight size={16} color="#10B981" /> : <ToggleLeft size={16} color="#EF4444" />}
                    {partner.isActive ? 'Deactivate' : 'Activate'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Clients Added</p>
                    <p className="text-2xl font-bold mt-1">{stats.clients}</p>
                </div>
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Projects Created</p>
                    <p className="text-2xl font-bold mt-1">{stats.projects}</p>
                </div>
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>Active Projects</p>
                    <p className="text-2xl font-bold mt-1">{stats.activeProjects}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    {(['overview', 'clients', 'projects'] as const).map((name) => (
                        <button
                            key={name}
                            onClick={() => setTab(name)}
                            className="px-3 py-2 text-sm rounded-lg capitalize"
                            style={tab === name ? { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-darker)' } : { color: 'var(--color-text-secondary)' }}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Company</p>
                            <p>{partner.companyName || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Contact Person</p>
                            <p>{partner.contactPerson || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Phone</p>
                            <p>{partner.phone || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Registration Status</p>
                            <p className="capitalize">{partner.registrationStatus || 'pending'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>Address</p>
                            <p>
                                {[partner.address?.street, partner.address?.city, partner.address?.state, partner.address?.country, partner.address?.postalCode]
                                    .filter(Boolean)
                                    .join(', ') || '-'}
                            </p>
                        </div>
                        <div className="md:col-span-2 pt-2">
                            <button
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                            >
                                {isRegenerating ? <RefreshCcw size={14} className="animate-spin" /> : <Copy size={14} />}
                                Regenerate + Copy Registration Link
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'clients' && (
                    <div>
                        {isClientsLoading ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading clients...</p>
                        ) : clients.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No clients found for this partner.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <th className="text-left py-2">Client</th>
                                            <th className="text-left py-2">Email</th>
                                            <th className="text-left py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.map((client: any) => (
                                            <tr key={client._id} className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                                <td className="py-2">{client.name || '-'}</td>
                                                <td className="py-2">{client.email || '-'}</td>
                                                <td className="py-2 capitalize">{client.status || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'projects' && (
                    <div>
                        {isProjectsLoading ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading projects...</p>
                        ) : projects.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No projects found for this partner.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <th className="text-left py-2">Project</th>
                                            <th className="text-left py-2">Client</th>
                                            <th className="text-left py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projects.map((project: any) => (
                                            <tr key={project._id} className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                                <td className="py-2">{project.name || '-'}</td>
                                                <td className="py-2">{project.clientId?.name || '-'}</td>
                                                <td className="py-2 capitalize">{project.status || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
