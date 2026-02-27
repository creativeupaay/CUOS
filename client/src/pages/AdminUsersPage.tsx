import { useState } from 'react';
import { Users, Plus, Search, X, ToggleLeft, ToggleRight, KeyRound, Trash2, Pencil } from 'lucide-react';
import {
    useGetAdminUsersQuery,
    useCreateAdminUserMutation,
    useUpdateAdminUserMutation,
    useDeactivateUserMutation,
    useActivateUserMutation,
    useResetUserPasswordMutation,
    useDeleteAdminUserMutation,
    useGetAdminRolesQuery,
} from '@/features/overall-admin/api/adminApi';

// ─── Form data ────────────────────────────────────────────────────────────────

interface UserFormData {
    name: string;
    email: string;
    password: string;
    role: string;
    department: string;
    customDepartment: string;
}

const initialForm: UserFormData = { name: '', email: '', password: '', role: '', department: '', customDepartment: '' };
const PRESET_DEPARTMENTS = ['Engineering', 'Design', 'Marketing', 'Finance', 'HR', 'Operations', 'Sales'];

// ─── Edit Email/Password Modal ────────────────────────────────────────────────

function EditCredentialsModal({ user, onClose, onSave }: { user: any; onClose: () => void; onSave: (email: string, password: string) => void }) {
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState('');
    const inputSty = { borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' };
    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-[1rem] shadow-premium m-4" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Credentials</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
                </div>
                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            autoComplete="off"
                            className={inputCls} style={inputSty} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>New Password <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>(leave blank to keep current)</span></label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters"
                            autoComplete="new-password"
                            className={inputCls} style={inputSty} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>Cancel</button>
                    <button onClick={() => onSave(email, password)} className="px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── AdminUsersPage ───────────────────────────────────────────────────────────

export default function AdminUsersPage() {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [formData, setFormData] = useState<UserFormData>(initialForm);
    const [editCreds, setEditCreds] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [resetPwdUser, setResetPwdUser] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');

    const { data, isLoading } = useGetAdminUsersQuery({ search, isActive: filterStatus, page, limit: 15 });
    const { data: rolesData } = useGetAdminRolesQuery();
    const [createUser] = useCreateAdminUserMutation();
    const [updateUser] = useUpdateAdminUserMutation();
    const [deactivateUser] = useDeactivateUserMutation();
    const [activateUser] = useActivateUserMutation();
    const [resetPassword] = useResetUserPasswordMutation();
    const [deleteUser] = useDeleteAdminUserMutation();

    const users = data?.data?.users || [];
    const pagination = data?.data?.pagination;

    const resolvedDept = (fd: UserFormData) =>
        fd.department === '__custom__' ? fd.customDepartment.trim() : fd.department;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        try {
            await createUser({
                name: formData.name, email: formData.email,
                password: formData.password, role: formData.role,
                department: resolvedDept(formData),
            } as any).unwrap();
            setShowCreate(false); setFormData(initialForm);
        } catch (err: any) { setError(err?.data?.message || 'Failed to create user'); }
    };

    const handleSaveCreds = async (email: string, password: string) => {
        if (!editCreds) return;
        try {
            // Update email
            await updateUser({ id: editCreds._id, data: { email } }).unwrap();
            // Reset password if provided
            if (password && password.length >= 8) {
                await resetPassword({ id: editCreds._id, newPassword: password }).unwrap();
            }
            setEditCreds(null);
        } catch (err: any) { alert(err?.data?.message || 'Failed to update credentials'); }
    };

    const handleToggle = async (userId: string, isActive: boolean) => {
        try {
            if (isActive) await deactivateUser(userId).unwrap();
            else await activateUser(userId).unwrap();
        } catch (err: any) { alert(err?.data?.message || 'Failed'); }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteUser(deleteConfirm.id).unwrap();
            setDeleteConfirm(null);
        } catch (err: any) { alert(err?.data?.message || 'Failed to delete user'); }
    };

    const handleResetPwd = async () => {
        if (!resetPwdUser || newPassword.length < 8) return;
        try {
            await resetPassword({ id: resetPwdUser, newPassword }).unwrap();
            setResetPwdUser(null); setNewPassword(''); alert('Password reset successfully');
        } catch (err: any) { alert(err?.data?.message || 'Failed'); }
    };

    const getRoleName = (role: any) => role ? (typeof role === 'object' ? role.name : role) : '—';

    const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm outline-none';
    const inputSty = { borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' };

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1100px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Users</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{pagination?.total || 0} total users</p>
                    </div>
                </div>
                <button onClick={() => { setShowCreate(true); setFormData(initialForm); setError(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Plus size={18} /> Add User
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl shadow-premium border-0" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                    <input type="text" placeholder="Search by name or email…" value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm" style={inputSty} />
                </div>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-lg border text-sm" style={inputSty}>
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl shadow-premium overflow-hidden border-0" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading users…</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>No users found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    {['User', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                                        <th key={h} className={`text-xs font-semibold uppercase tracking-wider px-5 py-3 ${h === 'Actions' ? 'text-right' : 'text-left'}`} style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user: any) => {
                                    const roleStr = getRoleName(user.role).toLowerCase();
                                    const isSuperAdmin = roleStr === 'super-admin' || roleStr === 'super_admin';
                                    return (
                                        <tr key={user._id} className="border-b last:border-b-0 transition-colors" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                                                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{user.name}</div>
                                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{getRoleName(user.role)}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.department || '—'}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                                                    style={{ backgroundColor: user.isActive ? '#ECFDF5' : '#FEF2F2', color: user.isActive ? '#059669' : '#DC2626' }}>
                                                    {user.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setEditCreds(user)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Edit email / password">
                                                        <Pencil size={15} style={{ color: 'var(--color-text-muted)' }} />
                                                    </button>
                                                    {!isSuperAdmin && (
                                                        <>
                                                            <button onClick={() => handleToggle(user._id, user.isActive)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title={user.isActive ? 'Deactivate' : 'Activate'}>
                                                                {user.isActive ? <ToggleRight size={16} style={{ color: '#10B981' }} /> : <ToggleLeft size={16} style={{ color: '#EF4444' }} />}
                                                            </button>
                                                            <button onClick={() => setDeleteConfirm({ id: user._id, name: user.name })} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete user">
                                                                <Trash2 size={15} style={{ color: '#EF4444' }} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => { setResetPwdUser(user._id); setNewPassword(''); }} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Reset password">
                                                        <KeyRound size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Page {pagination.page} of {pagination.pages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border-default)' }}>Previous</button>
                            <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages} className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border-default)' }}>Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-lg rounded-[1rem] shadow-premium m-4" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Create User</h3>
                            <button onClick={() => setShowCreate(false)} className="p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="px-6 py-5 space-y-4">
                                {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Full Name</label>
                                        <input required type="text" value={formData.name} placeholder="e.g. Ananya Sharma"
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className={inputCls} style={inputSty} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
                                        <input required type="email" value={formData.email} placeholder="user@company.com"
                                            autoComplete="off"
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className={inputCls} style={inputSty} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Password</label>
                                        <input required type="password" value={formData.password} minLength={8} placeholder="Min 8 characters"
                                            autoComplete="new-password"
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className={inputCls} style={inputSty} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Role / Designation</label>
                                        <select required value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className={inputCls} style={inputSty}>
                                            <option value="" disabled>Select a role</option>
                                            {rolesData?.data?.map((r: any) => (
                                                <option key={r._id} value={r._id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Department</label>
                                        <select value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value, customDepartment: '' })}
                                            className={inputCls} style={inputSty}>
                                            <option value="">No Department</option>
                                            {PRESET_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                            <option value="__custom__">✏️ Custom…</option>
                                        </select>
                                        {formData.department === '__custom__' && (
                                            <input type="text" value={formData.customDepartment} placeholder="Type department name"
                                                onChange={e => setFormData({ ...formData, customDepartment: e.target.value })}
                                                className={`${inputCls} mt-2`} style={inputSty} required />
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    💡 After creating the user, go to <strong>Permissions</strong> in the sidebar to assign module access.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Credentials Modal */}
            {editCreds && <EditCredentialsModal user={editCreds} onClose={() => setEditCreds(null)} onSave={handleSaveCreds} />}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-sm rounded-[1rem] p-6 m-4 shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                                <Trash2 size={18} style={{ color: '#EF4444' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Delete User</h3>
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
                            </div>
                        </div>
                        <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                            Are you sure you want to permanently delete <strong>{deleteConfirm.name}</strong>?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>Cancel</button>
                            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: '#EF4444' }}>Delete User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPwdUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-sm rounded-[1rem] p-6 m-4 shadow-premium" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Reset Password</h3>
                            <button onClick={() => setResetPwdUser(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                                className={inputCls} style={inputSty} minLength={8} placeholder="New password (min 8 chars)" />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setResetPwdUser(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>Cancel</button>
                                <button onClick={handleResetPwd} disabled={newPassword.length < 8}
                                    className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: '#EF4444' }}>
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
