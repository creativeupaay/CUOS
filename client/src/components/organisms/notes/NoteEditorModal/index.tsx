import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Loader2, Pin, PinOff, X, Copy } from 'lucide-react';
import type { Note } from '@/features/project';
import type { MentionableMember, FocusTarget } from '@/types/notes';
import { useNoteEditor, emptyChecklistBlock } from '@/hooks/useNoteEditor';
import { buildNoteClipboardText, buildNoteClipboardHtml } from '@/utils/notes';
import { logger } from '@/utils/logger';
import { NoteCollaborationBar } from '@/components/molecules/NoteCollaborationBar';
import { BlockEditor } from '@/components/organisms/notes/BlockEditor';

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

interface NoteEditorModalProps {
    projectId: string;
    editingNote: Note | null;
    isAnimating: boolean;
    mentionableMembers: MentionableMember[];
    focusTarget?: FocusTarget;
    onClose: () => void;
}

export function NoteEditorModal({ projectId, editingNote, isAnimating, mentionableMembers, focusTarget, onClose }: NoteEditorModalProps) {
    const [tempId] = useState(() => (editingNote?._id ? null : `temp_${Math.random().toString(36).slice(2, 11)}`));

    const {
        blocks,
        setBlocks,
        title,
        setTitle,
        color,
        setColor,
        isPinned,
        setIsPinned,
        noteId,
        saveStatus,
        isSyncing,
        blockRefs,
        pendingFocusRef,
        focusedBlockIdRef,
        noteIdRef,
        handleSaveNow,
        scheduleSave,
        visibleActiveUsers,
        isConnected,
        broadcastChange,
        broadcastTitleChange,
        updatePresence,
        getUserEditingBlock,
    } = useNoteEditor({ projectId, editingNote, tempId });

    const containerRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const highlightedMentionRef = useRef<string | null>(null);

    const blocksRef = useRef(blocks);
    const titleRef = useRef(title);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);
    useEffect(() => { titleRef.current = title; }, [title]);

    const handleClose = useCallback(async () => {
        try {
            await handleSaveNow();
        } catch (error) {
            logger.error('Save on close failed', error);
        }
        onClose();
    }, [handleSaveNow, onClose]);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose]);

    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    const handleCopyAll = useCallback(async () => {
        const text = buildNoteClipboardText(titleRef.current, blocksRef.current);
        const html = buildNoteClipboardHtml(titleRef.current, blocksRef.current);

        try {
            if ('ClipboardItem' in window && navigator.clipboard?.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([text], { type: 'text/plain' }),
                        'text/html': new Blob([html], { type: 'text/html' }),
                    }),
                ]);
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
            setCopyStatus('copied');
        } catch (error) {
            logger.error('Failed to copy note', error);
        }
    }, []);

    useEffect(() => {
        if (copyStatus !== 'copied') return;
        const timer = window.setTimeout(() => setCopyStatus('idle'), 1800);
        return () => window.clearTimeout(timer);
    }, [copyStatus]);

    useEffect(() => {
        if (!focusTarget || !containerRef.current || highlightedMentionRef.current === focusTarget.mentionId) return;

        const highlight = () => {
            if (!containerRef.current) return false;

            if (focusTarget.mentionId) {
                const mentionElement = containerRef.current.querySelector<HTMLElement>(`[data-mention-id="${CSS.escape(focusTarget.mentionId)}"]`);
                if (mentionElement) {
                    mentionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    mentionElement.classList.add('note-mention-target');
                    window.setTimeout(() => mentionElement.classList.remove('note-mention-target'), 2200);
                    highlightedMentionRef.current = focusTarget.mentionId;
                    return true;
                }
            }

            if (focusTarget.blockId) {
                const blockElement = containerRef.current.querySelector<HTMLElement>(`[data-note-block-id="${CSS.escape(focusTarget.blockId)}"]`);
                if (blockElement) {
                    blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return true;
                }
            }

            return false;
        };

        const timer = window.setTimeout(() => {
            highlight();
        }, 250);

        return () => window.clearTimeout(timer);
    }, [blocks, focusTarget, isAnimating]);

    return createPortal(
        <>
            <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
                <div
                    className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
                    onClick={handleClose}
                />

                <div
                    ref={containerRef}
                    className={`relative w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : 'translate-x-full'}`}
                    style={{ backgroundColor: color, borderLeft: '1px solid rgba(0,0,0,0.1)' }}
                >
                    <div
                        className="flex items-center justify-between px-4 pt-3 pb-3 gap-2"
                        style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-1.5">
                                {NOTE_COLORS.map((swatch) => (
                                    <button
                                        key={swatch.value}
                                        type="button"
                                        onClick={() => {
                                            setColor(swatch.value);
                                            scheduleSave();
                                        }}
                                        title={swatch.label}
                                        className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                                        style={{
                                            backgroundColor: swatch.value,
                                            borderColor: color === swatch.value ? '#6366F1' : 'rgba(0,0,0,0.2)',
                                            boxShadow: color === swatch.value ? '0 0 0 2px #6366F1' : undefined,
                                        }}
                                    />
                                ))}
                            </div>

                            {noteId && (
                                <NoteCollaborationBar 
                                    isConnected={isConnected} 
                                    isSyncing={isSyncing} 
                                    visibleActiveUsers={visibleActiveUsers} 
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <span
                                className="text-xs mr-1 flex items-center gap-1 whitespace-nowrap min-w-[76px] justify-end"
                                style={{ color: 'var(--color-text-muted)', opacity: 0.75 }}
                            >
                                {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin" />Saving...</>}
                                {saveStatus === 'saved' && <><CheckSquare size={11} className="text-green-500" />Saved</>}
                                {saveStatus === 'error' && <span className="text-red-500 text-xs">Error saving</span>}
                            </span>

                            <button
                                type="button"
                                onClick={() => {
                                    const newBlock = emptyChecklistBlock();
                                    pendingFocusRef.current = { id: newBlock.id };
                                    
                                    const insertPosition = focusedBlockIdRef.current 
                                        ? blocksRef.current.findIndex((b) => b.id === focusedBlockIdRef.current) + 1 
                                        : blocksRef.current.length;
                                    
                                    setBlocks((prev) => {
                                        const next = [...prev];
                                        next.splice(insertPosition, 0, newBlock);
                                        return next;
                                    });

                                    broadcastChange({
                                        blockId: newBlock.id,
                                        type: 'insert',
                                        data: { type: newBlock.type, content: newBlock.content, items: newBlock.items, position: insertPosition },
                                    });
                            
                                    scheduleSave();
                                }}
                                title="Insert checklist item after current block"
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors hover:bg-black/5"
                                style={{ borderColor: 'rgba(0,0,0,0.12)', color: 'var(--color-text-secondary)' }}
                            >
                                <CheckSquare size={11} /> Checklist
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsPinned((previous) => !previous);
                                    scheduleSave();
                                }}
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

                    <div className="px-6 py-5 flex flex-col overflow-y-auto flex-1">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                const nextTitle = e.target.value;
                                setTitle(nextTitle);
                                scheduleSave();
                                if (noteIdRef.current) {
                                    broadcastTitleChange(nextTitle);
                                }
                            }}
                            placeholder="Title"
                            autoFocus
                            className="w-full bg-transparent outline-none font-bold leading-snug border-none mb-4"
                            style={{ fontSize: '22px', color: 'var(--color-text-primary)' }}
                        />

                        <hr className="mb-4" style={{ borderColor: 'rgba(0,0,0,0.1)' }} />

                        <BlockEditor
                            blocks={blocks}
                            setBlocks={setBlocks}
                            mentionableMembers={mentionableMembers}
                            blockRefs={blockRefs}
                            pendingFocusRef={pendingFocusRef}
                            focusedBlockIdRef={focusedBlockIdRef}
                            onBroadcast={broadcastChange}
                            scheduleSave={scheduleSave}
                            getUserEditingBlock={getUserEditingBlock}
                            updatePresence={updatePresence}
                            containerRef={containerRef}
                        />
                    </div>

                    <div
                        className="flex items-center justify-between gap-3 px-6 py-3 border-t"
                        style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(0,0,0,0.02)' }}
                    >
                        <button
                            type="button"
                            onClick={handleCopyAll}
                            title="Copy the full note including text and checklists"
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors hover:bg-black/5"
                            style={{
                                borderColor: copyStatus === 'copied' ? 'rgba(22, 163, 74, 0.28)' : 'rgba(0,0,0,0.12)',
                                color: copyStatus === 'copied' ? '#166534' : 'var(--color-text-secondary)',
                                backgroundColor: copyStatus === 'copied' ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                            }}
                        >
                            <Copy size={14} />
                            {copyStatus === 'copied' ? 'Copied!' : 'Copy All'}
                        </button>

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
            </div>
        </>,
        document.body
    );
}
