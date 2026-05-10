import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { FormBlock, MentionableMember, MentionMenuState } from '@/types/notes';
import type { BlockOperation } from '@/features/collaboration';
import { emptyTextBlock, emptyChecklistBlock } from '@/hooks/useNoteEditor';
import { getMentionQuery, buildTextOffsetsRange, createMentionHtml } from '@/utils/notes';
import { TextBlock } from '@/components/atoms/TextBlock';
import { ChecklistBlock } from '@/components/atoms/ChecklistBlock';
import { MentionMenu } from '@/components/molecules/MentionMenu';
import { BlockPresenceIndicator } from '@/features/collaboration';
import type { UserPresence } from '@/features/collaboration';

interface BlockEditorProps {
    blocks: FormBlock[];
    setBlocks: React.Dispatch<React.SetStateAction<FormBlock[]>>;
    mentionableMembers: MentionableMember[];
    blockRefs: React.MutableRefObject<Map<string, { focus: () => void; focusAtStart: () => void }>>;
    pendingFocusRef: React.MutableRefObject<{ id: string; atStart?: boolean } | null>;
    focusedBlockIdRef: React.MutableRefObject<string | null>;
    onBroadcast: (change: Omit<BlockOperation, 'noteId' | 'timestamp' | 'userId' | 'version'>) => void;
    scheduleSave: () => void;
    getUserEditingBlock: (blockId: string) => UserPresence | null;
    updatePresence: (blockId: string) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function BlockEditor({
    blocks,
    setBlocks,
    mentionableMembers,
    blockRefs,
    pendingFocusRef,
    focusedBlockIdRef,
    onBroadcast,
    scheduleSave,
    getUserEditingBlock,
    updatePresence,
    containerRef,
}: BlockEditorProps) {
    const [mentionMenu, setMentionMenu] = useState<MentionMenuState | null>(null);

    // Keep stable ref for blocks
    const blocksRef = useRef(blocks);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);

    const handleTextChange = useCallback((id: string, content: string) => {
        setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, content } : block)));
        scheduleSave();
        onBroadcast({ blockId: id, type: 'update', data: { content } });
    }, [onBroadcast, scheduleSave, setBlocks]);

    const handleChecklistChange = useCallback((id: string, patch: Partial<FormBlock>) => {
        setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
        scheduleSave();
        if (patch.items) {
            onBroadcast({ blockId: id, type: 'update', data: { items: patch.items } });
        }
    }, [onBroadcast, scheduleSave, setBlocks]);

    const insertBlock = useCallback((afterId: string | null, type: 'text' | 'checklist') => {
        const newBlock = type === 'text' ? emptyTextBlock() : emptyChecklistBlock();
        const current = blocksRef.current;
        const afterIndex = afterId ? current.findIndex((block) => block.id === afterId) : -1;
        const insertPosition = afterId === null ? current.length : afterIndex === -1 ? current.length : afterIndex + 1;

        pendingFocusRef.current = { id: newBlock.id };

        setBlocks((prev) => {
            const next = [...prev];
            next.splice(insertPosition, 0, newBlock);
            return next;
        });

        onBroadcast({
            blockId: newBlock.id,
            type: 'insert',
            data: { type: newBlock.type, content: newBlock.content, items: newBlock.items, position: insertPosition },
        });

        scheduleSave();
    }, [onBroadcast, pendingFocusRef, scheduleSave, setBlocks]);

    const handleConvertToText = useCallback((id: string) => {
        const newTextBlock = emptyTextBlock();
        const current = blocksRef.current;
        const convertIndex = current.findIndex((block) => block.id === id);
        pendingFocusRef.current = { id: newTextBlock.id };

        setBlocks((prev) => {
            const next = [...prev];
            const idx = next.findIndex((block) => block.id === id);
            if (idx === -1) return prev;
            next.splice(idx, 1, newTextBlock);
            return next;
        });

        if (convertIndex !== -1) {
            onBroadcast({ blockId: id, type: 'delete', data: { position: convertIndex } });
            onBroadcast({
                blockId: newTextBlock.id,
                type: 'insert',
                data: { type: 'text', content: '', position: convertIndex },
            });
        }

        scheduleSave();
    }, [onBroadcast, pendingFocusRef, scheduleSave, setBlocks]);

    const handleDeleteBlock = useCallback((id: string) => {
        const current = blocksRef.current;
        const deletedIndex = current.findIndex((block) => block.id === id);
        const isLastBlock = current.length === 1;
        const replacement = isLastBlock ? emptyTextBlock() : null;

        setBlocks((prev) => {
            const next = prev.filter((block) => block.id !== id);
            if (next.length > 0) return next;
            if (replacement) {
                pendingFocusRef.current = { id: replacement.id };
                return [replacement];
            }
            return [emptyTextBlock()];
        });

        if (deletedIndex !== -1) {
            onBroadcast({ blockId: id, type: 'delete', data: { position: deletedIndex } });
            if (replacement) {
                onBroadcast({
                    blockId: replacement.id,
                    type: 'insert',
                    data: { type: 'text', content: '', position: 0 },
                });
            }
        }

        scheduleSave();
    }, [onBroadcast, pendingFocusRef, scheduleSave, setBlocks]);

    const handleFocusPrev = useCallback((id: string) => {
        const current = blocksRef.current;
        const index = current.findIndex((block) => block.id === id);
        if (index > 0) blockRefs.current.get(current[index - 1].id)?.focus();
    }, [blockRefs]);

    const handleFocusNext = useCallback((id: string) => {
        const current = blocksRef.current;
        const index = current.findIndex((block) => block.id === id);
        if (index < current.length - 1) blockRefs.current.get(current[index + 1].id)?.focus();
    }, [blockRefs]);

    const handleFocused = useCallback((id: string) => {
        focusedBlockIdRef.current = id;
        updatePresence(id);
    }, [focusedBlockIdRef, updatePresence]);

    const filteredMentionMembers = useMemo(
        () =>
            mentionMenu
                ? mentionableMembers.filter((member) => {
                    const query = mentionMenu.query.trim().toLowerCase();
                    if (!query) return true;
                    return member.displayName.toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query);
                })
                : [],
        [mentionMenu, mentionableMembers]
    );

    const dismissMentionMenu = useCallback((blockId?: string) => {
        setMentionMenu((current) => {
            if (!current) return null;
            if (!blockId || current.blockId === blockId) return null;
            return current;
        });
    }, []);

    const handleMentionQueryChange = useCallback((blockId: string, element: HTMLDivElement | null) => {
        if (!element) {
            dismissMentionMenu(blockId);
            return;
        }

        const query = getMentionQuery(element);
        if (!query) {
            dismissMentionMenu(blockId);
            return;
        }

        setMentionMenu((current) => ({
            blockId,
            ...query,
            activeIndex:
                current && current.blockId === blockId && current.query === query.query
                    ? Math.min(current.activeIndex, Math.max(filteredMentionMembers.length - 1, 0))
                    : 0,
        }));
    }, [dismissMentionMenu, filteredMentionMembers.length]);

    const selectMentionMember = useCallback((member: MentionableMember) => {
        if (!mentionMenu || !containerRef.current) return;

        const blockElement = containerRef.current.querySelector<HTMLElement>(`[data-note-block-id="${CSS.escape(mentionMenu.blockId)}"] [data-note-editable="true"]`);
        if (!blockElement) return;

        const replaceRange = buildTextOffsetsRange(blockElement, mentionMenu.startOffset, mentionMenu.endOffset);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(replaceRange);
        document.execCommand('insertHTML', false, createMentionHtml(member));

        const updatedHtml = blockElement.innerHTML;
        const currentBlock = blocksRef.current.find((block) => block.id === mentionMenu.blockId);
        if (currentBlock?.type === 'text') {
            handleTextChange(mentionMenu.blockId, updatedHtml);
        } else if (currentBlock?.items?.[0]) {
            handleChecklistChange(mentionMenu.blockId, {
                items: [{ ...currentBlock.items[0], text: updatedHtml }],
            });
        }

        blockElement.focus();
        dismissMentionMenu(mentionMenu.blockId);
    }, [containerRef, dismissMentionMenu, handleChecklistChange, handleTextChange, mentionMenu]);

    const handleMentionCommand = useCallback((blockId: string, key: string) => {
        if (!mentionMenu || mentionMenu.blockId !== blockId) {
            return false;
        }

        const total = filteredMentionMembers.length;
        if (key === 'Escape') {
            dismissMentionMenu(blockId);
            return true;
        }

        if (!total) {
            if (key === 'Enter' || key === 'Tab' || key === 'ArrowDown' || key === 'ArrowUp') {
                dismissMentionMenu(blockId);
                return true;
            }
            return false;
        }

        if (key === 'ArrowDown') {
            setMentionMenu((current) => current ? { ...current, activeIndex: (current.activeIndex + 1) % total } : current);
            return true;
        }

        if (key === 'ArrowUp') {
            setMentionMenu((current) => current ? { ...current, activeIndex: (current.activeIndex - 1 + total) % total } : current);
            return true;
        }

        if (key === 'Enter' || key === 'Tab') {
            selectMentionMember(filteredMentionMembers[mentionMenu.activeIndex] || filteredMentionMembers[0]);
            return true;
        }

        return false;
    }, [dismissMentionMenu, filteredMentionMembers, mentionMenu, selectMentionMember]);

    return (
        <div className="flex flex-col gap-3">
            {blocks.map((block) => {
                const userEditing = getUserEditingBlock(block.id);

                if (block.type === 'text') {
                    return (
                        <div key={block.id} data-note-block-id={block.id} className="relative">
                            <BlockPresenceIndicator user={userEditing} />
                            <TextBlock
                                block={block}
                                ref={(element) => {
                                    if (element) blockRefs.current.set(block.id, element);
                                    else blockRefs.current.delete(block.id);
                                }}
                                onChange={handleTextChange}
                                onDelete={handleDeleteBlock}
                                onFocusPrev={handleFocusPrev}
                                onFocusNext={handleFocusNext}
                                onFocused={handleFocused}
                                onMentionQueryChange={handleMentionQueryChange}
                                onMentionDismiss={dismissMentionMenu}
                                onMentionCommand={handleMentionCommand}
                            />
                        </div>
                    );
                }

                if (block.type === 'checklist') {
                    return (
                        <div key={block.id} data-note-block-id={block.id} className="relative">
                            <BlockPresenceIndicator user={userEditing} />
                            <ChecklistBlock
                                block={block}
                                ref={(element) => {
                                    if (element) blockRefs.current.set(block.id, element);
                                    else blockRefs.current.delete(block.id);
                                }}
                                onChange={handleChecklistChange}
                                onInsertAfter={(id) => insertBlock(id, 'checklist')}
                                onDelete={handleDeleteBlock}
                                onFocusPrev={handleFocusPrev}
                                onFocusNext={handleFocusNext}
                                onFocused={handleFocused}
                                onConvertToText={handleConvertToText}
                                onMentionQueryChange={handleMentionQueryChange}
                                onMentionDismiss={dismissMentionMenu}
                                onMentionCommand={handleMentionCommand}
                            />
                        </div>
                    );
                }

                return null;
            })}

            <MentionMenu
                mentionMenu={mentionMenu}
                filteredMentionMembers={filteredMentionMembers}
                onSelectMember={selectMentionMember}
            />
            
            <style>{`
                .note-mention-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 1px 6px;
                    border-radius: 999px;
                    background: rgba(37, 99, 235, 0.12);
                    color: #1d4ed8;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .note-mention-target {
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.28);
                    background: rgba(59, 130, 246, 0.18);
                    transition: box-shadow 0.2s ease, background 0.2s ease;
                }
            `}</style>
        </div>
    );
}
