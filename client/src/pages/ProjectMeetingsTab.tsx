import { useParams } from 'react-router-dom';
import { useGetMeetingsQuery, useCreateMeetingMutation, useDeleteMeetingMutation } from '@/features/project';
import { useState } from 'react';
import { Plus, Loader2, Video, X, MapPin, Clock, Users, Trash2 } from 'lucide-react';

export default function ProjectMeetingsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useGetMeetingsQuery({ projectId: projectId! });
    const meetings = data?.data || [];

    const [createMeeting, { isLoading: isCreating }] = useCreateMeetingMutation();
    const [deleteMeeting] = useDeleteMeetingMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const meetingData = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            type: formData.get('type') as 'internal' | 'external',
            scheduledAt: formData.get('scheduledAt') as string,
            duration: parseInt(formData.get('duration') as string),
            location: formData.get('location') as string,
            agenda: formData.get('agenda') as string,
            participants: [],
        };

        try {
            await createMeeting({ projectId: projectId!, data: meetingData }).unwrap();
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create meeting:', error);
        }
    };

    const handleDelete = async (meetingId: string) => {
        if (!confirm('Delete this meeting?')) return;
        try {
            await deleteMeeting({ projectId: projectId!, id: meetingId }).unwrap();
        } catch (error) {
            console.error('Failed to delete meeting:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    Loading meetings...
                </div>
            </div>
        );
    }

    const inputStyle = {
        height: '36px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Meetings
                    <span
                        className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        {meetings.length}
                    </span>
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >
                    <Plus size={15} />
                    Schedule Meeting
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Schedule Meeting
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Title *</label>
                            <input type="text" name="title" required className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="Meeting title" />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                            <textarea
                                name="description"
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                placeholder="Meeting description"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
                                <select name="type" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                    <option value="internal">Internal</option>
                                    <option value="external">External</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Duration (min) *</label>
                                <input type="number" name="duration" defaultValue={60} required className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Scheduled At *</label>
                                <input type="datetime-local" name="scheduledAt" required className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Location</label>
                                <input type="text" name="location" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="Zoom / Office" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Agenda</label>
                            <textarea
                                name="agenda"
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                placeholder="Agenda items..."
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                Schedule
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{ height: '36px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Meeting List */}
            <div className="space-y-2">
                {meetings.map((meeting) => {
                    const typeStyle = meeting.type === 'internal'
                        ? { bg: 'var(--color-info-soft)', text: 'var(--color-info)' }
                        : { bg: '#F3E8FF', text: '#7C3AED' };

                    return (
                        <div
                            key={meeting._id}
                            className="p-4 rounded-lg border transition-all"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {meeting.title}
                                    </h3>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                        {new Date(meeting.scheduledAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                                        style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                                    >
                                        {meeting.type}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(meeting._id)}
                                        className="p-1 transition-colors"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {meeting.description && (
                                <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                    {meeting.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                <span className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    {meeting.location || 'No location'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {meeting.duration} min
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users size={12} />
                                    {meeting.participants.length} participants
                                </span>
                            </div>
                        </div>
                    );
                })}

                {meetings.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <Video size={20} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No meetings scheduled</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Schedule your first meeting</p>
                    </div>
                )}
            </div>
        </div>
    );
}
