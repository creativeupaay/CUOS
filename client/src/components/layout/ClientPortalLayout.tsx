import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { clearPortalAuth, setPortalClientInfo } from '@/features/client-portal/clientPortalSlice';
import {
    useGetPortalProjectsQuery,
    useGetPortalMeQuery,
    useLogoutPortalMutation,
    type PortalProject,
} from '@/features/client-portal/clientPortalApi';
import { LogOut, Building2, Loader2, Menu, X, ChevronDown, Mail, User2, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    planning: '#3B82F6',
    active: '#16A34A',
    'on-hold': '#D97706',
    completed: '#059669',
    cancelled: '#DC2626',
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
        return <p className="text-xs px-4 py-4" style={{ color: '#94A3B8' }}>No projects assigned yet.</p>;
    }
    return (
        <div className="space-y-0.5 px-2">
            {projects.map((project) => {
                const dotColor = STATUS_COLORS[project.status] ?? '#94A3B8';
                return (
                    <NavLink
                        key={project._id}
                        to={`/client-portal/projects/${project._id}`}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left ${isActive ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-700'}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? '#FFFFFF' : dotColor }} />
                                <span className="flex-1 text-sm font-medium truncate leading-snug">{project.name}</span>
                            </>
                        )}
                    </NavLink>
                );
            })}
        </div>
    );
}

/** Client info dropdown shown in top-right of header */
function ClientDropdown({ client, onLogout }: { client: { name: string; email: string; companyName?: string }; onLogout: () => void }) {
    const [open, setOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all hover:bg-neutral-50"
                style={{ borderColor: '#E2E8F0' }}
            >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                    {client.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium hidden sm:block" style={{ color: '#1E293B' }}>{client.name}</span>
                <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#94A3B8' }} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div
                        className="absolute right-0 mt-2 z-40 rounded-xl border shadow-lg overflow-hidden min-w-[220px]"
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
                    >
                        {/* Profile summary */}
                        <div className="px-4 py-3 border-b" style={{ borderColor: '#F1F5F9', backgroundColor: '#FAFAFA' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#6366F1' }}>
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{client.name}</p>
                                    {client.companyName && <p className="text-xs truncate" style={{ color: '#64748B' }}>{client.companyName}</p>}
                                </div>
                            </div>
                        </div>

                        {/* My Details */}
                        <button
                            onClick={() => { setShowDetails(true); setOpen(false); }}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-neutral-50"
                            style={{ color: '#374151' }}
                        >
                            <User2 size={15} style={{ color: '#6366F1' }} />
                            My Details
                        </button>

                        {/* Sign out */}
                        <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                            <button
                                onClick={onLogout}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-red-50"
                                style={{ color: '#EF4444' }}
                            >
                                <LogOut size={15} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Client details modal */}
            {showDetails && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowDetails(false)}>
                        <div
                            className="rounded-2xl border shadow-xl max-w-sm w-full overflow-hidden"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
                                <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>My Details</span>
                                <button onClick={() => setShowDetails(false)} className="p-1.5 rounded-lg hover:bg-neutral-100" style={{ color: '#64748B' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            {/* Modal body */}
                            <div className="px-5 py-5 space-y-4">
                                {/* Avatar */}
                                <div className="flex justify-center">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: '#6366F1' }}>
                                        {client.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                {/* Fields */}
                                {[
                                    { icon: <User2 size={14} />, label: 'Name', value: client.name },
                                    { icon: <Mail size={14} />, label: 'Email', value: client.email },
                                    ...(client.companyName ? [{ icon: <Building2 size={14} />, label: 'Company', value: client.companyName }] : []),
                                ].map((row) => (
                                    <div key={row.label} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: '#F8FAFC' }}>
                                        <span className="mt-0.5" style={{ color: '#6366F1' }}>{row.icon}</span>
                                        <div>
                                            <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>{row.label}</p>
                                            <p className="text-sm font-medium" style={{ color: '#1E293B' }}>{row.value}</p>
                                        </div>
                                    </div>
                                ))}
                                <p className="text-xs text-center" style={{ color: '#C7D0E0' }}>Contact your account manager to update details.</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ClientPortalLayout() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [logoutPortal] = useLogoutPortalMutation();

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

    const handleLogout = async () => {
        try { await logoutPortal().unwrap(); } catch { /* ignore */ }
        dispatch(clearPortalAuth());
        navigate('/', { replace: true });
    };

    const SidebarInner = ({ onNavigate }: { onNavigate?: () => void }) => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Brand */}
            <div className="flex items-center gap-3 px-5 h-16 border-b flex-shrink-0" style={{ borderColor: '#E2E8F0' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#111827' }}>
                    <Building2 size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>Creative Upaay</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>Client Portal</p>
                </div>
            </div>

            {/* Projects list — fills remaining space */}
            <div className="flex-1 overflow-y-auto pt-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider px-5 mb-2" style={{ color: '#94A3B8' }}>Projects</p>
                <SidebarProjectList projects={projects} isLoading={isLoading} onNavigate={onNavigate} />
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex flex-col flex-shrink-0 border-r" style={{ width: 260, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                <SidebarInner />
            </aside>

            {/* Mobile overlay */}
            {mobileOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 z-50 flex flex-col border-r lg:hidden" style={{ width: 260, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg" style={{ color: '#64748B' }}>
                            <X size={18} />
                        </button>
                        <SidebarInner onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top header — always visible */}
                <header className="flex items-center justify-between gap-3 px-4 h-14 border-b flex-shrink-0" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                    {/* Left: mobile menu + brand */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg" style={{ color: '#64748B' }}><Menu size={20} /></button>
                        <div className="hidden lg:flex items-center gap-2">
                            {/* breadcrumb-style subtle label */}
                            <span className="text-sm" style={{ color: '#94A3B8' }}>Client Portal</span>
                        </div>
                        <div className="lg:hidden flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
                                <Building2 size={13} className="text-white" />
                            </div>
                            <span className="text-sm font-bold" style={{ color: '#111827' }}>Creative Upaay</span>
                        </div>
                    </div>

                    {/* Right: client dropdown */}
                    {client && (
                        <ClientDropdown client={client} onLogout={handleLogout} />
                    )}
                </header>

                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
