import { Plus, StickyNote } from 'lucide-react';

interface NotesEmptyStateProps {
    onCreateNote: () => void;
}

export function NotesEmptyState({ onCreateNote }: NotesEmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                <StickyNote size={24} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>No notes yet</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>Capture ideas, decisions, or anything worth remembering.</p>
            <button
                onClick={onCreateNote}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
            >
                <Plus size={15} /> Create First Note
            </button>
        </div>
    );
}
