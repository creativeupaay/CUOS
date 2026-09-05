import { useMemo, useState } from 'react';
import { useGlobalTasks, type GlobalTask } from '@/hooks/useGlobalTasks';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, Circle } from 'lucide-react';
import { formatElapsed } from '@/hooks/useTaskTimer';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    'todo':        { color: '#6B7280', label: 'To Do' },
    'in-progress': { color: '#3B82F6', label: 'In Progress' },
    'paused':      { color: '#F59E0B', label: 'Paused' },
    'completed':   { color: '#10B981', label: 'Completed' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    low:      { color: '#059669', bg: '#D1FAE5', label: 'Low'      },
    medium:   { color: '#D97706', bg: '#FEF3C7', label: 'Medium'   },
    high:     { color: '#DC2626', bg: '#FEE2E2', label: 'High'     },
    critical: { color: '#991B1B', bg: '#FECACA', label: 'Critical' },
};

function getEntityId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return String(obj._id ?? obj.id ?? '');
    }
    return String(value);
}

function GroupCollapsible({ 
    title, 
    tasks, 
    updateTask,
    projects
}: { 
    title: string; 
    tasks: GlobalTask[];
    updateTask: (projectId: string, taskId: string, updates: Partial<GlobalTask>) => void;
    projects: any[];
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (tasks.length === 0) return null;

    return (
        <div className="mb-8">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 mb-3 text-sm font-bold group uppercase tracking-wider"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                ) : (
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-700 transition-colors" />
                )}
                {title}
                <span className="text-gray-400 font-normal ml-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100">{tasks.length}</span>
            </button>

            {isExpanded && (
                <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50/50 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-500 w-full min-w-[200px]">Task name</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 min-w-[140px]">Status</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 min-w-[150px]">Project</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 min-w-[120px]">Due</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 min-w-[100px]">Priority</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 min-w-[120px] text-right">Time Spent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tasks.map(task => {
                                    const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG['todo'];
                                    const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['medium'];
                                    
                                    const totalSecs = (task.accumulatedSeconds || []).reduce((a, b) => a + b.seconds, 0);

                                    let isOverdue = false;
                                    if (task.deadline && task.status !== 'completed') {
                                        const deadlineDate = new Date(task.deadline);
                                        if (!isNaN(deadlineDate.getTime())) {
                                            deadlineDate.setHours(23, 59, 59, 999);
                                            isOverdue = deadlineDate < new Date();
                                        }
                                    }

                                    return (
                                        <tr key={task._id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => {
                                                            const newStatus = task.status === 'completed' ? 'todo' : 'completed';
                                                            updateTask(task._projectId, task._id, { status: newStatus });
                                                        }}
                                                        className="text-gray-300 hover:text-emerald-500 transition-colors"
                                                    >
                                                        {task.status === 'completed' ? (
                                                            <CheckCircle2 size={18} className="text-emerald-500" />
                                                        ) : (
                                                            <Circle size={18} />
                                                        )}
                                                    </button>
                                                    <span className={`font-medium truncate max-w-[300px] ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`} title={task.title}>
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => updateTask(task._projectId, task._id, { status: e.target.value as any })}
                                                    className="bg-transparent text-xs font-semibold rounded-md outline-none cursor-pointer hover:bg-black/5 transition-colors border border-transparent focus:border-gray-300"
                                                    style={{ 
                                                        color: sc.color, 
                                                        backgroundColor: `${sc.color}10`, 
                                                        padding: '3px 6px',
                                                    }}
                                                >
                                                    <option value="todo">To Do</option>
                                                    <option value="in-progress">In Progress</option>
                                                    <option value="paused">Paused</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={task._projectId || ''}
                                                    onChange={(e) => updateTask(task._projectId, task._id, { projectId: e.target.value || undefined })}
                                                    className="bg-transparent text-xs font-medium text-gray-600 rounded outline-none cursor-pointer hover:bg-black/5 transition-colors border border-transparent focus:border-gray-300 w-full max-w-[140px] truncate"
                                                    style={{ padding: '2px 4px' }}
                                                >
                                                    <option value="">-</option>
                                                    {projects.map(p => (
                                                        <option key={p._id} value={p._id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="date"
                                                    className="bg-transparent text-xs font-medium outline-none cursor-pointer hover:bg-black/5 transition-colors rounded border border-transparent focus:border-gray-300 w-full max-w-[130px]"
                                                    style={{ 
                                                        color: isOverdue ? '#EF4444' : '#4B5563',
                                                        padding: '2px 4px'
                                                    }}
                                                    value={task.deadline ? (() => {
                                                        const d = new Date(task.deadline);
                                                        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
                                                    })() : ''}
                                                    onChange={(e) => updateTask(task._projectId, task._id, { deadline: e.target.value })}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={task.priority}
                                                    onChange={(e) => updateTask(task._projectId, task._id, { priority: e.target.value as any })}
                                                    className="bg-transparent text-[11px] font-semibold rounded outline-none cursor-pointer hover:bg-black/5 transition-colors border border-transparent focus:border-gray-300"
                                                    style={{ 
                                                        backgroundColor: pc.bg, 
                                                        color: pc.color,
                                                        padding: '2px 6px',
                                                    }}
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="critical">Critical</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {(totalSecs > 0 || task.status === 'in-progress') ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                        <Clock size={12} />
                                                        {formatElapsed(totalSecs)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300 font-mono">00:00:00</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DailyTodosList() {
    const { allTasks, currentUserId, updateTask, projects } = useGlobalTasks();

    const { todoTasks, inProgressTasks, pausedTasks, completedTasks } = useMemo(() => {
        const isToday = (dateVal?: string | Date) => {
            if (!dateVal) return false;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return false;
            const today = new Date();
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
        };

        const myTodos = allTasks.filter(t => {
            const isAssigned = Array.isArray(t.assignees) && t.assignees.some(a => getEntityId(a) === currentUserId);
            if (isAssigned) return true;

            const isCreator = getEntityId(t.createdBy) === currentUserId;
            const hasOtherAssignees = Array.isArray(t.assignees) && t.assignees.length > 0;

            if (isCreator && !hasOtherAssignees) return true;
            
            return false;
        });

        // Sort them by date (newest first)
        myTodos.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });

        const todoTasks = myTodos.filter(t => t.status === 'todo');
        const inProgressTasks = myTodos.filter(t => t.status === 'in-progress');
        const pausedTasks = myTodos.filter(t => t.status === 'paused');
        const completedTasks = myTodos.filter(t => t.status === 'completed' && (isToday(t.completedAt) || isToday(t.updatedAt))).slice(0, 4); // Only show last 4

        return { todoTasks, inProgressTasks, pausedTasks, completedTasks };
    }, [allTasks, currentUserId]);

    const totalTasks = todoTasks.length + inProgressTasks.length + pausedTasks.length + completedTasks.length;

    return (
        <div className="pt-2 pb-10">
            {totalTasks === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <Clock className="text-gray-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No tasks today</h3>
                    <p className="text-sm text-gray-500">Your daily agenda is completely clear!</p>
                </div>
            ) : (
                <div className="max-w-[1200px] w-full mx-auto">
                    <GroupCollapsible title="Todo" tasks={todoTasks} updateTask={updateTask} projects={projects} />
                    <GroupCollapsible title="In Progress" tasks={inProgressTasks} updateTask={updateTask} projects={projects} />
                    <GroupCollapsible title="Paused" tasks={pausedTasks} updateTask={updateTask} projects={projects} />
                    <GroupCollapsible title="Completed" tasks={completedTasks} updateTask={updateTask} projects={projects} />
                </div>
            )}
        </div>
    );
}
