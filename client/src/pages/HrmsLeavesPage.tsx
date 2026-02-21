import { useState, useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import {
    useGetLeavesQuery, useGetMyLeavesQuery, useGetLeaveBalanceQuery,
    useCreateLeaveMutation, useUpdateLeaveStatusMutation,
} from '@/features/hrms/hrmsApi';
import { Plus, Calendar, X, Check, XCircle, Clock } from 'lucide-react';

const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity'];

export default function HrmsLeavesPage() {
    const rawRole = useAppSelector((state) => state.auth.user?.role);
    const userRole = typeof rawRole === 'object' ? (rawRole as any)?.name : rawRole;
    const isHrOrAdmin = ['super-admin', 'admin', 'hr'].includes(userRole || 'employee');

    const [showForm, setShowForm] = useState(false);
    const [view, setView] = useState<'all' | 'mine'>(isHrOrAdmin ? 'all' : 'mine');

    useEffect(() => {
        if (!isHrOrAdmin && view === 'all') {
            setView('mine');
        }
    }, [isHrOrAdmin, view]);

    const { data: allLeaves, isLoading: loadingAll } = useGetLeavesQuery({}, { skip: view !== 'all' || !isHrOrAdmin });
    const { data: myLeaves, isLoading: loadingMine } = useGetMyLeavesQuery({}, { skip: view !== 'mine' });
    const { data: balanceData } = useGetLeaveBalanceQuery();

    const [createLeave, { isLoading: creating }] = useCreateLeaveMutation();
    const [updateStatus] = useUpdateLeaveStatusMutation();

    const leaves = view === 'all' ? (allLeaves?.data?.leaves || []) : (myLeaves?.data?.leaves || []);
    const balance = balanceData?.data?.balance || [];
    const isLoading = view === 'all' ? loadingAll : loadingMine;

    const [form, setForm] = useState({ type: 'casual', startDate: '', endDate: '', days: 1, reason: '' });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createLeave(form).unwrap();
            setShowForm(false);
            setForm({ type: 'casual', startDate: '', endDate: '', days: 1, reason: '' });
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusIcon = (s: string) => {
        switch (s) {
            case 'approved': return <Check size={14} style={{ color: 'var(--color-success)' }} />;
            case 'rejected': return <XCircle size={14} style={{ color: '#EF4444' }} />;
            case 'cancelled': return <X size={14} style={{ color: 'var(--color-text-muted)' }} />;
            default: return <Clock size={14} style={{ color: '#F59E0B' }} />;
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'approved': return { bg: 'var(--color-success-soft)', color: 'var(--color-success)' };
            case 'rejected': return { bg: '#FEE2E2', color: '#991B1B' };
            case 'cancelled': return { bg: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' };
            default: return { bg: 'var(--color-warning-soft)', color: '#92400E' };
        }
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Leaves</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Manage leave requests and track balances</p>
                </div>
                <div className="flex gap-3">
                    {isHrOrAdmin && (
                        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                            {(['all', 'mine'] as const).map((v) => (
                                <button key={v} onClick={() => setView(v)}
                                    className="px-4 py-2 text-sm font-medium capitalize cursor-pointer"
                                    style={{
                                        backgroundColor: view === v ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                        color: view === v ? 'white' : 'var(--color-text-primary)',
                                    }}>
                                    {v === 'mine' ? 'My Leaves' : 'All Leaves'}
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                        style={{ backgroundColor: 'var(--color-primary)' }}>
                        <Plus size={16} /> Apply Leave
                    </button>
                </div>
            </div>

            {/* Leave Balance Cards */}
            {balance.length > 0 && (
                <div className="grid grid-cols-6 gap-3 mb-6">
                    {balance.map((b) => (
                        <div key={b.type} className="rounded-lg border p-4 text-center"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <div className="text-xs font-medium capitalize mb-1" style={{ color: 'var(--color-text-muted)' }}>{b.type}</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{b.remaining}</div>
                            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{b.used}/{b.total} used</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Leave Apply Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-md rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Apply for Leave</h2>
                            <button onClick={() => setShowForm(false)} className="cursor-pointer"><X size={20} style={{ color: 'var(--color-text-muted)' }} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Leave Type</label>
                                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                                    {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Start Date</label>
                                    <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>End Date</label>
                                    <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Days</label>
                                <input type="number" required min={0.5} step={0.5} value={form.days} onChange={(e) => setForm({ ...form, days: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Reason</label>
                                <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={creating}
                                    className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {creating ? 'Applying...' : 'Apply'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Leaves Table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading ? (
                    <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
                ) : leaves.length === 0 ? (
                    <div className="p-12 text-center">
                        <Calendar size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No leave requests found</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {(view === 'all' ? ['Employee', 'Type', 'Dates', 'Days', 'Reason', 'Status', 'Actions'] : ['Type', 'Dates', 'Days', 'Reason', 'Status']).map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaves.map((leave) => {
                                const statusStyle = getStatusColor(leave.status);
                                return (
                                    <tr key={leave._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {view === 'all' && (
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                {typeof leave.employeeId === 'object' ? ((leave.employeeId as any)?.userId?.name || '—') : '—'}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--color-text-primary)' }}>{leave.type}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</td>
                                        <td className="px-4 py-3 text-sm max-w-[200px] truncate" style={{ color: 'var(--color-text-secondary)' }}>{leave.reason}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                                                {getStatusIcon(leave.status)} {leave.status}
                                            </span>
                                        </td>
                                        {isHrOrAdmin && view === 'all' && leave.status === 'pending' && (
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button onClick={() => updateStatus({ id: leave._id, data: { status: 'approved' } })}
                                                        className="px-2 py-1 text-xs font-medium text-white rounded cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--color-success)' }}>Approve</button>
                                                    <button onClick={() => updateStatus({ id: leave._id, data: { status: 'rejected' } })}
                                                        className="px-2 py-1 text-xs font-medium text-white rounded cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: '#EF4444' }}>Reject</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
