import { useState, useMemo } from 'react';
import {
    useGetPartnerEmployeesQuery,
    useCreatePartnerEmployeeMutation,
    useUpdatePartnerEmployeeMutation,
    useDeletePartnerEmployeeMutation,
    useTogglePartnerEmployeeStatusMutation,
    useResetPartnerEmployeePasswordMutation,
    useGetPartnerEmployeeStatsQuery,
    type PartnerEmployee,
} from '@/features/partners/partnerEmployeeApi';
import {
    Search,
    Users,
    ToggleLeft,
    ToggleRight,
    Pencil,
    Trash2,
    X,
    Eye,
    EyeOff,
    Key,
    UserPlus,
} from 'lucide-react';

export default function PartnerEmployeesPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<PartnerEmployee | null>(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordEmployeeId, setPasswordEmployeeId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        designation: '',
    });

    const { data: employeesResponse, isLoading, isFetching } = useGetPartnerEmployeesQuery({
        page,
        limit: 20,
        search: search || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'true',
    });

    const { data: statsResponse } = useGetPartnerEmployeeStatsQuery();

    const [createEmployee, { isLoading: isCreating }] = useCreatePartnerEmployeeMutation();
    const [updateEmployee, { isLoading: isUpdating }] = useUpdatePartnerEmployeeMutation();
    const [deleteEmployee] = useDeletePartnerEmployeeMutation();
    const [toggleStatus, { isLoading: isToggling }] = useTogglePartnerEmployeeStatusMutation();
    const [resetPassword, { isLoading: isResettingPassword }] = useResetPartnerEmployeePasswordMutation();

    const employees = useMemo(() => employeesResponse?.data?.employees || [], [employeesResponse]);
    const total = employeesResponse?.data?.total || 0;
    const totalPages = employeesResponse?.data?.totalPages || 1;
    const stats = statsResponse?.data || { total: 0, active: 0, inactive: 0 };

    const handleOpenModal = (employee?: PartnerEmployee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData({
                name: employee.name,
                email: employee.email,
                password: '',
                phone: employee.phone || '',
                designation: employee.designation || '',
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                designation: '',
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingEmployee(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            phone: '',
            designation: '',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await updateEmployee({
                    id: editingEmployee._id,
                    data: {
                        name: formData.name,
                        email: formData.email,
                        phone: formData.phone || undefined,
                        designation: formData.designation || undefined,
                    },
                }).unwrap();
            } else {
                await createEmployee({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    phone: formData.phone || undefined,
                    designation: formData.designation || undefined,
                }).unwrap();
            }
            handleCloseModal();
        } catch (err: any) {
            alert(err.data?.message || 'Failed to save employee');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deleteEmployee(id).unwrap();
        } catch (err: any) {
            alert(err.data?.message || 'Failed to delete employee');
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            await toggleStatus(id).unwrap();
        } catch (err: any) {
            alert(err.data?.message || 'Failed to toggle status');
        }
    };

    const handleOpenPasswordModal = (id: string) => {
        setPasswordEmployeeId(id);
        setNewPassword('');
        setShowPasswordModal(true);
    };

    const handleResetPassword = async () => {
        if (!passwordEmployeeId || newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        try {
            await resetPassword({ id: passwordEmployeeId, newPassword }).unwrap();
            setShowPasswordModal(false);
            setPasswordEmployeeId(null);
            setNewPassword('');
            alert('Password reset successfully');
        } catch (err: any) {
            alert(err.data?.message || 'Failed to reset password');
        }
    };

    return (
        <div className="p-6 md:p-8 mx-auto" style={{ maxWidth: '1400px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}
                    >
                        <Users size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Team Members
                        </h1>
                        <p className="text-base mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Manage your team's access to the portal
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
                    style={{ backgroundColor: '#4F46E5' }}
                >
                    <UserPlus size={18} strokeWidth={2.5} /> Add Team Member
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                        Total Members
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#4F46E5' }}>
                        {stats.total}
                    </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                        Active Members
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#10B981' }}>
                        {stats.active}
                    </p>
                </div>
                <div className="p-6 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>
                        Inactive Members
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#EF4444' }}>
                        {stats.inactive}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 p-5 rounded-2xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}>
                <div className="relative flex-1 min-w-[280px]">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: '#9CA3AF' }}
                    />
                    <input
                        type="text"
                        value={search}
                        placeholder="Search by name, email, designation..."
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value as '' | 'true' | 'false');
                        setPage(1);
                    }}
                    className="px-5 py-3 rounded-xl border text-sm font-medium transition-all focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                >
                    <option value="">All Status</option>
                    <option value="true">Active Only</option>
                    <option value="false">Inactive Only</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl shadow-sm border overflow-hidden" style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}>
                {isLoading || isFetching ? (
                    <div className="text-center py-20">
                        <div
                            className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
                            style={{ color: '#4F46E5' }}
                        ></div>
                        <p className="mt-4 text-base font-medium" style={{ color: '#6B7280' }}>
                            Loading team members...
                        </p>
                    </div>
                ) : employees.length === 0 ? (
                    <div className="text-center py-20">
                        <Users size={64} className="mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                        <p className="text-lg font-semibold" style={{ color: '#6B7280' }}>
                            No team members found
                        </p>
                        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                            Add your first team member to get started
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b" style={{ borderColor: '#E5E7EB' }}>
                                    {['Name', 'Email', 'Phone', 'Designation', 'Status', 'Actions'].map((header) => (
                                        <th
                                            key={header}
                                            className={`text-xs font-semibold uppercase tracking-wider px-6 py-4 ${header === 'Actions' ? 'text-right' : 'text-left'}`}
                                            style={{ color: '#6B7280' }}
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: '#E5E7EB' }}>
                                {employees.map((employee) => (
                                    <tr key={employee._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-semibold" style={{ color: '#111827' }}>
                                                {employee.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm" style={{ color: '#6B7280' }}>
                                            {employee.email}
                                        </td>
                                        <td className="px-6 py-5 text-sm" style={{ color: '#6B7280' }}>
                                            {employee.phone || '-'}
                                        </td>
                                        <td className="px-6 py-5 text-sm" style={{ color: '#6B7280' }}>
                                            {employee.designation || '-'}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span
                                                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                                                style={{
                                                    backgroundColor: employee.isActive ? '#ECFDF5' : '#FEF2F2',
                                                    color: employee.isActive ? '#059669' : '#DC2626',
                                                }}
                                            >
                                                {employee.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(employee)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={16} style={{ color: '#6B7280' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenPasswordModal(employee._id)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                    title="Reset Password"
                                                >
                                                    <Key size={16} style={{ color: '#6B7280' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(employee._id)}
                                                    disabled={isToggling}
                                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                                    title={employee.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {employee.isActive ? (
                                                        <ToggleRight size={18} style={{ color: '#10B981' }} />
                                                    ) : (
                                                        <ToggleLeft size={18} style={{ color: '#EF4444' }} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(employee._id, employee.name)}
                                                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} style={{ color: '#EF4444' }} />
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
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                        <span className="text-sm font-medium" style={{ color: '#6B7280' }}>
                            Page {page} of {totalPages} ({total} total)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 text-sm font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
                                style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages}
                                className="px-4 py-2 text-sm font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
                                style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold" style={{ color: '#111827' }}>
                                {editingEmployee ? 'Edit Team Member' : 'Add Team Member'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} style={{ color: '#6B7280' }} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                    Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    style={{ borderColor: '#E5E7EB' }}
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    style={{ borderColor: '#E5E7EB' }}
                                    placeholder="john@example.com"
                                />
                            </div>

                            {!editingEmployee && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2.5 pr-12 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            style={{ borderColor: '#E5E7EB' }}
                                            placeholder="••••••••"
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    style={{ borderColor: '#E5E7EB' }}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                    Designation
                                </label>
                                <input
                                    type="text"
                                    value={formData.designation}
                                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    style={{ borderColor: '#E5E7EB' }}
                                    placeholder="Sales Manager"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2.5 rounded-xl border font-medium transition-colors hover:bg-gray-50"
                                    style={{ borderColor: '#E5E7EB' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || isUpdating}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-colors disabled:opacity-60"
                                    style={{ backgroundColor: '#4F46E5' }}
                                >
                                    {isCreating || isUpdating ? 'Saving...' : editingEmployee ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold" style={{ color: '#111827' }}>
                                Reset Password
                            </h2>
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} style={{ color: '#6B7280' }} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                    New Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 pr-12 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        style={{ borderColor: '#E5E7EB' }}
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                                    Password must be at least 6 characters
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border font-medium transition-colors hover:bg-gray-50"
                                    style={{ borderColor: '#E5E7EB' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    disabled={isResettingPassword || newPassword.length < 6}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-colors disabled:opacity-60"
                                    style={{ backgroundColor: '#4F46E5' }}
                                >
                                    {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
