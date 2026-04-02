import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Block types ──────────────────────────────────────────────────────────────

export interface IChecklistItem {
    id: string;
    text: string;
    checked: boolean;
}

export type NoteBlockType = 'text' | 'checklist' | 'image';

export interface IContentBlock {
    /** Client-generated UUID that stays stable across edits */
    id: string;
    type: NoteBlockType;
    /** For 'text' blocks — raw text content */
    content?: string;
    /** For 'checklist' blocks */
    items?: IChecklistItem[];
    /** For 'image' blocks — Cloudinary public ID */
    cloudinaryId?: string;
    /** For 'image' blocks — public display URL */
    url?: string;
    /** For 'image' blocks — optional caption */
    caption?: string;
}

export interface INoteMention {
    mentionId: string;
    userId: Types.ObjectId;
    blockId: string;
    displayName: string;
}

// ── Main Note type ────────────────────────────────────────────────────────────

export interface INote extends Document {
    _id: Types.ObjectId;
    projectId: Types.ObjectId;
    title: string;
    /** Hex color string (e.g. '#FEF3C7') used as the card background */
    color: string;
    isPinned: boolean;
    blocks: IContentBlock[];
    mentions: INoteMention[];
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const ChecklistItemSchema = new Schema<IChecklistItem>(
    {
        id: { type: String, required: true },
        text: { type: String, default: '' },
        checked: { type: Boolean, default: false },
    },
    { _id: false }
);

const ContentBlockSchema = new Schema<IContentBlock>(
    {
        id: { type: String, required: true },
        type: { type: String, enum: ['text', 'checklist', 'image'], required: true },
        content: { type: String },
        items: { type: [ChecklistItemSchema], default: undefined },
        cloudinaryId: { type: String },
        url: { type: String },
        caption: { type: String },
    },
    { _id: false }
);

const NoteMentionSchema = new Schema<INoteMention>(
    {
        mentionId: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        blockId: { type: String, required: true },
        displayName: { type: String, required: true, trim: true },
    },
    { _id: false }
);

// ── Note schema ───────────────────────────────────────────────────────────────

const NoteSchema = new Schema<INote>(
    {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        color: { type: String, default: '#FFFFFF' },
        isPinned: { type: Boolean, default: false },
        blocks: { type: [ContentBlockSchema], default: [] },
        mentions: { type: [NoteMentionSchema], default: [] },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        lastEditedAt: { type: Date },
    },
    { timestamps: true }
);

// Pinned notes first, then newest first
NoteSchema.index({ projectId: 1, isPinned: -1, createdAt: -1 });

export const Note = mongoose.model<INote>('Note', NoteSchema);
