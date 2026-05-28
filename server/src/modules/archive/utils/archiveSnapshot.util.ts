import { Document, Types } from 'mongoose';
import { ArchiveSnapshot } from '../types/archive.types';

type SnapshotInput = Document | Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isMongooseDocument = (value: SnapshotInput): value is Document => (
    isRecord(value) && typeof value.toObject === 'function'
);

const normalizeSnapshotValue = (value: unknown): unknown => {
    if (value === undefined) {
        return undefined;
    }

    if (value instanceof Types.ObjectId) {
        return value.toString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof Map) {
        return Object.fromEntries(
            Array.from(value.entries())
                .map(([key, entryValue]) => [String(key), normalizeSnapshotValue(entryValue)])
                .filter(([, entryValue]) => entryValue !== undefined)
        );
    }

    if (Array.isArray(value)) {
        return value.map(normalizeSnapshotValue);
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, entryValue]) => [key, normalizeSnapshotValue(entryValue)])
                .filter(([, entryValue]) => entryValue !== undefined)
        );
    }

    return value;
};

export const createArchiveSnapshot = (document: SnapshotInput): ArchiveSnapshot => {
    const plainDocument = isMongooseDocument(document)
        ? document.toObject({
            depopulate: true,
            flattenMaps: true,
            getters: false,
            minimize: false,
            virtuals: false,
            versionKey: true,
        })
        : document;

    const snapshot = normalizeSnapshotValue(plainDocument);

    if (!isRecord(snapshot)) {
        throw new Error('Archive snapshot must be a plain object.');
    }

    return snapshot;
};

export const getSnapshotObjectId = (snapshot: ArchiveSnapshot, fieldName: string): Types.ObjectId => {
    const value = snapshot[fieldName];

    if (value instanceof Types.ObjectId) {
        return value;
    }

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
    }

    throw new Error(`Archive snapshot is missing a valid ${fieldName}.`);
};

