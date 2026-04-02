import { Types } from 'mongoose';
import type { IContentBlock, INoteMention } from '../models/Note.model';

const ATTR_REGEX = /\s([a-zA-Z0-9:-]+)=["']([^"']*)["']/g;

function decodeHtmlAttribute(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function readAttributes(tag: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = ATTR_REGEX.exec(tag)) !== null) {
        attributes[match[1]] = decodeHtmlAttribute(match[2]);
    }

    ATTR_REGEX.lastIndex = 0;
    return attributes;
}

function extractMentionsFromHtml(html: string, blockId: string): INoteMention[] {
    if (!html) return [];

    const mentions: INoteMention[] = [];
    const tagRegex = /<span\b[^>]*data-mention-id=["'][^"']+["'][^>]*>.*?<\/span>/gi;
    let tagMatch: RegExpExecArray | null;

    while ((tagMatch = tagRegex.exec(html)) !== null) {
        const attrs = readAttributes(tagMatch[0]);
        const mentionId = attrs['data-mention-id'];
        const userId = attrs['data-user-id'];
        const displayName = attrs['data-display-name'];

        if (!mentionId || !userId || !displayName || !Types.ObjectId.isValid(userId)) {
            continue;
        }

        mentions.push({
            mentionId,
            userId: new Types.ObjectId(userId),
            blockId,
            displayName,
        });
    }

    return mentions;
}

export function extractNoteMentions(blocks: IContentBlock[] = []): INoteMention[] {
    const deduped = new Map<string, INoteMention>();

    blocks.forEach((block) => {
        if (block.type === 'text' && block.content) {
            extractMentionsFromHtml(block.content, block.id).forEach((mention) => {
                deduped.set(mention.mentionId, mention);
            });
        }

        if (block.type === 'checklist' && block.items?.length) {
            block.items.forEach((item) => {
                extractMentionsFromHtml(item.text || '', block.id).forEach((mention) => {
                    deduped.set(mention.mentionId, mention);
                });
            });
        }
    });

    return Array.from(deduped.values());
}
