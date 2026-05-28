import React, { forwardRef, useRef, useState, useEffect, useImperativeHandle } from 'react';
import type { FormBlock, ChecklistItemData, BlockMentionHandlers } from '@/types/notes';
import { stripHtml, linkifyHtml, uid } from '@/utils/notes';

export interface ChecklistBlockHandle {
    focus: () => void;
    focusAtStart: () => void;
}

export interface ChecklistBlockProps extends BlockMentionHandlers {
    block: FormBlock;
    onChange: (id: string, patch: Partial<FormBlock>) => void;
    onInsertAfter: (id: string, type: 'text' | 'checklist') => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
    onConvertToText: (id: string) => void;
}

export const ChecklistBlock = forwardRef<ChecklistBlockHandle, ChecklistBlockProps>(function ChecklistBlock(
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
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsEmpty(!next || next === '<br>');
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
