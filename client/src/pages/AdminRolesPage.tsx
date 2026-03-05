import { useState } from 'react';
import {
    Shield,
    Plus,
    X,
    Trash2,
    Copy,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import {
    useGetAdminRolesQuery,
    useCreateAdminRoleMutation,
    useUpdateAdminRoleMutation,
    useDeleteAdminRoleMutation,
    useCloneAdminRoleMutation,
    useGetAdminPermissionsQuery,
} from '@/features/overall-admin/api/adminApi';

interface RoleFormData {
    name: string;
    description: string;
    level: number;
    permissions: string[];
}

const initialFormData: RoleFormData = {
    name: '',
    description: '',
    level: 5,
    permissions: [],
};

export default function AdminRolesPage() {
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [formData, setFormData] = useState<RoleFormData>(initialFormData);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [cloneName, setCloneName] = useState('');
    const [cloningRoleId, setCloningRoleId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const { data: rolesData, isLoading } = useGetAdminRolesQuery();
    const { data: permsData } = useGetAdminPermissionsQuery();
    const [createRole] = useCreateAdminRoleMutation();
    const [updateRole] = useUpdateAdminRoleMutation();
    const [deleteRole] = useDeleteAdminRoleMutation();
    const [cloneRole] = useCloneAdminRoleMutation();

    const roles = rolesData?.data || [];
    const groupedPermissions = permsData?.data?.grouped || {};

    const openCreateModal = () => {
        setEditingRole(null);
        setFormData(initialFormData);
        setError('');
        setShowModal(true);
    };

    const openEditModal = (role: any) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            description: role.description,
            level: role.level,
            permissions: role.permissions.map((p: any) =>
                typeof p === 'object' ? p._id : p
            ),
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (editingRole) {
                await updateRole({ id: editingRole._id, data: formData }).unwrap();
            } else {
                await createRole(formData).unwrap();
            }
            setShowModal(false);
        } catch (err: any) {
            setError(err?.data?.message || 'Operation failed');
        }
    };

    const handleDelete = async (roleId: string, roleName: string) => {
        if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
        try {
            await deleteRole(roleId).unwrap();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to delete role');
        }
    };

    const handleClone = async () => {
        if (!cloningRoleId || !cloneName.trim()) return;
        try {
            await cloneRole({ id: cloningRoleId, name: cloneName.trim() }).unwrap();
            setCloningRoleId(null);
            setCloneName('');
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to clone role');
        }
    };

    const togglePermission = (permId: string) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(permId)
                ? prev.permissions.filter((id) => id !== permId)
                : [...prev.permissions, permId],
        }));
    };

    const toggleResourcePermissions = (resource: string) => {
        const resourcePerms = groupedPermissions[resource] || [];
        const resourcePermIds = resourcePerms.map((p: any) => p._id);
        const allSelected = resourcePermIds.every((id: string) =>
            formData.permissions.includes(id)
        );

        if (allSelected) {
            setFormData((prev) => ({
                ...prev,
                permissions: prev.permissions.filter(
                    (id) => !resourcePermIds.includes(id)
                ),
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                permissions: [
                    ...prev.permissions.filter((id) => !resourcePermIds.includes(id)),
                    ...resourcePermIds,
                ],
            }));
        }
    };

    const protectedRoles = ['super-admin', 'admin', 'employee'];

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}
                    >
                        <Shield size={22} />
                    </div>
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Roles & Permissions
                        </h1>
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {roles.length} roles configured
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={18} />
                    Create Role
                </button>
            </div>

            {/* Roles List */}
            {isLoading ? (
                <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
                    Loading roles...
                </div>
            ) : (
                <div className="space-y-3">
                    {roles.map((role: any) => {
                        const isExpanded = expandedRole === role._id;
                        const permsList = (role.permissions || []).filter(
                            (p: any) => typeof p === 'object'
                        );

                        return (
                            <div
                                key={role._id}
                                className="rounded-[1rem] shadow-premium overflow-hidden border-0 transition-shadow"
                                style={{
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                {/* Role Header */}
                                <div
                                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                                    onClick={() =>
                                        setExpandedRole(isExpanded ? null : role._id)
                                    }
                                >
                                    <div className="flex-shrink-0">
                                        {isExpanded ? (
                                            <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />
                                        ) : (
                                            <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                                        )}
                                    </div>
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            backgroundColor: '#F5F3FF',
                                            color: '#7C3AED',
                                        }}
                                    >
                                        <Shield size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-sm font-semibold capitalize"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {role.name}
                                            </span>
                                            <span
                                                className="text-xs px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: '#EFF6FF',
                                                    color: '#3B82F6',
                                                }}
                                            >
                                                Level {role.level}
                                            </span>
                                        </div>
                                        <div
                                            className="text-xs mt-0.5"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {role.description} • {permsList.length} permissions
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => openEditModal(role)}
                                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCloningRoleId(role._id);
                                                setCloneName('');
                                            }}
                                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                            title="Clone role"
                                        >
                                            <Copy size={16} style={{ color: 'var(--color-text-muted)' }} />
                                        </button>
                                        {!protectedRoles.includes(role.name) && (
                                            <button
                                                onClick={() => handleDelete(role._id, role.name)}
                                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                title="Delete role"
                                            >
                                                <Trash2 size={16} style={{ color: '#EF4444' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Permissions */}
                                {isExpanded && permsList.length > 0 && (
                                    <div
                                        className="px-5 pb-4 border-t"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <div className="mt-3">
                                            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                                                Assigned Permissions
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {permsList.map((perm: any) => (
                                                    <span
                                                        key={perm._id}
                                                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                                                        style={{
                                                            backgroundColor: '#F0FDF4',
                                                            color: '#15803D',
                                                        }}
                                                    >
                                                        {perm.resource}:{perm.action}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Clone Modal */}
            {cloningRoleId && (
                <div className="modal-overlay">

                    <div
                        className="w-full max-w-sm rounded-[1rem] p-6 m-4 shadow-premium"
                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Clone Role
                            </h3>
                            <button onClick={() => setCloningRoleId(null)} className="p-1 rounded hover:bg-gray-100">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>New Role Name</label>
                                <input
                                    type="text"
                                    value={cloneName}
                                    onChange={(e) => setCloneName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                    placeholder="e.g. marketing-lead"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setCloningRoleId(null)}
                                    className="px-4 py-2 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleClone}
                                    disabled={!cloneName.trim()}
                                    className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    Clone
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="modal-overlay">

                    <div
                        className="w-full max-w-2xl rounded-[1rem] shadow-premium p-6 m-4 max-h-[85vh] overflow-y-auto"
                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {editingRole ? 'Edit Role' : 'Create Role'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100">
                                <X size={18} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Role Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                        placeholder="e.g. team-lead"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Level (1-10)</label>
                                    <input
                                        required
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Description</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                    placeholder="Brief description of this role"
                                />
                            </div>

                            {/* Permission Matrix */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                    Permissions ({formData.permissions.length} selected)
                                </label>
                                <div
                                    className="rounded-lg border p-4 space-y-4 max-h-64 overflow-y-auto"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    {Object.entries(groupedPermissions).map(
                                        ([resource, perms]: [string, any]) => {
                                            const permIds = perms.map((p: any) => p._id);
                                            const allChecked = permIds.every((id: string) =>
                                                formData.permissions.includes(id)
                                            );
                                            return (
                                                <div key={resource}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={allChecked}
                                                            onChange={() => toggleResourcePermissions(resource)}
                                                            className="rounded"
                                                        />
                                                        <span
                                                            className="text-xs font-semibold uppercase tracking-wider capitalize"
                                                            style={{ color: 'var(--color-text-primary)' }}
                                                        >
                                                            {resource}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 ml-6">
                                                        {perms.map((perm: any) => (
                                                            <label
                                                                key={perm._id}
                                                                className="flex items-center gap-1.5 text-xs cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.permissions.includes(perm._id)}
                                                                    onChange={() => togglePermission(perm._id)}
                                                                    className="rounded"
                                                                />
                                                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                                                    {perm.action}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                    {Object.keys(groupedPermissions).length === 0 && (
                                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No permissions available</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium rounded-lg text-white"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {editingRole ? 'Save Changes' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
