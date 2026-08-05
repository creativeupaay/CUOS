import { FolderKanban, CheckCircle2, Lock, Users, FileText } from 'lucide-react';

const FEATURES = [
    { icon: <CheckCircle2 size={16} style={{ color: '#6366F1' }} />, label: 'Task progress', desc: 'See what\'s being worked on' },
    { icon: <Users size={16} style={{ color: '#6366F1' }} />, label: 'Meeting links', desc: 'Join scheduled meetings' },
    { icon: <Lock size={16} style={{ color: '#6366F1' }} />, label: 'Project credentials', desc: 'Access your project logins' },
    { icon: <FileText size={16} style={{ color: '#6366F1' }} />, label: 'Shared files', desc: 'Upload & download documents' },
];

export default function ClientPortalProjectsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 py-12">
            {/* Icon */}
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
            >
                <FolderKanban size={28} className="text-white" />
            </div>

            <h2 className="text-xl font-bold mb-2" style={{ color: '#0F172A' }}>
                Welcome to your portal
            </h2>
            <p className="text-sm max-w-xs leading-relaxed mb-8" style={{ color: '#64748B' }}>
                Select a project from the sidebar to view its details and everything associated with it.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
                {FEATURES.map((f) => (
                    <div
                        key={f.label}
                        className="flex flex-col items-start gap-2 p-4 rounded-xl border text-left"
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                    >
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#EEF2FF' }}
                        >
                            {f.icon}
                        </div>
                        <div>
                            <p className="text-xs font-semibold" style={{ color: '#1E293B' }}>{f.label}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

