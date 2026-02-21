import { useParams } from 'react-router-dom';
import { useGetMeetingsQuery, useCreateMeetingMutation, useDeleteMeetingMutation } from '@/features/project';
import { useState } from 'react';
import { Plus, Loader2, Video, Trash2, Calendar, Users, Link2, BookOpen, X, ExternalLink } from 'lucide-react';

export default function ProjectMeetingsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useGetMeetingsQuery({ projectId: projectId! });
    const meetings = data?.data || [];

    const [createMeeting, { isLoading: isCreating }] = useCreateMeetingMutation();
    const [deleteMeeting] = useDeleteMeetingMutation();

    const [form, setForm] = useState({ purpose: '', members: '', datetime: '', notesLink: '' });
    const setField = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.purpose || !form.datetime) { alert('Purpose and Date/Time are required.'); return; }
        try {
            await createMeeting({
                projectId: projectId!,
                data: {
                    title: form.purpose,
                    description: form.members,      // reuse description for members
                    scheduledAt: form.datetime,
                    notes: form.notesLink,           // reuse notes field for link
                    type: 'internal',
                    participants: [],
                    duration: 1,
                }
            }).unwrap();
            setForm({ purpose: '', members: '', datetime: '', notesLink: '' });
            setShowForm(false);
        } catch (err) {
            console.error('Failed to save meeting:', err);
            alert('Failed to save meeting. Please try again.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this meeting?')) return;
        try { await deleteMeeting({ projectId: projectId!, id }).unwrap(); } catch (e) { console.error(e); }
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
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Meeting Log
                    </h2>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        {meetings.length}
                    </span>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}>
                        <Plus size={15} /> Add Meeting
                    </button>
                )}
            </div>

            {/* Add Meeting Form */}
            {showForm && (
                <div className="p-5 rounded-xl border shadow-sm"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            New Meeting Entry
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1.5 rounded hover:bg-white/5"
                            style={{ color: 'var(--color-text-muted)' }}>
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Purpose + DateTime — row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls} style={labelSty}>Meeting Purpose *</label>
                                <input
                                    value={form.purpose}
                                    onChange={e => setField('purpose', e.target.value)}
                                    className={inputCls} style={inputSty}
                                    placeholder="e.g. Sprint Planning, Client Sync…" required />
                            </div>
                            <div>
                                <label className={labelCls} style={labelSty}>Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    value={form.datetime}
                                    onChange={e => setField('datetime', e.target.value)}
                                    className={inputCls} style={inputSty} required />
                            </div>
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

                        <div className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                            <button type="submit" disabled={isCreating}
                                className="flex items-center gap-1.5 px-5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                                style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}>
                                {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Save Meeting
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="px-4 text-sm font-medium rounded-lg border"
                                style={{ height: '36px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Meeting List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
            ) : meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        <Video size={22} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No meetings logged yet</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Click "Add Meeting" to record one</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {meetings.map(meeting => {
                        const hasLink = !!meeting.notes;
                        return (
                            <div key={meeting._id}
                                className="rounded-xl border overflow-hidden"
                                style={{ borderColor: 'var(--color-border-default)' }}>

                                {/* Header bar */}
                                <div className="flex items-center gap-3 px-4 py-3"
                                    style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                            {meeting.title}
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
                                            <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Date & Time</div>
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
