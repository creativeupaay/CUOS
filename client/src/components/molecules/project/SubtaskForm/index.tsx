import React from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Task } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { getEntityId } from '@/lib/utils/entity';

export interface SubtaskFormProps {
    parentTask: Task;
    subSelectedAssignees: string[];
    isCreatingSubtask: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    toggleSubAssignee: (uid: string) => void;
}

export const SubtaskForm: React.FC<SubtaskFormProps> = ({
    parentTask,
    subSelectedAssignees,
    isCreatingSubtask,
    onClose,
    onSubmit,
    toggleSubAssignee,
}) => {
    const subInputStyle = {
        height: '32px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
        fontSize: '12px',
    };

    return (
        <form
            onSubmit={onSubmit}
            className="mx-3 mb-3 p-3 rounded-lg border space-y-3"
            style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-primary)', borderStyle: 'dashed' }}
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>New Subtask</p>
                <button type="button" onClick={onClose} className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                    <X size={12} />
                </button>
            </div>

            <input
                name="title"
                required
                autoFocus
                placeholder="Subtask title *"
                className="w-full px-2.5 rounded-md border outline-none"
                style={subInputStyle}
            />

            <div className="grid grid-cols-3 gap-2">
                <select name="status" defaultValue="todo" className="px-2 rounded-md border outline-none" style={subInputStyle}>
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                </select>
                <select name="priority" defaultValue="medium" className="px-2 rounded-md border outline-none" style={subInputStyle}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
                <input type="date" name="deadline" className="px-2 rounded-md border outline-none" style={subInputStyle} />
            </div>

            {parentTask.assignees.length > 0 && (
                <div>
                    <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Assign to (task members only)</p>
                    <div className="flex flex-wrap gap-1.5">
                        {parentTask.assignees.map((assignee: unknown) => {
                            const a = assignee as Record<string, unknown>;
                            const uid = getEntityId(assignee);
                            const mName = (a.name as string) || 'User';
                            const mPhoto = (a.profilePhoto as string) || null;
                            const sel = subSelectedAssignees.includes(uid);
                            return (
                                <button key={uid} type="button" onClick={() => toggleSubAssignee(uid)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors"
                                    style={{ borderColor: sel ? 'var(--color-primary)' : 'var(--color-border-default)', backgroundColor: sel ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)', color: sel ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                >
                                    <Avatar name={mName} photoUrl={mPhoto} size={14} selected={sel} />
                                    {mName}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex gap-2 pt-0.5">
                <button type="submit" disabled={isCreatingSubtask} className="flex items-center gap-1 px-3 text-[11px] font-semibold text-white rounded-md disabled:opacity-50" style={{ height: '28px', backgroundColor: 'var(--color-primary)' }}>
                    {isCreatingSubtask && <Loader2 size={10} className="animate-spin" />}
                    Add
                </button>
                <button type="button" onClick={onClose} className="px-3 text-[11px] font-medium rounded-md border" style={{ height: '28px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}>
                    Cancel
                </button>
            </div>
        </form>
    );
};
