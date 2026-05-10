import type { MentionableMember, MentionMenuState, FormatState, FormBlock } from '@/types/notes';
import type { Project } from '@/features/project';

export function uid(): string {
    return Math.random().toString(36).slice(2, 11);
}

export function timeAgo(dateStr: string): string {
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

export function stripHtml(html: string): string {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function htmlToText(html: string): string {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\u00A0/g, ' ').trim();
}

export function linkifyHtml(html: string): string {
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

export function createMentionHtml(member: MentionableMember): string {
    const mentionId = uid();
    return `<span contenteditable="false" class="note-mention-chip" data-mention-id="${mentionId}" data-user-id="${escapeHtml(member.userId)}" data-display-name="${escapeHtml(member.displayName)}">@${escapeHtml(member.displayName)}</span>&nbsp;`;
}

export function buildTextOffsetsRange(root: HTMLElement, startOffset: number, endOffset: number): Range {
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

export function getMentionQuery(root: HTMLElement): Omit<MentionMenuState, 'blockId' | 'activeIndex'> | null {
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

export function buildNoteClipboardText(title: string, blocks: FormBlock[]): string {
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

export function buildNoteClipboardHtml(title: string, blocks: FormBlock[]): string {
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


export function detectFormat(): FormatState {
    return {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
    };
}

export function normalizeMentionableMembers(project?: Project | null): MentionableMember[] {
    if (!project?.assignees?.length) return [];

    const seen = new Set<string>();
    const members: MentionableMember[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    project.assignees.forEach((assignee: any) => {
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
