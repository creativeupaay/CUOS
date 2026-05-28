import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { Task } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { StatusDropdown } from '../StatusDropdown';
import { STATUS_STYLES, PRIORITY_STYLES } from '@/data/project/taskConstants';

export interface SubtaskRowProps {
    subtask: Task;
    projectId: string;
    currentUserId: string;
    isProjectManager: boolean;
    onEdit: (subtask: Task) => void;
}

export const SubtaskRow: React.FC<SubtaskRowProps> = ({
    subtask,
    projectId,
    currentUserId,
    isProjectManager,
    onEdit,
}) => {
    const subS = STATUS_STYLES[subtask.status] || STATUS_STYLES.todo;
    const subP = PRIORITY_STYLES[subtask.priority] || PRIORITY_STYLES.medium;

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onEdit(subtask); }}
            className="group/sub grid grid-cols-12 gap-4 items-center py-2.5 pl-4 pr-3 rounded-lg text-xs border cursor-pointer transition-all hover:shadow-sm"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
                borderLeft: `3px solid ${subS.dot}`,
            }}
        >
            <div className="col-span-12 md:col-span-5 flex items-center gap-2 min-w-0">
                <span className="flex-1 font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{subtask.title}</span>
            </div>

            <div className="hidden md:flex col-span-2">
                <StatusDropdown task={subtask} projectId={projectId} currentUserId={currentUserId} canManage={isProjectManager} size="xs" />
            </div>

            <div className="hidden md:flex col-span-2 items-center">
                {subtask.assignees.length > 0 ? (
                    <div className="flex -space-x-1.5">
                        {subtask.assignees.slice(0, 4).map((assignee: unknown, index: number) => {
                            const name = (assignee as unknown as Record<string, unknown>).name as string || 'User';
                            const photoUrl = (assignee as unknown as Record<string, unknown>).profilePhoto as string || null;
                            return (
                                <Avatar key={index} name={name} photoUrl={photoUrl} size={24} ring />
                            );
                        })}
                    </div>
                ) : (
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
            </div>

            <div className="hidden md:block col-span-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {subtask.deadline ? new Date(subtask.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            </div>

            <div className="hidden md:block col-span-1">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: subP.bg, color: subP.text }}>
                    {subtask.priority}
                </span>
            </div>

            <div className="hidden md:flex col-span-1 justify-end">
                <ChevronRight size={12} className="opacity-0 group-hover/sub:opacity-50 transition-opacity flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            </div>
        </div>
    );
};
