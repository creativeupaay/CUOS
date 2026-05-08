import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Handshake, Plus, Search, ExternalLink, Trash2 } from 'lucide-react';
import {
import { logger } from '@/utils/logger';
    useDeletePartnerMutation,
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
            logger.error('Partners fetch error:', error);
        }
    }, [error]);

    const [deletePartner, { isLoading: isDeleting }] = useDeletePartnerMutation();

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
        return { active, inactive, clients, projects };
    }, [partners]);

    const handleDelete = async (partner: Partner) => {
        const companyName = partner.companyName || partner.contactPerson || 'this partner';
        const confirmMessage = `Are you sure you want to delete ${companyName}?\n\nThis action will:\n• Delete the partner record\n• Delete the associated user account\n• This action cannot be undone\n\nType "DELETE" to confirm:`;

        const userInput = prompt(confirmMessage);

        if (userInput === 'DELETE') {
            try {
                await deletePartner(partner._id).unwrap();
                alert('Partner deleted successfully');
            } catch (error: any) {
                alert(error?.data?.message || 'Failed to delete partner');
            }
        } else if (userInput !== null) {
            alert('Deletion cancelled - you must type "DELETE" to confirm');
        }
    };

    return (
        <div className="p-6 md:p-8 mx-auto" style={{ maxWidth: '1400px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: '#ECFEFF', color: '#0E7490' }}
                    >
                        <Handshake size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Manage Partners
                        </h1>
                        <p className="text-base mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {total} partner{total !== 1 ? 's' : ''} in your network
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/partners/dashboard')}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all hover:shadow-md"
                        style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        <BarChart3 size={18} strokeWidth={2.5} /> Dashboard
                    </button>
                    <button
                        onClick={() => navigate('/admin/partners/manage/new')}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        <Plus size={18} strokeWidth={2.5} /> Add Partner
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Active Partners
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#10B981' }}>
                        {summary.active}
                    </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Inactive Partners
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#EF4444' }}>
                        {summary.inactive}
                    </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Total Clients
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                        {summary.clients}
                    </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Total Projects
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                        {summary.projects}
                    </p>
                </div>
            </div>


            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 p-5 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="relative flex-1 min-w-[280px]">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                        type="text"
                        value={search}
                        placeholder="Search partners by name, company, email..."
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-offset-0"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: '#F9FAFB',
                        }}
                    />
                </div>
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value as '' | 'true' | 'false');
                        setPage(1);
                    }}
                    className="px-5 py-3 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-offset-0"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: '#F9FAFB',
                    }}
                >
                    <option value="">All Status</option>
                    <option value="true">Active Only</option>
                    <option value="false">Inactive Only</option>
                </select>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-5 rounded-xl border border-red-200 bg-red-50">
                    <p className="text-sm font-semibold text-red-800">
                        Error loading partners: {errorMessage}
                    </p>
                </div>
            )}

            {/* Partners Table */}
            <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                {isLoading || isFetching ? (
                    <div className="text-center py-20">
                        <div
                            className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
                            style={{ color: 'var(--color-primary)' }}
                        ></div>
                        <p className="mt-4 text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            Loading partners...
                        </p>
                    </div>
                ) : partners.length === 0 ? (
                    <div className="text-center py-20">
                        <Handshake size={64} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            No partners found
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Try adjusting your search or filters
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-neutral-50 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    {['Partner', 'Company', 'Contact', 'Clients', 'Projects', 'Status', 'Actions'].map((header) => (
                                        <th
                                            key={header}
                                            className={`text-xs font-semibold uppercase tracking-wider px-6 py-4 ${header === 'Actions' ? 'text-right' : 'text-left'}`}
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                {partners.map((partner: Partner) => (
                                    <tr key={partner._id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                {partner.userId?.name || partner.contactPerson || 'Unnamed Partner'}
                                            </div>
                                            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                                {partner.userId?.email || partner.email || 'No email'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                            {partner.companyName || '-'}
                                        </td>
                                        <td className="px-6 py-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {partner.contactPerson || '-'}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span
                                                className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold"
                                                style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
                                            >
                                                {partner.stats?.clientsCount || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span
                                                className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold"
                                                style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                                            >
                                                {partner.stats?.projectsCount || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span
                                                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                                                style={{
                                                    backgroundColor: partner.isActive ? '#ECFDF5' : '#FEF2F2',
                                                    color: partner.isActive ? '#059669' : '#DC2626',
                                                }}
                                            >
                                                {partner.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/partners/manage/${partner._id}`)}
                                                    className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                                                    title="View partner details"
                                                >
                                                    <ExternalLink size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(partner)}
                                                    disabled={isDeleting}
                                                    className="p-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                    title="Delete partner"
                                                >
                                                    <Trash2 size={16} style={{ color: '#EF4444' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#F9FAFB' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 text-sm font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'white',
                                }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages}
                                className="px-4 py-2 text-sm font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'white',
                                }}
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
