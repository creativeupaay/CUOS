import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetEmployeesQuery, useDeleteEmployeeMutation } from '@/features/hrms/hrmsApi';
import {
    Plus, Search, Trash2, Edit, Eye, Users, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';

const DEPARTMENTS = ['engineering', 'design', 'marketing', 'finance', 'hr', 'admin'];
const STATUSES = ['active', 'on-notice', 'relieved', 'terminated'];

export default function HrmsEmployeesPage() {
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');          // debounced value sent to API
    const [department, setDepartment] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);

    // Debounce: update `search` 350ms after the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading } = useGetEmployeesQuery({
        search: search || undefined,
        department: department || undefined,
        status: status || undefined,
        page,
        limit: 20,
    });

    const [deleteEmployee] = useDeleteEmployeeMutation();

    const employees = data?.data?.employees || [];
    const pagination = data?.data?.pagination;

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete ${name}?`)) {
            try {
                await deleteEmployee(id).unwrap();
            } catch (err) {
                console.error('Failed to delete employee:', err);
            }
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'active': return { bg: 'var(--color-success-soft)', color: 'var(--color-success)' };
            case 'on-notice': return { bg: 'var(--color-warning-soft)', color: '#92400E' };
            case 'relieved': return { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' };
            case 'terminated': return { bg: '#FEE2E2', color: '#991B1B' };
            default: return { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' };
        }
    };

    const getDeptColor = (d: string) => {
        const colors: Record<string, string> = {
            engineering: '#3B82F6', design: '#8B5CF6', marketing: '#F59E0B',
            finance: '#10B981', hr: '#EC4899', admin: '#6B7280',
        };
        return colors[d] || '#6B7280';
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Employees
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Manage employee profiles, departments, and onboarding
                    </p>
                </div>
                <button
                    onClick={() => navigate('/hrms/employees/new')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={16} />
                    Add Employee
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, email, ID, designation..."
                        value={searchInput}
                        onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border outline-none"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    />
                </div>
                <select
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">All Statuses</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading ? (
                    <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading employees...</div>
                ) : employees.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No employees found</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Employee', 'Department', 'Designation', 'Type', 'Status', 'Joining Date', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map((emp) => {
                                const statusStyle = getStatusColor(emp.status);
                                return (
                                    <tr key={emp._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                                    style={{ backgroundColor: getDeptColor(emp.department) }}
                                                >
                                                    {(emp.userId as any)?.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        {(emp.userId as any)?.name || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {emp.employeeId} · {(emp.userId as any)?.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                                                style={{ backgroundColor: getDeptColor(emp.department) + '20', color: getDeptColor(emp.department) }}
                                            >
                                                <Building2 size={12} />
                                                {emp.department}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>{emp.designation}</td>
                                        <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>{emp.employmentType}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {new Date(emp.joiningDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => navigate(`/hrms/employees/${emp._id}`)} className="p-1.5 rounded hover:bg-gray-100 cursor-pointer" title="View">
                                                    <Eye size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                                <button onClick={() => navigate(`/hrms/employees/${emp._id}/edit`)} className="p-1.5 rounded hover:bg-gray-100 cursor-pointer" title="Edit">
                                                    <Edit size={16} style={{ color: 'var(--color-text-muted)' }} />
                                                </button>
                                                <button onClick={() => handleDelete(emp._id, (emp.userId as any)?.name)} className="p-1.5 rounded hover:bg-red-50 cursor-pointer" title="Delete">
                                                    <Trash2 size={16} style={{ color: '#EF4444' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded border cursor-pointer disabled:opacity-50"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="p-1.5 rounded border cursor-pointer disabled:opacity-50"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
