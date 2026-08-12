import React from 'react';
import { ListTodo } from 'lucide-react';
import type { Task } from '@/features/project';
import { TaskCard } from '@/components/molecules/project/TaskCard';

export interface TaskListViewProps {
    tasks: Task[];
    projectId: string;
    onEdit: (t: Task) => void;
    onDelete: (id: string) => void;
    onSubtaskEdit: (sub: Task) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
    tasks,
    projectId,
    onEdit,
    onDelete,
    onSubtaskEdit,
}) => (
    <div className="space-y-2">
        {tasks.length > 0 && (
            <div
                className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium border-b"
                style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="col-span-4 flex items-center gap-2">Task name</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Assignee</div>
                <div className="col-span-1">Due</div>
                <div className="col-span-1">Priority</div>
                <div className="col-span-1">Time Logged</div>
                <div className="col-span-1 text-right">Actions</div>
            </div>
        )}

        {tasks.map((task) => (
            <TaskCard
                key={task._id}
                task={task}
                projectId={projectId}
                onEdit={onEdit}
                onDelete={onDelete}
                onSubtaskEdit={onSubtaskEdit}
            />
        ))}

        {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                >
                    <ListTodo size={20} />
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No tasks yet</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Create your first task to get started</p>
            </div>
        )}
    </div>
);
