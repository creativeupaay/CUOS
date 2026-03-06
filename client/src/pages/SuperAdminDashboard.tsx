import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import {
    FolderKanban, DollarSign, Users, Building2, Shield,
    ArrowRight, Clock, LogOut, Sparkles, ChevronRight,
} from 'lucide-react';

/* ── Module definitions ──────────────────────────────────── */
interface Department {
    key: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    accentFrom: string;
    accentTo: string;
    isActive: boolean;
}

const MODULE_ACCENTS: Record<string, { from: string; to: string }> = {
    projectManagement: { from: '#059669', to: '#0EA5E9' },
    finance: { from: '#7C3AED', to: '#EC4899' },
    crm: { from: '#EA580C', to: '#F59E0B' },
    hrms: { from: '#0369A1', to: '#06B6D4' },
    overallAdmin: { from: '#374151', to: '#6B7280' },
};

/* ── Department Card ─────────────────────────────────────── */
function DepartmentCard({ title, description, icon, path, isActive, accentFrom, accentTo }: Department) {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => isActive && navigate(path)}
            className="relative rounded-2xl border overflow-hidden transition-all duration-200 group"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
                cursor: isActive ? 'pointer' : 'not-allowed',
                opacity: isActive ? 1 : 0.55,
                boxShadow: 'var(--shadow-xs)',
            }}
            onMouseEnter={(e) => {
                if (!isActive) return;
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                e.currentTarget.style.borderColor = accentFrom + '50';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                e.currentTarget.style.borderColor = 'var(--color-border-default)';
            }}
        >
            {/* Gradient accent strip */}
            <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`, opacity: isActive ? 1 : 0.4 }}
            />

            <div className="p-6 pt-7">
                {/* Icon */}
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{
                        background: `linear-gradient(135deg, ${accentFrom}20, ${accentTo}20)`,
                        border: `1px solid ${accentFrom}30`,
                    }}
                >
                    <div style={{ color: accentFrom }}>{icon}</div>
                </div>

                {/* Text */}
                <h3
                    className="text-base font-bold mb-1.5"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                >
                    {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {description}
                </p>

                {/* Footer row */}
                <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-default)' }}>
                    {isActive ? (
                        <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: accentFrom + '15', color: accentFrom }}
                        >
                            Active
                        </span>
                    ) : (
                        <span
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <Clock size={10} />
                            Coming Soon
                        </span>
                    )}

                    {isActive && (
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
                            style={{ background: accentFrom + '15', color: accentFrom }}
                        >
                            <ArrowRight size={14} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Main Dashboard ──────────────────────────────────────── */
export default function SuperAdminDashboard() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isAdminUser = ['super-admin', 'admin', 'super_admin'].includes(roleName);
    const displayRole = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name
            : String(user.role)
        : 'User';

    const mp = user?.modulePermissions;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const allDepartments = [
        {
            key: 'projectManagement',
            title: 'Project Management',
            description: 'Manage projects, tasks, time logs and team collaboration',
            icon: <FolderKanban size={22} />,
            path: '/projects',
        },
        {
            key: 'finance',
            title: 'Finance',
            description: 'Track expenses, invoices, and financial reports',
            icon: <DollarSign size={22} />,
            path: '/finance',
        },
        {
            key: 'crm',
            title: 'CRM',
            description: 'Customer relationship management and sales tracking',
            icon: <Users size={22} />,
            path: '/crm',
        },
        {
            key: 'hrms',
            title: 'HRMS',
            description: 'Human resource management and employee records',
            icon: <Building2 size={22} />,
            path: '/hrms',
        },
        {
            key: 'overallAdmin',
            title: 'Overall Admin',
            description: 'System administration, user permissions and settings',
            icon: <Shield size={22} />,
            path: '/admin',
        },
    ];

    const departments: Department[] = isAdminUser
        ? allDepartments.map(d => ({
            ...d,
            isActive: true,
            accentFrom: MODULE_ACCENTS[d.key].from,
            accentTo: MODULE_ACCENTS[d.key].to,
        }))
        : allDepartments
            .filter(d => {
                const perm = mp?.[d.key as keyof typeof mp] as any;
                if (!perm?.enabled) return false;
                if (d.key === 'projectManagement') {
                    return Array.isArray(perm.projectPermissions) && perm.projectPermissions.length > 0;
                }
                return true;
            })
            .map(d => ({
                ...d,
                isActive: true,
                accentFrom: MODULE_ACCENTS[d.key].from,
                accentTo: MODULE_ACCENTS[d.key].to,
            }));

    const firstName = user?.name?.split(' ')[0] || 'there';

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-app)' }}>

            {/* ── Top Navigation Bar ────────────────────────────────── */}
            <header
                className="border-b sticky top-0 z-30"
                style={{
                    background: 'rgba(255,255,255,0.90)',
                    backdropFilter: 'blur(16px)',
                    borderColor: 'var(--color-border-default)',
                    boxShadow: 'var(--shadow-xs)',
                }}
            >
                <div className="flex items-center justify-between px-6 h-14" style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                            style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)', boxShadow: 'var(--shadow-brand)' }}
                        >
                            CU
                        </div>
                        <div>
                            <div
                                className="font-bold text-sm leading-tight"
                                style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}
                            >
                                CUOS
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                Creative Upaay
                            </div>
                        </div>
                    </div>

                    {/* User + Logout */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 pr-3" style={{ borderRight: '1px solid var(--color-border-default)' }}>
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                            >
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                                    {user?.name || 'User'}
                                </div>
                                <div
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize"
                                    style={{
                                        background: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary-dark)',
                                        display: 'inline-block',
                                    }}
                                >
                                    {displayRole}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn btn-ghost"
                            style={{ height: '34px', padding: '0 12px', gap: '6px' }}
                        >
                            <LogOut size={14} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hero Banner ───────────────────────────────────────── */}
            <div
                className="relative overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg,#0a2018 0%,#064E3B 50%,#0c3a5c 100%)',
                    padding: '48px 24px 52px',
                }}
            >
                {/* Decorative circles */}
                <div
                    className="absolute -top-20 -right-20 w-64 h-64 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.08)', pointerEvents: 'none' }}
                />
                <div
                    className="absolute bottom-0 left-1/3 w-96 h-32 rounded-full"
                    style={{ background: 'rgba(14,165,233,0.06)', filter: 'blur(40px)', pointerEvents: 'none' }}
                />

                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={14} style={{ color: 'rgba(16,185,129,0.9)' }} />
                                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
                                    WORKSPACE
                                </span>
                            </div>
                            <h1
                                className="text-3xl font-bold text-white mb-2"
                                style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}
                            >
                                Good to see you, {firstName}!
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px' }}>
                                Select a module below to get started
                            </p>
                        </div>
                        <div
                            className="rounded-xl px-5 py-3 text-right"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                {timeStr}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                {dateStr}
                            </div>
                        </div>
                    </div>

                    {/* Quick nav pills */}
                    <div className="flex flex-wrap gap-2 mt-7">
                        {departments.slice(0, 4).map(d => (
                            <button
                                key={d.key}
                                onClick={() => navigate(d.path)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.75)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                                }}
                            >
                                {d.title}
                                <ChevronRight size={11} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Module Grid ───────────────────────────────────────── */}
            <main className="flex-1 px-6 py-8">
                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2
                            className="text-lg font-bold"
                            style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}
                        >
                            Modules
                        </h2>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {departments.length} available
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {departments.map(({ key: deptKey, ...deptProps }) => (
                            <DepartmentCard key={deptKey} {...deptProps} />
                        ))}
                    </div>
                </div>
            </main>

            {/* ── Footer ────────────────────────────────────────────── */}
            <footer
                className="px-6 py-4 border-t text-center text-xs"
                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
            >
                CUOS — Creative Upaay Operating System &nbsp;·&nbsp; © {new Date().getFullYear()} Creative Upaay
            </footer>
        </div>
    );
}
