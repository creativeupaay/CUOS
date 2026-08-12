import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useGetMyProfileQuery } from '@/features/hrms/hrmsApi';
import {
    FolderKanban, DollarSign, Users, Building2, Shield,
    ArrowRight, Clock, LogOut, Sparkles, Settings, Briefcase, Handshake, ListTodo, Gamepad2
} from 'lucide-react';
import NotificationBell from '@/features/notification/components/NotificationBell';
import NotificationPanel from '@/features/notification/components/NotificationPanel';
import GlobalTimerWidget from '@/components/organisms/project/GlobalTimerWidget';
import { useNotificationSocket } from '@/features/notification/hooks/useNotificationSocket';
import { useCheckJobManagerStatusQuery } from '@/features/hiring/hiringApi';
import { hasModuleViewAccess } from '@/utils/modulePermissions';


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
    tasks: { from: '#7C3AED', to: '#059669' },
    finance: { from: '#7C3AED', to: '#EC4899' },
    crm: { from: '#EA580C', to: '#F59E0B' },
    hrms: { from: '#0369A1', to: '#06B6D4' },
    overallAdmin: { from: '#374151', to: '#6B7280' },
    hiring: { from: '#0F766E', to: '#0EA5E9' },
    partners: { from: '#0E7490', to: '#06B6D4' },
    teamManagement: { from: '#6366F1', to: '#8B5CF6' },
    gameZone: { from: '#F59E0B', to: '#F43F5E' },
};

/* ── Department Card ─────────────────────────────────────── */
function DepartmentCard({ title, description, icon, path, isActive, accentFrom, accentTo }: Department) {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => isActive && navigate(path, { state: { newTab: true } })}
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
    const user = useAppSelector((state) => state.auth.user);

    // Initialize notification socket listeners
    useNotificationSocket();

    const { data: jobManagerStatus } = useCheckJobManagerStatusQuery();
    const isJobManager = !!jobManagerStatus?.data?.isJobManager;

    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner';



    const { data: profileData } = useGetMyProfileQuery(undefined, { skip: isPartner });
    const profilePhotoUrl = (profileData?.data?.employee as any)?.profilePhoto?.url;

    const mp = user?.modulePermissions;

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const intervalId = setInterval(() => {
            setNow(new Date());
        }, 1000); // Ticks every second

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

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
            key: 'tasks',
            title: 'Tasks',
            description: 'View and manage all your tasks and meetings across all projects',
            icon: <ListTodo size={22} />,
            path: '/tasks',
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
        {
            key: 'partners',
            title: 'Partners',
            description: 'Manage partner onboarding, attribution and performance',
            icon: <Handshake size={22} />,
            path: '/admin/partners/dashboard',
        },
        {
            key: 'hiring',
            title: 'Hiring',
            description: 'Manage job postings, candidates, assignments, and interviews',
            icon: <Briefcase size={22} />,
            path: '/hiring',
        },
        {
            key: 'gameZone',
            title: 'Game Zone',
            description: 'Play team building games and track leaderboards',
            icon: <Gamepad2 size={22} />,
            path: '/games',
        },
    ];

    const partnerDepartments = [
        // Team Management is optional for partner employees, always available for main partner account.
        ...(user?.isPartnerEmployee && mp?.teamManagement?.enabled !== true
            ? []
            : [{
                key: 'teamManagement',
                title: 'Team Management',
                description: 'Manage your team members, access and credentials',
                icon: <Users size={22} />,
                path: '/partner-admin/team',
                isActive: true,
                accentFrom: MODULE_ACCENTS.teamManagement.from,
                accentTo: MODULE_ACCENTS.teamManagement.to,
            }]),
        // Project Management and CRM based on permissions
        ...allDepartments
            .filter(d => d.key === 'projectManagement' || d.key === 'crm')
            .filter(d => {
                const perm = mp?.[d.key as keyof typeof mp] as any;
                return !!perm?.enabled;
            })
            .map(d => ({
                ...d,
                isActive: true,
                accentFrom: MODULE_ACCENTS[d.key].from,
                accentTo: MODULE_ACCENTS[d.key].to,
            })),
    ];

    const nonAdminDepartments = allDepartments
        .filter(d => {
            if (!['projectManagement', 'tasks', 'finance', 'crm', 'hrms', 'overallAdmin', 'partners', 'hiring', 'gameZone'].includes(d.key)) return false;
            if (d.key === 'gameZone') return true; // Game zone is visible to all non-partner users
            
            // Tasks module reuses projectManagement access
            const permKey = d.key === 'tasks' ? 'projectManagement' : d.key;
            if (!hasModuleViewAccess(user, permKey as any, { isJobManager })) return false;
            return true;
        })
        .map(d => ({
            ...d,
            isActive: true,
            accentFrom: MODULE_ACCENTS[d.key].from,
            accentTo: MODULE_ACCENTS[d.key].to,
        }));

    const departments: Department[] = isPartner
            ? partnerDepartments
            : nonAdminDepartments;

    // Partner branding - get company info from user object (set during partner login)
    const partnerCompanyName = (user as any)?.companyName;
    const partnerCompanyLogo = (user as any)?.companyLogo;

    // Determine branding
    const brandName = isPartner && partnerCompanyName ? partnerCompanyName : 'CUOS';
    const brandSubtitle = isPartner && partnerCompanyName ? 'Partner Portal' : 'Creative Upaay';
    // const brandInitials = isPartner && partnerCompanyName
    //     ? partnerCompanyName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    //     : 'CU';

    return (
        <div className="min-h-screen flex flex-col" style={{
            background: isPartner
                ? 'linear-gradient(to bottom right, #EEF2FF, #FEFEFE, #F3E8FF)'
                : 'var(--color-bg-app)'
        }}>

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
                <div className="flex items-center justify-between px-6 h-14">
                    {/* Brand */}
                    <div className="flex items-center gap-3 flex-1">
                        {partnerCompanyLogo && isPartner ? (
                            <img
                                src={partnerCompanyLogo}
                                alt={brandName}
                                className="h-8 w-auto object-contain"
                            />
                        ) : (
                            <img
                                src="/company-logo2.png"
                                alt="Company Logo"
                                className="h-8 w-auto object-contain"
                            />
                        )}
                        <div>
                            <div
                                className="font-bold text-sm leading-tight"
                                style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}
                            >
                                {brandName}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                {brandSubtitle}
                            </div>
                        </div>
                    </div>

                    {/* Right: timer + profile + notifications */}
                    <div className="flex items-center justify-end gap-4 flex-1">
                        {/* Timer */}
                        <div className="shrink-0">
                            <GlobalTimerWidget />
                        </div>

                        {/* Avatar — clickable to open settings */}
                        <Link to="/my-hrms/profile" title="My Profile & Settings" className="shrink-0 transition-transform hover:scale-105 active:scale-95">
                            {profilePhotoUrl ? (
                                <img
                                    src={profilePhotoUrl}
                                    alt={user?.name || 'Profile'}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            ) : (
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                                >
                                    {user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                </div>
                            )}
                        </Link>

                        {/* Notification Bell (far right) */}
                        <NotificationBell />
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
                {isPartner && partnerCompanyName
                    ? `${partnerCompanyName} — Partner Portal · © ${new Date().getFullYear()}`
                    : `CUOS — Creative Upaay Operating System · © ${new Date().getFullYear()} Creative Upaay`
                }
            </footer>

            {/* Notification Panel */}
            <NotificationPanel />
        </div>
    );
}
