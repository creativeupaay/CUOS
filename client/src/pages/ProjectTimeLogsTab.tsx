import { useParams } from 'react-router-dom';
import {
    useGetProjectTimeLogsQuery,
    useGetTasksQuery,
    useCreateTimeLogMutation,
} from '@/features/project';
import { useState } from 'react';
import { Plus, Loader2, Clock, X } from 'lucide-react';

export default function ProjectTimeLogsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useGetProjectTimeLogsQuery({ projectId: projectId! });
    const timeLogs = data?.data || [];

    const { data: tasksData } = useGetTasksQuery({ projectId: projectId! });
    const tasks = tasksData?.data || [];

    const [createTimeLog, { isLoading: isCreating }] = useCreateTimeLogMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const taskId = formData.get('taskId') as string;
        if (!taskId) return;

        const timeLogData = {
            date: formData.get('date') as string,
            duration: parseInt(formData.get('duration') as string),
            description: formData.get('description') as string,
            billable: formData.get('billable') === 'true',
        };

        try {
            await createTimeLog({
                projectId: projectId!,
                taskId,
                data: timeLogData,
            }).unwrap();
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create time log:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    Loading time logs...
                </div>
            </div>
        );
    }

    const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const billableMinutes = timeLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    Time Logs
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{
                        height: '36px',
                        backgroundColor: 'var(--color-primary)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >
                    <Plus size={15} />
                    Log Time
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div
                    className="p-4 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Hours</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {(totalMinutes / 60).toFixed(1)}h
                    </p>
                </div>
                <div
                    className="p-4 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Billable Hours</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>
                        {(billableMinutes / 60).toFixed(1)}h
                    </p>
                </div>
                <div
                    className="p-4 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Total Entries</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {timeLogs.length}
                    </p>
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Log Time
                        </h3>
                        <button
                            onClick={() => setShowForm(false)}
                            className="p-1 rounded transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Task *
                                </label>
                                <select
                                    name="taskId"
                                    required
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={{
                                        height: '36px',
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                >
                                    <option value="">Select a task</option>
                                    {tasks.map(task => (
                                        <option key={task._id} value={task._id}>
                                            {task.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Date *
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={{
                                        height: '36px',
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Duration (minutes) *
                                </label>
                                <input
                                    type="number"
                                    name="duration"
                                    required
                                    min={1}
                                    placeholder="60"
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={{
                                        height: '36px',
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Billable
                                </label>
                                <select
                                    name="billable"
                                    defaultValue="true"
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={{
                                        height: '36px',
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Description
                            </label>
                            <textarea
                                name="description"
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                                placeholder="What did you work on?"
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{
                                    height: '36px',
                                    backgroundColor: 'var(--color-primary)',
                                }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                Log Time
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{
                                    height: '36px',
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Time Log Table */}
            <div
                className="rounded-lg border overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <table className="w-full">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>Date</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>User</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>Task</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>Duration</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>Billable</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeLogs.map((log) => {
                            const user = typeof log.userId === 'object' ? log.userId : null;
                            const task = typeof log.taskId === 'object' ? log.taskId : null;
                            return (
                                <tr
                                    key={log._id}
                                    style={{ borderBottomWidth: '1px', borderColor: 'var(--color-border-default)' }}
                                >
                                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                        {new Date(log.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                        {user?.name || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                        {task?.title || 'N/A'}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {(log.duration / 60).toFixed(1)}h
                                    </td>
                                    <td className="px-4 py-2.5 text-sm">
                                        {log.billable ? (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                                            >
                                                Yes
                                            </span>
                                        ) : (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                            >
                                                No
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {log.description || '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {timeLogs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <Clock size={20} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            No time logs yet
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            Start tracking your time
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
