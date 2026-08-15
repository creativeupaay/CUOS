import React, { useMemo } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, pointerWithin } from '@dnd-kit/core';
import { useGlobalTasks, type GlobalTask } from '@/hooks/useGlobalTasks';
import { Calendar, User2 } from 'lucide-react';


const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    low:      { color: '#10B981', label: 'Low'      },
    medium:   { color: '#F59E0B', label: 'Medium'   },
    high:     { color: '#EA580C', label: 'High'     },
    critical: { color: '#EF4444', label: 'Critical' },
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

function TaskCard({ task }: { task: GlobalTask }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task._id,
        data: { task },
    });
    
    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.9 : 1,
        borderColor: 'var(--color-border-default)'
    };
    

    const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['medium'];

    const creatorName = task.createdBy && typeof task.createdBy === 'object' ? (task.createdBy as any).name || (task.createdBy as any).email : 'Unknown';

    // Calculate overdue status
    let isOverdue = false;
    if (task.deadline && task.status !== 'completed') {
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(23, 59, 59, 999);
        isOverdue = deadlineDate < new Date();
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="p-4 bg-white rounded-2xl shadow-sm border cursor-grab hover:shadow-md transition-shadow relative"
        >
            <div className="flex justify-between items-start gap-2 mb-1.5">
                <span className="text-sm font-bold leading-snug" style={{ color: 'var(--color-text-primary)' }}>{task.title}</span>
            </div>
            
            <div className="text-[11px] font-medium mb-4 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {task._projectId ? task._projectName : 'Personal Task'}
            </div>

            <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center justify-between text-[11px] font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pc.color }} />
                        <span style={{ color: 'var(--color-text-secondary)' }}>{pc.label}</span>
                    </div>
                    {task.deadline ? (
                        <span 
                            className="flex items-center gap-1 font-semibold" 
                            style={{ color: isOverdue ? '#EF4444' : 'var(--color-text-secondary)' }}
                        >
                            <Calendar size={11} />
                            {isOverdue && <span className="uppercase text-[9px] tracking-wider">Overdue · </span>}
                            {new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>No date</span>
                    )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-3 mt-1 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                    <span className="flex items-center gap-1 truncate max-w-[130px]" style={{ color: 'var(--color-text-secondary)' }} title={`Assigned by: ${creatorName}`}>
                        <User2 size={12} />
                        <span className="truncate">{creatorName}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

function Column({ id, title, tasks }: { id: string; title: string; tasks: GlobalTask[] }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    
    return (
        <div
            ref={setNodeRef}
            className={`flex-1 rounded-3xl border p-5 flex flex-col gap-4 min-h-[500px] transition-colors ${isOver ? 'bg-black/5' : ''}`}
            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
        >
            <h3 className="font-bold text-sm mb-1 flex items-center justify-between uppercase tracking-wide" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                {title}
            </h3>
            {tasks.map(t => <TaskCard key={t._id} task={t} />)}
            {tasks.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs font-medium border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}>
                    No tasks here
                </div>
            )}
        </div>
    );
}

export default function DailyTodosBoard() {
    const { allTasks, currentUserId, updateTask } = useGlobalTasks();

    const isToday = (dateVal?: string | Date) => {
        if (!dateVal) return false;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    // Filter logic: Include if user is assigned OR user created it.
    const filterAndSort = (status: GlobalTask['status'], sortNewestFirst = false) => {
        const filtered = allTasks.filter(t => {
            if (t.status !== status) return false;
            
            if (status === 'completed') {
                if (!isToday(t.completedAt) && !isToday(t.updatedAt)) {
                    return false;
                }
            }

            const isAssigned = Array.isArray(t.assignees) && t.assignees.some(a => getEntityId(a) === currentUserId);
            if (isAssigned) return true;

            const isCreator = getEntityId(t.createdBy) === currentUserId;
            const hasOtherAssignees = Array.isArray(t.assignees) && t.assignees.length > 0;

            if (isCreator && !hasOtherAssignees) return true;
            
            return false;
        });

        if (sortNewestFirst) {
            filtered.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA; // Descending (newest first)
            });
        }
        return filtered;
    };

    const todoTasks = useMemo(() => filterAndSort('todo', true), [allTasks, currentUserId]);
    const inProgressTasks = useMemo(() => filterAndSort('in-progress'), [allTasks, currentUserId]);
    const pausedTasks = useMemo(() => filterAndSort('paused'), [allTasks, currentUserId]);
    const completedTasks = useMemo(() => filterAndSort('completed', true).slice(0, 4), [allTasks, currentUserId]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        
        const taskId = active.id as string;
        const targetStatus = over.id as GlobalTask['status'];
        
        const task = allTasks.find(t => t._id === taskId);
        if (!task) return;

        if (task.status !== targetStatus) {
            updateTask(task._projectId, task._id, { status: targetStatus });
        }
    };

    return (
        <div className="pt-2 pb-10">
            <DndContext onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                    <Column id="todo" title="Todo" tasks={todoTasks} />
                    <Column id="in-progress" title="In Progress" tasks={inProgressTasks} />
                    <Column id="paused" title="Paused" tasks={pausedTasks} />
                    <Column id="completed" title="Completed" tasks={completedTasks} />
                </div>
            </DndContext>
        </div>
    );
}
