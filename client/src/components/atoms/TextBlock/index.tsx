import React, { forwardRef, useRef, useState, useEffect, useImperativeHandle } from 'react';
import type { FormBlock, FormatState, BlockMentionHandlers } from '@/types/notes';
import { stripHtml, linkifyHtml, detectFormat } from '@/utils/notes';

export interface TextBlockHandle {
    focus: () => void;
    focusAtStart: () => void;
}

export interface TextBlockProps extends BlockMentionHandlers {
    block: FormBlock;
    onChange: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onFocusPrev: (id: string) => void;
    onFocusNext: (id: string) => void;
    onFocused: (id: string) => void;
}

export const TextBlock = forwardRef<TextBlockHandle, TextBlockProps>(function TextBlock(
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

    // Initialise DOM content once on mount — intentionally omits block.content from deps
    useEffect(() => {
        if (divRef.current) divRef.current.innerHTML = block.content || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!divRef.current) return;
        const next = block.content || '';
        if (divRef.current.innerHTML !== next) {
            divRef.current.innerHTML = next;
        }
        setIsEmpty(!next || next === '<br>'); // DOM-sync: runs after paint, no cascade
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
