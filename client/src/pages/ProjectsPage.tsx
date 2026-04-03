import { useGetProjectsQuery, useDeleteProjectMutation, useUpdateProjectMutation } from '@/features/project';
import { Link, Navigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, FolderOpen, Users, Calendar, Flame, Trash2, MoreVertical } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';

/* ── Status map ──────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'var(--color-success-soft)', text: 'var(--color-success-dark)', dot: '#10B981' },
    completed: { bg: 'var(--color-info-soft)', text: 'var(--color-info)', dot: '#3B82F6' },
    'on-hold': { bg: 'var(--color-warning-soft)', text: '#92400E', dot: '#F59E0B' },
    planning: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)', dot: '#9CA3AF' },
    cancelled: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)', dot: '#EF4444' },
};

/* ── Priority config ─────────────────────────────────────── */
const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    critical: { color: '#EF4444', label: 'Critical' },
    high: { color: '#EA580C', label: 'High' },
    medium: { color: '#F59E0B', label: 'Medium' },
    low: { color: '#10B981', label: 'Low' },
};

/* ── Priority border accent ──────────────────────────────── */
const PRIORITY_BORDER: Record<string, string> = {
    critical: '#EF4444',
    high: '#EA580C',
    medium: '#F59E0B',
    low: '#10B981',
};



/* ── Main Page ───────────────────────────────────────────── */
export default function ProjectsPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [partnerFilter, setPartnerFilter] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [statusModal, setStatusModal] = useState<{ id: string; name: string; currentStatus: string } | null>(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const user = useAppSelector((state) => state.auth.user);

    const { data, isLoading, error } = useGetProjectsQuery({
        status: statusFilter,
        priority: priorityFilter,
        partnerId: partnerFilter || undefined,
    });
    const [deleteProject, { isLoading: isDeletingProject }] = useDeleteProjectMutation();
    const [updateProject, { isLoading: isUpdatingStatus }] = useUpdateProjectMutation();
    const projects = data?.data || [];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (openMenuId && menuRefs.current[openMenuId] && !menuRefs.current[openMenuId]!.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openMenuId]);

    const roleName = user?.role ? (typeof user.role === 'object' ? (user.role as any).name : user.role) : '';
    const isAdmin = ['super-admin', 'admin', 'super_admin'].includes((roleName as string).toLowerCase());
    const isPartner = (roleName as string).toLowerCase() === 'partner';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes((roleName as string).toLowerCase());
    const mp = user?.modulePermissions?.projectManagement;
    const hasProjectAccess = isAdmin || isPartner || (mp?.enabled && Array.isArray(mp?.projectPermissions) && mp.projectPermissions.length > 0);
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdmin });
    const partners = partnersData?.data?.partners || [];
    const getPartnerName = (partnerId?: string) => {
        if (!partnerId) return '';
        const partner = partners.find((p: any) => p._id === partnerId);
        return partner?.userId?.name || partner?.contactPerson || partner?.companyName || 'Partner';
    };

    const handleDeleteProject = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteProject(deleteConfirm.id).unwrap();
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Failed to delete project:', err);
        }
    };

    const handleStatusUpdate = async () => {
        if (!statusModal || !selectedStatus) return;
        try {
            await updateProject({ id: statusModal.id, data: { status: selectedStatus as any } }).unwrap();
            setStatusModal(null);
        } catch (err) {
            console.error('Failed to update project status:', err);
        }
    };

    if (!hasProjectAccess && !isLoading) return <Navigate to="/dashboard" replace />;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    Loading projects…
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Error loading projects
                </div>
            </div>
        );
    }

    const statusOptions = ['', 'planning', 'active', 'on-hold', 'completed', 'cancelled'];
    const priorityOptions = ['', 'low', 'medium', 'high', 'critical'];

    return (
        <>
        <div className="px-6 py-6 page-enter" style={{ maxWidth: '1280px' }}>
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        Projects
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''} {statusFilter ? `· ${statusFilter}` : ''}
                    </p>
                </div>

                {/* ── Filters ───────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    >
                        <option value="">All Statuses</option>
                        {statusOptions.filter(Boolean).map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
                        ))}
                    </select>

                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    >
                        <option value="">All Priorities</option>
                        {priorityOptions.filter(Boolean).map((p) => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                    </select>

                    {isAdmin && (
                        <select
                            value={partnerFilter}
                            onChange={(e) => setPartnerFilter(e.target.value)}
                            className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors w-full md:w-auto"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        >
                            <option value="">All Partners</option>
                            {partners.map((partner: any) => (
                                <option key={partner._id} value={partner._id}>
                                    {partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner'}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* ── Grid ──────────────────────────────────────────────── */}
            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {projects.map((project) => {
                        const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
                        const pc = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.low;
                        const borderAccent = PRIORITY_BORDER[project.priority] || '#10B981';
                        const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed';

                        return (
                            <div key={project._id} className="relative group">
                                <Link
                                    to={`/projects/${project._id}`}
                                    className="block rounded-2xl border overflow-hidden transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--color-bg-surface)',
                                        borderColor: 'var(--color-border-default)',
                                        boxShadow: 'var(--shadow-xs)',
                                        borderLeft: `3px solid ${borderAccent}`,
                                        minHeight: '150px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                        e.currentTarget.style.borderColor = borderAccent + '60';
                                        e.currentTarget.style.borderLeftColor = borderAccent;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                                        e.currentTarget.style.borderColor = 'var(--color-border-default)';
                                        e.currentTarget.style.borderLeftColor = borderAccent;
                                    }}
                                >
                                    <div className="p-5 flex flex-col h-full flex-1">
                                        {/* Top row: name + status */}
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3
                                                className="text-sm font-bold leading-tight flex-1"
                                                style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                                            >
                                                {project.name}
                                            </h3>
                                            <span
                                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0"
                                                style={{ backgroundColor: sc.bg, color: sc.text }}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                                                {project.status?.replace('-', ' ')}
                                            </span>
                                        </div>

                                        {/* Description */}
                                        {project.description && (
                                            <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                                                {project.description}
                                            </p>
                                        )}

                                        {isAdmin && project.partnerId && (
                                            <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                                Created by Partner: {getPartnerName(project.partnerId)}
                                            </p>
                                        )}

                                        {/* Meta row */}
                                        <div className="flex items-center gap-3 text-xs mt-auto" style={{ color: 'var(--color-text-muted)' }}>
                                            {/* Priority */}
                                            <span className="flex items-center gap-1 font-medium" style={{ color: pc.color }}>
                                                <Flame size={11} />
                                                {pc.label}
                                            </span>

                                            {/* Assignees */}
                                            <span className="flex items-center gap-1">
                                                <Users size={11} />
                                                {project.assignees.length}
                                            </span>

                                            {/* Deadline / Internal Deadline */}
                                            {(project.endDate || project.deadline) && (
                                                <span
                                                    className="flex items-center gap-1 ml-auto font-medium"
                                                    style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                                                >
                                                    <Calendar size={11} />
                                                    {new Date((project.endDate || project.deadline) as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    {isOverdue && ' · Overdue'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>

                                {/* 3-dot menu — super admin only, visible on hover */}
                                {isSuperAdmin && (
                                    <div
                                        className="absolute top-2.5 right-2.5 z-10"
                                        ref={(el) => { menuRefs.current[project._id] = el; }}
                                    >
                                        <button
                                            type="button"
                                            title="Project options"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === project._id ? null : project._id);
                                            }}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            <MoreVertical size={15} />
                                        </button>

                                        {openMenuId === project._id && (
                                            <div
                                                className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border py-1 z-20"
                                                style={{ borderColor: 'var(--color-border-default)' }}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setOpenMenuId(null);
                                                        setSelectedStatus(project.status);
                                                        setStatusModal({ id: project._id, name: project.name, currentStatus: project.status });
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                                                    style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                    Change Status
                                                </button>
                                                <div className="my-1 border-t" style={{ borderColor: 'var(--color-border-default)' }} />
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setOpenMenuId(null);
                                                        setDeleteConfirm({ id: project._id, name: project.name });
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-red-50 transition-colors text-left text-red-600"
                                                >
                                                    <Trash2 size={13} />
                                                    Delete Project
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="flex flex-col items-center justify-center py-20 rounded-2xl border"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        <FolderOpen size={28} />
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        No projects found
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {isAdmin ? 'Create your first project to get started' : 'No projects have been assigned to you yet'}
                    </p>
                    {(isAdmin || isPartner) && (
                        <Link to="/projects/new" className="btn btn-primary mt-5" style={{ gap: '6px' }}>
                            <Plus size={15} /> Create Project
                        </Link>
                    )}
                </div>
            )}
        </div>

        {/* ── Delete project confirmation modal ─────────────────── */}
        {/* ── Status change modal ──────────────────────────────── */}
        {statusModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Change Project Status
                    </h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        {statusModal.name}
                    </p>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="on-hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setStatusModal(null)}
                            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStatusUpdate}
                            disabled={isUpdatingStatus || selectedStatus === statusModal.currentStatus}
                            className="px-4 py-2 text-sm rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : null}
                            Update Status
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Delete project confirmation modal ─────────────────── */}
        {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        Delete Project
                    </h3>
                    <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                        Are you sure you want to permanently delete <strong>{deleteConfirm.name}</strong>?
                        This will remove all associated tasks, time logs, and documents. This action cannot be undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteProject}
                            disabled={isDeletingProject}
                            className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isDeletingProject ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete Project
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* ── Floating Action Button (New Project) ────────────────── */}
        {(isAdmin || isPartner) && (
            <Link
                to="/projects/new"
                className="fixed bottom-6 right-6 btn btn-primary shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                style={{ 
                    zIndex: 60, 
                    gap: '8px', 
                    padding: '0 24px', 
                    height: '48px', 
                    borderRadius: '999px',
                    fontSize: '14.5px',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 8px 10px -6px rgba(16, 185, 129, 0.1)'
                }}
            >
                <Plus size={18} />
                New Project
            </Link>
        )}
        </>)

    }