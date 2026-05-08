import { useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetNotesQuery,
    useCreateNoteMutation,
    useUpdateNoteMutation,
    useDeleteNoteMutation,
} from '@/features/project';
import type { Project, ProjectAssignee, Note, NoteBlock, NoteChecklistItem } from '@/features/project';
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
    Copy,
} from 'lucide-react';
import { useNoteCollaboration } from '@/features/collaboration/hooks/useNoteCollaboration';
import { PresenceAvatars } from '@/features/collaboration/components/PresenceAvatars';
import { BlockPresenceIndicator } from '@/features/collaboration/components/BlockPresenceIndicator';
import { CollaborationStatus } from '@/features/collaboration/components/CollaborationStatus';
import type { NoteBroadcastResponse, UserPresence } from '@/features/collaboration/types/types';
import { logger } from '@/utils/logger';

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

interface MentionableMember {
    userId: string;
    displayName: string;
    email?: string;
    sourceLabel?: string;
}

interface MentionMenuState {
    blockId: string;
    query: string;
    startOffset: number;
    endOffset: number;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
    activeIndex: number;
}

interface FocusTarget {
    blockId?: string;
    mentionId?: string;
}

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

function stripHtml(html: string): string {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function htmlToText(html: string): string {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\u00A0/g, ' ').trim();
}

function linkifyHtml(html: string): string {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const urlRegex = /(https?:\/\/[^\s\u00A0<]+)/g;
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const textNode = node as Text;
        if (!textNode.parentElement?.closest('a,[data-mention-id]')) {
            nodes.push(textNode);
        }
    }

    let changed = false;
    nodes.forEach((textNode) => {
        const text = textNode.nodeValue || '';
        if (!urlRegex.test(text)) return;

        changed = true;
        const fragment = doc.createDocumentFragment();
        let lastIndex = 0;

        text.replace(urlRegex, (match, url, offset) => {
            fragment.appendChild(doc.createTextNode(text.slice(lastIndex, offset)));
            const anchor = doc.createElement('a');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.className = 'text-blue-500 hover:underline cursor-pointer';
            anchor.innerText = url;
            fragment.appendChild(anchor);
            lastIndex = offset + match.length;
            return match;
        });

        fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
        textNode.parentNode?.replaceChild(fragment, textNode);
    });

    return changed ? doc.body.innerHTML : html;
}

function createMentionHtml(member: MentionableMember): string {
    const mentionId = uid();
    return `<span contenteditable="false" class="note-mention-chip" data-mention-id="${mentionId}" data-user-id="${escapeHtml(member.userId)}" data-display-name="${escapeHtml(member.displayName)}">@${escapeHtml(member.displayName)}</span>&nbsp;`;
}

function buildTextOffsetsRange(root: HTMLElement, startOffset: number, endOffset: number): Range {
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let startSet = false;
    let endSet = false;
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const textNode = node as Text;
        const nextOffset = currentOffset + (textNode.nodeValue?.length || 0);

        if (!startSet && startOffset <= nextOffset) {
            range.setStart(textNode, Math.max(0, startOffset - currentOffset));
            startSet = true;
        }

        if (!endSet && endOffset <= nextOffset) {
            range.setEnd(textNode, Math.max(0, endOffset - currentOffset));
            endSet = true;
            break;
        }

        currentOffset = nextOffset;
    }

    if (!startSet) {
        range.selectNodeContents(root);
        range.collapse(true);
    }

    if (!endSet) {
        range.setEnd(range.endContainer, range.endOffset);
    }

    return range;
}

function getMentionQuery(root: HTMLElement): Omit<MentionMenuState, 'blockId' | 'activeIndex'> | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) {
        return null;
    }

    const caretRange = range.cloneRange();
    caretRange.selectNodeContents(root);
    caretRange.setEnd(range.endContainer, range.endOffset);

    const textBeforeCaret = caretRange.toString();
    const match = textBeforeCaret.match(/(^|\s)@([^\s@]{0,40})$/);
    if (!match) {
        return null;
    }

    const query = match[2] || '';
    const endOffset = textBeforeCaret.length;
    const startOffset = endOffset - query.length - 1;
    const rect = range.getBoundingClientRect();
    const fallbackRect = root.getBoundingClientRect();
    const topRect = rect.width || rect.height ? rect : fallbackRect;
    const viewportHeight = window.innerHeight;
    const placement = topRect.bottom + 220 < viewportHeight ? 'bottom' : 'top';

    return {
        query,
        startOffset,
        endOffset,
        top: placement === 'bottom' ? topRect.bottom + 8 : topRect.top - 8,
        left: Math.min(topRect.left, window.innerWidth - 300),
        placement,
    };
}

function buildNoteClipboardText(title: string, blocks: FormBlock[]): string {
    const lines: string[] = [];

    if (title.trim()) {
        lines.push(title.trim(), '');
    }

    blocks.forEach((block) => {
        if (block.type === 'text') {
            const text = htmlToText(block.content || '');
            if (text) lines.push(text);
            return;
        }

        const item = block.items?.[0];
        if (!item) return;
        const prefix = item.checked ? '[x]' : '[ ]';
        lines.push(`${prefix} ${htmlToText(item.text || '')}`.trim());
    });

    return lines.join('\n').trim();
}

function buildNoteClipboardHtml(title: string, blocks: FormBlock[]): string {
    const parts: string[] = [];
    if (title.trim()) {
        parts.push(`<h1>${escapeHtml(title.trim())}</h1>`);
    }

    blocks.forEach((block) => {
        if (block.type === 'text') {
            parts.push(`<p>${block.content || ''}</p>`);
            return;
        }

        const item = block.items?.[0];
        if (!item) return;
        const prefix = item.checked ? '&#9745;' : '&#9744;';
        parts.push(`<p>${prefix} ${item.text || ''}</p>`);
    });

    return parts.join('');
}

function normalizeMentionableMembers(project?: Project | null): MentionableMember[] {
    if (!project?.assignees?.length) return [];

    const seen = new Set<string>();
    const members: MentionableMember[] = [];

    project.assignees.forEach((assignee: ProjectAssignee & Record<string, any>) => {
        const internalUser = typeof assignee.employeeId === 'object' ? assignee.employeeId?.userId : null;
        const partnerUser = assignee.memberType === 'partner-employee' ? assignee.partnerEmployeeId : null;
        const userId =
            (typeof assignee.userId === 'object' ? assignee.userId?._id : assignee.userId) ||
            (typeof internalUser === 'object' ? internalUser?._id : internalUser) ||
            (typeof partnerUser === 'object' ? partnerUser?._id : partnerUser);

        if (!userId || seen.has(String(userId))) return;

        members.push({
            userId: String(userId),
            displayName: assignee.displayName || (typeof internalUser === 'object' ? internalUser?.name : '') || (typeof partnerUser === 'object' ? partnerUser?.name : '') || 'Team member',
            email: assignee.displayEmail || (typeof internalUser === 'object' ? internalUser?.email : '') || (typeof partnerUser === 'object' ? partnerUser?.email : '') || '',
            sourceLabel: assignee.sourceLabel || (assignee.memberType === 'partner-employee' ? 'Partner Team' : 'Creative Upaay'),
        });
        seen.add(String(userId));
    });

    return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

interface ChecklistItemData extends NoteChecklistItem { }

interface FormBlock {
    id: string;
    type: 'text' | 'checklist';
    content?: string;
    items?: ChecklistItemData[];
}

const emptyTextBlock = (): FormBlock => ({ id: uid(), type: 'text', content: '' });
const emptyChecklistBlock = (): FormBlock => ({
    id: uid(),
    type: 'checklist',
    items: [{ id: uid(), text: '', checked: false }],
});

function flattenBlocks(blocks: NoteBlock[]): FormBlock[] {
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

interface FormatState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
}

function detectFormat(): FormatState {
    return {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
    };
}

interface TextBlockHandle {
    focus: () => void;
    focusAtStart: () => void;
}

interface BlockMentionHandlers {
    onMentionQueryChange: (blockId: string, element: HTMLDivElement | null) => void;
    onMentionDismiss: (blockId: string) => void;
    onMentionCommand: (blockId: string, key: string) => boolean;
}

interface TextBlockProps extends BlockMentionHandlers {
    block: FormBlock;
    onChange: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
}

const TextBlock = forwardRef<TextBlockHandle, TextBlockProps>(function TextBlock(
    { block, onChange, onDelete, onFocusPrev, onFocusNext, onFocused, onMentionQueryChange, onMentionDismiss, onMentionCommand },
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
            const selection = window.getSelection();
            range.selectNodeContents(divRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        },
        focusAtStart: () => {
            if (!divRef.current) return;
            divRef.current.focus();
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(divRef.current, 0);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
        },
    }));

    useEffect(() => {
        if (divRef.current) divRef.current.innerHTML = block.content || '';
    }, []);

    useEffect(() => {
        if (!divRef.current) return;
        const next = block.content || '';
        if (divRef.current.innerHTML !== next) {
            divRef.current.innerHTML = next;
            setIsEmpty(!next || next === '<br>');
        }
    }, [block.content]);

    const syncFormats = () => setFormats(detectFormat());

    const syncMentionQuery = () => {
        onMentionQueryChange(block.id, divRef.current);
    };

    const handleInput = () => {
        const html = divRef.current?.innerHTML || '';
        const effective = html === '<br>' || html === '' ? '' : html;
        setIsEmpty(!effective);
        onChange(block.id, effective);
        syncMentionQuery();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (onMentionCommand(block.id, e.key)) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
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

    const handleBlur = () => {
        if (!divRef.current) return;
        const html = divRef.current.innerHTML;
        const linkified = linkifyHtml(html);
        if (html !== linkified) {
            divRef.current.innerHTML = linkified;
            onChange(block.id, linkified);
        }
        window.setTimeout(() => onMentionDismiss(block.id), 0);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        document.execCommand('insertHTML', false, linkifyHtml(text).replace(/\n/g, '<br>'));
        handleInput();
    };

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && anchor.href) {
            e.preventDefault();
            window.open(anchor.href, '_blank', 'noopener,noreferrer');
        }
    };

    const FORMATS: { cmd: string; label: string; title: string; style: React.CSSProperties }[] = [
        { cmd: 'bold', label: 'B', title: 'Bold (Ctrl+B)', style: { fontWeight: 700 } },
        { cmd: 'italic', label: 'I', title: 'Italic (Ctrl+I)', style: { fontStyle: 'italic' } },
        { cmd: 'underline', label: 'U', title: 'Underline (Ctrl+U)', style: { textDecoration: 'underline' } },
    ];

    return (
        <div className="group/textblock">
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
                        Write something...
                    </span>
                )}
                <div
                    ref={divRef}
                    data-note-editable="true"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onKeyUp={() => {
                        syncFormats();
                        syncMentionQuery();
                    }}
                    onMouseUp={() => {
                        syncFormats();
                        syncMentionQuery();
                    }}
                    onSelect={syncFormats}
                    onFocus={() => {
                        syncFormats();
                        onFocused(block.id);
                        syncMentionQuery();
                    }}
                    onBlur={handleBlur}
                    onPaste={handlePaste}
                    onClick={handleClick}
                    className="w-full text-sm outline-none leading-relaxed py-0.5"
                    style={{ minHeight: '24px', color: 'var(--color-text-primary)', wordBreak: 'break-word' }}
                />
            </div>
        </div>
    );
});

interface ChecklistBlockHandle {
    focus: () => void;
    focusAtStart: () => void;
}

interface ChecklistBlockProps extends BlockMentionHandlers {
    block: FormBlock;
    onChange: (id: string, patch: Partial<FormBlock>) => void;
    onInsertAfter: (id: string, type: 'text' | 'checklist') => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
    onConvertToText: (id: string) => void;
}

const ChecklistBlock = forwardRef<ChecklistBlockHandle, ChecklistBlockProps>(function ChecklistBlock(
    { block, onChange, onInsertAfter, onDelete, onFocusPrev, onFocusNext, onFocused, onConvertToText, onMentionQueryChange, onMentionDismiss, onMentionCommand },
    ref
) {
    const divRef = useRef<HTMLDivElement>(null);
    const item: ChecklistItemData = block.items?.[0] ?? { id: uid(), text: '', checked: false };
    const [isEmpty, setIsEmpty] = useState(!item.text);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (!divRef.current) return;
            divRef.current.focus();
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(divRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        },
        focusAtStart: () => {
            if (!divRef.current) return;
            divRef.current.focus();
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(divRef.current, 0);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
        },
    }));

    useEffect(() => {
        if (!divRef.current) return;
        const next = item.text || '';
        if (divRef.current.innerHTML !== next) {
            divRef.current.innerHTML = next;
            setIsEmpty(!next || next === '<br>');
        }
    }, [item.text]);

    const updateItem = (patch: Partial<ChecklistItemData>) => {
        onChange(block.id, { items: [{ ...item, ...patch }] });
    };

    const syncMentionQuery = () => {
        onMentionQueryChange(block.id, divRef.current);
    };

    const handleInput = () => {
        const html = divRef.current?.innerHTML || '';
        const effective = html === '<br>' || html === '' ? '' : html;
        setIsEmpty(!effective);
        updateItem({ text: effective });
        syncMentionQuery();
    };

    const handleBlur = () => {
        if (!divRef.current) return;
        const html = divRef.current.innerHTML;
        const linkified = linkifyHtml(html);
        if (html !== linkified) {
            divRef.current.innerHTML = linkified;
            updateItem({ text: linkified });
        }
        window.setTimeout(() => onMentionDismiss(block.id), 0);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        document.execCommand('insertHTML', false, linkifyHtml(text).replace(/\n/g, '<br>'));
        handleInput();
    };

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && anchor.href) {
            e.preventDefault();
            window.open(anchor.href, '_blank', 'noopener,noreferrer');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onMentionCommand(block.id, e.key)) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (!divRef.current?.innerText.trim()) {
                onConvertToText(block.id);
            } else {
                onInsertAfter(block.id, 'checklist');
            }
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

    return (
        <div className="flex items-start gap-2 py-0.5">
            <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => updateItem({ checked: e.target.checked })}
                className="w-3.5 h-3.5 rounded flex-shrink-0 cursor-pointer accent-indigo-500 mt-1"
            />
            <div className="relative flex-1">
                {isEmpty && (
                    <span
                        className="absolute top-0 left-0 text-sm pointer-events-none select-none opacity-40"
                        style={{ color: 'var(--color-text-secondary)', paddingTop: '2px' }}
                    >
                        List item...
                    </span>
                )}
                <div
                    ref={divRef}
                    data-note-editable="true"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onKeyUp={syncMentionQuery}
                    onMouseUp={syncMentionQuery}
                    onFocus={() => {
                        onFocused(block.id);
                        syncMentionQuery();
                    }}
                    onBlur={handleBlur}
                    onPaste={handlePaste}
                    onClick={handleClick}
                    className="w-full text-sm outline-none border-b border-transparent focus:border-gray-300 pb-0.5 transition-colors leading-relaxed"
                    style={{
                        color: 'var(--color-text-primary)',
                        textDecoration: item.checked ? 'line-through' : 'none',
                        opacity: item.checked ? 0.55 : 1,
                        minHeight: '24px',
                        wordBreak: 'break-word',
                    }}
                />
            </div>
        </div>
    );
});

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
    const textPreview = note.blocks.find((block) => block.type === 'text')?.content || '';
    const cleanPreview = stripHtml(textPreview).slice(0, 100) + (stripHtml(textPreview).length > 100 ? '...' : '');
    const checkCount = note.blocks.filter((block) => block.type === 'checklist').length;
    const checkedCount = note.blocks.filter((block) => block.type === 'checklist' && (block.items as any)?.[0]?.checked).length;

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

interface NoteEditorModalProps {
    projectId: string;
    editingNote: Note | null;
    isAnimating: boolean;
    mentionableMembers: MentionableMember[];
    focusTarget?: FocusTarget;
    onClose: () => void;
}

function NoteEditorModal({ projectId, editingNote, isAnimating, mentionableMembers, focusTarget, onClose }: NoteEditorModalProps) {
    const [createNote] = useCreateNoteMutation();
    const [updateNote] = useUpdateNoteMutation();
    const [tempId] = useState(() => (editingNote?._id ? null : `temp_${uid()}`));
    const OFFLINE_CACHE_KEY = `cuos_note_offline_${editingNote?._id || tempId}`;

    const cachedRef = useRef<{ title: string; color: string; isPinned: boolean; blocks: FormBlock[] } | null>(null);
    if (!cachedRef.current && typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
            if (cached) cachedRef.current = JSON.parse(cached);
        } catch (error) {
            logger.error('Failed to parse offline cache', error);
        }
    }

    const cachedData = cachedRef.current;
    const [title, setTitle] = useState(cachedData?.title ?? (editingNote?.title || ''));
    const [color, setColor] = useState(cachedData?.color ?? (editingNote?.color || '#FFFFFF'));
    const [isPinned, setIsPinned] = useState(cachedData?.isPinned ?? (editingNote?.isPinned || false));
    const [blocks, setBlocks] = useState<FormBlock[]>(() => {
        if (cachedData?.blocks?.length) return cachedData.blocks;
        return editingNote?.blocks?.length ? flattenBlocks(editingNote.blocks as NoteBlock[]) : [emptyTextBlock()];
    });
    const [noteId, setNoteId] = useState<string | null>(editingNote?._id || null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [isSyncing, setIsSyncing] = useState(false);
    const [mentionMenu, setMentionMenu] = useState<MentionMenuState | null>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const currentUserId = currentUser?._id;
    const containerRef = useRef<HTMLDivElement>(null);
    const hasLocalPendingChangesRef = useRef(!!cachedData);

    const createResultRef = useRef<string | null>(editingNote?._id || null);
    const isSavingRef = useRef(false);
    const saveQueuedRef = useRef(false);
    const isDirtyRef = useRef(!!cachedData);
    const pendingFocusRef = useRef<{ id: string; atStart?: boolean } | null>(null);
    const focusedBlockIdRef = useRef<string | null>(null);
    const blockRefs = useRef<Map<string, { focus: () => void; focusAtStart: () => void }>>(new Map());
    const titleRef = useRef(title);
    const colorRef = useRef(color);
    const isPinnedRef = useRef(isPinned);
    const blocksRef = useRef(blocks);
    const noteIdRef = useRef(noteId);
    const highlightedMentionRef = useRef<string | null>(null);

    useEffect(() => {
        titleRef.current = title;
    }, [title]);
    useEffect(() => {
        colorRef.current = color;
    }, [color]);
    useEffect(() => {
        isPinnedRef.current = isPinned;
    }, [isPinned]);
    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);
    useEffect(() => {
        noteIdRef.current = noteId;
    }, [noteId]);

    const persistToLocalCache = useCallback(() => {
        if (!isDirtyRef.current) return;
        try {
            localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ title, color, isPinned, blocks }));
        } catch (error) {
            logger.error('Failed to save to offline cache', error);
        }
    }, [OFFLINE_CACHE_KEY, title, color, isPinned, blocks]);

    useEffect(() => {
        persistToLocalCache();
    }, [persistToLocalCache]);

    const handleRemoteUpdate = useCallback((operation: NoteBroadcastResponse) => {
        setBlocks((prev) => {
            const blockIndex = prev.findIndex((block) => block.id === operation.blockId);

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
                    type: operation.data.type || 'text',
                    content: operation.data.content,
                    items: operation.data.items,
                };
                const position = operation.data.position ?? prev.length;
                const updated = [...prev];
                updated.splice(position, 0, newBlock);
                return updated;
            }

            if (operation.type === 'delete' && blockIndex !== -1) {
                return prev.filter((block) => block.id !== operation.blockId);
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
        setTitle((previous) => (previous === nextTitle ? previous : nextTitle));
    }, []);

    const { activeUsers, isConnected, broadcastChange, broadcastTitleChange, updatePresence } = useNoteCollaboration({
        noteId: noteId || '',
        projectId,
        onRemoteUpdate: handleRemoteUpdate,
        onRemoteTitleUpdate: handleRemoteTitleUpdate,
        onRoomState: handleRoomState,
        onSyncRequired: handleSyncRequired,
        onError: (message) => logger.error('Collaboration error:', message),
    });

    const visibleActiveUsers = activeUsers.filter((user) => user.userId !== currentUserId);

    const getUserEditingBlock = useCallback((blockId: string): UserPresence | null => {
        return activeUsers.find((user) => user.currentBlock === blockId && user.userId !== currentUserId) || null;
    }, [activeUsers, currentUserId]);

    useEffect(() => {
        if (pendingFocusRef.current) {
            const { id, atStart } = pendingFocusRef.current;
            const handle = blockRefs.current.get(id);
            if (handle) {
                if (atStart) handle.focusAtStart();
                else handle.focus();
                pendingFocusRef.current = null;
            }
        }
    }, [blocks]);

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
                        : { id: block.id, type: 'checklist', items: block.items ?? [] }
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
                    } catch (error) { }
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

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    useEffect(() => {
        if (cachedData) scheduleSave();
    }, [cachedData, scheduleSave]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            if (isDirtyRef.current) scheduleSave();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [scheduleSave]);

    const handleClose = useCallback(async () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setMentionMenu(null);
        if (isDirtyRef.current) {
            setSaveStatus('saving');
            try {
                await handleSaveNow();
            } catch (error) {
                logger.error('Save on close failed', error);
            }
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

    const handleTextChange = useCallback((id: string, content: string) => {
        setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, content } : block)));
        scheduleSave();
        if (noteIdRef.current) {
            broadcastChange({ blockId: id, type: 'update', data: { content } });
        }
    }, [broadcastChange, scheduleSave]);

    const handleChecklistChange = useCallback((id: string, patch: Partial<FormBlock>) => {
        setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
        scheduleSave();
        if (noteIdRef.current && patch.items) {
            broadcastChange({ blockId: id, type: 'update', data: { items: patch.items } });
        }
    }, [broadcastChange, scheduleSave]);

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

        if (noteIdRef.current) {
            broadcastChange({
                blockId: newBlock.id,
                type: 'insert',
                data: { type: newBlock.type, content: newBlock.content, items: newBlock.items, position: insertPosition },
            });
        }

        scheduleSave();
    }, [broadcastChange, scheduleSave]);

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

        if (noteIdRef.current && convertIndex !== -1) {
            broadcastChange({ blockId: id, type: 'delete', data: { position: convertIndex } });
            broadcastChange({
                blockId: newTextBlock.id,
                type: 'insert',
                data: { type: 'text', content: '', position: convertIndex },
            });
        }

        scheduleSave();
    }, [broadcastChange, scheduleSave]);

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

        if (noteIdRef.current && deletedIndex !== -1) {
            broadcastChange({ blockId: id, type: 'delete', data: { position: deletedIndex } });
            if (replacement) {
                broadcastChange({
                    blockId: replacement.id,
                    type: 'insert',
                    data: { type: 'text', content: '', position: 0 },
                });
            }
        }

        scheduleSave();
    }, [broadcastChange, scheduleSave]);

    const handleFocusPrev = useCallback((id: string) => {
        const current = blocksRef.current;
        const index = current.findIndex((block) => block.id === id);
        if (index > 0) blockRefs.current.get(current[index - 1].id)?.focus();
    }, []);

    const handleFocusNext = useCallback((id: string) => {
        const current = blocksRef.current;
        const index = current.findIndex((block) => block.id === id);
        if (index < current.length - 1) blockRefs.current.get(current[index + 1].id)?.focus();
    }, []);

    const handleFocused = useCallback((id: string) => {
        focusedBlockIdRef.current = id;
        if (noteIdRef.current) {
            updatePresence(id);
        }
    }, [updatePresence]);

    const filteredMentionMembers = mentionMenu
        ? mentionableMembers.filter((member) => {
            const query = mentionMenu.query.trim().toLowerCase();
            if (!query) return true;
            return member.displayName.toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query);
        })
        : [];

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
    }, [dismissMentionMenu, handleChecklistChange, handleTextChange, mentionMenu]);

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
                                <div className="flex items-center gap-2">
                                    <CollaborationStatus isConnected={isConnected} isSyncing={isSyncing} />
                                    <PresenceAvatars users={visibleActiveUsers} maxDisplay={4} />
                                </div>
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
                                onClick={() => insertBlock(focusedBlockIdRef.current, 'checklist')}
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
                        </div>
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

            {mentionMenu && createPortal(
                <div
                    className="fixed z-[70] w-72 max-h-56 overflow-auto rounded-xl border bg-white shadow-2xl"
                    style={{
                        top: mentionMenu.placement === 'bottom' ? mentionMenu.top : undefined,
                        bottom: mentionMenu.placement === 'top' ? window.innerHeight - mentionMenu.top + 8 : undefined,
                        left: Math.max(12, mentionMenu.left),
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    {filteredMentionMembers.length === 0 ? (
                        <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            No matching team members
                        </div>
                    ) : (
                        filteredMentionMembers.map((member, index) => (
                            <button
                                key={member.userId}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectMentionMember(member);
                                }}
                                className="w-full text-left px-3 py-2 transition-colors"
                                style={{
                                    backgroundColor: index === mentionMenu.activeIndex ? 'var(--color-bg-subtle)' : '#fff',
                                }}
                            >
                                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {member.displayName}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {[member.email, member.sourceLabel].filter(Boolean).join(' • ')}
                                </div>
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}

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
        </>,
        document.body
    );
}

export default function ProjectNotesTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const { project } = useOutletContext<{ project: Project }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useSelector((state: RootState) => state.auth.user);
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
    const pinned = notes.filter((note) => note.isPinned);
    const unpinned = notes.filter((note) => !note.isPinned);
    const mentionableMembers = normalizeMentionableMembers(project);
    const requestedNoteId = searchParams.get('noteId');
    const requestedBlockId = searchParams.get('blockId') || undefined;
    const requestedMentionId = searchParams.get('mentionId') || undefined;

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

    const clearDeepLinkParams = useCallback(() => {
        if (!requestedNoteId && !requestedBlockId && !requestedMentionId) return;
        const next = new URLSearchParams(searchParams);
        next.delete('noteId');
        next.delete('blockId');
        next.delete('mentionId');
        setSearchParams(next, { replace: true });
    }, [requestedBlockId, requestedMentionId, requestedNoteId, searchParams, setSearchParams]);

    const closeModal = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsModalOpen(false);
            setEditingNote(null);
            clearDeepLinkParams();
        }, 300);
    };

    useEffect(() => {
        if (!requestedNoteId || isLoading || isModalOpen) return;
        const targetNote = notes.find((note) => note._id === requestedNoteId);
        if (!targetNote) return;
        setEditingNote(targetNote);
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

    const canModify = (note: Note) => isAdmin || (note.createdBy as any)?._id === currentUser?._id;

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
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={15} />
                    New Note
                </button>
            </div>

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

            {pinned.length > 0 && (
                <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <Pin size={11} /> Pinned
                    </p>
                    <div className="flex flex-col gap-2">
                        {pinned.map((note) => (
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

            {unpinned.length > 0 && (
                <div>
                    {pinned.length > 0 && (
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                            Other Notes
                        </p>
                    )}
                    <div className="flex flex-col gap-2">
                        {unpinned.map((note) => (
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
                    mentionableMembers={mentionableMembers}
                    focusTarget={{ blockId: requestedBlockId, mentionId: requestedMentionId }}
                    onClose={closeModal}
                />
            )}
        </div>
    );
}
