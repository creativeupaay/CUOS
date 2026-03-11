import { useParams, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetNotesQuery,
    useCreateNoteMutation,
    useUpdateNoteMutation,
    useDeleteNoteMutation,
} from '@/features/project';
import type { Project, Note, NoteBlock } from '@/features/project';
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import {
    StickyNote,
    Plus,
    Pin,
    PinOff,
    Trash2,
    X,
    CheckSquare,
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

// ── Block types ───────────────────────────────────────────────────────────────

interface ChecklistItemData {
    id: string;
    text: string;
    checked: boolean;
}

/** Each block is either a text paragraph or a SINGLE checklist item (Notion-style) */
interface FormBlock {
    id: string;
    type: 'text' | 'checklist';
    content?: string;          // text blocks
    items?: ChecklistItemData[]; // checklist blocks — always exactly 1 item
}

const emptyTextBlock = (): FormBlock => ({ id: uid(), type: 'text', content: '' });
const emptyChecklistBlock = (): FormBlock => ({
    id: uid(),
    type: 'checklist',
    items: [{ id: uid(), text: '', checked: false }],
});

/**
 * Flatten blocks from the API model into the flat one-item-per-row editor model.
 * Old multi-item checklist blocks become individual single-item blocks.
 */
function flattenBlocks(blocks: NoteBlock[]): FormBlock[] {
    if (!blocks || blocks.length === 0) return [emptyTextBlock()];
    const result: FormBlock[] = [];
    for (const block of blocks) {
        if (block.type === 'checklist') {
            const items = (block.items ?? []) as ChecklistItemData[];
            if (items.length === 0) {
                result.push(emptyChecklistBlock());
            } else {
                for (const item of items) {
                    result.push({ id: uid(), type: 'checklist', items: [{ ...item }] });
                }
            }
        } else if (block.type === 'text') {
            result.push({ id: uid(), type: 'text', content: block.content ?? '' });
        }
        // 'image' blocks are skipped (not supported in this editor)
    }
    return result.length > 0 ? result : [emptyTextBlock()];
}

// ── Block components (Notion-style: one row per text paragraph or checklist item) ─────

interface FormatState { bold: boolean; italic: boolean; underline: boolean }

function detectFormat(): FormatState {
    return {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
    };
}

// ── TextBlock ─────────────────────────────────────────────────────────────────

interface TextBlockHandle { focus: () => void; focusAtStart: () => void; }

interface TextBlockProps {
    block: FormBlock;
    onChange: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
}

const TextBlock = forwardRef<TextBlockHandle, TextBlockProps>(function TextBlock(
    { block, onChange, onDelete, onFocusPrev, onFocusNext, onFocused },
    ref
) {
    const divRef = useRef<HTMLDivElement>(null);
    const [formats, setFormats] = useState<FormatState>({ bold: false, italic: false, underline: false });
    const [isEmpty, setIsEmpty] = useState(!block.content);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (!divRef.current) return;
            divRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(divRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        },
        focusAtStart: () => {
            if (!divRef.current) return;
            divRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(divRef.current, 0);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        },
    }));

    useEffect(() => {
        if (divRef.current) divRef.current.innerHTML = block.content || '';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncFormats = () => setFormats(detectFormat());

    const handleInput = () => {
        const html = divRef.current?.innerHTML || '';
        const effective = html === '<br>' || html === '' ? '' : html;
        setIsEmpty(!effective);
        onChange(block.id, effective);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            // Enter always inserts a line break — no new blocks from text
            e.preventDefault();
            document.execCommand('insertLineBreak');
            handleInput();
        } else if (e.key === 'Backspace') {
            const html = divRef.current?.innerHTML || '';
            if (!html || html === '<br>' || stripHtml(html).trim() === '') {
                e.preventDefault();
                onDelete(block.id);
                onFocusPrev(block.id);
            }
        } else if (e.key === 'ArrowDown') {
            onFocusNext(block.id);
        } else if (e.key === 'ArrowUp') {
            onFocusPrev(block.id);
        }
    };

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
        <div className="group/textblock">
            {/* Format toolbar — visible on hover/focus */}
            <div className="flex items-center gap-1 mb-1 h-6 opacity-0 group-focus-within/textblock:opacity-100 group-hover/textblock:opacity-100 transition-opacity">
                {FORMATS.map(({ cmd, label, title, style }) => {
                    const active = formats[cmd as keyof FormatState];
                    return (
                        <button
                            key={cmd}
                            type="button"
                            onMouseDown={applyFormat(cmd)}
                            title={title}
                            className="w-6 h-6 flex items-center justify-center text-xs rounded transition-colors"
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

            <div className="relative">
                {isEmpty && (
                    <span
                        className="absolute top-0 left-0 text-sm pointer-events-none select-none opacity-40"
                        style={{ color: 'var(--color-text-secondary)', paddingTop: '2px' }}
                    >
                        Write something…
                    </span>
                )}
                <div
                    ref={divRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onKeyUp={syncFormats}
                    onMouseUp={syncFormats}
                    onSelect={syncFormats}
                    onFocus={() => { syncFormats(); onFocused(block.id); }}
                    className="w-full text-sm outline-none leading-relaxed py-0.5"
                    style={{ minHeight: '24px', color: 'var(--color-text-primary)', wordBreak: 'break-word' }}
                />
            </div>
        </div>
    );
});

// ── ChecklistBlock ────────────────────────────────────────────────────────────

interface ChecklistBlockHandle { focus: () => void; focusAtStart: () => void; }

interface ChecklistBlockProps {
    block: FormBlock;
    onChange: (id: string, patch: Partial<FormBlock>) => void;
    onInsertAfter: (id: string, type: 'text' | 'checklist') => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
    /** Replace this checklist block in-place with an empty text block */
    onConvertToText: (id: string) => void;
}

const ChecklistBlock = forwardRef<ChecklistBlockHandle, ChecklistBlockProps>(function ChecklistBlock(
    { block, onChange, onInsertAfter, onDelete, onFocusPrev, onFocusNext, onFocused, onConvertToText },
    ref
) {
    const inputRef = useRef<HTMLInputElement>(null);
    const item: ChecklistItemData = block.items?.[0] ?? { id: uid(), text: '', checked: false };

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        focusAtStart: () => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(0, 0); },
    }));

    const updateItem = (patch: Partial<ChecklistItemData>) => {
        onChange(block.id, { items: [{ ...item, ...patch }] });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!item.text) {
                // Empty checklist item — convert it to a text block in-place
                onConvertToText(block.id);
            } else {
                onInsertAfter(block.id, 'checklist');
            }
        } else if (e.key === 'Backspace' && !item.text) {
            e.preventDefault();
            onDelete(block.id);
            onFocusPrev(block.id);
        } else if (e.key === 'ArrowDown') {
            onFocusNext(block.id);
        } else if (e.key === 'ArrowUp') {
            onFocusPrev(block.id);
        }
    };

    return (
        <div className="flex items-center gap-2 py-0.5">
            <input
                type="checkbox"
                checked={item.checked}
                onChange={e => updateItem({ checked: e.target.checked })}
                className="w-3.5 h-3.5 rounded flex-shrink-0 cursor-pointer accent-indigo-500"
            />
            <input
                ref={inputRef}
                type="text"
                value={item.text}
                onChange={e => updateItem({ text: e.target.value })}
                onKeyDown={handleKeyDown}
                onFocus={() => onFocused(block.id)}
                placeholder="List item…"
                className="flex-1 text-sm bg-transparent outline-none border-b border-transparent focus:border-gray-300 pb-0.5 transition-colors"
                style={{
                    color: 'var(--color-text-primary)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    opacity: item.checked ? 0.55 : 1,
                }}
            />
        </div>
    );
});

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

    const textPreview = note.blocks.find(b => b.type === 'text')?.content || '';
    const cleanPreview = stripHtml(textPreview).slice(0, 100) + (stripHtml(textPreview).length > 100 ? '...' : '');
    const checkCount = note.blocks.filter(b => b.type === 'checklist').length;
    const checkedCount = note.blocks.filter(b => b.type === 'checklist' && (b.items as any)?.[0]?.checked).length;

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
                {!cleanPreview && checkCount > 0 && (
                    <p className="text-xs text-neutral-400">{checkedCount}/{checkCount} items checked</p>
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
    const [blocks, setBlocks] = useState<FormBlock[]>(() =>
        editingNote?.blocks && editingNote.blocks.length > 0
            ? flattenBlocks(editingNote.blocks as NoteBlock[])
            : [emptyTextBlock()]
    );
    const [noteId, setNoteId] = useState<string | null>(editingNote?._id || null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
    void focusedBlockId;

    // Stable refs so async callbacks always read latest values
    const createResultRef = useRef<string | null>(editingNote?._id || null);
    const isSavingRef = useRef(false);
    const isDirtyRef = useRef(false);
    const pendingFocusRef = useRef<{ id: string; atStart?: boolean } | null>(null);
    const focusedBlockIdRef = useRef<string | null>(null);
    const blockRefs = useRef<Map<string, { focus: () => void; focusAtStart: () => void }>>(new Map());

    // Latest-value refs for async save
    const titleRef = useRef(title);
    const colorRef = useRef(color);
    const isPinnedRef = useRef(isPinned);
    const blocksRef = useRef(blocks);
    const noteIdRef = useRef(noteId);

    useEffect(() => { titleRef.current = title; }, [title]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { isPinnedRef.current = isPinned; }, [isPinned]);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);
    useEffect(() => { noteIdRef.current = noteId; }, [noteId]);

    // Focus a newly inserted block after the state update lands
    useEffect(() => {
        if (pendingFocusRef.current) {
            const { id, atStart } = pendingFocusRef.current;
            const handle = blockRefs.current.get(id);
            if (handle) {
                if (atStart) handle.focusAtStart(); else handle.focus();
                pendingFocusRef.current = null;
            }
        }
    }, [blocks]);

    // ── Save helpers ──────────────────────────────────────────────────────────

    const handleSaveNow = useCallback(async (): Promise<void> => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        const t = titleRef.current;
        const c = colorRef.current;
        const p = isPinnedRef.current;
        const b = blocksRef.current;
        const resolvedId = createResultRef.current ?? noteIdRef.current;

        const cleanBlocks: NoteBlock[] = b.map(block =>
            block.type === 'text'
                ? ({ id: block.id, type: 'text', content: block.content ?? '' } as NoteBlock)
                : ({ id: block.id, type: 'checklist', items: block.items ?? [] } as NoteBlock)
        );
        const data = { title: t.trim() || 'Untitled', color: c, isPinned: p, blocks: cleanBlocks };

        try {
            if (resolvedId) {
                await updateNote({ projectId, noteId: resolvedId, data }).unwrap();
            } else {
                const res = await createNote({ projectId, data }).unwrap();
                const newId = res.data?._id as string | undefined;
                if (newId) {
                    createResultRef.current = newId;
                    setNoteId(newId);
                }
            }
        } finally {
            isSavingRef.current = false;
        }
    }, [projectId, createNote, updateNote]);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback(() => {
        isDirtyRef.current = true;
        setSaveStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await handleSaveNow();
                isDirtyRef.current = false;
                setSaveStatus('saved');
            } catch (err) {
                console.error('Autosave failed', err);
                setSaveStatus('error');
            }
        }, 900);
    }, [handleSaveNow]);

    useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

    const handleClose = useCallback(async () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (isDirtyRef.current) {
            setSaveStatus('saving');
            try { await handleSaveNow(); setSaveStatus('saved'); }
            catch (err) { console.error('Save on close failed', err); }
        }
        onClose();
    }, [handleSaveNow, onClose]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose]);

    // ── Block mutations ───────────────────────────────────────────────────────

    const handleTextChange = useCallback((id: string, content: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
        scheduleSave();
    }, [scheduleSave]);

    const handleChecklistChange = useCallback((id: string, patch: Partial<FormBlock>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
        scheduleSave();
    }, [scheduleSave]);

    /** Insert a new block after the given id, or at the end if afterId is null */
    const insertBlock = useCallback((afterId: string | null, type: 'text' | 'checklist') => {
        const newBlock = type === 'text' ? emptyTextBlock() : emptyChecklistBlock();
        pendingFocusRef.current = { id: newBlock.id };
        if (afterId === null) {
            setBlocks(prev => [...prev, newBlock]);
        } else {
            setBlocks(prev => {
                const idx = prev.findIndex(b => b.id === afterId);
                const next = [...prev];
                next.splice(idx === -1 ? next.length : idx + 1, 0, newBlock);
                return next;
            });
        }
        isDirtyRef.current = true;
    }, []);

    const handleInsertAfter = useCallback((id: string, type: 'text' | 'checklist') => {
        insertBlock(id, type);
    }, [insertBlock]);

    /** Convert a checklist block to a text block in-place */
    const handleConvertToText = useCallback((id: string) => {
        const newTextBlock = emptyTextBlock();
        pendingFocusRef.current = { id: newTextBlock.id };
        setBlocks(prev => {
            const idx = prev.findIndex(b => b.id === id);
            if (idx === -1) return prev;
            const next = [...prev];
            next.splice(idx, 1, newTextBlock);
            return next;
        });
        isDirtyRef.current = true;
        scheduleSave();
    }, [scheduleSave]);

    const handleDeleteBlock = useCallback((id: string) => {
        setBlocks(prev => {
            const next = prev.filter(b => b.id !== id);
            if (next.length > 0) return next;
            // Last block was deleted — drop in an empty text block and focus it
            const replacement = emptyTextBlock();
            pendingFocusRef.current = { id: replacement.id };
            return [replacement];
        });
        scheduleSave();
    }, [scheduleSave]);

    const handleFocusPrev = useCallback((id: string) => {
        const cur = blocksRef.current;
        const idx = cur.findIndex(b => b.id === id);
        if (idx > 0) blockRefs.current.get(cur[idx - 1].id)?.focus();
    }, []);

    const handleFocusNext = useCallback((id: string) => {
        const cur = blocksRef.current;
        const idx = cur.findIndex(b => b.id === id);
        if (idx < cur.length - 1) blockRefs.current.get(cur[idx + 1].id)?.focus();
    }, []);

    const handleFocused = useCallback((id: string) => {
        focusedBlockIdRef.current = id;
        setFocusedBlockId(id);
    }, []);

    /** Header buttons: insert after the focused block or at end */
    const handleHeaderInsert = (type: 'text' | 'checklist') => {
        insertBlock(focusedBlockIdRef.current, type);
        scheduleSave();
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />

            {/* Note panel */}
            <div
                className={`relative w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ backgroundColor: color, borderLeft: '1px solid rgba(0,0,0,0.1)' }}
            >
                {/* ── Header: color swatches + insert buttons + pin + save + close ── */}
                <div
                    className="flex items-center justify-between px-4 pt-3 pb-3 gap-2 flex-wrap"
                    style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}
                >
                    {/* Color swatches */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {NOTE_COLORS.map(c => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => { setColor(c.value); scheduleSave(); }}
                                title={c.label}
                                className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                                style={{
                                    backgroundColor: c.value,
                                    borderColor: color === c.value ? '#6366F1' : 'rgba(0,0,0,0.2)',
                                    boxShadow: color === c.value ? '0 0 0 2px #6366F1' : undefined,
                                }}
                            />
                        ))}
                    </div>

                    {/* Right: save status + insert buttons + pin + close */}
                    <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs mr-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)', opacity: 0.75 }}>
                            {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin" />Saving…</>}
                            {saveStatus === 'saved' && <><CheckSquare size={11} className="text-green-500" />Saved</>}
                            {saveStatus === 'error' && <span className="text-red-500 text-xs">Error saving</span>}
                        </span>

                        <button
                            type="button"
                            onClick={() => handleHeaderInsert('checklist')}
                            title="Insert checklist item after current block"
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors hover:bg-black/5"
                            style={{ borderColor: 'rgba(0,0,0,0.12)', color: 'var(--color-text-secondary)' }}
                        >
                            <CheckSquare size={11} /> Checklist
                        </button>

                        <button
                            type="button"
                            onClick={() => { setIsPinned(p => !p); scheduleSave(); }}
                            title={isPinned ? 'Unpin' : 'Pin to top'}
                            className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
                            style={{
                                backgroundColor: isPinned ? '#FCD34D' : 'transparent',
                                color: isPinned ? '#78350F' : 'var(--color-text-muted)',
                            }}
                        >
                            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                        </button>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="px-6 py-5 flex flex-col overflow-y-auto flex-1">
                    {/* Title */}
                    <input
                        type="text"
                        value={title}
                        onChange={e => { setTitle(e.target.value); scheduleSave(); }}
                        placeholder="Title"
                        autoFocus
                        className="w-full bg-transparent outline-none font-bold leading-snug border-none mb-4"
                        style={{ fontSize: '22px', color: 'var(--color-text-primary)' }}
                    />

                    {/* Divider between title and content */}
                    <hr className="mb-4" style={{ borderColor: 'rgba(0,0,0,0.1)' }} />

                    {/* Content blocks — Notion-style flat list */}
                    <div className="flex flex-col gap-3">
                        {blocks.map(block => {
                            if (block.type === 'text') {
                                return (
                                    <TextBlock
                                        key={block.id}
                                        block={block}
                                        ref={el => {
                                            if (el) blockRefs.current.set(block.id, el);
                                            else blockRefs.current.delete(block.id);
                                        }}
                                        onChange={handleTextChange}
                                        onDelete={handleDeleteBlock}
                                        onFocusPrev={handleFocusPrev}
                                        onFocusNext={handleFocusNext}
                                        onFocused={handleFocused}
                                    />
                                );
                            }
                            if (block.type === 'checklist') {
                                return (
                                    <ChecklistBlock
                                        key={block.id}
                                        block={block}
                                        ref={el => {
                                            if (el) blockRefs.current.set(block.id, el);
                                            else blockRefs.current.delete(block.id);
                                        }}
                                        onChange={handleChecklistChange}
                                        onInsertAfter={handleInsertAfter}
                                        onDelete={handleDeleteBlock}
                                        onFocusPrev={handleFocusPrev}
                                        onFocusNext={handleFocusNext}
                                        onFocused={handleFocused}
                                        onConvertToText={handleConvertToText}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-3 border-t"
                    style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(0,0,0,0.02)' }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-1.5 text-sm font-medium rounded-lg text-white transition-colors"
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
    const [deleteNote] = useDeleteNoteMutation();
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
