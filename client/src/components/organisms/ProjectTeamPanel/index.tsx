import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, AlertTriangle, Loader2, Settings2, Trash2, X, ChevronRight, LayoutDashboard, ListTodo, Clock, Video, KeyRound, FileText, StickyNote, Handshake } from 'lucide-react';
import { ProjectTabHeader } from '@/components/organisms/ProjectTabHeader';
import { useAddAssigneeMutation, useRemoveAssigneeMutation, useUpdateAssigneePermissionsMutation, useLazyGetAssigneePermissionsQuery } from '@/features/project';
import { useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { useGetPartnerEmployeesQuery } from '@/features/partners/partnerEmployeeApi';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { logger } from '@/utils/logger';
import { getAssigneeMeta } from '@/lib/utils/project';
import type { Project } from '@/features/project';

export interface ProjectTeamPanelProps {
    project: Project;
    isSuperAdmin: boolean;
    canManageTeam: boolean;
    isPartnerOwnedProject: boolean;
}

export function ProjectTeamPanel({
    project,
    isSuperAdmin,
    canManageTeam,
    isPartnerOwnedProject,
}: ProjectTeamPanelProps) {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedMemberType, setSelectedMemberType] = useState<'employee' | 'partner-employee'>('employee');
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

    useBodyScrollLock(Boolean(editingUserId));

    // Load all active employees — the employee list is the team pool for project assignment
    const { data: employeesData, isLoading: isLoadingEmployees } = useGetEmployeesQuery({ status: 'active', limit: 200 }, { skip: !isSuperAdmin });
    const employees = (employeesData?.data as any)?.employees ?? [];
    const { data: partnerEmployeesResponse, isLoading: isLoadingPartnerEmployees } = useGetPartnerEmployeesQuery(
        { isActive: true, limit: 200 },
        { skip: !isPartnerOwnedProject }
    );
    const partnerEmployees = partnerEmployeesResponse?.data?.employees || [];
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
                data: {
                    memberId: selectedUserId,
                    memberType: selectedMemberType,
                    role: selectedRole as any,
                    subModules,
                }
            }).unwrap();
            setIsAddingMember(false);
            setSelectedUserId('');
            setSelectedMemberType(isPartnerOwnedProject ? 'partner-employee' : 'employee');
            setSelectedRole('');
            setRoleError(false);
            setSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false, notes: false });
        } catch (error) {
            logger.error('Failed to add assignee:', error);
        }
    };

    const handleRemoveMember = async (employeeId: string) => {
        if (!employeeId) {
            logger.error('Cannot remove assignee: memberId is empty or undefined');
            return;
        }
        if (window.confirm('Are you sure you want to remove this member from the project?')) {
            try {
                await removeAssignee({ projectId: project._id, memberId: employeeId }).unwrap();
            } catch (error) {
                logger.error('Failed to remove assignee:', error);
            }
        }
    };

    const handleOpenEdit = async (employeeId: string) => {
        setEditingUserId(employeeId);

        // Full defaults — ensures any new fields (like `notes`) missing from old DB records are present
        const fullDefaults = { overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false, notes: false };

        // Fetch current custom permissions from the backend instead of using defaults
        try {
            const res = await fetchAssigneePermissions({ projectId: project._id, memberId: employeeId }).unwrap();
            // Merge: defaults first so old records without `notes` still have it, backend values win
            setEditSubModules({ ...fullDefaults, ...(res.data ?? {}) });
        } catch (error) {
            logger.error("Failed to fetch assignee permissions", error);
            setEditSubModules(fullDefaults);
        }
    };

    const handleSavePermissions = async () => {
        if (!editingUserId) return;
        try {
            await updatePermissions({
                projectId: project._id,
                memberId: editingUserId,
                data: { subModules: editSubModules }
            }).unwrap();
            setEditingUserId(null);
        } catch (error) {
            logger.error('Failed to update permissions:', error);
        }
    };

    const availableMembers = isPartnerOwnedProject ? partnerEmployees : employees;

    return (
        <div
            className="p-5 rounded-[1rem] shadow-premium border-0"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
            }}
        >
            <ProjectTabHeader
                title="Team Members"
                icon={Users}
                badgeCount={project.assignees.length}
                rightElement={
                    canManageTeam && !isAddingMember && (
                        <button
                            onClick={() => {
                                setSelectedMemberType(isPartnerOwnedProject ? 'partner-employee' : 'employee');
                                setIsAddingMember(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors hover:bg-gray-50 border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            <Plus size={14} /> Add Member
                        </button>
                    )
                }
            />

            {canManageTeam && isAddingMember && (
                <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-1">
                            <select
                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none bg-white"
                                style={{ borderColor: 'var(--color-border-default)' }}
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                disabled={isLoadingEmployees || isLoadingPartnerEmployees}
                            >
                                <option value="">{isPartnerOwnedProject ? 'Select Partner Team Member...' : 'Select Employee...'}</option>
                                {availableMembers.map((member: any) => {
                                    const memberMeta = isPartnerOwnedProject
                                        ? { id: member._id, label: `${member.name} · ${member.designation || 'Team Member'}` }
                                        : { id: member._id, label: `${member.userId?.name ?? '—'} · ${member.designation} (${member.employeeId})` };
                                    const isAssigned = project.assignees.some((a: any) => getAssigneeMeta(a).memberId === memberMeta.id);
                                    if (isAssigned) return null;
                                    return (
                                        <option key={memberMeta.id} value={memberMeta.id}>
                                            {memberMeta.label}
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
                                <option value="admin">Admin</option>
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
                                    setSelectedMemberType(isPartnerOwnedProject ? 'partner-employee' : 'employee');
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

                    {selectedMemberType === 'employee' && (
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
                    )}
                </div>
            )}

            <div className="space-y-2">
                {project.assignees.map((assignee, index) => {
                    const meta = getAssigneeMeta(assignee);
                    const canEditPermissions = isSuperAdmin && meta.sourceType === 'cu' && !!meta.memberId;
                    const canRemoveMember = (isSuperAdmin || (isPartnerOwnedProject && meta.sourceType === 'partner')) && !meta.protectedFromRemoval;
                    const sourceBadgeLabel = meta.sourceType === 'partner' ? 'Partner' : 'CU';
                    const sourceBadgeTitle = meta.sourceType === 'partner'
                        ? 'Partner team member'
                        : 'Creative Upaay team member';

                    return (
                        <div
                            key={meta.memberId || index}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-lg group"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {meta.displayName}{meta.displayDesignation ? ` · ${meta.displayDesignation}` : ''}
                                    </p>
                                    <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                        title={sourceBadgeTitle}
                                        style={{
                                            backgroundColor: meta.sourceType === 'partner' ? '#FEF3C7' : '#DBEAFE',
                                            color: meta.sourceType === 'partner' ? '#92400E' : '#1D4ED8',
                                        }}
                                    >
                                        {meta.sourceType === 'partner' ? <Handshake size={10} /> : null}
                                        {sourceBadgeLabel}
                                    </span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {meta.displayEmail || ''}
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
                                {canEditPermissions && (
                                    <>
                                        <button
                                            onClick={() => handleOpenEdit(meta.memberId)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                                            title="Edit Tab Access"
                                        >
                                            <Settings2 size={14} />
                                        </button>
                                    </>
                                )}
                                {canRemoveMember && !!meta.memberId && (
                                    <>
                                        <button
                                            onClick={() => handleRemoveMember(meta.memberId)}
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
                                        const assignee = project.assignees.find((item: any) => getAssigneeMeta(item).memberId === editingUserId);
                                        return assignee ? getAssigneeMeta(assignee).displayName : 'Member';
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
                                { key: 'documents', label: 'Documents', desc: 'View project documents', icon: FileText },
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
