import { useParams } from 'react-router-dom';
import { useGetMeetingsQuery, useCreateMeetingMutation, useDeleteMeetingMutation, type Meeting } from '@/features/project';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, Video, Trash2, Calendar, Users, Link2, BookOpen, X, ExternalLink } from 'lucide-react';
import { logger } from '@/utils/logger';
import { ProjectTabHeader } from '@/components/organisms/ProjectTabHeader';



export default function ProjectMeetingsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [activeTab, setActiveTab] = useState<Meeting['type']>('internal');

    useBodyScrollLock(showForm);

    const { data, isLoading } = useGetMeetingsQuery({ projectId: projectId! });
    const meetings = data?.data || [];

    const internalCount = meetings.filter((m: Meeting) => m.type === 'internal').length;
    const externalCount = meetings.filter((m: Meeting) => m.type === 'external').length;
    const filteredMeetings = meetings.filter((m: Meeting) => m.type === activeTab);

    const [createMeeting, { isLoading: isCreating }] = useCreateMeetingMutation();
    const [deleteMeeting] = useDeleteMeetingMutation();

    const [form, setForm] = useState({ purpose: '', members: '', datetime: '', notesLink: '', type: 'internal' as Meeting['type'] });
    const setField = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.purpose || !form.datetime) { alert('Purpose and Date/Time are required.'); return; }
        try {
            await createMeeting({
                projectId: projectId!,
                data: {
                    title: form.purpose,
                    description: form.members,
                    scheduledAt: form.datetime,
                    notes: form.notesLink,
                    type: form.type,
                    participants: [],
                    duration: 1,
                }
            }).unwrap();
            setForm({ purpose: '', members: '', datetime: '', notesLink: '', type: activeTab });
            closeForm();
        } catch (err) {
            logger.error('Failed to save meeting:', err);
            alert('Failed to save meeting. Please try again.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this meeting?')) return;
        try { await deleteMeeting({ projectId: projectId!, id }).unwrap(); } catch (e) { logger.error(e); }
    };

    const openForm = (type: Meeting['type']) => {
        setForm({ purpose: '', members: '', datetime: '', notesLink: '', type });
        setShowForm(true);
        setTimeout(() => setIsAnimating(true), 10);
    };

    const closeForm = () => {
        setIsAnimating(false);
        setTimeout(() => setShowForm(false), 300);
    };

    const inputCls = 'w-full px-3 rounded-lg border text-sm outline-none transition-colors';
    const inputSty = {
        height: '38px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };
    const labelCls = 'block text-xs font-semibold mb-1.5';
    const labelSty = { color: 'var(--color-text-secondary)' };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
            });
        } catch { return iso; }
    };

    return (
        <div className="space-y-5">

            {/* Header */}
            <ProjectTabHeader
                title="Meetings"
                icon={Video}
                rightElement={
                    !showForm ? (
                        <button
                            onClick={() => openForm(activeTab)}
                            className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors"
                            style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}>
                            <Plus size={15} /> Add Meeting
                        </button>
                    ) : undefined
                }
            />

            {/* Sub-tabs: Internal / External */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                {(['internal', 'external'] as Meeting['type'][]).map(tab => {
                    const count = tab === 'internal' ? internalCount : externalCount;
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); closeForm(); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all"
                            style={{
                                backgroundColor: isActive ? 'var(--color-bg-surface)' : 'transparent',
                                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            }}>
                            {tab === 'internal' ? 'Internal' : 'External'}
                            <span className="text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-body)',
                                    color: isActive ? '#fff' : 'var(--color-text-muted)',
                                }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Add Meeting Form (Side Panel Dialog) */}
            {showForm && createPortal(
                <>
                    {/* Dim backdrop */}
                    <div
                        className={`fixed inset-0 z-[200] transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundColor: 'rgba(0,0,0,0.20)' }}
                        onClick={closeForm}
                    />
                    {/* Side panel — slides from right */}
                    <div
                        className={`fixed top-0 right-0 h-full z-[201] flex flex-col transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : 'translate-x-full'}`}
                        style={{
                            width: 'min(480px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-12px 0 48px rgba(0,0,0,0.14)',
                        }}
                    >
                        {/* Panel header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            <button
                                onClick={closeForm}
                                className="p-1.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
                                style={{ color: 'var(--color-text-muted)' }}
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                New Meeting Entry
                            </span>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <form id="meeting-form" onSubmit={handleSubmit} className="space-y-5">
                                {/* Meeting Type Toggle */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Type *</label>
                                    <div className="flex gap-2">
                                        {(['internal', 'external'] as Meeting['type'][]).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setField('type', t)}
                                                className="flex-1 py-2 text-sm font-medium rounded-lg border transition-all"
                                                style={{
                                                    borderColor: form.type === t ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                    backgroundColor: form.type === t ? 'var(--color-primary)' : 'transparent',
                                                    color: form.type === t ? '#fff' : 'var(--color-text-secondary)',
                                                }}>
                                                {t === 'internal' ? '🏢 Internal' : '🌐 External'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Purpose */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Purpose *</label>
                                    <input
                                        value={form.purpose}
                                        onChange={e => setField('purpose', e.target.value)}
                                        className={inputCls} style={inputSty}
                                        placeholder="e.g. Sprint Planning, Client Sync…" required />
                                </div>

                                {/* DateTime */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Date &amp; Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.datetime}
                                        onChange={e => setField('datetime', e.target.value)}
                                        className={inputCls} style={inputSty} required />
                                </div>

                                {/* Members */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Members / Attendees</label>
                                    <input
                                        value={form.members}
                                        onChange={e => setField('members', e.target.value)}
                                        className={inputCls} style={inputSty}
                                        placeholder="e.g. Vinay, Rahul, Priya (comma-separated)" />
                                </div>

                                {/* Notes Link */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Notes Link</label>
                                    <input
                                        type="url"
                                        value={form.notesLink}
                                        onChange={e => setField('notesLink', e.target.value)}
                                        className={inputCls} style={inputSty}
                                        placeholder="https://docs.google.com/… or Notion link" />
                                </div>
                            </form>
                        </div>

                        {/* Panel footer */}
                        <div className="px-5 py-3.5 border-t flex justify-end gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{ height: '34px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="meeting-form"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '34px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                <Plus size={14} /> Save Meeting
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Meeting List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
            ) : filteredMeetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        <Video size={22} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        No {activeTab} meetings logged yet
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Click "Add Meeting" to record one</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredMeetings.map((meeting: Meeting) => {
                        const hasLink = !!meeting.notes;
                        const isExternal = meeting.type === 'external';
                        return (
                            <div key={meeting._id}
                                className="rounded-xl border overflow-hidden"
                                style={{ borderColor: 'var(--color-border-default)' }}>

                                {/* Header bar */}
                                <div className="flex items-center gap-3 px-4 py-3"
                                    style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                            {meeting.title}
                                        </span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: isExternal ? '#FEF3C7' : '#EFF6FF',
                                                color: isExternal ? '#92400E' : '#1D4ED8',
                                            }}>
                                            {isExternal ? '🌐 External' : '🏢 Internal'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {hasLink && (
                                            <a href={meeting.notes} target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors hover:bg-white/5"
                                                style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border-default)' }}>
                                                <BookOpen size={12} /> Notes
                                            </a>
                                        )}
                                        <button onClick={() => handleDelete(meeting._id)}
                                            className="p-1.5 rounded transition-colors hover:bg-red-500/10"
                                            style={{ color: 'var(--color-danger)' }} title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Detail row */}
                                <div className="px-4 py-3 border-t flex flex-wrap gap-x-8 gap-y-2"
                                    style={{ backgroundColor: 'var(--color-bg-body)', borderColor: 'var(--color-border-default)' }}>

                                    {/* Date & Time */}
                                    <div className="flex items-center gap-2">
                                        <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
                                        <div>
                                            <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Date &amp; Time</div>
                                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {formatDate(meeting.scheduledAt)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Members */}
                                    {meeting.description && (
                                        <div className="flex items-center gap-2">
                                            <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
                                            <div>
                                                <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Members</div>
                                                <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                    {meeting.description}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes link full URL */}
                                    {hasLink && (
                                        <div className="flex items-center gap-2">
                                            <Link2 size={13} style={{ color: 'var(--color-text-muted)' }} />
                                            <div>
                                                <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Notes Link</div>
                                                <a href={meeting.notes} target="_blank" rel="noopener noreferrer"
                                                    className="text-sm flex items-center gap-1 hover:underline max-w-xs truncate"
                                                    style={{ color: 'var(--color-primary)' }}>
                                                    {meeting.notes}
                                                    <ExternalLink size={11} />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
