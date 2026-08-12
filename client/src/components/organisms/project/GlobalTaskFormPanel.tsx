import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, FolderKanban, User, Calendar, Clock, AlignLeft, Flag, CheckCircle2, Repeat } from 'lucide-react';
import type { Project } from '@/features/project';
import type { GlobalTask } from '@/hooks/useGlobalTasks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewTaskFormData {
    title: string;
    taskType: 'project' | 'individual';
    projectId: string;
    status: 'todo' | 'in-progress' | 'paused' | 'completed';
    priority: 'low' | 'medium' | 'high' | 'critical';
    deadline: string;       // ISO date string or ''
    timeSpentHours: number;
    timeSpentMins: number;
    description: string;
    isRecurring: boolean;
    recurrenceFreq: 'daily' | 'weekly';
    recurrenceEndDate: string;
    recurrenceDays: number[]; // 0-6
}

interface GlobalTaskFormPanelProps {
    projects: Project[];
    isCreating: boolean;
    onClose: () => void;
    onSubmit: (data: NewTaskFormData) => Promise<void>;
    defaultProjectId?: string;
    initialData?: GlobalTask;
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
    { value: 'low',      label: 'Low',      color: '#10B981' },
    { value: 'medium',   label: 'Medium',   color: '#F59E0B' },
    { value: 'high',     label: 'High',     color: '#EA580C' },
    { value: 'critical', label: 'Critical', color: '#EF4444' },
] as const;

const STATUS_OPTIONS = [
    { value: 'todo',        label: 'To Do'       },
    { value: 'in-progress', label: 'In Progress'  },
    { value: 'paused',      label: 'Paused'       },
    { value: 'completed',   label: 'Completed'    },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalTaskFormPanel({
    projects,
    isCreating,
    onClose,
    onSubmit,
    defaultProjectId = '',
    initialData
}: GlobalTaskFormPanelProps) {
    const [form, setForm] = useState<NewTaskFormData>({
        title: initialData?.title || '',
        taskType: initialData ? (initialData._projectId ? 'project' : 'individual') : (defaultProjectId ? 'project' : 'individual'),
        projectId: initialData?._projectId || defaultProjectId,
        status: initialData?.status || 'todo',
        priority: initialData?.priority || 'medium',
        deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().slice(0, 10) : '',
        timeSpentHours: initialData?.estimatedHours ? Math.floor(initialData.estimatedHours) : 0,
        timeSpentMins: initialData?.estimatedHours ? Math.round((initialData.estimatedHours % 1) * 60) : 0,
        description: initialData?.description || '',
        isRecurring: false,
        recurrenceFreq: 'daily',
        recurrenceEndDate: '',
        recurrenceDays: [],
    });
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => setVisible(true), 12);
        return () => window.clearTimeout(id);
    }, []);

    const handleClose = () => {
        setVisible(false);
        window.setTimeout(onClose, 280);
    };

    const set = <K extends keyof NewTaskFormData>(key: K, value: NewTaskFormData[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        await onSubmit(form);
        handleClose();
    };

    const inputStyle: React.CSSProperties = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[200] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
                onClick={handleClose}
            />
            {/* Panel */}
            <div
                className={`fixed top-0 right-0 h-full z-[201] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? 'translate-x-0' : 'translate-x-full'}`}
                style={{
                    width: 'min(520px, 100vw)',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderLeft: '1px solid var(--color-border-default)',
                    boxShadow: '-16px 0 48px rgba(0,0,0,0.13)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'var(--color-primary-soft)' }}
                        >
                            <CheckCircle2 size={16} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {initialData ? 'Edit Task' : 'New Task'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Task Title <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            placeholder="What needs to be done?"
                            autoFocus
                            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                            style={inputStyle}
                            required
                        />
                    </div>

                    {/* Task type toggle */}
                    <div>
                        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Task Type
                        </label>
                        <div
                            className="flex gap-1 p-1 rounded-xl"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
                        >
                            {(['project', 'individual'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => set('taskType', type)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
                                    style={{
                                        backgroundColor: form.taskType === type ? 'var(--color-bg-surface)' : 'transparent',
                                        color: form.taskType === type ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                        boxShadow: form.taskType === type ? 'var(--shadow-xs)' : 'none',
                                    }}
                                >
                                    {type === 'project' ? <FolderKanban size={13} /> : <User size={13} />}
                                    {type === 'project' ? 'Project Task' : 'Individual Task'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Project selector (only for project tasks) */}
                    {form.taskType === 'project' && (
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                <FolderKanban size={12} className="inline mr-1" />
                                Project
                            </label>
                            <select
                                value={form.projectId}
                                onChange={e => set('projectId', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none disabled:opacity-50"
                                style={inputStyle}
                            >
                                <option value="">Select a project…</option>
                                {projects.map(p => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={e => set('status', e.target.value as NewTaskFormData['status'])}
                                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none"
                                style={inputStyle}
                            >
                                {STATUS_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                <Flag size={12} className="inline mr-1" />
                                Priority
                            </label>
                            <div className="flex gap-1">
                                {PRIORITY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        title={opt.label}
                                        onClick={() => set('priority', opt.value)}
                                        className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all"
                                        style={{
                                            borderColor: form.priority === opt.value ? opt.color : 'var(--color-border-default)',
                                            backgroundColor: form.priority === opt.value ? opt.color + '18' : 'transparent',
                                            color: form.priority === opt.value ? opt.color : 'var(--color-text-muted)',
                                        }}
                                    >
                                        {opt.label[0]}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
                                {PRIORITY_OPTIONS.find(o => o.value === form.priority)?.label}
                            </p>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            <Calendar size={12} className="inline mr-1" />
                            Due Date <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={form.deadline}
                            onChange={e => set('deadline', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                            style={inputStyle}
                        />
                    </div>

                    {/* Recurrence (Repeat Task) */}
                    {!initialData && (
                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold mb-2 cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                                <input 
                                    type="checkbox" 
                                    checked={form.isRecurring}
                                    onChange={e => set('isRecurring', e.target.checked)}
                                    className="rounded"
                                />
                                <Repeat size={14} className="inline" />
                                Repeat Task
                            </label>
                            
                            {form.isRecurring && (
                                <div className="p-3 rounded-xl border mt-2 space-y-3" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                    <div>
                                        <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Frequency</label>
                                        <select
                                            value={form.recurrenceFreq}
                                            onChange={e => set('recurrenceFreq', e.target.value as 'daily' | 'weekly')}
                                            className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none appearance-none"
                                            style={inputStyle}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                        </select>
                                    </div>
                                    
                                    {form.recurrenceFreq === 'weekly' && (
                                        <div>
                                            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Repeat on</label>
                                            <div className="flex gap-1 flex-wrap">
                                                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                                                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                    const isSelected = form.recurrenceDays.includes(day);
                                                    return (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    set('recurrenceDays', form.recurrenceDays.filter(d => d !== day));
                                                                } else {
                                                                    set('recurrenceDays', [...form.recurrenceDays, day]);
                                                                }
                                                            }}
                                                            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${isSelected ? 'border-primary' : ''}`}
                                                            style={{
                                                                backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                                                color: isSelected ? '#fff' : 'var(--color-text-muted)',
                                                                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border-default)'
                                                            }}
                                                        >
                                                            {dayNames[day]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>End Date (Required)</label>
                                        <input
                                            type="date"
                                            required={form.isRecurring}
                                            value={form.recurrenceEndDate}
                                            onChange={e => set('recurrenceEndDate', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time Spent */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            <Clock size={12} className="inline mr-1" />
                            Time Spent <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={form.timeSpentHours || ''}
                                    onChange={e => set('timeSpentHours', parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none text-center"
                                    style={inputStyle}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-muted)' }}>h</span>
                            </div>
                            <span style={{ color: 'var(--color-text-muted)' }}>:</span>
                            <div className="flex-1 relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={form.timeSpentMins || ''}
                                    onChange={e => set('timeSpentMins', Math.min(59, parseInt(e.target.value) || 0))}
                                    placeholder="0"
                                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none text-center"
                                    style={inputStyle}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-muted)' }}>m</span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            <AlignLeft size={12} className="inline mr-1" />
                            Description <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
                        </label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Add any notes or details…"
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                            style={inputStyle}
                        />
                    </div>

                    {/* Spacer for footer */}
                    <div className="h-4" />
                </form>

                {/* Footer */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm rounded-xl border transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isCreating || !form.title.trim() || (form.taskType === 'project' && !form.projectId)}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isCreating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {initialData ? 'Save Changes' : 'Create Task'}
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
}
