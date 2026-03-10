import { useParams, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetNotesQuery,
    useCreateNoteMutation,
    useUpdateNoteMutation,
    useDeleteNoteMutation,
} from '@/features/project';
import type { Project, Note, NoteBlock, NoteChecklistItem } from '@/features/project';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    StickyNote,
    Plus,
    Pin,
    PinOff,
    Trash2,
    X,
    CheckSquare,
    AlignLeft,
    Loader2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTE_COLORS = [
    { label: 'White', value: '#FFFFFF' },
    { label: 'Yellow', value: '#FEF3C7' },
    { label: 'Green', value: '#DCFCE7' },
    { label: 'Blue', value: '#DBEAFE' },
    { label: 'Purple', value: '#EDE9FE' },
    { label: 'Pink', value: '#FCE7F3' },
    { label: 'Red', value: '#FEE2E2' },
    { label: 'Teal', value: '#CCFBF1' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function uid(): string {
    return Math.random().toString(36).slice(2, 11);
}

/** Strip HTML tags — used for plain-text presence check in card preview */
function stripHtml(html: string): string {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}

// ── Block-level form state ─────────────────────────────────────────────────────

interface FormBlock extends NoteBlock {
    _uploading?: boolean;
}

const emptyTextBlock = (): FormBlock => ({ id: uid(), type: 'text', content: '' });
const emptyChecklistBlock = (): FormBlock => ({
    id: uid(),
    type: 'checklist',
    items: [{ id: uid(), text: '', checked: false }],
});

// ── Rich text editor ──────────────────────────────────────────────────────────

interface FormatState { bold: boolean; italic: boolean; underline: boolean }

function detectFormat(): FormatState {
    return {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
    };
}

interface RichTextEditorProps {
    initialHtml: string;
    placeholder?: string;
    onChange: (html: string) => void;
    minHeight?: number;
}

function RichTextEditor({ initialHtml, placeholder = 'Start typing…', onChange, minHeight = 80 }: RichTextEditorProps) {
    const divRef = useRef<HTMLDivElement>(null);
    const [formats, setFormats] = useState<FormatState>({ bold: false, italic: false, underline: false });
    const [isEmpty, setIsEmpty] = useState(!initialHtml);

    // Populate once on mount — uncontrolled to avoid cursor jumping
    useEffect(() => {
        if (divRef.current) divRef.current.innerHTML = initialHtml || '';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncFormats = () => setFormats(detectFormat());

    const handleInput = useCallback(() => {
        const html = divRef.current?.innerHTML || '';
        const effective = (html === '<br>' || html === '') ? '' : html;
        setIsEmpty(!effective);
        onChange(effective);
    }, [onChange]);

    // onMouseDown + preventDefault preserves the text selection when toolbar button is clicked
    const applyFormat = (cmd: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        divRef.current?.focus();
        document.execCommand(cmd, false);
        handleInput();
        setFormats(detectFormat());
    };

    const FORMATS: { cmd: string; label: string; title: string; style: React.CSSProperties }[] = [
        { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', style: { fontWeight: 700 } },
        { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', style: { fontStyle: 'italic' } },
        { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)', style: { textDecoration: 'underline' } },
    ];

    return (
        <div className="flex flex-col gap-2 group/editor">
            {/* Formatting toolbar - show on hover/focus */}
            <div className="flex items-center gap-1 opacity-0 group-focus-within/editor:opacity-100 group-hover/editor:opacity-100 transition-opacity">
                {FORMATS.map(({ cmd, label, title, style }) => {
                    const active = formats[cmd as keyof FormatState];
                    return (
                        <button
                            key={cmd}
                            type="button"
                            onMouseDown={applyFormat(cmd)}
                            title={title}
                            className="w-7 h-7 flex items-center justify-center text-xs rounded transition-colors"
                            style={{
                                ...style,
                                backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                                color: active ? '#fff' : 'var(--color-text-secondary)',
                                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Editable area */}
            <div className="relative">
                {isEmpty && (
                    <span
                        className="absolute top-0 left-2 text-sm pointer-events-none select-none opacity-50 transition-opacity"
                        style={{ color: 'var(--color-text-secondary)', paddingTop: '4px' }}
                    >
                        {placeholder}
                    </span>
                )}
                <div
                    ref={divRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyUp={syncFormats}
                    onMouseUp={syncFormats}
                    onSelect={syncFormats}
                    onFocus={syncFormats}
                    className="w-full text-sm outline-none leading-relaxed rounded-md px-2 py-1 transparent-selection"
                    style={{
                        minHeight,
                        color: 'var(--color-text-primary)',
                        wordBreak: 'break-word',
                    }}
                />
            </div>
        </div>
    );
}

// ── NoteCard ──────────────────────────────────────────────────────────────────

interface NoteCardProps {
    note: Note;
    canModify: boolean;
    isAdmin: boolean;
    onOpen: (note: Note) => void;
    onDelete: (note: Note) => void;
    onTogglePin: (note: Note) => void;
}

function NoteCard({ note, canModify, isAdmin, onOpen, onDelete, onTogglePin }: NoteCardProps) {
    const borderColor = note.color === '#FFFFFF' ? 'var(--color-border-default)' : note.color;

    // Get a quick text preview from the first text block
    const textPreview = note.blocks.find(b => b.type === 'text')?.content || '';
    const cleanPreview = stripHtml(textPreview).slice(0, 100) + (stripHtml(textPreview).length > 100 ? '...' : '');

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
                    <h3 className="text-sm font-semibold truncate text-neutral-900">
                        {note.title || 'Untitled'}
                    </h3>
                </div>
                {cleanPreview && (
                    <p className="text-xs text-neutral-500 truncate">{cleanPreview}</p>
                )}
            </div>

            <div className="flex items-center gap-6 shrink-0 text-xs text-neutral-400">
                <div className="hidden sm:block">
                    {note.createdBy?.name || 'Unknown'} • {timeAgo(note.lastEditedAt || note.updatedAt || note.createdAt)}
                </div>

                <div
                    className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                >
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

// ── TextBlockEditor ────────────────────────────────────────────────────────────

function TextBlockEditor({ block, onChange, onDelete }: {
    block: FormBlock;
    onChange: (id: string, patch: Partial<FormBlock>) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div className="relative group/block py-1">
            <button
                type="button"
                onClick={() => onDelete(block.id)}
                className="absolute -left-6 top-3 p-1 rounded text-neutral-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover/block:opacity-100 transition-opacity"
                title="Delete block"
            >
                <X size={14} />
            </button>
            <RichTextEditor
                initialHtml={block.content || ''}
                onChange={html => onChange(block.id, { content: html })}
                placeholder="Start typing…"
                minHeight={24}
            />
        </div>
    );
}

function ChecklistBlockEditor({ block, onChange, onDelete }: {
    block: FormBlock;
    onChange: (id: string, patch: Partial<FormBlock>) => void;
    onDelete: (id: string) => void;
}) {
    const items: NoteChecklistItem[] = block.items || [];

    const updateItem = (itemId: string, patch: Partial<NoteChecklistItem>) => {
        onChange(block.id, {
            items: items.map(i => i.id === itemId ? { ...i, ...patch } : i),
        });
    };

    const addItem = () => {
        onChange(block.id, { items: [...items, { id: uid(), text: '', checked: false }] });
    };

    const removeItem = (itemId: string) => {
        const next = items.filter(i => i.id !== itemId);
        onChange(block.id, { items: next.length ? next : [{ id: uid(), text: '', checked: false }] });
    };

    return (
        <div className="relative group/block py-2">
            <button
                type="button"
                onClick={() => onDelete(block.id)}
                className="absolute -left-6 top-2 p-1 rounded text-neutral-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover/block:opacity-100 transition-opacity"
                title="Delete block"
            >
                <X size={14} />
            </button>
            <div className="flex flex-col gap-1.5 pl-2">
                {items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={e => updateItem(item.id, { checked: e.target.checked })}
                            className="w-3.5 h-3.5 rounded accent-green-500 flex-shrink-0 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={item.text}
                            onChange={e => updateItem(item.id, { text: e.target.value })}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                                if (e.key === 'Backspace' && !item.text && items.length > 1) {
                                    e.preventDefault(); removeItem(item.id);
                                }
                            }}
                            placeholder={`Item ${idx + 1}`}
                            className="flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-gray-300 pb-0.5 transition-colors"
                            style={{ color: 'var(--color-text-primary)' }}
                        />
                        {items.length > 1 && (
                            <button onClick={() => removeItem(item.id)} className="p-0.5 rounded hover:text-red-500 transition-colors opacity-40 hover:opacity-100">
                                <X size={11} />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs mt-1 opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-primary)' }}
                >
                    <Plus size={12} /> Add item
                </button>
            </div>
        </div>
    );
}

// ── NoteEditorModal ────────────────────────────────────────────────────────────

interface NoteEditorModalProps {
    projectId: string;
    editingNote: Note | null;
    isAnimating: boolean;
    onClose: () => void;
}

function NoteEditorModal({ projectId, editingNote, isAnimating, onClose }: NoteEditorModalProps) {
    const [createNote] = useCreateNoteMutation();
    const [updateNote] = useUpdateNoteMutation();

    const [title, setTitle] = useState(editingNote?.title || '');
    const [color, setColor] = useState(editingNote?.color || '#FFFFFF');
    const [isPinned, setIsPinned] = useState(editingNote?.isPinned || false);
    const [blocks, setBlocks] = useState<FormBlock[]>(
        editingNote?.blocks && editingNote.blocks.length > 0
            ? (editingNote.blocks as FormBlock[])
            : [emptyTextBlock()]
    );
    const [noteId, setNoteId] = useState<string | null>(editingNote?._id || null);
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

    const createPromiseRef = useRef<Promise<any> | null>(null);
    const currentDataRef = useRef({ title, color, isPinned, blocks, isDirty, noteId });

    useEffect(() => {
        currentDataRef.current = { title, color, isPinned, blocks, isDirty, noteId };
    }, [title, color, isPinned, blocks, isDirty, noteId]);

    const patchBlock = useCallback((id: string, patch: Partial<FormBlock>) => {
        setIsDirty(true);
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    }, []);

    const deleteBlock = useCallback((id: string) => {
        setIsDirty(true);
        setBlocks(prev => prev.filter(b => b.id !== id));
    }, []);

    const handleTitleChange = (val: string) => {
        setTitle(val);
        setIsDirty(true);
    };

    const handleColorChange = (val: string) => {
        setColor(val);
        setIsDirty(true);
    };

    const handlePinChange = () => {
        setIsPinned(p => !p);
        setIsDirty(true);
    };

    const handleSaveNow = async (dataState = currentDataRef.current) => {
        const { title: t, color: c, isPinned: p, blocks: b, noteId: nid } = dataState;
        const cleanBlocks = b.map(({ _uploading, ...rest }) => rest);
        const finalTitle = t.trim() || 'Untitled';
        const data = { title: finalTitle, color: c, isPinned: p, blocks: cleanBlocks as NoteBlock[] };

        if (nid) {
            await updateNote({ projectId, noteId: nid, data }).unwrap();
        } else if (createPromiseRef.current) {
            const res = await createPromiseRef.current;
            if (res?.data?._id) {
                await updateNote({ projectId, noteId: res.data._id, data }).unwrap();
            }
        } else {
            const promise = createNote({ projectId, data }).unwrap();
            createPromiseRef.current = promise;
            const res = await promise;
            if (res.data?._id) {
                setNoteId(res.data._id);
            }
        }
    };

    const handleClose = async () => {
        if (currentDataRef.current.isDirty) {
            setSaveStatus('saving');
            try {
                await handleSaveNow(currentDataRef.current);
            } catch (err) {
                console.error("Save on close failed", err);
            }
        }
        onClose();
    };

    useEffect(() => {
        if (!isDirty) return;

        setSaveStatus('saving');
        const timeout = setTimeout(async () => {
            try {
                await handleSaveNow();
                setSaveStatus('saved');
                setIsDirty(false);
            } catch (err) {
                console.error("Autosave failed", err);
                setSaveStatus('error');
            }
        }, 800);

        return () => clearTimeout(timeout);
    }, [title, color, isPinned, blocks, isDirty, noteId, projectId, createNote, updateNote]);

    // Escape to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />

            {/* Note panel — background is the chosen color */}
            <div
                className={`relative w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ backgroundColor: color, borderLeft: '1px solid rgba(0,0,0,0.1)' }}
            >
                {/* Top bar — color swatches + pin + close */}
                <div
                    className="flex items-center justify-between px-5 pt-4 pb-2 gap-3"
                    style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        {NOTE_COLORS.map(c => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => handleColorChange(c.value)}
                                title={c.label}
                                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
                                style={{
                                    backgroundColor: c.value,
                                    borderColor: color === c.value ? '#6366F1' : 'rgba(0,0,0,0.2)',
                                    boxShadow: color === c.value ? '0 0 0 2px #6366F1' : undefined,
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs mr-3 flex items-center gap-1 transition-opacity opacity-70" style={{ color: 'var(--color-text-muted)' }}>
                            {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
                            {saveStatus === 'saved' && <span className="flex items-center gap-1 text-green-600"><CheckSquare size={12} /> Saved</span>}
                            {saveStatus === 'error' && <span className="text-red-500">Error saving</span>}
                        </span>
                        <button
                            type="button"
                            onClick={handlePinChange}
                            title={isPinned ? 'Unpin' : 'Pin to top'}
                            className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
                            style={{
                                backgroundColor: isPinned ? '#FCD34D' : 'transparent',
                                color: isPinned ? '#78350F' : 'var(--color-text-muted)',
                            }}
                        >
                            {isPinned ? <Pin size={15} /> : <PinOff size={15} />}
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="px-6 pb-4 pt-4 flex flex-col gap-4 overflow-y-auto flex-1 h-full">
                    {/* Title — big, Google Keep-style */}
                    <div>
                        <input
                            type="text"
                            value={title}
                            onChange={e => handleTitleChange(e.target.value)}
                            placeholder="Title"
                            autoFocus
                            className="w-full bg-transparent outline-none font-bold leading-snug border-none pb-2"
                            style={{
                                fontSize: '24px',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>

                    {/* Content blocks */}
                    <div className="flex flex-col gap-1 px-4">
                        {blocks.map(block => {
                            if (block.type === 'text') {
                                return <TextBlockEditor key={block.id} block={block} onChange={patchBlock} onDelete={deleteBlock} />;
                            }
                            if (block.type === 'checklist') {
                                return <ChecklistBlockEditor key={block.id} block={block} onChange={patchBlock} onDelete={deleteBlock} />;
                            }
                            return null;
                        })}

                        {/* Add block buttons */}
                        <div className="flex items-center gap-2 pt-4 mt-2 border-t opacity-40 hover:opacity-100 transition-opacity" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>+ Add block:</span>
                            <button
                                type="button"
                                onClick={() => setBlocks(p => [...p, emptyTextBlock()])}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border hover:bg-black/5 transition-colors font-medium"
                                style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--color-text-secondary)' }}
                            >
                                <AlignLeft size={13} /> Text
                            </button>
                            <button
                                type="button"
                                onClick={() => setBlocks(p => [...p, emptyChecklistBlock()])}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border hover:bg-black/5 transition-colors font-medium"
                                style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--color-text-secondary)' }}
                            >
                                <CheckSquare size={13} /> Checklist
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-4 border-t"
                    style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(0,0,0,0.02)' }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function ProjectNotesTab() {
    const { id: projectId } = useParams<{ id: string }>();
    useOutletContext<{ project: Project }>();

    const currentUser = useSelector((s: RootState) => s.auth.user);
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isAdmin = ['super-admin', 'super_admin', 'admin'].includes(roleName);

    const { data, isLoading } = useGetNotesQuery(projectId!);
    const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();
    const [updateNote] = useUpdateNoteMutation();

    const notes: Note[] = data?.data ?? [];
    const pinned = notes.filter(n => n.isPinned);
    const unpinned = notes.filter(n => !n.isPinned);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    const openCreate = () => {
        setEditingNote(null);
        setIsModalOpen(true);
        setTimeout(() => setIsAnimating(true), 10);
    };
    const openNote = (note: Note) => {
        setEditingNote(note);
        setIsModalOpen(true);
        setTimeout(() => setIsAnimating(true), 10);
    };
    const closeModal = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsModalOpen(false);
            setEditingNote(null);
        }, 300);
    };

    const handleDelete = async (note: Note) => {
        if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
        try {
            await deleteNote({ projectId: projectId!, noteId: note._id }).unwrap();
        } catch (err) {
            console.error('Failed to delete note', err);
        }
    };

    const handleTogglePin = async (note: Note) => {
        await updateNote({ projectId: projectId!, noteId: note._id, data: { isPinned: !note.isPinned } }).unwrap();
    };

    const canModify = (note: Note) =>
        isAdmin || (note.createdBy as any)?._id === currentUser?._id;

    void isDeleting;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading notes…</span>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
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
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={15} />
                    New Note
                </button>
            </div>

            {/* Empty state */}
            {notes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                        <StickyNote size={24} style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>No notes yet</p>
                    <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>Capture ideas, decisions, or anything worth remembering.</p>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        <Plus size={15} /> Create First Note
                    </button>
                </div>
            )}

            {/* Pinned section */}
            {pinned.length > 0 && (
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <Pin size={11} /> Pinned
                    </p>
                    <div className="flex flex-col gap-2">
                        {pinned.map(note => (
                            <NoteCard
                                key={note._id}
                                note={note}
                                canModify={canModify(note)}
                                isAdmin={isAdmin}
                                onOpen={openNote}
                                onDelete={handleDelete}
                                onTogglePin={handleTogglePin}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Other notes */}
            {unpinned.length > 0 && (
                <div>
                    {pinned.length > 0 && (
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                            Other Notes
                        </p>
                    )}
                    <div className="flex flex-col gap-2">
                        {unpinned.map(note => (
                            <NoteCard
                                key={note._id}
                                note={note}
                                canModify={canModify(note)}
                                isAdmin={isAdmin}
                                onOpen={openNote}
                                onDelete={handleDelete}
                                onTogglePin={handleTogglePin}
                            />
                        ))}
                    </div>
                </div>
            )}

            {isModalOpen && (
                <NoteEditorModal
                    projectId={projectId!}
                    editingNote={editingNote}
                    isAnimating={isAnimating}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}
