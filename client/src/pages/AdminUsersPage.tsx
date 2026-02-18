import { useState } from 'react';
import {
    Users,
    Plus,
    Search,
    X,
    UserCog,
    ToggleLeft,
    ToggleRight,
    KeyRound,
} from 'lucide-react';
import {
    useGetAdminUsersQuery,
    useCreateAdminUserMutation,
    useUpdateAdminUserMutation,
    useDeactivateUserMutation,
    useActivateUserMutation,
    useResetUserPasswordMutation,
    useGetAdminRolesQuery,
} from '@/features/overall-admin/api/adminApi';

interface UserFormData {
    name: string;
    email: string;
    password: string;
    role: string;
    department: string;
}

const initialFormData: UserFormData = {
    name: '',
    email: '',
    password: '',
    role: '',
    department: '',
};

export default function AdminUsersPage() {
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [formData, setFormData] = useState<UserFormData>(initialFormData);
    const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');

    const { data, isLoading } = useGetAdminUsersQuery({
        search,
        role: filterRole,
        isActive: filterStatus,
        page,
        limit: 15,
    });

    const { data: rolesData } = useGetAdminRolesQuery();
    const [createUser] = useCreateAdminUserMutation();
    const [updateUser] = useUpdateAdminUserMutation();
    const [deactivateUser] = useDeactivateUserMutation();
    const [activateUser] = useActivateUserMutation();
    const [resetPassword] = useResetUserPasswordMutation();

    const users = data?.data?.users || [];
    const pagination = data?.data?.pagination;
    const roles = rolesData?.data || [];

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData(initialFormData);
        setError('');
        setShowModal(true);
    };

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: typeof user.role === 'object' ? user.role._id : user.role,
            department: user.department || '',
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (editingUser) {
                const { password, ...updateData } = formData;
                await updateUser({
                    id: editingUser._id,
                    data: updateData,
                }).unwrap();
            } else {
                await createUser(formData).unwrap();
            }
            setShowModal(false);
        } catch (err: any) {
            setError(err?.data?.message || 'Operation failed');
        }
    };

    const handleToggleStatus = async (userId: string, isActive: boolean) => {
        try {
            if (isActive) {
                await deactivateUser(userId).unwrap();
            } else {
                await activateUser(userId).unwrap();
            }
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to update status');
        }
    };

    const handleResetPassword = async () => {
        if (!showPasswordModal || !newPassword) return;
        try {
            await resetPassword({ id: showPasswordModal, newPassword }).unwrap();
            setShowPasswordModal(null);
            setNewPassword('');
            alert('Password reset successfully');
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to reset password');
        }
    };

    const getRoleName = (role: any) => {
        if (!role) return '—';
        return typeof role === 'object' ? role.name : role;
    };

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}
                    >
                        <Users size={22} />
                    </div>
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            User Management
                        </h1>
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {pagination?.total || 0} total users
                        </p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={18} />
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div
                className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl border"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="relative flex-1 min-w-[200px]">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-subtle)',
                        }}
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-subtle)',
                    }}
                >
                    <option value="">All Roles</option>
                    {roles.map((r: any) => (
                        <option key={r._id} value={r._id}>
                            {r.name}
                        </option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-subtle)',
                    }}
                >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>

            {/* Users Table */}
            <div
                className="rounded-xl border overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {isLoading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                        Loading users...
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                        No users found
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr
                                    className="border-b"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: 'var(--color-text-muted)' }}>User</th>
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: 'var(--color-text-muted)' }}>Role</th>
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: 'var(--color-text-muted)' }}>Department</th>
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                                    <th className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: 'var(--color-text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user: any) => (
                                    <tr
                                        key={user._id}
                                        className="border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                                >
                                                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user.name}</div>
                                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm capitalize font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {getRoleName(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {user.department || '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className="text-xs font-medium px-2.5 py-1 rounded-full"
                                                style={{
                                                    backgroundColor: user.isActive ? '#ECFDF5' : '#FEF2F2',
                                                    color: user.isActive ? '#059669' : '#DC2626',
                                                }}
                                            >
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title="Edit user"
                                                >
                                                    <UserCog size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user._id, user.isActive)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title={user.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {user.isActive ? (
                                                        <ToggleRight size={16} style={{ color: '#10B981' }} />
                                                    ) : (
                                                        <ToggleLeft size={16} style={{ color: '#EF4444' }} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => { setShowPasswordModal(user._id); setNewPassword(''); }}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title="Reset password"
                                                >
                                                    <KeyRound size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div
                        className="flex items-center justify-between px-5 py-3 border-t"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Page {pagination.page} of {pagination.pages} ({pagination.total} users)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page >= pagination.pages}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="w-full max-w-lg rounded-xl p-6 m-4"
                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3
                                className="text-lg font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                {editingUser ? 'Edit User' : 'Create User'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100">
                                <X size={18} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Password</label>
                                    <input
                                        required
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                        minLength={8}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Role</label>
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <option value="">Select Role</option>
                                    {roles.map((r: any) => (
                                        <option key={r._id} value={r._id}>
                                            {r.name} (Level {r.level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Department (optional)</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <option value="">No Department</option>
                                    <option value="engineering">Engineering</option>
                                    <option value="design">Design</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="finance">Finance</option>
                                    <option value="hr">HR</option>
                                    <option value="operations">Operations</option>
                                </select>
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
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="w-full max-w-sm rounded-xl p-6 m-4"
                        style={{ backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3
                                className="text-lg font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Reset Password
                            </h3>
                            <button onClick={() => setShowPasswordModal(null)} className="p-1 rounded hover:bg-gray-100">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                    minLength={8}
                                    placeholder="Min 8 characters"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowPasswordModal(null)}
                                    className="px-4 py-2 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    disabled={newPassword.length < 8}
                                    className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                                    style={{ backgroundColor: '#EF4444' }}
                                >
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
