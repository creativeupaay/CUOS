import { useOutletContext, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import type { Project, ProjectPhase } from '@/features/project';
import { useAddAssigneeMutation, useRemoveAssigneeMutation, useUpdateAssigneePermissionsMutation, useLazyGetAssigneePermissionsQuery, useUpdateProjectMutation } from '@/features/project';
import { useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { Calendar, Users, Building2, Pencil, CheckCircle2, Circle, Clock, Target, Plus, Trash2, Loader2, Settings2, X, LayoutDashboard, ListTodo, Video, KeyRound, FileText, StickyNote, ChevronRight, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';

export default function ProjectOverviewTab() {
    const { project } = useOutletContext<{ project: Project }>();
    const currentUser = useSelector((s: RootState) => s.auth.user);

    // Check if user is super-admin
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);
    const isAdminUser = ['super-admin', 'super_admin', 'admin'].includes(roleName);
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const projectPartnerId = typeof project.partnerId === 'object' ? (project.partnerId as any)?._id : project.partnerId;
    const partnerName = projectPartnerId
        ? (() => {
            const partner = partnersData?.data?.partners?.find((p: any) => p._id === projectPartnerId);
            return partner?.userId?.name || partner?.contactPerson || partner?.companyName;
        })()
        : undefined;

    const [isAddingMember, setIsAddingMember] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [roleError, setRoleError] = useState(false);
    const [subModules, setSubModules] = useState({
        overview: true, // give overview by default
        tasks: false,
        timeLogs: false,
        meetings: false,
        credentials: false,
        documents: false,
        notes: false,
    });

    // Edit permissions state
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editSubModules, setEditSubModules] = useState({
        overview: true,
        tasks: false,
        timeLogs: false,
        meetings: false,
        credentials: false,
        documents: false,
        notes: false,
    });

    // Load all active employees — the employee list is the team pool for project assignment
    const { data: employeesData, isLoading: isLoadingEmployees } = useGetEmployeesQuery({ status: 'active', limit: 200 });
    const employees = (employeesData?.data as any)?.employees ?? [];
    const [addAssignee, { isLoading: isAdding }] = useAddAssigneeMutation();
    const [removeAssignee, { isLoading: isRemoving }] = useRemoveAssigneeMutation();
    const [updatePermissions, { isLoading: isUpdatingPermissions }] = useUpdateAssigneePermissionsMutation();
    const [fetchAssigneePermissions] = useLazyGetAssigneePermissionsQuery();

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        if (!selectedRole) {
            setRoleError(true);
            return;
        }
        setRoleError(false);
        try {
            await addAssignee({
                projectId: project._id,
                data: { employeeId: selectedUserId, role: selectedRole as any, subModules }
            }).unwrap();
            setIsAddingMember(false);
            setSelectedUserId('');
            setSelectedRole('');
            setRoleError(false);
            setSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false, notes: false });
        } catch (error) {
            console.error('Failed to add assignee:', error);
        }
    };

    const handleRemoveMember = async (employeeId: string) => {
        if (window.confirm('Are you sure you want to remove this member from the project?')) {
            try {
                await removeAssignee({ projectId: project._id, employeeId }).unwrap();
            } catch (error) {
                console.error('Failed to remove assignee:', error);
            }
        }
    };

    const handleOpenEdit = async (employeeId: string) => {
        setEditingUserId(employeeId);

        // Full defaults — ensures any new fields (like `notes`) missing from old DB records are present
        const fullDefaults = { overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false, notes: false };

        // Fetch current custom permissions from the backend instead of using defaults
        try {
            const res = await fetchAssigneePermissions({ projectId: project._id, employeeId }).unwrap();
            // Merge: defaults first so old records without `notes` still have it, backend values win
            setEditSubModules({ ...fullDefaults, ...(res.data ?? {}) });
        } catch (error) {
            console.error("Failed to fetch assignee permissions", error);
            setEditSubModules(fullDefaults);
        }
    };

    const handleSavePermissions = async () => {
        if (!editingUserId) return;
        try {
            await updatePermissions({
                projectId: project._id,
                employeeId: editingUserId,
                data: { subModules: editSubModules }
            }).unwrap();
            setEditingUserId(null);
        } catch (error) {
            console.error('Failed to update permissions:', error);
        }
    };

    return (
        <div className="space-y-5">
            {/* Project Progress */}
            <ProjectProgress project={project} isSuperAdmin={isSuperAdmin} />

            {/* Project Info - Admin */}
            {isAdminUser && (
                <div
                    className="p-5 rounded-[1rem] shadow-premium border-0"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar size={15} style={{ color: 'var(--color-text-muted)' }} />
                        <h2
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Project Information
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <InfoItem label="Start Date" value={new Date(project.startDate).toLocaleDateString()} />
                        {project.endDate && (
                            <InfoItem label="Internal Deadline" value={new Date(project.endDate).toLocaleDateString()} />
                        )}
                        {project.deadline && (
                            <InfoItem label="Deadline" value={new Date(project.deadline).toLocaleDateString()} />
                        )}
                        <InfoItem label="Billing Type" value={project.billingType} capitalize />
                        {project.budget && (
                            <InfoItem label="Budget" value={`${project.currency} ${project.budget.toLocaleString()}`} />
                        )}
                        {project.hourlyRate && (
                            <InfoItem label="Hourly Rate" value={`${project.currency} ${project.hourlyRate}`} />
                        )}
                        {partnerName && <InfoItem label="Partner" value={partnerName} />}
                    </div>
                </div>
            )}

            {/* Team Members */}
            <div
                className="p-5 rounded-[1rem] shadow-premium border-0"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users size={15} style={{ color: 'var(--color-text-muted)' }} />
                        <h2
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Team Members
                        </h2>
                        <span
                            className="text-[11px] px-1.5 py-0.5 rounded-full"
                            style={{
                                backgroundColor: 'var(--color-bg-subtle)',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {project.assignees.length}
                        </span>
                    </div>
                    {isSuperAdmin && !isAddingMember && (
                        <button
                            onClick={() => setIsAddingMember(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors hover:bg-gray-50 border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            <Plus size={14} /> Add Member
                        </button>
                    )}
                </div>

                {isSuperAdmin && isAddingMember && (
                    <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <select
                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none bg-white"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    disabled={isLoadingEmployees}
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map((emp: any) => {
                                        const empUserId = emp.userId?._id ?? emp.userId;
                                        // Don't show employees already assigned
                                        const isAssigned = project.assignees.some((a: any) =>
                                            (typeof a.employeeId === 'object' ? a.employeeId._id : a.employeeId) === emp._id
                                            || (a.userId && (typeof a.userId === 'object' ? a.userId._id : a.userId) === empUserId) // Fallback for old records
                                        );
                                        if (isAssigned) return null;
                                        return (
                                            <option key={emp._id} value={emp._id}>
                                                {emp.userId?.name ?? '—'} · {emp.designation} ({emp.employeeId})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <select
                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none bg-white"
                                    style={{ borderColor: roleError ? 'var(--color-danger)' : 'var(--color-border-default)', boxShadow: roleError ? '0 0 0 2px rgba(239,68,68,0.15)' : 'none' }}
                                    value={selectedRole}
                                    onChange={(e) => { setSelectedRole(e.target.value); setRoleError(false); }}
                                >
                                    <option value="">Select role…</option>
                                    <option value="manager">Manager</option>
                                    <option value="developer">Developer</option>
                                    <option value="designer">Designer</option>
                                    <option value="qa">QA</option>
                                    <option value="member">Member</option>
                                </select>
                                {roleError && (
                                    <p className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: 'var(--color-danger)' }}>
                                        <AlertTriangle size={10} /> Please select a role
                                    </p>
                                )}
                            </div>
                            <div className="md:col-span-1 flex items-center gap-2">
                                <button
                                    onClick={handleAddMember}
                                    disabled={!selectedUserId || isAdding}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-white disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {isAdding && <Loader2 size={12} className="animate-spin" />}
                                    Add Team Member
                                </button>
                                <button
                                    onClick={() => {
                                        setIsAddingMember(false);
                                        setSelectedUserId('');
                                        setSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false, notes: false });
                                    }}
                                    className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50 bg-white"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                    disabled={isAdding}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>

                        {/* Sub Module Permissions */}
                        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Initial Tab Access</p>
                                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={Object.values(subModules).every(Boolean)}
                                        onChange={(e) => {
                                            const val = e.target.checked;
                                            setSubModules({
                                                overview: val, tasks: val, timeLogs: val, meetings: val, credentials: val, documents: val, notes: val
                                            });
                                        }}
                                        disabled={isAdding}
                                    />
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Select All</span>
                                </label>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.keys(subModules).map((key) => (
                                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={(subModules as any)[key]}
                                            onChange={(e) => setSubModules((prev) => ({ ...prev, [key]: e.target.checked }))}
                                            disabled={isAdding}
                                        />
                                        <span className="capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {project.assignees.map((assignee) => {
                        // Backend populates assignees.employeeId with: { _id, designation, employeeId, userId: { name, email } }
                        const empObj = typeof assignee.employeeId === 'object' && assignee.employeeId !== null
                            ? (assignee.employeeId as any)
                            : null;
                        const userObj = empObj && typeof empObj.userId === 'object' ? empObj.userId : null;
                        const displayName = userObj?.name || 'Unknown';
                        const displayEmail = userObj?.email || '';
                        const displayDesignation = empObj?.designation || '';
                        const displayEmpId = empObj?.employeeId || '';
                        const keyId = empObj?._id || (typeof assignee.employeeId === 'string' ? assignee.employeeId : '');

                        return (
                            <div
                                key={keyId || Math.random()}
                                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg group"
                                style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                            >
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {displayName}{displayDesignation ? ` · ${displayDesignation}` : ''}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {displayEmpId}{displayEmail ? ` · ${displayEmail}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                                        style={{
                                            backgroundColor: 'var(--color-info-soft)',
                                            color: 'var(--color-info)',
                                        }}
                                    >
                                        {assignee.role}
                                    </span>
                                    {isSuperAdmin && (
                                        <>
                                            <button
                                                onClick={() => handleOpenEdit(keyId)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                                                title="Edit Tab Access"
                                            >
                                                <Settings2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(keyId)}
                                                disabled={isRemoving}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-all disabled:opacity-50 cursor-pointer"
                                                title="Revoke access"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {project.assignees.length === 0 && (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                            No team members assigned
                        </p>
                    )}
                </div>
            </div>

            {/* Client Info - Super Admin Only */}
            {isSuperAdmin && typeof project.clientId === 'object' && project.clientId && (
                <Link
                    to={`/crm/clients/${project.clientId._id}`}
                    className="block p-5 rounded-[1rem] shadow-premium border-0 transition-all hover:shadow-md"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Building2 size={15} style={{ color: 'var(--color-text-muted)' }} />
                            <h2
                                className="text-sm font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Attached Client Configuration
                            </h2>
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium">View CRM Record →</span>
                    </div>
                    <div
                        className="px-3.5 py-2.5 rounded-lg"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {project.clientId.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {project.clientId.email}
                        </p>
                        {project.clientId.phone && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {project.clientId.phone}
                            </p>
                        )}
                    </div>
                </Link>
            )}

            {/* Edit Tab Access — Notion-style right side panel */}
            {editingUserId && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[200]"
                        style={{ backgroundColor: 'rgba(0,0,0,0.20)' }}
                        onClick={() => setEditingUserId(null)}
                    />
                    {/* Side panel */}
                    <div
                        className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                        style={{
                            width: 'min(400px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-12px 0 48px rgba(0,0,0,0.14)',
                            animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <X size={16} />
                            </button>
                            <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: 'var(--color-text-muted)' }}>
                                <span className="flex-shrink-0">Team</span>
                                <ChevronRight size={11} className="flex-shrink-0" />
                                <span className="font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                    {(() => {
                                        const a = project.assignees.find((a: any) => {
                                            const empObj = typeof a.employeeId === 'object' ? a.employeeId as any : null;
                                            return empObj?._id === editingUserId;
                                        });
                                        const empObj = a && typeof a.employeeId === 'object' ? a.employeeId as any : null;
                                        return empObj?.userId?.name || 'Member';
                                    })()}
                                </span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Title section */}
                            <div>
                                <h3 className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>Tab Access</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Choose which tabs this member can see inside this project.</p>
                            </div>

                            {/* Select All toggle */}
                            <div
                                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-black/5"
                                style={{ borderColor: 'var(--color-border-default)' }}
                                onClick={() => {
                                    const allOn = Object.values(editSubModules).every(Boolean);
                                    setEditSubModules(Object.keys(editSubModules).reduce((acc: any, k) => { acc[k] = !allOn; return acc; }, {}));
                                }}
                            >
                                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Select All Tabs</span>
                                <div
                                    className="w-10 h-5.5 rounded-full flex items-center transition-all relative"
                                    style={{
                                        backgroundColor: Object.values(editSubModules).every(Boolean) ? 'var(--color-primary)' : 'var(--color-border-default)',
                                        width: '40px', height: '22px',
                                    }}
                                >
                                    <div
                                        className="absolute w-4 h-4 bg-white rounded-full shadow transition-all"
                                        style={{ left: Object.values(editSubModules).every(Boolean) ? '22px' : '2px' }}
                                    />
                                </div>
                            </div>

                            {/* Per-tab cards */}
                            {([
                                { key: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Project summary, team, progress' },
                                { key: 'tasks', label: 'Tasks', icon: ListTodo, desc: 'Create and manage tasks' },
                                { key: 'timeLogs', label: 'Time Logs', icon: Clock, desc: 'View time tracking records' },
                                { key: 'meetings', label: 'Meetings', icon: Video, desc: 'Schedule and manage meetings' },
                                { key: 'credentials', label: 'Credentials', icon: KeyRound, desc: 'Access project credentials' },
                                { key: 'documents', label: 'Documents', icon: FileText, desc: 'View project documents' },
                                { key: 'notes', label: 'Notes', icon: StickyNote, desc: 'View and write project notes' },
                            ] as const).map(({ key, label, icon: Icon, desc }) => {
                                const enabled = (editSubModules as any)[key];
                                return (
                                    <div
                                        key={key}
                                        className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl border cursor-pointer transition-all"
                                        style={{
                                            borderColor: enabled ? 'var(--color-primary)' : 'var(--color-border-default)',
                                            backgroundColor: enabled ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                                        }}
                                        onClick={() => setEditSubModules(prev => ({ ...prev, [key]: !enabled }))}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-bg-surface)' }}
                                        >
                                            <Icon size={15} style={{ color: enabled ? 'white' : 'var(--color-text-muted)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold" style={{ color: enabled ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{label}</p>
                                            <p className="text-[11px]" style={{ color: enabled ? 'var(--color-primary)' : 'var(--color-text-muted)', opacity: enabled ? 0.8 : 1 }}>{desc}</p>
                                        </div>
                                        {/* Toggle */}
                                        <div
                                            className="relative rounded-full transition-all flex-shrink-0"
                                            style={{ width: '36px', height: '20px', backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-border-default)' }}
                                        >
                                            <div
                                                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                                                style={{ left: enabled ? '18px' : '2px' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3.5 border-t flex justify-end gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <button
                                onClick={() => setEditingUserId(null)}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{ height: '34px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                                disabled={isUpdatingPermissions}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePermissions}
                                disabled={isUpdatingPermissions}
                                className="flex items-center justify-center gap-1.5 px-5 text-sm font-medium rounded-lg transition-colors text-white disabled:opacity-50"
                                style={{ height: '34px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isUpdatingPermissions && <Loader2 size={13} className="animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

function InfoItem({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
    return (
        <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <p
                className={`text-sm font-medium ${capitalize ? 'capitalize' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
            >
                {value}
            </p>
        </div>
    );
}

function ProjectProgress({ project, isSuperAdmin }: { project: Project, isSuperAdmin?: boolean }) {
    const phases = project.phases || [];
    const totalPhases = phases.length;
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const progressPercentage = totalPhases === 0 ? 0 : Math.round((completedPhases / totalPhases) * 100);

    const [showPhasePanel, setShowPhasePanel] = useState(false);
    const [localPhases, setLocalPhases] = useState<any[]>([]);
    const [updateProject, { isLoading: isSavingPhases }] = useUpdateProjectMutation();

    useEffect(() => {
        if (showPhasePanel) {
            setLocalPhases((project.phases || []).map((p: any) => ({ ...p })));
        }
    }, [showPhasePanel]);

    const addPhase = () =>
        setLocalPhases(prev => [...prev, { name: '', status: 'pending', endDate: '' }]);

    const updatePhaseField = (idx: number, field: string, value: string) =>
        setLocalPhases(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

    const removePhase = (idx: number) =>
        setLocalPhases(prev => prev.filter((_, i) => i !== idx));

    const savePhases = async () => {
        try {
            const cleaned = localPhases
                .filter(p => p.name.trim())
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .map(({ _id, __v, ...rest }: any) => {
                    const phase = { ...rest };
                    if (!phase.endDate) delete phase.endDate;
                    if (!phase.startDate) delete phase.startDate;
                    return phase;
                });
            await updateProject({ id: String(project._id), data: { phases: cleaned } }).unwrap();
            setShowPhasePanel(false);
        } catch (e) {
            console.error('Failed to save phases:', e);
        }
    };

    const getPhaseIcon = (status: ProjectPhase['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />;
            case 'in-progress':
                return <Clock size={16} style={{ color: 'var(--color-warning)' }} />;
            default:
                return <Circle size={16} style={{ color: 'var(--color-text-muted)' }} />;
        }
    };

    return (
        <div className="p-5 rounded-[1rem] shadow-premium border-0" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Target size={15} style={{ color: 'var(--color-text-muted)' }} />
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Phase Progress</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {progressPercentage}% Completed
                    </div>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowPhasePanel(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50 bg-white"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                        >
                            <Pencil size={12} />
                            Edit Phases
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden mb-6" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--color-primary)' }}
                />
            </div>

            {/* Phases Grid */}
            {totalPhases > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {phases.map((phase, index) => (
                        <div
                            key={(phase as any)._id || index}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                        >
                            {getPhaseIcon(phase.status)}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{phase.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                    <span className="capitalize">{phase.status.replace('-', ' ')}</span>
                                    {phase.endDate && (
                                        <>
                                            <span style={{ color: 'var(--color-border-default)' }}>•</span>
                                            <span>Due {new Date(phase.endDate).toLocaleDateString()}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    className="text-center py-6 px-4 rounded-lg border border-dashed"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No phases defined</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {isSuperAdmin ? 'Click "Edit Phases" to add tracking phases.' : 'No phases have been added yet.'}
                    </p>
                </div>
            )}

            {/* Phase editor side panel */}
            {showPhasePanel && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[200]"
                        style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
                        onClick={() => setShowPhasePanel(false)}
                    />
                    <div
                        className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                        style={{
                            width: 'min(580px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-16px 0 48px rgba(0,0,0,0.13)',
                            animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center gap-2">
                                <Target size={16} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Phases</h2>
                            </div>
                            <button onClick={() => setShowPhasePanel(false)} className="p-1.5 rounded transition-colors hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Hint */}
                        <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Define the milestones or stages of the project. Phases with empty names are ignored on save.
                            </p>
                        </div>

                        {/* Scrollable phase rows */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {localPhases.length === 0 && (
                                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                                    No phases yet — click “Add Phase” below.
                                </p>
                            )}
                            {localPhases.map((phase, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border space-y-3"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>Phase {idx + 1}</span>
                                        <button onClick={() => removePhase(idx)} className="p-1 rounded transition-colors hover:bg-red-500/10" style={{ color: 'var(--color-danger)' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Phase Name *</label>
                                            <input
                                                value={phase.name}
                                                onChange={e => updatePhaseField(idx, 'name', e.target.value)}
                                                placeholder="e.g. Design, Development, Testing…"
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                            <select
                                                value={phase.status}
                                                onChange={e => updatePhaseField(idx, 'status', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Due Date</label>
                                            <input
                                                type="date"
                                                value={phase.endDate ? new Date(phase.endDate).toISOString().split('T')[0] : ''}
                                                onChange={e => updatePhaseField(idx, 'endDate', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3.5 border-t shrink-0 flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <button
                                onClick={addPhase}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                <Plus size={13} /> Add Phase
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPhasePanel(false)}
                                    disabled={isSavingPhases}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={savePhases}
                                    disabled={isSavingPhases}
                                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {isSavingPhases ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                    {isSavingPhases ? 'Saving…' : 'Save Phases'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
