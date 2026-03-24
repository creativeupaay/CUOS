import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Handshake, Plus, Search, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import {
    useActivatePartnerMutation,
    useDeactivatePartnerMutation,
    useGetPartnersQuery,
    type Partner,
} from '@/features/partners/partnersApi';

export default function PartnersPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'' | 'true' | 'false'>('');
    const [page, setPage] = useState(1);

    const { data, isLoading, isFetching, refetch, error } = useGetPartnersQuery({
        search: search || undefined,
        isActive: status ? (status as 'true' | 'false') : undefined,
        page,
        limit: 12,
    });

    // Refetch partners whenever the page is focused/navigated to
    // This ensures newly created partners are displayed
    useEffect(() => {
        refetch();
    }, [location.pathname, refetch]);

    // Log error for debugging
    useEffect(() => {
        if (error) {
            console.error('Partners fetch error:', error);
        }
    }, [error]);

    const [activatePartner, { isLoading: isActivating }] = useActivatePartnerMutation();
    const [deactivatePartner, { isLoading: isDeactivating }] = useDeactivatePartnerMutation();

    const partners = data?.data?.partners || [];
    const totalPages = data?.data?.totalPages || 1;
    const total = data?.data?.total || 0;
    const errorMessage = error
        ? ('data' in error
            ? ((error.data as any)?.message || 'Failed to fetch partners')
            : (('error' in error ? error.error : (error as any)?.message) || 'Failed to fetch partners'))
        : null;

    const summary = useMemo(() => {
        const active = partners.filter((p: Partner) => p.isActive).length;
        const inactive = partners.filter((p: Partner) => !p.isActive).length;
        const clients = partners.reduce((sum, p) => sum + (p.stats?.clientsCount || 0), 0);
        const projects = partners.reduce((sum, p) => sum + (p.stats?.projectsCount || 0), 0);
        const topByClients = [...partners]
            .sort((a, b) => (b.stats?.clientsCount || 0) - (a.stats?.clientsCount || 0))
            .slice(0, 5);
        const topByProjects = [...partners]
            .sort((a, b) => (b.stats?.projectsCount || 0) - (a.stats?.projectsCount || 0))
            .slice(0, 5);
        return { active, inactive, clients, projects, topByClients, topByProjects };
    }, [partners]);

    const handleToggle = async (partner: Partner) => {
        try {
            if (partner.isActive) {
                await deactivatePartner(partner._id).unwrap();
            } else {
                await activatePartner(partner._id).unwrap();
            }
        } catch (error: any) {
            alert(error?.data?.message || 'Failed to update partner status');
        }
    };

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFEFF', color: '#0E7490' }}>
                        <Handshake size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Partners</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{total} total partners</p>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/admin/partners/new')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={16} /> New Partner
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Active Partners</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{summary.active}</p>
                </div>
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Inactive Partners</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{summary.inactive}</p>
                </div>
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Total Clients</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{summary.clients}</p>
                </div>
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Total Projects</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{summary.projects}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                        Top Partners by Clients
                    </h2>
                    {summary.topByClients.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No partner stats available.</p>
                    ) : (
                        <div className="space-y-2">
                            {summary.topByClients.map((partner) => (
                                <div key={partner._id} className="flex items-center justify-between text-sm">
                                    <span style={{ color: 'var(--color-text-primary)' }}>
                                        {partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner'}
                                    </span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>{partner.stats?.clientsCount || 0}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                        Top Partners by Projects
                    </h2>
                    {summary.topByProjects.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No partner stats available.</p>
                    ) : (
                        <div className="space-y-2">
                            {summary.topByProjects.map((partner) => (
                                <div key={partner._id} className="flex items-center justify-between text-sm">
                                    <span style={{ color: 'var(--color-text-primary)' }}>
                                        {partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner'}
                                    </span>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>{partner.stats?.projectsCount || 0}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                        type="text"
                        value={search}
                        placeholder="Search by name, company, email..."
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                    />
                </div>
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value as '' | 'true' | 'false');
                        setPage(1);
                    }}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50">
                    <p className="text-sm font-medium text-red-800">
                        Error loading partners: {errorMessage}
                    </p>
                </div>
            )}

            <div className="rounded-xl shadow-premium overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading || isFetching ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading partners...</div>
                ) : partners.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>No partners found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    {['Partner', 'Company', 'Contact', 'Clients', 'Projects', 'Status', 'Actions'].map((header) => (
                                        <th
                                            key={header}
                                            className={`text-xs font-semibold uppercase tracking-wider px-5 py-3 ${header === 'Actions' ? 'text-right' : 'text-left'}`}
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {partners.map((partner: Partner) => (
                                    <tr key={partner._id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <td className="px-5 py-4">
                                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {partner.userId?.name || partner.contactPerson || 'Unnamed Partner'}
                                            </div>
                                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                {partner.userId?.email || partner.email || 'No email'}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{partner.companyName || '-'}</td>
                                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{partner.contactPerson || '-'}</td>
                                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{partner.stats?.clientsCount || 0}</td>
                                        <td className="px-5 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{partner.stats?.projectsCount || 0}</td>
                                        <td className="px-5 py-4">
                                            <span
                                                className="text-xs font-medium px-2.5 py-1 rounded-full"
                                                style={{
                                                    backgroundColor: partner.isActive ? '#ECFDF5' : '#FEF2F2',
                                                    color: partner.isActive ? '#059669' : '#DC2626',
                                                }}
                                            >
                                                {partner.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/partners/${partner._id}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-100"
                                                    title="View partner"
                                                >
                                                    <ExternalLink size={15} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(partner)}
                                                    disabled={isActivating || isDeactivating}
                                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-60"
                                                    title={partner.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {partner.isActive
                                                        ? <ToggleRight size={16} style={{ color: '#10B981' }} />
                                                        : <ToggleLeft size={16} style={{ color: '#EF4444' }} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
