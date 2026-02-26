import { useOutletContext, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import type { Project, ProjectPhase } from '@/features/project';
import { useAddAssigneeMutation, useRemoveAssigneeMutation, useUpdateAssigneePermissionsMutation, useLazyGetAssigneePermissionsQuery } from '@/features/project';
import { useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { Calendar, Users, Building2, Pencil, CheckCircle2, Circle, Clock, Target, Plus, Trash2, Loader2, Settings2, X } from 'lucide-react';
import { useState } from 'react';

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

    const [isAddingMember, setIsAddingMember] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRole, setSelectedRole] = useState('member');
    const [subModules, setSubModules] = useState({
        overview: true, // give overview by default
        tasks: false,
        timeLogs: false,
        meetings: false,
        credentials: false,
        documents: false,
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
        try {
            await addAssignee({
                projectId: project._id,
                data: { employeeId: selectedUserId, role: selectedRole as any, subModules }
            }).unwrap();
            setIsAddingMember(false);
            setSelectedUserId('');
            setSelectedRole('member');
            setSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false });
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

        // Fetch current custom permissions from the backend instead of using defaults
        try {
            const res = await fetchAssigneePermissions({ projectId: project._id, employeeId }).unwrap();
            if (res.data) {
                setEditSubModules(res.data);
            } else {
                setEditSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false });
            }
        } catch (error) {
            console.error("Failed to fetch assignee permissions", error);
            setEditSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false });
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
            {/* Quick Actions - Super Admin Only */}
            {isSuperAdmin && (
                <div className="flex justify-end">
                    <Link
                        to={`/projects/${project._id}/edit`}
                        className="flex items-center gap-1.5 px-3.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
                        style={{
                            height: '32px',
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        <Pencil size={13} />
                        Edit Project
                    </Link>
                </div>
            )}

            {/* Project Progress */}
            <ProjectProgress project={project} />

            {/* Project Info - Super Admin Only */}
            {isSuperAdmin && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
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
                            <InfoItem label="End Date" value={new Date(project.endDate).toLocaleDateString()} />
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
                    </div>
                </div>
            )}

            {/* Team Members */}
            <div
                className="p-5 rounded-lg border"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
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
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                >
                                    <option value="manager">Manager</option>
                                    <option value="developer">Developer</option>
                                    <option value="designer">Designer</option>
                                    <option value="qa">QA</option>
                                    <option value="member">Member</option>
                                </select>
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
                                        setSubModules({ overview: true, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false });
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
                            <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>Initial Tab Access</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

                {/* Edit Permissions Modal Overlay */}
                {editingUserId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div
                            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
                            style={{ backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Edit Sub-Permissions
                                </h3>
                                <button
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-4">
                                <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                                    Select which tabs this team member can access in this project.
                                </p>
                                <div className="space-y-3">
                                    {Object.keys(editSubModules).map((key) => (
                                        <label key={key} className="flex items-center gap-3 text-sm cursor-pointer select-none p-2 rounded-md hover:bg-gray-50 transition-colors border" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={(editSubModules as any)[key]}
                                                onChange={(e) => setEditSubModules((prev) => ({ ...prev, [key]: e.target.checked }))}
                                                disabled={isUpdatingPermissions}
                                            />
                                            <span className="capitalize font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button
                                    onClick={() => setEditingUserId(null)}
                                    className="px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50 bg-white"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                    disabled={isUpdatingPermissions}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSavePermissions}
                                    disabled={isUpdatingPermissions}
                                    className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors text-white disabled:opacity-50 min-w-[100px]"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {isUpdatingPermissions && <Loader2 size={12} className="animate-spin" />}
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Client Info - Super Admin Only */}
            {isSuperAdmin && typeof project.clientId === 'object' && project.clientId && (
                <Link
                    to={`/crm/clients/${project.clientId._id}`}
                    className="block p-5 rounded-lg border transition-all hover:shadow-sm"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
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

function ProjectProgress({ project }: { project: Project }) {
    const phases = project.phases || [];
    const totalPhases = phases.length;
    const completedPhases = phases.filter(p => p.status === 'completed').length;

    // If no phases exist, we show 0% explicitly or a prompt.
    const progressPercentage = totalPhases === 0 ? 0 : Math.round((completedPhases / totalPhases) * 100);

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
        <div
            className="p-5 rounded-lg border"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Target size={15} style={{ color: 'var(--color-text-muted)' }} />
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Phase Progress
                    </h2>
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {progressPercentage}% Completed
                </div>
            </div>

            {/* Progress Bar Track */}
            <div
                className="w-full h-2 rounded-full overflow-hidden mb-6"
                style={{ backgroundColor: 'var(--color-bg-subtle)' }}
            >
                <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                        width: `${progressPercentage}%`,
                        backgroundColor: 'var(--color-primary)'
                    }}
                />
            </div>

            {/* Phases Breakdown */}
            {totalPhases > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {phases.map((phase, index) => (
                        <div
                            key={phase._id || index}
                            className="flex items-center gap-3 p-3 rounded-lg border"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)'
                            }}
                        >
                            {getPhaseIcon(phase.status)}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                    {phase.name}
                                </p>
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
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-subtle)'
                    }}
                >
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        No phases defined
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Edit the project to add tracking phases to visualize progress.
                    </p>
                </div>
            )}
        </div>
    );
}
