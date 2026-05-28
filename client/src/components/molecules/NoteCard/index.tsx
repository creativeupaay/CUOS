import type { Note } from '@/features/project';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { timeAgo, stripHtml } from '@/utils/notes';

interface NoteCardProps {
    note: Note;
    canModify: boolean;
    isAdmin: boolean;
    onOpen: (note: Note) => void;
    onDelete: (note: Note) => void;
    onTogglePin: (note: Note) => void;
}

export function NoteCard({ note, canModify, isAdmin, onOpen, onDelete, onTogglePin }: NoteCardProps) {
    const borderColor = note.color === '#FFFFFF' ? 'var(--color-border-default)' : note.color;
    const textPreview = note.blocks.find((block) => block.type === 'text')?.content || '';
    const cleanPreview = stripHtml(textPreview).slice(0, 100) + (stripHtml(textPreview).length > 100 ? '...' : '');
    const checkCount = note.blocks.filter((block) => block.type === 'checklist').length;
    const checkedCount = note.blocks.filter((block) => block.type === 'checklist' && (block.items as Array<{ checked?: boolean }>)?.[0]?.checked).length;

    return (
        <div
            onClick={() => onOpen(note)}
            className="flex items-center gap-4 p-3 border-b hover:bg-neutral-50 cursor-pointer group transition-colors"
            style={{ borderColor: 'var(--color-border-default)' }}
        >
            <div className="w-1.5 h-full rounded-full self-stretch" style={{ backgroundColor: borderColor }} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    {note.isPinned && <Pin size={12} className="text-amber-500 shrink-0" />}
                    <h3 className="text-sm font-semibold truncate text-neutral-900">{note.title || 'Untitled'}</h3>
                </div>
                {cleanPreview && <p className="text-xs text-neutral-500 truncate">{cleanPreview}</p>}
                {!cleanPreview && checkCount > 0 && (
                    <p className="text-xs text-neutral-400">{checkedCount}/{checkCount} items checked</p>
                )}
            </div>

            <div className="flex items-center gap-6 shrink-0 text-xs text-neutral-400">
                <div className="hidden sm:block">
                    {note.createdBy?.name || 'Unknown'} • {timeAgo(note.lastEditedAt || note.updatedAt || note.createdAt)}
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {(canModify || isAdmin) && (
                        <button
                            onClick={() => onTogglePin(note)}
                            title={note.isPinned ? 'Unpin' : 'Pin'}
                            className="p-1.5 rounded-md hover:bg-neutral-200 transition-colors text-neutral-500"
                        >
                            {note.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                    )}
                    {(canModify || isAdmin) && (
                        <button
                            onClick={() => onDelete(note)}
                            title="Delete note"
                            className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
