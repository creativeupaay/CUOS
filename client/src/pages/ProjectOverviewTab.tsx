import { useOutletContext, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import type { Project, ProjectPhase } from '@/features/project';
import { useAddAssigneeMutation, useRemoveAssigneeMutation, useUpdateAssigneePermissionsMutation, useLazyGetAssigneePermissionsQuery, useUpdateProjectMutation, useMarkPhasePaymentReceivedMutation } from '@/features/project';
import { useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { Calendar, Users, Building2, Pencil, CheckCircle2, Circle, Clock, Target, Plus, Trash2, Loader2, Settings2, X, LayoutDashboard, ListTodo, Video, KeyRound, FileText, StickyNote, ChevronRight, AlertTriangle, Handshake, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import { useGetPartnerEmployeesQuery } from '@/features/partners/partnerEmployeeApi';
import PhasePaymentDialog from '@/components/PhasePaymentDialog';

function getAssigneeMeta(assignee: any) {
    const employee = assignee?.employeeId && typeof assignee.employeeId === 'object' ? assignee.employeeId : null;
    const partnerEmployee = assignee?.partnerEmployeeId && typeof assignee.partnerEmployeeId === 'object' ? assignee.partnerEmployeeId : null;
    const partner = assignee?.partnerId && typeof assignee.partnerId === 'object' ? assignee.partnerId : null;
    const employeeUser = employee?.userId && typeof employee.userId === 'object' ? employee.userId : null;
    const plainUser = assignee?.userId && typeof assignee.userId === 'object' ? assignee.userId : null;

    const sourceType = assignee?.sourceType
        || (assignee?.memberType === 'partner' || assignee?.memberType === 'partner-employee' || partnerEmployee || partner ? 'partner' : 'cu');
    const memberId = assignee?.memberId
        || partner?._id
        || partnerEmployee?._id
        || employee?._id
        || plainUser?._id
        || (typeof assignee?.partnerId === 'string' ? assignee.partnerId : typeof assignee?.partnerEmployeeId === 'string' ? assignee.partnerEmployeeId : assignee?.employeeId || assignee?.userId);
    const displayName = assignee?.displayName
        || (partner?.userId && typeof partner.userId === 'object' ? partner.userId.name : null)
        || partner?.contactPerson
        || partner?.companyName
        || partnerEmployee?.name
        || employeeUser?.name
        || plainUser?.name
        || 'Team Member';
    const displayEmail = assignee?.displayEmail
        || (partner?.userId && typeof partner.userId === 'object' ? partner.userId.email : null)
        || partner?.email
        || partnerEmployee?.email
        || employeeUser?.email
        || plainUser?.email
        || '';
    const displayDesignation = assignee?.displayDesignation
        || (assignee?.memberType === 'partner' || partner ? 'Partner Admin' : '')
        || partnerEmployee?.designation
        || employee?.designation
        || '';
    const displayCode = assignee?.displayCode || (sourceType === 'partner' ? 'Partner' : 'CU');

    return {
        memberId: String(memberId || ''),
        sourceType,
        displayName,
        displayEmail,
        displayDesignation,
        displayCode,
        protectedFromRemoval: Boolean(assignee?.protectedFromRemoval),
    };
}

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
    const isPartnerUser = roleName === 'partner';
    const currentPartnerId = typeof currentUser?.partnerId === 'object' ? (currentUser.partnerId as any)?._id : currentUser?.partnerId;
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const projectPartnerId = typeof project.partnerId === 'object' ? (project.partnerId as any)?._id : project.partnerId;
    const partnerName = projectPartnerId
        ? (() => {
            const partner = partnersData?.data?.partners?.find((p: any) => p._id === projectPartnerId);
            return partner?.userId?.name || partner?.contactPerson || partner?.companyName;
        })()
        : undefined;
    const isPartnerOwnedProject = Boolean(isPartnerUser && currentPartnerId && projectPartnerId && String(currentPartnerId) === String(projectPartnerId));
    const canManageTeam = isSuperAdmin || isPartnerOwnedProject;

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
            console.error('Failed to add assignee:', error);
        }
    };

    const handleRemoveMember = async (employeeId: string) => {
        if (window.confirm('Are you sure you want to remove this member from the project?')) {
            try {
                await removeAssignee({ projectId: project._id, memberId: employeeId }).unwrap();
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
            const res = await fetchAssigneePermissions({ projectId: project._id, memberId: employeeId }).unwrap();
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
                memberId: editingUserId,
                data: { subModules: editSubModules }
            }).unwrap();
            setEditingUserId(null);
        } catch (error) {
            console.error('Failed to update permissions:', error);
        }
    };

    const availableMembers = isPartnerOwnedProject ? partnerEmployees : employees;

    return (
        <div className="space-y-5">
            {/* Project Progress */}
            <ProjectProgress project={project} isSuperAdmin={isSuperAdmin} canViewPaymentDetails={isAdminUser} />

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
                        {(project as any).overdueDate && (
                            <InfoItem label="Overdue Date" value={new Date((project as any).overdueDate).toLocaleDateString()} />
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
                    {canManageTeam && !isAddingMember && (
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
                    )}
                </div>

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
                    {project.assignees.map((assignee) => {
                        const meta = getAssigneeMeta(assignee);
                        const canEditPermissions = isSuperAdmin && meta.sourceType === 'cu' && !!meta.memberId;
                        const canRemoveMember = (isSuperAdmin || (isPartnerOwnedProject && meta.sourceType === 'partner')) && !meta.protectedFromRemoval;
                        const sourceBadgeLabel = meta.sourceType === 'partner' ? 'Partner' : 'CU';
                        const sourceBadgeTitle = meta.sourceType === 'partner'
                            ? 'Partner team member'
                            : 'Creative Upaay team member';

                        return (
                            <div
                                key={meta.memberId || Math.random()}
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
                                    {canRemoveMember && (
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

function ProjectProgress({ project, isSuperAdmin, canViewPaymentDetails }: { project: Project, isSuperAdmin?: boolean, canViewPaymentDetails?: boolean }) {
    const phases = project.phases || [];
    const totalPhases = phases.length;
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const progressPercentage = totalPhases === 0 ? 0 : Math.round((completedPhases / totalPhases) * 100);
    const showPaymentDetails = Boolean(canViewPaymentDetails);

    const [showPhasePanel, setShowPhasePanel] = useState(false);
    const [localPhases, setLocalPhases] = useState<any[]>([]);
    const [expandedPaymentSections, setExpandedPaymentSections] = useState<Record<number, boolean>>({});
    const [paymentDialogPhase, setPaymentDialogPhase] = useState<(ProjectPhase & { _id: string }) | null>(null);
    const [updateProject, { isLoading: isSavingPhases }] = useUpdateProjectMutation();
    const [markPhasePaymentReceived] = useMarkPhasePaymentReceivedMutation();
    const localPhaseRowRefs = useRef<Array<HTMLDivElement | null>>([]);
    const newlyAddedLocalPhaseIndexRef = useRef<number | null>(null);

    const totalPaymentAllocation = useMemo(
        () => localPhases.reduce((sum, phase) => sum + (phase.hasPayment ? Number(phase.paymentPercentage || 0) : 0), 0),
        [localPhases]
    );
    const paymentAllocationError = totalPaymentAllocation > 100
        ? 'Total payment allocation cannot be more than 100% across all phases.'
        : '';

    const getMaxAllowedPaymentPercentage = (index: number) => {
        const otherAllocated = localPhases.reduce((sum, phase, phaseIndex) => {
            if (phaseIndex === index || !phase.hasPayment) return sum;
            return sum + Number(phase.paymentPercentage || 0);
        }, 0);

        return Math.max(0, 100 - otherAllocated);
    };

    useBodyScrollLock(showPhasePanel);

    useEffect(() => {
        if (showPhasePanel) {
            setLocalPhases((project.phases || []).map((p: any) => ({ ...p })));
        }
    }, [showPhasePanel]);

    const addPhase = () =>
        setLocalPhases(prev => {
            const nextIndex = prev.length;
            newlyAddedLocalPhaseIndexRef.current = nextIndex;
            return [...prev, {
                name: '',
                status: 'pending',
                endDate: '',
                hasPayment: false,
                paymentAmount: 0,
                paymentPercentage: 0,
                paymentCurrency: project.currency || 'INR',
                gstApplicable: true,
                gstRate: 18,
                tdsDeducted: 0,
            }];
        });

    useEffect(() => {
        const index = newlyAddedLocalPhaseIndexRef.current;
        if (index === null || !showPhasePanel) return;

        const id = window.setTimeout(() => {
            const row = localPhaseRowRefs.current[index];
            if (!row) return;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstInput = row.querySelector('input');
            if (firstInput instanceof HTMLInputElement) {
                firstInput.focus();
            }
        }, 90);

        newlyAddedLocalPhaseIndexRef.current = null;
        return () => window.clearTimeout(id);
    }, [localPhases.length, showPhasePanel]);

    const updatePhaseField = (idx: number, field: string, value: any) =>
        setLocalPhases(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

    const removePhase = (idx: number) =>
        setLocalPhases(prev => prev.filter((_, i) => i !== idx));

    const savePhases = async () => {
        try {
            if (totalPaymentAllocation > 100) {
                return;
            }

            const cleaned = localPhases
                .filter(p => p.name.trim())
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .map(({ _id, __v, revenueId, bankTransactionId, completedAt, paymentReceivedAmount, paymentStatus, ...rest }: any) => {
                    const phase = { ...rest };
                    // Clean up empty dates
                    if (!phase.endDate) delete phase.endDate;
                    if (!phase.startDate) delete phase.startDate;
                    if (!phase.paymentDueDate) delete phase.paymentDueDate;

                    // Clean up payment fields if hasPayment is false
                    if (!phase.hasPayment) {
                        delete phase.paymentAmount;
                        delete phase.paymentPercentage;
                        delete phase.paymentCurrency;
                        delete phase.paymentDueDate;
                        delete phase.paymentBankAccount;
                        delete phase.gstApplicable;
                        delete phase.gstRate;
                        delete phase.tdsDeducted;
                    } else {
                        // Ensure numeric values are proper numbers or undefined
                        if (!phase.paymentAmount || phase.paymentAmount === 0) delete phase.paymentAmount;
                        if (!phase.paymentPercentage || phase.paymentPercentage === 0) delete phase.paymentPercentage;
                        if (!phase.tdsDeducted || phase.tdsDeducted === 0) delete phase.tdsDeducted;
                    }

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

    const handleMarkPaymentReceived = async (data: {
        phaseId: string;
        receivedAmount: number;
        bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
        receivedDate: string;
        notes?: string;
    }) => {
        try {
            // Mark payment as received
            await markPhasePaymentReceived({
                projectId: String(project._id),
                ...data,
            }).unwrap();

            // Close the payment dialog
            setPaymentDialogPhase(null);
        } catch (error) {
            console.error('Failed to mark payment received or complete phase:', error);
        }
    };

    const handleTogglePhaseCompletion = async (phaseIndex: number, currentStatus: ProjectPhase['status']) => {
        const currentPhase = project.phases?.[phaseIndex];
        const paymentAlreadyReceived =
            currentPhase?.paymentStatus === 'received'
            || Number(currentPhase?.paymentReceivedAmount || 0) > 0
            || Boolean((currentPhase as any)?.revenueId)
            || Boolean((currentPhase as any)?.bankTransactionId);

        // If marking as completed and phase has payment tracking, ask about payment
        if (currentStatus !== 'completed' && currentPhase?.hasPayment && !paymentAlreadyReceived) {
            const confirmed = confirm(
                `Phase "${currentPhase.name}" is being marked as completed.\n\n` +
                `Has the payment for this phase been received?\n\n` +
                `• Click OK if payment is received (you'll enter payment details next)\n` +
                `• Click Cancel to complete phase without marking payment as received`
            );

            if (confirmed) {
                // Show payment dialog first, then complete the phase
                setPaymentDialogPhase({ ...currentPhase, _id: currentPhase._id || `temp-${phaseIndex}` });
                return;
            }
        }

        try {
            const updatedPhases = (project.phases || []).map((p: any, i: number) => {
                if (i === phaseIndex) {
                    // Toggle between completed and in-progress
                    return {
                        ...p,
                        status: currentStatus === 'completed' ? 'in-progress' : 'completed',
                        completedAt: currentStatus === 'completed' ? undefined : new Date().toISOString(),
                    };
                }
                // If marking current phase as complete, auto-start next phase
                if (currentStatus !== 'completed' && i === phaseIndex + 1 && p.status === 'pending') {
                    return { ...p, status: 'in-progress' as const };
                }
                return p;
            });

            // Clean phases before sending (remove backend-only fields)
            const cleanedPhases = updatedPhases.map(({ _id, __v, revenueId, bankTransactionId, ...rest }: any) => rest);

            await updateProject({ id: String(project._id), data: { phases: cleanedPhases } }).unwrap();
        } catch (error) {
            console.error('Failed to update phase status:', error);
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
                    {phases.map((phase, index) => {
                        const hasPayment = phase.hasPayment;
                        const paymentStatus = phase.paymentStatus;
                        const isPaymentReceived =
                            paymentStatus === 'received'
                            || Number((phase as any).paymentReceivedAmount || 0) > 0;

                        return (
                            <div
                                key={(phase as any)._id || index}
                                className="flex items-start gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                {/* Completion Checkbox/Ticker */}
                                {isSuperAdmin ? (
                                    <button
                                        onClick={() => handleTogglePhaseCompletion(index, phase.status)}
                                        className="flex-shrink-0 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                                        style={{ outline: 'none' }}
                                        title={phase.status === 'completed' ? 'Mark as in-progress' : 'Mark as completed'}
                                    >
                                        {getPhaseIcon(phase.status)}
                                    </button>
                                ) : (
                                    <div className="flex-shrink-0">
                                        {getPhaseIcon(phase.status)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{phase.name}</p>
                                        {showPaymentDetails && hasPayment && (
                                            <DollarSign size={12} style={{ color: isPaymentReceived ? 'var(--color-success)' : 'var(--color-warning)' }} />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="capitalize">{phase.status.replace('-', ' ')}</span>
                                        {phase.endDate && (
                                            <>
                                                <span style={{ color: 'var(--color-border-default)' }}>•</span>
                                                <span>Due {new Date(phase.endDate).toLocaleDateString()}</span>
                                            </>
                                        )}
                                    </div>
                                    {showPaymentDetails && hasPayment && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: isPaymentReceived
                                                        ? 'var(--color-success-bg)'
                                                        : paymentStatus === 'partial'
                                                        ? 'var(--color-warning-bg)'
                                                        : 'var(--color-bg-subtle)',
                                                    color: isPaymentReceived
                                                        ? 'var(--color-success)'
                                                        : paymentStatus === 'partial'
                                                        ? 'var(--color-warning)'
                                                        : 'var(--color-text-muted)',
                                                }}
                                            >
                                                Payment: {isPaymentReceived ? 'received' : (paymentStatus || 'pending')}
                                            </span>
                                            {phase.status === 'completed' && !isPaymentReceived && isSuperAdmin && (phase as any)._id && (
                                                <button
                                                    onClick={() => setPaymentDialogPhase({ ...phase, _id: (phase as any)._id })}
                                                    className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded transition-colors"
                                                    style={{
                                                        backgroundColor: 'var(--color-success-bg)',
                                                        color: 'var(--color-success)',
                                                    }}
                                                >
                                                    Mark Received
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
                            {paymentAllocationError && (
                                <p className="mt-2 text-xs font-semibold" style={{ color: '#B91C1C' }}>
                                    {paymentAllocationError}
                                </p>
                            )}
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
                                    ref={(el) => {
                                        localPhaseRowRefs.current[idx] = el;
                                    }}
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

                                    {/* Payment Tracking Section */}
                                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedPaymentSections(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                            className="flex items-center justify-between w-full text-xs font-medium py-2"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <DollarSign size={14} />
                                                <span>Payment Tracking</span>
                                                {phase.hasPayment && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                                        Enabled
                                                    </span>
                                                )}
                                            </div>
                                            {expandedPaymentSections[idx] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>

                                        {expandedPaymentSections[idx] && (
                                            <div className="space-y-3 mt-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                {/* Has Payment Toggle */}
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={phase.hasPayment || false}
                                                        onChange={e => updatePhaseField(idx, 'hasPayment', e.target.checked)}
                                                        className="w-4 h-4 rounded border-gray-300"
                                                    />
                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                        This phase has a payment
                                                    </span>
                                                </label>

                                                {phase.hasPayment && (
                                                    <>
                                                        {/* Payment Amount & Percentage */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fixed Amount</label>
                                                                <input
                                                                    type="number"
                                                                    value={phase.paymentAmount || ''}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value);
                                                                        updatePhaseField(idx, 'paymentAmount', val > 0 ? val : 0);
                                                                    }}
                                                                    placeholder="0"
                                                                    min="0"
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>% of Budget</label>
                                                                <input
                                                                    type="number"
                                                                    value={phase.paymentPercentage || ''}
                                                                    onChange={e => {
                                                                        let val = parseFloat(e.target.value);
                                                                        if (isNaN(val) || val < 0) val = 0;
                                                                        const maxAllowed = getMaxAllowedPaymentPercentage(idx);
                                                                        if (val > maxAllowed) val = maxAllowed;
                                                                        updatePhaseField(idx, 'paymentPercentage', val);
                                                                        // Auto-populate fixed amount from percentage
                                                                        if (project.budget && project.budget > 0 && val > 0) {
                                                                            const calculatedAmount = (project.budget * val) / 100;
                                                                            updatePhaseField(idx, 'paymentAmount', calculatedAmount);
                                                                        } else if (val === 0) {
                                                                            // Clear fixed amount if percentage is 0
                                                                            updatePhaseField(idx, 'paymentAmount', 0);
                                                                        }
                                                                    }}
                                                                    placeholder="0"
                                                                    max={getMaxAllowedPaymentPercentage(idx)}
                                                                    min="0"
                                                                    step="0.1"
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                />
                                                                {/* Show calculated amount or budget warning */}
                                                                {phase.paymentPercentage > 0 && (
                                                                    <div className="mt-1">
                                                                        {project.budget && project.budget > 0 ? (
                                                                            <p className="text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>
                                                                                ≈ {phase.paymentCurrency || project.currency || 'INR'} {((project.budget * phase.paymentPercentage) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
                                                                                <AlertTriangle size={10} />
                                                                                Set project budget first
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Currency & Payment Due Date */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Currency</label>
                                                                <select
                                                                    value={phase.paymentCurrency || project.currency || 'INR'}
                                                                    onChange={e => updatePhaseField(idx, 'paymentCurrency', e.target.value)}
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                >
                                                                    <option value="INR">INR</option>
                                                                    <option value="USD">USD</option>
                                                                    <option value="EUR">EUR</option>
                                                                    <option value="GBP">GBP</option>
                                                                    <option value="AED">AED</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Payment Due</label>
                                                                <input
                                                                    type="date"
                                                                    value={phase.paymentDueDate ? new Date(phase.paymentDueDate).toISOString().split('T')[0] : ''}
                                                                    onChange={e => updatePhaseField(idx, 'paymentDueDate', e.target.value)}
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* GST & TDS */}
                                                        <div className="space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={phase.gstApplicable !== false}
                                                                    onChange={e => updatePhaseField(idx, 'gstApplicable', e.target.checked)}
                                                                    className="w-4 h-4 rounded border-gray-300"
                                                                />
                                                                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    GST Applicable
                                                                </span>
                                                            </label>

                                                            {phase.gstApplicable !== false && (
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>GST Rate (%)</label>
                                                                        <select
                                                                            value={phase.gstRate || 18}
                                                                            onChange={e => updatePhaseField(idx, 'gstRate', parseInt(e.target.value))}
                                                                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                        >
                                                                            <option value="0">0%</option>
                                                                            <option value="5">5%</option>
                                                                            <option value="12">12%</option>
                                                                            <option value="18">18%</option>
                                                                            <option value="28">28%</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>TDS Deducted</label>
                                                                        <input
                                                                            type="number"
                                                                            value={phase.tdsDeducted || ''}
                                                                            onChange={e => updatePhaseField(idx, 'tdsDeducted', parseFloat(e.target.value) || 0)}
                                                                            placeholder="0"
                                                                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Mark Payment Received Button */}
                                                        {phase._id && phase.paymentStatus !== 'received' && Number(phase.paymentReceivedAmount || 0) <= 0 && (
                                                            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPaymentDialogPhase({ ...phase, _id: phase._id || `temp-${idx}` });
                                                                    }}
                                                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-green-50"
                                                                    style={{
                                                                        borderColor: 'var(--color-success)',
                                                                        color: 'var(--color-success)',
                                                                        backgroundColor: 'var(--color-success-bg)'
                                                                    }}
                                                                >
                                                                    <DollarSign size={12} />
                                                                    Mark Payment Received
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
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
                                    disabled={isSavingPhases || totalPaymentAllocation > 100}
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

            {/* Phase Payment Dialog */}
            {showPaymentDetails && paymentDialogPhase && (
                <PhasePaymentDialog
                    phase={paymentDialogPhase}
                    projectCurrency={project.currency}
                    projectBudget={project.budget}
                    defaultBankAccount={project.defaultBankAccount}
                    onClose={() => setPaymentDialogPhase(null)}
                    onConfirm={handleMarkPaymentReceived}
                />
            )}
        </div>
    );
}
