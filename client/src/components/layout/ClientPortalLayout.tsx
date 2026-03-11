import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { setPortalClientInfo } from '@/features/client-portal/clientPortalSlice';
import {
    useGetPortalProjectsQuery,
    useGetPortalMeQuery,
    type PortalProject,
} from '@/features/client-portal/clientPortalApi';
import { Building2, Loader2, Menu, X, Mail, User2, Phone, MapPin, AlertTriangle, Briefcase } from 'lucide-react';

const STATUS_META: Record<string, { dot: string; text: string; bg: string; label: string }> = {
    planning:  { dot: '#3B82F6', text: '#1D4ED8', bg: '#EFF6FF',  label: 'Planning' },
    active:    { dot: '#16A34A', text: '#15803D', bg: '#F0FDF4',  label: 'Active' },
    'on-hold': { dot: '#D97706', text: '#B45309', bg: '#FFFBEB',  label: 'On Hold' },
    completed: { dot: '#059669', text: '#047857', bg: '#ECFDF5',  label: 'Done' },
    cancelled: { dot: '#DC2626', text: '#B91C1C', bg: '#FEF2F2',  label: 'Cancelled' },
};

function SidebarProjectList({ projects, isLoading, onNavigate }: { projects: PortalProject[]; isLoading: boolean; onNavigate?: () => void; }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
        );
    }
    if (projects.length === 0) {
        return (
            <div className="px-4 py-8 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                    <Briefcase size={18} style={{ color: '#94A3B8' }} />
                </div>
                <p className="text-xs" style={{ color: '#94A3B8' }}>No projects assigned yet.</p>
            </div>
        );
    }
    return (
        <div className="space-y-1 px-2">
            {projects.map((project) => {
                const meta = STATUS_META[project.status];
                return (
                    <NavLink
                        key={project._id}
                        to={`/client-portal/projects/${project._id}`}
                        onClick={onNavigate}
                        style={({ isActive }) => isActive
                            ? { background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none' }
                            : { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none', color: '#374151' }}
                        className={({ isActive }) => `transition-all w-full text-left ${!isActive ? 'hover:bg-slate-100' : ''}`}
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.8)' : (meta?.dot ?? '#94A3B8') }}
                                />
                                <span className="flex-1 text-sm font-medium truncate leading-snug">
                                    {project.name}
                                </span>
                                {!isActive && meta && (
                                    <span
                                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: meta.bg, color: meta.text }}
                                    >
                                        {meta.label}
                                    </span>
                                )}
                            </>
                        )}
                    </NavLink>
                );
            })}
        </div>
    );
}

/** Profile modal — shows client details when the profile button is clicked */
function ProfileModal({ client, onClose }: { client: any; onClose: () => void }) {
    const rows = [
        { icon: <User2 size={14} />, label: 'Name',    value: client.name },
        { icon: <Mail size={14} />,  label: 'Email',   value: client.email },
        ...(client.companyName ? [{ icon: <Building2 size={14} />, label: 'Company', value: client.companyName }] : []),
        ...(client.phone       ? [{ icon: <Phone size={14} />,    label: 'Phone',   value: client.phone }]       : []),
        ...(client.address     ? [{ icon: <MapPin size={14} />,   label: 'Address', value: client.address }]     : []),
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
        >
            <div
                className="rounded-2xl border shadow-2xl max-w-sm w-full overflow-hidden"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gradient header */}
                <div
                    className="relative px-5 pt-8 pb-8"
                    style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                        style={{ color: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.08)' }}
                    >
                        <X size={15} />
                    </button>
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
                        style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                    >
                        {client.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-lg font-bold text-white leading-tight">{client.name}</p>
                    {client.companyName && (
                        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {client.companyName}
                        </p>
                    )}
                </div>

                {/* Fields */}
                <div className="px-5 py-5 space-y-3">
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ backgroundColor: '#F8FAFC' }}
                        >
                            <span className="mt-0.5 flex-shrink-0" style={{ color: '#6366F1' }}>{row.icon}</span>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#94A3B8' }}>
                                    {row.label}
                                </p>
                                <p className="text-sm font-medium break-words" style={{ color: '#1E293B' }}>
                                    {row.value}
                                </p>
                            </div>
                        </div>
                    ))}
                    <p className="text-xs text-center pt-1" style={{ color: '#CBD5E1' }}>
                        Contact your account manager to update details.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ClientPortalLayout() {
    const dispatch = useAppDispatch();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // Cookie-based auth — /me verifies the httpOnly portal_jwt cookie
    const { data: meData, isLoading: meLoading, isError: meError } = useGetPortalMeQuery();
    const client = meData?.data.client;

    // Sync client info into Redux so other parts of the app can read it
    if (client) {
        dispatch(setPortalClientInfo({
            clientId: (client as any)._id ?? (client as any).clientId ?? '',
            name: client.name,
            email: client.email,
            companyName: (client as any).companyName,
        }));
    }

    const { data: projectsData, isLoading } = useGetPortalProjectsQuery(undefined, { skip: meLoading || meError });
    const projects = projectsData?.data.projects ?? [];

    // Loading state
    if (meLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: '#6366F1' }} />
            </div>
        );
    }

    // Auth failed — cookie missing/expired or revoked
    if (meError || !client) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F8FAFC' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF2F2' }}>
                    <AlertTriangle size={22} style={{ color: '#DC2626' }} />
                </div>
                <h1 className="text-base font-semibold mb-2" style={{ color: '#0F172A' }}>Access Required</h1>
                <p className="text-sm max-w-xs" style={{ color: '#64748B' }}>
                    Your session has expired or the access link is no longer valid.
                    Please use your portal access link or contact your account manager.
                </p>
            </div>
        );
    }

    const SidebarInner = ({ onNavigate }: { onNavigate?: () => void }) => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Brand header — matches right-side header height (h-14 = 56px) */}
            <div
                className="flex items-center gap-3 px-5 h-14 border-b flex-shrink-0"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
                <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                    <Building2 size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#0F172A' }}>Creative Upaay</p>
                    <p className="text-[11px]" style={{ color: '#94A3B8' }}>Client Portal</p>
                </div>
            </div>

            {/* Projects list — fills remaining space */}
            <div className="flex-1 overflow-y-auto pt-5 pb-3" style={{ backgroundColor: '#FAFAFA' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest px-5 mb-3" style={{ color: '#94A3B8' }}>
                    Your Projects
                </p>
                <SidebarProjectList projects={projects} isLoading={isLoading} onNavigate={onNavigate} />
            </div>

            {/* Bottom client card */}
            <div
                className="flex items-center gap-3 px-4 py-4 border-t flex-shrink-0"
                style={{ borderColor: '#E2E8F0', backgroundColor: '#FAFAFA' }}
            >
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                    {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{client.name}</p>
                    {client.companyName && (
                        <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{client.companyName}</p>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
            {/* Desktop sidebar */}
            <aside
                className="hidden lg:flex flex-col flex-shrink-0 border-r"
                style={{ width: 264, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
                <SidebarInner />
            </aside>

            {/* Mobile overlay */}
            {mobileOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
                    <aside
                        className="fixed inset-y-0 left-0 z-50 flex flex-col border-r lg:hidden"
                        style={{ width: 264, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                    >
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg"
                            style={{ color: '#64748B' }}
                        >
                            <X size={18} />
                        </button>
                        <SidebarInner onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top header */}
                <header
                    className="flex items-center justify-between gap-3 px-4 h-14 border-b flex-shrink-0"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                >
                    {/* Left: mobile menu toggle only */}
                    <div className="flex items-center">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="lg:hidden p-2 rounded-lg"
                            style={{ color: '#64748B' }}
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    {/* Right: Profile button (icon on left of name, click → profile modal) */}
                    {client && (
                        <button
                            onClick={() => setShowProfile(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:bg-indigo-50 hover:border-indigo-200"
                            style={{ borderColor: '#E2E8F0' }}
                            title="View my profile"
                        >
                            {/* Profile icon — LEFT of name as requested */}
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                            >
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium hidden sm:block" style={{ color: '#1E293B' }}>
                                {client.name}
                            </span>
                        </button>
                    )}
                </header>

                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>

            {/* Profile modal */}
            {showProfile && <ProfileModal client={client} onClose={() => setShowProfile(false)} />}
        </div>
    );
}

