import { useParams } from 'react-router-dom';
import { useGetProjectTimeLogsQuery, useCreateTimeLogMutation } from '@/features/project';
import { useState } from 'react';

export default function ProjectTimeLogsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useGetProjectTimeLogsQuery({ projectId: projectId! });
    const timeLogs = data?.data || [];

    const [createTimeLog] = useCreateTimeLogMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const timeLogData = {
            date: formData.get('date') as string,
            duration: parseInt(formData.get('duration') as string),
            description: formData.get('description') as string,
            billable: formData.get('billable') === 'true',
        };

        try {
            // Note: This requires a taskId, so in a real app you'd select a task
            // For now, we'll skip the actual creation
            console.log('Time log data:', timeLogData);
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create time log:', error);
        }
    };

    if (isLoading) {
        return <div>Loading time logs...</div>;
    }

    // Group by user
    const groupedLogs = timeLogs.reduce((acc, log) => {
        const userId = typeof log.userId === 'string' ? log.userId : log.userId._id;
        if (!acc[userId]) {
            acc[userId] = [];
        }
        acc[userId].push(log);
        return {};
    }, {} as Record<string, typeof timeLogs>);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Time Logs</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Log Time
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-2xl font-bold">
                        {(timeLogs.reduce((sum, log) => sum + log.duration, 0) / 60).toFixed(1)}h
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                    <p className="text-sm text-gray-600">Billable Hours</p>
                    <p className="text-2xl font-bold">
                        {(timeLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration, 0) / 60).toFixed(1)}h
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                    <p className="text-sm text-gray-600">Total Entries</p>
                    <p className="text-2xl font-bold">{timeLogs.length}</p>
                </div>
            </div>

            {/* Time Log List */}
            <div className="bg-white rounded-lg border">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Task</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Billable</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {timeLogs.map((log) => {
                            const user = typeof log.userId === 'object' ? log.userId : null;
                            const task = typeof log.taskId === 'object' ? log.taskId : null;
                            return (
                                <tr key={log._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm">
                                        {new Date(log.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{user?.name || 'Unknown'}</td>
                                    <td className="px-4 py-3 text-sm">{task?.title || 'N/A'}</td>
                                    <td className="px-4 py-3 text-sm font-medium">
                                        {(log.duration / 60).toFixed(1)}h
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {log.billable ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                                Yes
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                                No
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {log.description || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {timeLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No time logs yet. Start tracking your time!
                    </div>
                )}
            </div>
        </div>
    );
}
