import { useParams } from 'react-router-dom';
import { useGetMeetingsQuery, useCreateMeetingMutation } from '@/features/project';
import { useState } from 'react';

export default function ProjectMeetingsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useGetMeetingsQuery({ projectId: projectId! });
    const meetings = data?.data || [];

    const [createMeeting] = useCreateMeetingMutation();

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
            participants: [],
        };

        try {
            await createMeeting({ projectId: projectId!, data: meetingData }).unwrap();
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create meeting:', error);
        }
    };

    if (isLoading) {
        return <div>Loading meetings...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Meetings</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Schedule Meeting
                </button>
            </div>

            {/* Meeting Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Schedule Meeting</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                name="description"
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Type</label>
                                <select
                                    name="type"
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="internal">Internal</option>
                                    <option value="external">External</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                                <input
                                    type="number"
                                    name="duration"
                                    defaultValue={60}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Scheduled At</label>
                                <input
                                    type="datetime-local"
                                    name="scheduledAt"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Schedule
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Meeting List */}
            <div className="space-y-3">
                {meetings.map((meeting) => (
                    <div
                        key={meeting._id}
                        className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-semibold text-lg">{meeting.title}</h3>
                                <p className="text-sm text-gray-600">
                                    {new Date(meeting.scheduledAt).toLocaleString()}
                                </p>
                            </div>
                            <span
                                className={`px-3 py-1 rounded text-sm ${meeting.type === 'internal'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-purple-100 text-purple-800'
                                    }`}
                            >
                                {meeting.type}
                            </span>
                        </div>

                        {meeting.description && (
                            <p className="text-gray-600 mb-3">{meeting.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>📍 {meeting.location || 'No location'}</span>
                            <span>⏱️ {meeting.duration} min</span>
                            <span>👥 {meeting.participants.length} participants</span>
                        </div>
                    </div>
                ))}

                {meetings.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No meetings scheduled. Schedule your first meeting!
                    </div>
                )}
            </div>
        </div>
    );
}
