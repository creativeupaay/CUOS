import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Clock3, FolderKanban, Handshake, UserCheck } from 'lucide-react';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';

export default function PartnersDashboardPage() {
    const navigate = useNavigate();
    const { data, isLoading, isFetching } = useGetPartnersQuery({ page: 1, limit: 500 });

    const partners = data?.data?.partners || [];

    const overview = useMemo(() => {
        const active = partners.filter((partner) => partner.isActive).length;
        const pending = partners.filter((partner) => partner.registrationStatus === 'pending').length;
        const completed = partners.filter((partner) => partner.registrationStatus === 'completed').length;
        const totalClients = partners.reduce((sum, partner) => sum + (partner.stats?.clientsCount || 0), 0);
        const totalProjects = partners.reduce((sum, partner) => sum + (partner.stats?.projectsCount || 0), 0);
        const recentlyAdded = [...partners]
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
            .slice(0, 5);
        const topPartners = [...partners]
            .sort((a, b) => (b.stats?.projectsCount || 0) - (a.stats?.projectsCount || 0))
            .slice(0, 5);

        return {
            total: partners.length,
            active,
            inactive: partners.length - active,
            pending,
            completed,
            totalClients,
            totalProjects,
            recentlyAdded,
            topPartners,
        };
    }, [partners]);

    const statCards = [
        {
            label: 'Total Partners',
            value: overview.total,
            note: `${overview.completed} completed onboarding`,
            icon: <Handshake size={20} />,
            tone: { bg: '#ECFEFF', color: '#0E7490' },
        },
        {
            label: 'Pending Onboarding',
            value: overview.pending,
            note: 'Partners waiting to submit their form',
            icon: <Clock3 size={20} />,
            tone: { bg: '#FFF7ED', color: '#C2410C' },
        },
        {
            label: 'Active Partners',
            value: overview.active,
            note: `${overview.inactive} inactive currently`,
            icon: <UserCheck size={20} />,
            tone: { bg: '#ECFDF5', color: '#047857' },
        },
        {
            label: 'Partner Projects',
            value: overview.totalProjects,
            note: `${overview.totalClients} linked clients`,
            icon: <FolderKanban size={20} />,
            tone: { bg: '#EEF2FF', color: '#4338CA' },
        },
    ];

    return (
        <div className="p-6 md:p-8 mx-auto space-y-8" style={{ maxWidth: '1400px' }}>
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-2xl border bg-white p-6 shadow-sm"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex items-center justify-between">
                            <div
                                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                                style={{ backgroundColor: card.tone.bg, color: card.tone.color }}
                            >
                                {card.icon}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                {card.label}
                            </p>
                        </div>
                        <p className="mt-6 text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{card.value}</p>
                        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{card.note}</p>
                    </div>
                ))}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Top Partners by Project Load</h2>
                            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                The quickest view of where most partner activity is happening.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/partners/manage')}
                            className="inline-flex items-center gap-2 text-sm font-semibold"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            View all
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="mt-6 space-y-4">
                        {isLoading || isFetching ? (
                            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Loading partner insights...
                            </div>
                        ) : overview.topPartners.length === 0 ? (
                            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No partners have been added yet.
                            </div>
                        ) : (
                            overview.topPartners.map((partner, index) => (
                                <button
                                    key={partner._id}
                                    onClick={() => navigate(`/admin/partners/manage/${partner._id}`)}
                                    className="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all hover:bg-slate-50"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold"
                                            style={{ backgroundColor: index === 0 ? '#DBEAFE' : '#F1F5F9', color: index === 0 ? '#1D4ED8' : '#334155' }}
                                        >
                                            {(partner.companyName || partner.contactPerson || 'P').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                {partner.companyName || partner.contactPerson || 'Untitled Partner'}
                                            </p>
                                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {partner.contactPerson || partner.email || 'Partner contact not added yet'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                            {partner.stats?.projectsCount || 0}
                                        </p>
                                        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                            Projects
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Onboarding Pulse</h2>
                        <div className="mt-5 space-y-4">
                            {[
                                { label: 'Completed', value: overview.completed, color: '#047857', bg: '#ECFDF5' },
                                { label: 'Pending', value: overview.pending, color: '#C2410C', bg: '#FFF7ED' },
                                { label: 'Inactive', value: overview.inactive, color: '#B91C1C', bg: '#FEF2F2' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between rounded-2xl p-4" style={{ backgroundColor: item.bg }}>
                                    <p className="text-sm font-semibold" style={{ color: item.color }}>{item.label}</p>
                                    <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}>
                                <Building2 size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Recently Added</h2>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Fresh partner records that may still need follow-up.</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {overview.recentlyAdded.length === 0 ? (
                                <p className="rounded-2xl bg-slate-50 p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    No partner records yet.
                                </p>
                            ) : (
                                overview.recentlyAdded.map((partner) => (
                                    <button
                                        key={partner._id}
                                        onClick={() => navigate(`/admin/partners/manage/${partner._id}`)}
                                        className="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all hover:bg-slate-50"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                {partner.companyName || partner.contactPerson || partner.email || 'Untitled Partner'}
                                            </p>
                                            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {new Date(partner.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span
                                            className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                                            style={{
                                                backgroundColor: partner.registrationStatus === 'completed' ? '#ECFDF5' : '#FFF7ED',
                                                color: partner.registrationStatus === 'completed' ? '#047857' : '#C2410C',
                                            }}
                                        >
                                            {partner.registrationStatus || 'pending'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
