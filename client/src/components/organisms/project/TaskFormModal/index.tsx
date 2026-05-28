import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import type { Task } from '@/features/project';
import { Avatar } from '@/components/atoms/Avatar';
import { getEntityId } from '@/lib/utils/entity';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

export interface TaskFormModalProps {
    editingTask: Task | null;
    isCreating: boolean;
    selectedAssignees: string[];
    projectMembers: unknown[];
    estDays: number;
    estHrs: number;
    estMins: number;
    setEstDays: (n: number) => void;
    setEstHrs: (n: number) => void;
    setEstMins: (n: number) => void;
    toggleAssignee: (uid: string) => void;
    onClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
    editingTask,
    isCreating,
    selectedAssignees,
    projectMembers,
    estDays, estHrs, estMins,
    setEstDays, setEstHrs, setEstMins,
    toggleAssignee,
    onClose,
    onSubmit,
}) => {
    useBodyScrollLock(true);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[200]" style={{ backgroundColor: 'rgba(0,0,0,0.20)' }} onClick={onClose} />
            <div
                className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                style={{ width: 'min(520px, 100vw)', backgroundColor: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-default)', boxShadow: '-12px 0 48px rgba(0,0,0,0.14)' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} title="Close">
                        <X size={16} />
                    </button>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{editingTask ? 'Edit Task' : 'New Task'}</span>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    <form id="task-form" onSubmit={onSubmit}>
                        {/* Title */}
                        <div className="px-6 pt-6 pb-3">
                            <input type="text" name="title" defaultValue={editingTask?.title} required autoFocus
                                className="w-full text-2xl font-bold bg-transparent outline-none pb-1"
                                placeholder="Task title…"
                                style={{ color: 'var(--color-text-primary)', borderBottom: '2px solid transparent', transition: 'border-color 0.15s' }}
                                onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                            />
                        </div>

                        {/* Property table */}
                        <div className="mx-6 mb-5 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                            {[
                                { label: 'Status', name: 'status', value: editingTask?.status || 'todo', options: [['todo', 'To Do'], ['in-progress', 'In Progress'], ['paused', 'Paused'], ['completed', 'Completed']] },
                                { label: 'Priority', name: 'priority', value: editingTask?.priority || 'medium', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']] },
                            ].map(({ label, name, value, options }) => (
                                <div key={name} className="flex items-center border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs font-medium px-4 py-2.5 w-36 flex-shrink-0 border-r" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>{label}</span>
                                    <select name={name} defaultValue={value as string} className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: 'var(--color-text-primary)' }}>
                                        {(options as [string, string][]).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                                    </select>
                                </div>
                            ))}
                            {[
                                { label: 'Start Date', name: 'startDate', value: editingTask?.startDate?.toString().split('T')[0] },
                                { label: 'Deadline', name: 'deadline', value: editingTask?.deadline?.toString().split('T')[0] },
                            ].map(({ label, name, value }) => (
                                <div key={name} className="flex items-center border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <span className="text-xs font-medium px-4 py-2.5 w-36 flex-shrink-0 border-r" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>{label}</span>
                                    <input type="date" name={name} defaultValue={value} className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: 'var(--color-text-primary)' }} />
                                </div>
                            ))}

                            {/* Estimated time */}
                            <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <span className="text-xs font-medium px-4 py-2.5 w-36 flex-shrink-0 border-r" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>Est. Time</span>
                                <div className="flex items-center gap-2 px-3 py-2">
                                    {([['d', estDays, setEstDays, 999], ['h', estHrs, setEstHrs, 23], ['m', estMins, setEstMins, 59]] as [string, number, (n: number) => void, number][]).map(([unit, val, setter, max]) => (
                                        <div key={unit} className="flex items-center gap-1">
                                            <input type="number" value={val} onChange={e => setter(Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))} min={0} max={max}
                                                className="w-12 px-1.5 py-1 rounded-md border text-xs text-center outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                                            />
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Assignees */}
                            <div className="flex items-start">
                                <span className="text-xs font-medium px-4 py-3 w-36 flex-shrink-0 border-r self-stretch flex items-start pt-3" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>Assignees</span>
                                <div className="flex-1 px-3 py-2.5">
                                    {selectedAssignees.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {selectedAssignees.map(userId => {
                                                const m = (projectMembers as Record<string, unknown>[]).find(member => {
                                                    const empId = typeof member.employeeId === 'object' ? member.employeeId as Record<string, unknown> : null;
                                                    const uid = empId ? getEntityId(empId.userId) : getEntityId(member.userId);
                                                    return uid === userId;
                                                });
                                                const empId = m?.employeeId as Record<string, unknown> | null;
                                                const name = (typeof empId === 'object' && empId && typeof empId.userId === 'object') ? (empId.userId as Record<string, unknown>).name as string : (typeof m?.userId === 'object' ? (m?.userId as Record<string, unknown>).name as string : 'User');
                                                return (
                                                    <div key={userId} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                                        <span>{name}</span>
                                                        <button type="button" onClick={() => toggleAssignee(userId)} className="rounded hover:bg-black/10"><X size={10} /></button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className="border rounded-lg max-h-32 overflow-y-auto" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {(projectMembers as Record<string, unknown>[]).length === 0 ? (
                                            <div className="p-2.5 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>No team members yet.</div>
                                        ) : (
                                            (projectMembers as Record<string, unknown>[]).map((member) => {
                                                const empId = typeof member.employeeId === 'object' ? member.employeeId as Record<string, unknown> : null;
                                                const userId = empId ? getEntityId(empId.userId) : getEntityId(member.userId);
                                                const name = empId && typeof empId.userId === 'object' ? (empId.userId as Record<string, unknown>).name as string : typeof member.userId === 'object' ? (member.userId as Record<string, unknown>).name as string : 'User';
                                                const photoUrl = (empId as Record<string, unknown> | null)?.profilePhoto as string || null;
                                                const isSelected = selectedAssignees.includes(userId);
                                                return (
                                                    <div key={userId} onClick={() => toggleAssignee(userId)}
                                                        className={`flex items-center gap-2 p-2 cursor-pointer text-xs border-b last:border-0 transition-colors ${isSelected ? '' : 'hover:bg-black/[0.03]'}`}
                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'transparent' }}
                                                    >
                                                        <input type="checkbox" readOnly checked={isSelected} className="rounded border-gray-300 pointer-events-none" />
                                                        <Avatar name={name} photoUrl={photoUrl} size={20} selected={isSelected} />
                                                        <span style={{ color: 'var(--color-text-primary)' }}>{name}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="px-6 pb-6">
                            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                            <textarea name="description" defaultValue={editingTask?.description} rows={6}
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
                    <button type="submit" form="task-form" disabled={isCreating} className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ height: '34px', backgroundColor: 'var(--color-primary)' }}>
                        {isCreating && <Loader2 size={14} className="animate-spin" />}
                        {editingTask ? 'Update Task' : 'Create Task'}
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
};
