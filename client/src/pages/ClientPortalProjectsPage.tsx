import { FolderKanban } from 'lucide-react';

export default function ClientPortalProjectsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: '#F1F5F9' }}
            >
                <FolderKanban size={26} style={{ color: '#94A3B8' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#1E293B' }}>
                Select a project
            </h2>
            <p className="text-sm max-w-xs" style={{ color: '#94A3B8' }}>
                Choose a project from the sidebar to view its details, tasks, meetings, and shared files.
            </p>
        </div>
    );
}
