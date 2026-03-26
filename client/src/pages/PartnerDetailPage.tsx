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
    const clients = useMemo(() => {
        const rawClients = clientsResponse?.data || [];
        // Deduplicate by _id just in case
        const uniqueClients = Array.from(
            new Map(rawClients.map((client: any) => [client._id, client])).values()
        );
        return uniqueClients;
    }, [clientsResponse?.data]);
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
        <div className="p-6 md:p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header Section */}
            <div className="flex items-start gap-4 mb-8">
                <button
                    onClick={() => navigate('/admin/partners')}
                    className="p-2.5 rounded-xl hover:bg-neutral-100 transition-colors"
                    style={{ border: '1px solid var(--color-border-default)' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {partner.userId?.name || partner.contactPerson || 'Partner'}
                        </h1>
                        <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                                backgroundColor: partner.isActive ? '#ECFDF5' : '#FEF2F2',
                                color: partner.isActive ? '#059669' : '#DC2626',
                            }}
                        >
                            {partner.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                        {partner.userId?.email || partner.email || 'No email'}
                    </p>
                    {partner.companyName && (
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {partner.companyName}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/admin/partners/${partner._id}/edit`)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all hover:shadow-md"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}
                    >
                        <Pencil size={16} /> Edit Partner
                    </button>
                    <button
                        onClick={handleToggle}
                        disabled={isActivating || isDeactivating}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-md disabled:opacity-50"
                        style={{
                            backgroundColor: partner.isActive ? '#FEF2F2' : '#ECFDF5',
                            color: partner.isActive ? '#DC2626' : '#059669',
                            border: `1px solid ${partner.isActive ? '#FCA5A5' : '#86EFAC'}`,
                        }}
                    >
                        {partner.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {partner.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Total Clients
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{stats.clients}</p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Total Projects
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{stats.projects}</p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Active Projects
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#10B981' }}>{stats.activeProjects}</p>
                </div>
            </div>

            {/* Tabs Section */}
            <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex items-center gap-2 p-5 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    {(['overview', 'clients', 'projects'] as const).map((name) => (
                        <button
                            key={name}
                            onClick={() => setTab(name)}
                            className="px-4 py-2.5 text-sm font-medium rounded-xl capitalize transition-all"
                            style={
                                tab === name
                                    ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                                    : { color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }
                            }
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div className="p-6">{tab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Company Name
                                </p>
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {partner.companyName || '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Contact Person
                                </p>
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {partner.contactPerson || '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Phone Number
                                </p>
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {partner.phone || '-'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Registration Status
                                </p>
                                <span
                                    className="inline-block px-3 py-1 rounded-full text-sm font-medium capitalize"
                                    style={{
                                        backgroundColor: partner.registrationStatus === 'completed' ? '#ECFDF5' : '#FEF3C7',
                                        color: partner.registrationStatus === 'completed' ? '#059669' : '#D97706',
                                    }}
                                >
                                    {partner.registrationStatus || 'pending'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    Address
                                </p>
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {[partner.address?.street, partner.address?.city, partner.address?.state, partner.address?.country, partner.address?.postalCode]
                                        .filter(Boolean)
                                        .join(', ') || '-'}
                                </p>
                            </div>
                        </div>

                        {/* Login Portal Link Section */}
                        {partner.registrationStatus === 'completed' && partner.loginUrl && (
                            <div className="md:col-span-2 pt-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                    Partner Login Portal
                                </p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        readOnly
                                        value={partner.loginUrl}
                                        className="flex-1 px-4 py-2.5 rounded-xl border text-sm bg-neutral-50"
                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(partner.loginUrl!);
                                            alert('Login portal link copied to clipboard!');
                                        }}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                                            color: 'white',
                                        }}
                                    >
                                        <Copy size={16} />
                                        Copy Login Link
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Onboarding Link Section (for pending partners) */}
                        {partner.registrationStatus === 'pending' && partner.onboardingUrl && (
                            <div className="md:col-span-2 pt-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                    Onboarding Form Link
                                </p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        readOnly
                                        value={partner.onboardingUrl}
                                        className="flex-1 px-4 py-2.5 rounded-xl border text-sm bg-neutral-50"
                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(partner.onboardingUrl!);
                                            alert('Onboarding link copied to clipboard!');
                                        }}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                                        style={{
                                            backgroundColor: '#F59E0B',
                                            color: 'white',
                                        }}
                                    >
                                        <Copy size={16} />
                                        Copy Onboarding Link
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2 pt-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                            <button
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-md"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    opacity: isRegenerating ? 0.6 : 1,
                                }}
                            >
                                {isRegenerating ? <RefreshCcw size={16} className="animate-spin" /> : <Copy size={16} />}
                                Regenerate & Copy Registration Link
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'clients' && (
                    <div>
                        {isClientsLoading ? (
                            <div className="text-center py-12">
                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" style={{ color: 'var(--color-primary)' }}></div>
                                <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading clients...</p>
                            </div>
                        ) : clients.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                    No clients found for this partner.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border-default)' }}>
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-neutral-50 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Client Name
                                            </th>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Email
                                            </th>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {clients.map((client: any) => (
                                            <tr key={client._id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                    {client.name || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {client.email || '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className="inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                                                        style={{
                                                            backgroundColor: client.status === 'active' ? '#ECFDF5' : '#F3F4F6',
                                                            color: client.status === 'active' ? '#059669' : '#6B7280',
                                                        }}
                                                    >
                                                        {client.status || '-'}
                                                    </span>
                                                </td>
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
                            <div className="text-center py-12">
                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" style={{ color: 'var(--color-primary)' }}></div>
                                <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading projects...</p>
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                    No projects found for this partner.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border-default)' }}>
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-neutral-50 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Project Name
                                            </th>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Client
                                            </th>
                                            <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {projects.map((project: any) => (
                                            <tr key={project._id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                    {project.name || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {project.clientId?.name || '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className="inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                                                        style={{
                                                            backgroundColor: project.status === 'active' ? '#ECFDF5' : '#F3F4F6',
                                                            color: project.status === 'active' ? '#059669' : '#6B7280',
                                                        }}
                                                    >
                                                        {project.status || '-'}
                                                    </span>
                                                </td>
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
        </div>
    );
}
