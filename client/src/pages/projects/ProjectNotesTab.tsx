import { useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetNotesQuery,
    useDeleteNoteMutation,
    useUpdateNoteMutation,
} from '@/features/project';
import type { Project, Note } from '@/features/project';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Pin, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';
import { normalizeMentionableMembers } from '@/utils/notes';
import { getRoleName } from '@/utils/modulePermissions';
import { NoteCard } from '@/components/molecules/NoteCard';
import { NotesEmptyState } from '@/components/atoms/NotesEmptyState';
import { NoteEditorModal } from '@/components/organisms/notes/NoteEditorModal';

export default function ProjectNotesTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const { project } = useOutletContext<{ project: Project }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useSelector((state: RootState) => state.auth.user);

    const isAdmin = ['super-admin', 'super_admin', 'admin'].includes(getRoleName(currentUser?.role));

    const { data, isLoading } = useGetNotesQuery(projectId!);
    const [deleteNote] = useDeleteNoteMutation();
    const [updateNote] = useUpdateNoteMutation();

    const notes: Note[] = useMemo(() => data?.data ?? [], [data?.data]);
    const pinned = useMemo(() => notes.filter((n) => n.isPinned), [notes]);
    const unpinned = useMemo(() => notes.filter((n) => !n.isPinned), [notes]);
    const mentionableMembers = useMemo(() => normalizeMentionableMembers(project), [project]);

    const requestedNoteId = searchParams.get('noteId');
    const requestedBlockId = searchParams.get('blockId') || undefined;
    const requestedMentionId = searchParams.get('mentionId') || undefined;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    const openModal = useCallback((note: Note | null = null) => {
        setEditingNote(note);
        setIsModalOpen(true);
        setTimeout(() => setIsAnimating(true), 10);
    }, []);

    const clearDeepLinkParams = useCallback(() => {
        if (!requestedNoteId && !requestedBlockId && !requestedMentionId) return;
        const next = new URLSearchParams(searchParams);
        next.delete('noteId');
        next.delete('blockId');
        next.delete('mentionId');
        setSearchParams(next, { replace: true });
    }, [requestedBlockId, requestedMentionId, requestedNoteId, searchParams, setSearchParams]);

    const closeModal = useCallback(() => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsModalOpen(false);
            setEditingNote(null);
            clearDeepLinkParams();
        }, 300);
    }, [clearDeepLinkParams]);

    // Open deep-linked note exactly once on load
    useEffect(() => {
        if (!requestedNoteId || isLoading || isModalOpen) return;
        const targetNote = notes.find((n) => n._id === requestedNoteId);
        if (!targetNote) return;
        setEditingNote(targetNote); // eslint-disable-line react-hooks/set-state-in-effect
        setIsModalOpen(true);
        setTimeout(() => setIsAnimating(true), 10);
    }, [isLoading, isModalOpen, notes, requestedNoteId]);

    const handleDelete = async (note: Note) => {
        if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
        try {
            await deleteNote({ projectId: projectId!, noteId: note._id }).unwrap();
        } catch (error) {
            logger.error('Failed to delete note', error);
        }
    };

    const handleTogglePin = async (note: Note) => {
        await updateNote({ projectId: projectId!, noteId: note._id, data: { isPinned: !note.isPinned } }).unwrap();
    };

    const canModify = (note: Note) =>
        isAdmin || (typeof note.createdBy === 'object' ? (note.createdBy as { _id?: string })?._id : note.createdBy) === currentUser?._id;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading notes...</span>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notes</h2>
                    {notes.length > 0 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                            {notes.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={15} /> New Note
                </button>
            </div>

            {notes.length === 0 && <NotesEmptyState onCreateNote={() => openModal()} />}

            {pinned.length > 0 && (
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <Pin size={11} /> Pinned
                    </p>
                    <div className="flex flex-col gap-2">
                        {pinned.map((note) => (
                            <NoteCard key={note._id} note={note} canModify={canModify(note)} isAdmin={isAdmin} onOpen={openModal} onDelete={handleDelete} onTogglePin={handleTogglePin} />
                        ))}
                    </div>
                </div>
            )}

            {unpinned.length > 0 && (
                <div>
                    {pinned.length > 0 && (
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>Other Notes</p>
                    )}
                    <div className="flex flex-col gap-2">
                        {unpinned.map((note) => (
                            <NoteCard key={note._id} note={note} canModify={canModify(note)} isAdmin={isAdmin} onOpen={openModal} onDelete={handleDelete} onTogglePin={handleTogglePin} />
                        ))}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <NoteEditorModal
                    projectId={projectId!}
                    editingNote={editingNote}
                    isAnimating={isAnimating}
                    mentionableMembers={mentionableMembers}
                    focusTarget={{ blockId: requestedBlockId, mentionId: requestedMentionId }}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}
