import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Copy,
    Pencil,
    RefreshCcw,
    ToggleLeft,
    ToggleRight,
    UserCircle2,
} from 'lucide-react';
import {
    useActivatePartnerMutation,
    useDeactivatePartnerMutation,
    useGetPartnerByIdQuery,
    useGetPartnerClientsQuery,
    useGetPartnerProjectsQuery,
    useRegeneratePartnerTokenMutation,
} from '@/features/partners/partnersApi';

type DetailTab = 'company' | 'personal' | 'access' | 'clients' | 'projects';

function InfoField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <p className="mt-2 text-sm font-medium break-words" style={{ color: 'var(--color-text-primary)' }}>
                {value && String(value).trim() ? value : '-'}
            </p>
        </div>
    );
}

export default function PartnerDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [tab, setTab] = useState<DetailTab>('company');

    const { data: partnerResponse, isLoading } = useGetPartnerByIdQuery(id || '', { skip: !id });
    const { data: clientsResponse, isFetching: isClientsLoading } = useGetPartnerClientsQuery(id || '', {
        skip: !id || tab !== 'clients',
    });
    const { data: projectsResponse, isFetching: isProjectsLoading } = useGetPartnerProjectsQuery(id || '', {
        skip: !id || tab !== 'projects',
    });

    const [activatePartner, { isLoading: isActivating }] = useActivatePartnerMutation();
    const [deactivatePartner, { isLoading: isDeactivating }] = useDeactivatePartnerMutation();
    const [regenerateToken, { isLoading: isRegenerating }] = useRegeneratePartnerTokenMutation();

    const partner = partnerResponse?.data;
    const clients = useMemo(() => {
        const rawClients = clientsResponse?.data || [];
        return Array.from(new Map(rawClients.map((client: any) => [client._id, client])).values());
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

    const formattedAddress = [
        partner.address?.street,
        partner.address?.city,
        partner.address?.state,
        partner.address?.country,
        partner.address?.postalCode,
    ]
        .filter(Boolean)
        .join(', ');

    const copyText = async (value: string, message: string) => {
        await navigator.clipboard.writeText(value);
        alert(message);
    };

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
                await copyText(link, 'New registration link copied to clipboard');
            }
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to regenerate registration link');
        }
    };

    const tabs: Array<{ key: DetailTab; label: string }> = [
        { key: 'company', label: 'Company Info' },
        { key: 'personal', label: 'Personal Info' },
        { key: 'access', label: 'Access & Portal' },
        { key: 'clients', label: 'Clients' },
        { key: 'projects', label: 'Projects' },
    ];

    return (
        <div className="p-6 md:p-8 mx-auto space-y-6" style={{ maxWidth: '1240px' }}>
            <div className="flex flex-col gap-5 rounded-[28px] border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={() => navigate('/admin/partners/manage')}
                            className="mt-1 p-2.5 rounded-xl hover:bg-neutral-100 transition-colors"
                            style={{ border: '1px solid var(--color-border-default)' }}
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="space-y-3">
                            <div>
                                
                                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    {partner.userId?.email || partner.email || 'No email added'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span
                                    className="rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{
                                        backgroundColor: partner.isActive ? '#ECFDF5' : '#FEF2F2',
                                        color: partner.isActive ? '#047857' : '#B91C1C',
                                    }}
                                >
                                    {partner.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span
                                    className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                                    style={{
                                        backgroundColor: partner.registrationStatus === 'completed' ? '#EEF2FF' : '#FFF7ED',
                                        color: partner.registrationStatus === 'completed' ? '#4338CA' : '#C2410C',
                                    }}
                                >
                                    {partner.registrationStatus || 'pending'}
                                </span>
                                <span
                                    className="rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#F8FAFC', color: '#475569' }}
                                >
                                    Slug: {partner.slug || '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => navigate(`/admin/partners/manage/${partner._id}/edit`)}
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Clients</p>
                        <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.clients}</p>
                    </div>
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Projects</p>
                        <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.projects}</p>
                    </div>
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Active Projects</p>
                        <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.activeProjects}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-[28px] border bg-white shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                <div
                    className="flex flex-wrap gap-2 border-b px-4 pt-4"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F8FAFC' }}
                >
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setTab(item.key)}
                            className="rounded-t-2xl px-5 py-3 text-sm font-semibold transition-all"
                            style={
                                tab === item.key
                                    ? {
                                        backgroundColor: 'white',
                                        color: 'var(--color-text-primary)',
                                        border: '1px solid var(--color-border-default)',
                                        borderBottomColor: 'white',
                                    }
                                    : {
                                        color: 'var(--color-text-secondary)',
                                        backgroundColor: 'transparent',
                                        border: '1px solid transparent',
                                    }
                            }
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 md:p-7">
                    {tab === 'company' && (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                            <div className="rounded-3xl border p-6 text-center" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                <div className="mx-auto flex h-40 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-3xl border bg-white" style={{ borderColor: 'var(--color-border-default)' }}>
                                    {partner.companyLogo ? (
                                        <img src={partner.companyLogo} alt={partner.companyName || 'Company logo'} className="h-full w-full object-contain p-5" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <Building2 size={40} style={{ color: '#94A3B8' }} />
                                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No company logo</span>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                    {partner.companyName || 'Company name not added'}
                                </p>
                                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    {partner.websiteLink || 'Website not added yet'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <InfoField label="Company Name" value={partner.companyName} />
                                <InfoField label="Website" value={partner.websiteLink} />
                                <InfoField label="Contact Person" value={partner.contactPerson} />
                                <InfoField label="Contact Person Phone" value={partner.contactPersonPhone} />
                                <div className="md:col-span-2">
                                    <InfoField label="Address" value={formattedAddress} />
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'personal' && (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
                            <div className="rounded-3xl border p-6 text-center" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-3xl border bg-white" style={{ borderColor: 'var(--color-border-default)' }}>
                                    {partner.photo ? (
                                        <img src={partner.photo} alt={partner.userId?.name || partner.contactPerson || 'Partner'} className="h-full w-full object-cover" />
                                    ) : (
                                        <UserCircle2 size={72} style={{ color: '#94A3B8' }} />
                                    )}
                                </div>
                                <p className="mt-5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                    {partner.userId?.name || 'Name not available'}
                                </p>
                                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    {partner.userId?.email || partner.email || 'No email added'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <InfoField label="Primary Name" value={partner.userId?.name} />
                                <InfoField label="Primary Email" value={partner.userId?.email || partner.email} />
                                <InfoField label="Partner Phone" value={partner.phone} />
                                <InfoField label="Contact Person" value={partner.contactPerson} />
                            </div>
                        </div>
                    )}

                    {tab === 'access' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <InfoField label="Portal Slug" value={partner.slug} />
                                <InfoField label="Registration Status" value={partner.registrationStatus} />
                                <InfoField label="Created On" value={new Date(partner.createdAt).toLocaleString()} />
                                <InfoField label="Last Updated" value={new Date(partner.updatedAt).toLocaleString()} />
                            </div>

                            {partner.registrationStatus === 'completed' && partner.loginUrl && (
                                <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Partner Login Portal</p>
                                    <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                                        <div className="flex-1 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-secondary)' }}>
                                            {partner.loginUrl}
                                        </div>
                                        <button
                                            onClick={() => copyText(partner.loginUrl!, 'Login portal link copied to clipboard!')}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white"
                                            style={{ backgroundColor: 'var(--color-primary)' }}
                                        >
                                            <Copy size={16} />
                                            Copy Login Link
                                        </button>
                                    </div>
                                </div>
                            )}

                            {partner.registrationStatus === 'pending' && partner.onboardingUrl && (
                                <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Onboarding Form Link</p>
                                    <div className="mt-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
                                        <div
                                            className="min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm break-all"
                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-secondary)' }}
                                        >
                                            {partner.onboardingUrl}
                                        </div>
                                        <button
                                            onClick={() => copyText(partner.onboardingUrl!, 'Onboarding link copied to clipboard!')}
                                            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl px-5 py-3 text-sm font-semibold text-white"
                                            style={{ backgroundColor: '#D97706' }}
                                        >
                                            <Copy size={16} />
                                            Copy Onboarding Link
                                        </button>
                                    </div>
                                </div>
                            )}

                            {partner.registrationStatus === 'pending' && (
                                <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                Regenerate Registration Link
                                            </p>
                                            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                Generate a fresh onboarding link if the current one is lost or expired.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleRegenerate}
                                            disabled={isRegenerating}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                                            style={{ backgroundColor: 'var(--color-primary)' }}
                                        >
                                            {isRegenerating ? <RefreshCcw size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                            Regenerate Link
                                        </button>
                                    </div>
                                </div>
                            )}
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
                                <div className="rounded-3xl border p-12 text-center" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <p className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                        No clients found for this partner.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--color-border-default)' }}>
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
                                <div className="rounded-3xl border p-12 text-center" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FCFCFD' }}>
                                    <p className="text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                        No projects found for this partner.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-neutral-50 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                                    Project Name
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
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className="inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                                                            style={{
                                                                backgroundColor: project.status === 'active' ? '#DBEAFE' : '#F3F4F6',
                                                                color: project.status === 'active' ? '#1D4ED8' : '#6B7280',
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
