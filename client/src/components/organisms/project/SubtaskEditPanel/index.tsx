import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X, CheckCircle2, Loader2 } from 'lucide-react';
import type { Task } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { getEntityId } from '@/lib/utils/entity';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

export interface SubtaskEditPanelProps {
    subtask: Task;
    parentTask: Task;
    isUpdating: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    editAssignees: string[];
    toggleEditAssignee: (uid: string) => void;
}

export const SubtaskEditPanel: React.FC<SubtaskEditPanelProps> = ({
    subtask,
    parentTask,
    isUpdating,
    onClose,
    onSubmit,
    editAssignees,
    toggleEditAssignee,
}) => {
    useBodyScrollLock(true);

    return createPortal(
        <>
            <div
                className="fixed inset-0 z-[200]"
                style={{ backgroundColor: 'rgba(0,0,0,0.20)' }}
                onClick={onClose}
            />
            <div
                className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                style={{
                    width: 'min(480px, 100vw)',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderLeft: '1px solid var(--color-border-default)',
                    boxShadow: '-12px 0 48px rgba(0,0,0,0.14)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} title="Close">
                        <X size={16} />
                    </button>
                    <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="truncate max-w-[140px]">{parentTask.title}</span>
                        <ChevronRight size={11} className="flex-shrink-0" />
                        <span className="flex-shrink-0 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Subtask</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    <form id="subtask-edit-form" onSubmit={onSubmit}>
                        <div className="px-6 pt-6 pb-3">
                            <input
                                name="title"
                                required
                                autoFocus
                                defaultValue={subtask.title}
                                className="w-full text-xl font-bold bg-transparent outline-none pb-1"
                                placeholder="Subtask title…"
                                style={{ color: 'var(--color-text-primary)', borderBottom: '2px solid transparent', transition: 'border-color 0.15s' }}
                                onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                            />
                        </div>

                        {/* Property table */}
                        <div className="mx-6 mb-5 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                            {[
                                { label: 'Status', name: 'status', type: 'select', value: subtask.status, options: [['todo', 'To Do'], ['in-progress', 'In Progress'], ['paused', 'Paused'], ['completed', 'Completed']] },
                                { label: 'Priority', name: 'priority', type: 'select', value: subtask.priority, options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']] },
                            ].map(({ label, name, value, options }) => (
                                <div key={name} className="flex items-center border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs font-medium px-4 py-2.5 w-32 flex-shrink-0 border-r" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>{label}</span>
                                    <select name={name} defaultValue={value as string} className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: 'var(--color-text-primary)' }}>
                                        {(options as [string, string][]).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                                    </select>
                                </div>
                            ))}
                            <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <span className="text-xs font-medium px-4 py-2.5 w-32 flex-shrink-0 border-r" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>Deadline</span>
                                <input type="date" name="deadline" defaultValue={subtask.deadline?.toString().split('T')[0]} className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: 'var(--color-text-primary)' }} />
                            </div>
                            {parentTask.assignees.length > 0 && (
                                <div className="flex items-start">
                                    <span className="text-xs font-medium px-4 py-3 w-32 flex-shrink-0 border-r self-stretch flex items-start pt-3" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>Assignees</span>
                                    <div className="flex-1 px-3 py-2.5 flex flex-wrap gap-1.5">
                                        {parentTask.assignees.map((a) => {
                                            const uid = getEntityId(a);
                                            const name = (a as unknown as Record<string, unknown>).name as string || 'User';
                                            const aPhoto = (a as unknown as Record<string, unknown>).profilePhoto as string || null;
                                            const sel = editAssignees.includes(uid);
                                            return (
                                                <button key={uid} type="button" onClick={() => toggleEditAssignee(uid)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                                    style={{ borderColor: sel ? 'var(--color-primary)' : 'var(--color-border-default)', backgroundColor: sel ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)', color: sel ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                                >
                                                    <Avatar name={name} photoUrl={aPhoto} size={16} selected={sel} />
                                                    {name}
                                                    {sel && <CheckCircle2 size={10} style={{ color: 'var(--color-primary)' }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="px-6 pb-6">
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                            <textarea name="description" defaultValue={subtask.description} rows={5}
                                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                                placeholder="Add a description…"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t flex justify-end gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <button type="button" onClick={onClose} className="px-4 text-sm font-medium rounded-lg border transition-colors" style={{ height: '34px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}>
                        Cancel
                    </button>
                    <button type="submit" form="subtask-edit-form" disabled={isUpdating} className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ height: '34px', backgroundColor: 'var(--color-primary)' }}>
                        {isUpdating && <Loader2 size={14} className="animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};
