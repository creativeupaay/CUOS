import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { useCreateNoteMutation, useUpdateNoteMutation } from '@/features/project';
import type { Note, NoteBlock } from '@/features/project';
import { useNoteCollaboration } from '@/features/collaboration';
import type { NoteBroadcastResponse, UserPresence } from '@/features/collaboration';
import { logger } from '@/utils/logger';
import type { FormBlock, ChecklistItemData } from '@/types/notes';

// ---------------------------------------------------------------------------
// Shared types re-exported so components don't need to redefine them
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pure helpers (no React deps — kept here so the hook file is self-contained)
// ---------------------------------------------------------------------------

function uid(): string {
    return Math.random().toString(36).slice(2, 11);
}

export const emptyTextBlock = (): FormBlock => ({ id: uid(), type: 'text', content: '' });
export const emptyChecklistBlock = (): FormBlock => ({
    id: uid(),
    type: 'checklist',
    items: [{ id: uid(), text: '', checked: false }],
});

export function flattenBlocks(blocks: NoteBlock[]): FormBlock[] {
    if (!blocks || blocks.length === 0) return [emptyTextBlock()];

    const result: FormBlock[] = [];

    blocks.forEach((block) => {
        if (block.type === 'checklist') {
            const items = (block.items ?? []) as ChecklistItemData[];
            if (items.length === 0) {
                result.push({
                    id: block.id,
                    type: 'checklist',
                    items: [{ id: uid(), text: '', checked: false }],
                });
                return;
            }

            items.forEach((item, index) => {
                result.push({
                    id: index === 0 ? block.id : `${block.id}:${item.id || index}`,
                    type: 'checklist',
                    items: [{ ...item }],
                });
            });
            return;
        }

        if (block.type === 'text') {
            result.push({ id: block.id, type: 'text', content: block.content ?? '' });
        }
    });

    return result.length > 0 ? result : [emptyTextBlock()];
}

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

interface OfflineCacheSnapshot {
    title: string;
    color: string;
    isPinned: boolean;
    blocks: FormBlock[];
}

export interface UseNoteEditorOptions {
    projectId: string;
    editingNote: Note | null;
    tempId: string | null;
}

export interface UseNoteEditorReturn {
    // State
    blocks: FormBlock[];
    setBlocks: React.Dispatch<React.SetStateAction<FormBlock[]>>;
    title: string;
    setTitle: (value: string) => void;
    color: string;
    setColor: (value: string) => void;
    isPinned: boolean;
    setIsPinned: (value: boolean | ((prev: boolean) => boolean)) => void;
    noteId: string | null;
    saveStatus: 'saved' | 'saving' | 'error';
    isSyncing: boolean;

    // Refs exposed for the editor
    blockRefs: React.MutableRefObject<Map<string, { focus: () => void; focusAtStart: () => void }>>;
    pendingFocusRef: React.MutableRefObject<{ id: string; atStart?: boolean } | null>;
    focusedBlockIdRef: React.MutableRefObject<string | null>;
    noteIdRef: React.MutableRefObject<string | null>;

    // Save
    handleSaveNow: () => Promise<void>;
    scheduleSave: () => void;

    // Collaboration
    activeUsers: UserPresence[];
    visibleActiveUsers: UserPresence[];
    isConnected: boolean;
    broadcastChange: ReturnType<typeof useNoteCollaboration>['broadcastChange'];
    broadcastTitleChange: ReturnType<typeof useNoteCollaboration>['broadcastTitleChange'];
    updatePresence: ReturnType<typeof useNoteCollaboration>['updatePresence'];
    getUserEditingBlock: (blockId: string) => UserPresence | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNoteEditor({
    projectId,
    editingNote,
    tempId,
}: UseNoteEditorOptions): UseNoteEditorReturn {
    const [createNote] = useCreateNoteMutation();
    const [updateNote] = useUpdateNoteMutation();

    const currentUser = useSelector((state: RootState) => state.auth.user);
    const currentUserId = currentUser?._id;

    // ------------------------------------------------------------------
    // Offline cache bootstrapping (read once on mount, synchronously)
    // ------------------------------------------------------------------
    const OFFLINE_CACHE_KEY = `cuos_note_offline_${editingNote?._id || tempId}`;

    const cachedRef = useRef<OfflineCacheSnapshot | null>(null);
    if (!cachedRef.current && typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
            if (cached) cachedRef.current = JSON.parse(cached) as OfflineCacheSnapshot;
        } catch (error) {
            logger.error('Failed to parse offline cache', error);
        }
    }

    const cachedData = cachedRef.current;

    // ------------------------------------------------------------------
    // Editor state
    // ------------------------------------------------------------------
    const [title, setTitleState] = useState<string>(cachedData?.title ?? (editingNote?.title || ''));
    const [color, setColorState] = useState<string>(cachedData?.color ?? (editingNote?.color || '#FFFFFF'));
    const [isPinned, setIsPinnedState] = useState<boolean>(cachedData?.isPinned ?? (editingNote?.isPinned || false));
    const [blocks, setBlocks] = useState<FormBlock[]>(() => {
        if (cachedData?.blocks?.length) return cachedData.blocks;
        return editingNote?.blocks?.length
            ? flattenBlocks(editingNote.blocks as NoteBlock[])
            : [emptyTextBlock()];
    });
    const [noteId, setNoteId] = useState<string | null>(editingNote?._id || null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [isSyncing, setIsSyncing] = useState(false);

    // ------------------------------------------------------------------
    // Refs for stable access inside async / event handlers
    // ------------------------------------------------------------------
    const createResultRef = useRef<string | null>(editingNote?._id || null);
    const isSavingRef = useRef(false);
    const saveQueuedRef = useRef(false);
    const isDirtyRef = useRef(!!cachedData);
    const hasLocalPendingChangesRef = useRef(!!cachedData);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const titleRef = useRef(title);
    const colorRef = useRef(color);
    const isPinnedRef = useRef(isPinned);
    const blocksRef = useRef(blocks);
    const noteIdRef = useRef(noteId);

    // Block focus management
    const pendingFocusRef = useRef<{ id: string; atStart?: boolean } | null>(null);
    const focusedBlockIdRef = useRef<string | null>(null);
    const blockRefs = useRef<Map<string, { focus: () => void; focusAtStart: () => void }>>(new Map());

    // ------------------------------------------------------------------
    // Keep refs in sync with state
    // ------------------------------------------------------------------
    useEffect(() => { titleRef.current = title; }, [title]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { isPinnedRef.current = isPinned; }, [isPinned]);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);
    useEffect(() => { noteIdRef.current = noteId; }, [noteId]);

    // ------------------------------------------------------------------
    // Stable state setters with consistent API
    // ------------------------------------------------------------------
    const setTitle = useCallback((value: string) => setTitleState(value), []);
    const setColor = useCallback((value: string) => setColorState(value), []);
    const setIsPinned = useCallback(
        (value: boolean | ((prev: boolean) => boolean)) => setIsPinnedState(value),
        [],
    );

    // ------------------------------------------------------------------
    // Offline cache persistence
    // ------------------------------------------------------------------
    const persistToLocalCache = useCallback(() => {
        if (!isDirtyRef.current) return;
        try {
            localStorage.setItem(
                OFFLINE_CACHE_KEY,
                JSON.stringify({ title, color, isPinned, blocks }),
            );
        } catch (error) {
            logger.error('Failed to save to offline cache', error);
        }
    }, [OFFLINE_CACHE_KEY, title, color, isPinned, blocks]);

    useEffect(() => {
        persistToLocalCache();
    }, [persistToLocalCache]);

    // ------------------------------------------------------------------
    // Collaboration callbacks
    // ------------------------------------------------------------------
    const handleRemoteUpdate = useCallback((operation: NoteBroadcastResponse) => {
        setBlocks((prev) => {
            const blockIndex = prev.findIndex((b) => b.id === operation.blockId);

            if (operation.type === 'update' && blockIndex !== -1) {
                const updated = [...prev];
                if (operation.data.content !== undefined) {
                    updated[blockIndex] = { ...updated[blockIndex], content: operation.data.content };
                }
                if (operation.data.items !== undefined) {
                    updated[blockIndex] = { ...updated[blockIndex], items: operation.data.items };
                }
                return updated;
            }

            if (operation.type === 'insert') {
                const newBlock: FormBlock = {
                    id: operation.blockId,
                    type: (operation.data.type as 'text' | 'checklist') || 'text',
                    content: operation.data.content,
                    items: operation.data.items,
                };
                const position = (operation.data.position as number | undefined) ?? prev.length;
                const updated = [...prev];
                updated.splice(position, 0, newBlock);
                return updated;
            }

            if (operation.type === 'delete' && blockIndex !== -1) {
                return prev.filter((b) => b.id !== operation.blockId);
            }

            return prev;
        });
    }, []);

    const handleSyncRequired = useCallback((version: number) => {
        logger.warn('Sync required, version:', version);
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 1000);
    }, []);

    const handleRoomState = useCallback((state: { blocks: NoteBlock[] }) => {
        if (hasLocalPendingChangesRef.current) return;
        const normalized = flattenBlocks(state.blocks as NoteBlock[]);
        setBlocks(normalized.length > 0 ? normalized : [emptyTextBlock()]);
    }, []);

    const handleRemoteTitleUpdate = useCallback((nextTitle: string) => {
        setTitleState((previous) => (previous === nextTitle ? previous : nextTitle));
    }, []);

    // ------------------------------------------------------------------
    // Collaboration hook
    // ------------------------------------------------------------------
    const { activeUsers, isConnected, broadcastChange, broadcastTitleChange, updatePresence } =
        useNoteCollaboration({
            noteId: noteId || '',
            projectId,
            onRemoteUpdate: handleRemoteUpdate,
            onRemoteTitleUpdate: handleRemoteTitleUpdate,
            onRoomState: handleRoomState,
            onSyncRequired: handleSyncRequired,
            onError: (message) => logger.error('Collaboration error:', message),
        });

    const visibleActiveUsers = activeUsers.filter((user) => user.userId !== currentUserId);

    const getUserEditingBlock = useCallback(
        (blockId: string): UserPresence | null =>
            activeUsers.find(
                (user) => user.currentBlock === blockId && user.userId !== currentUserId,
            ) || null,
        [activeUsers, currentUserId],
    );

    // ------------------------------------------------------------------
    // Save logic
    // ------------------------------------------------------------------
    const handleSaveNow = useCallback(async (): Promise<void> => {
        if (isSavingRef.current) {
            saveQueuedRef.current = true;
            return;
        }

        isSavingRef.current = true;
        setSaveStatus('saving');

        try {
            while (true) {
                saveQueuedRef.current = false;

                const cleanBlocks: NoteBlock[] = blocksRef.current.map((block) =>
                    block.type === 'text'
                        ? { id: block.id, type: 'text', content: block.content ?? '' }
                        : { id: block.id, type: 'checklist', items: block.items ?? [] },
                );

                const data = {
                    title: titleRef.current.trim() || 'Untitled',
                    color: colorRef.current,
                    isPinned: isPinnedRef.current,
                    blocks: cleanBlocks,
                };

                const resolvedId = createResultRef.current ?? noteIdRef.current;

                if (resolvedId) {
                    await updateNote({ projectId, noteId: resolvedId, data }).unwrap();
                } else {
                    const response = await createNote({ projectId, data }).unwrap();
                    const newId = response.data?._id as string | undefined;
                    if (newId) {
                        createResultRef.current = newId;
                        setNoteId(newId);
                    }
                }

                isDirtyRef.current = false;

                if (!saveQueuedRef.current && !isDirtyRef.current) {
                    hasLocalPendingChangesRef.current = false;
                    setSaveStatus('saved');
                    try {
                        localStorage.removeItem(OFFLINE_CACHE_KEY);
                    } catch {
                        // ignore storage errors
                    }
                    break;
                }
            }
        } catch (error) {
            setSaveStatus('error');
            throw error;
        } finally {
            isSavingRef.current = false;
        }
    }, [OFFLINE_CACHE_KEY, createNote, projectId, updateNote]);

    const scheduleSave = useCallback(() => {
        isDirtyRef.current = true;
        hasLocalPendingChangesRef.current = true;
        if (isSavingRef.current) {
            saveQueuedRef.current = true;
        }
        setSaveStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                await handleSaveNow();
            } catch (error) {
                logger.error('Autosave failed', error);
                setSaveStatus('error');
            }
        }, 900);
    }, [handleSaveNow]);

    // Trigger save immediately if offline cache was found on mount
    useEffect(() => {
        if (cachedData) scheduleSave();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once

    // Clear timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    // Re-save when coming back online
    useEffect(() => {
        const handleOnline = () => {
            if (isDirtyRef.current) scheduleSave();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [scheduleSave]);

    // Apply pending block focus after blocks state updates
    useEffect(() => {
        if (!pendingFocusRef.current) return;
        const { id, atStart } = pendingFocusRef.current;
        const handle = blockRefs.current.get(id);
        if (handle) {
            if (atStart) handle.focusAtStart();
            else handle.focus();
            pendingFocusRef.current = null;
        }
    }, [blocks]);

    return {
        // State
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

        // Refs
        blockRefs,
        pendingFocusRef,
        focusedBlockIdRef,
        noteIdRef,

        // Save
        handleSaveNow,
        scheduleSave,

        // Collaboration
        activeUsers,
        visibleActiveUsers,
        isConnected,
        broadcastChange,
        broadcastTitleChange,
        updatePresence,
        getUserEditingBlock,
    };
}
