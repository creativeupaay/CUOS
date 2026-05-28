export interface ChecklistItemData {
    id: string;
    text: string;
    checked: boolean;
}

export interface FormBlock {
    id: string;
    type: 'text' | 'checklist';
    content?: string;
    items?: ChecklistItemData[];
}

export interface MentionableMember {
    userId: string;
    displayName: string;
    email?: string;
    sourceLabel?: string;
}

export interface MentionMenuState {
    blockId: string;
    query: string;
    startOffset: number;
    endOffset: number;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
    activeIndex: number;
}

export interface FocusTarget {
    blockId?: string;
    mentionId?: string;
}

export interface FormatState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
}


export interface BlockMentionHandlers {
    onMentionQueryChange: (blockId: string, element: HTMLDivElement | null) => void;
    onMentionDismiss: (blockId: string) => void;
    onMentionCommand: (blockId: string, key: string) => boolean;
}
