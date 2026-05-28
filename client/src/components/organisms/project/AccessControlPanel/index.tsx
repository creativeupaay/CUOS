import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Check,
    ChevronRight,
    Eye,
    File,
    Folder,
    Loader2,
    Lock,
    Shield,
    UserPlus,
    X,
} from 'lucide-react';

import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { useGetDocFoldersQuery, useGetDocItemsQuery } from '@/features/project';
import { avatarColor, initials } from '@/lib/utils';

// Local dependencies
import { FolderTreeNode } from '@/components/molecules';
import { FileIcon } from '@/components/atoms';

// Types
import type { DocFolder, DocItem } from '@/features/project';

type AcTab = 'view' | 'admins';

interface SelectedAccessItem {
    type: 'folder' | 'file';
    name: string;
    currentAccess: string[];
}

export interface AccessControlPanelProps {
    projectId: string;
    members: { userId: string; name: string; email: string }[];
    adminsData?: { data?: (string | { _id: string })[] } | null;
    onClose: () => void;
    updateFolderAccess: (params: { projectId: string; folderId: string; viewAccess: string[] }) => { unwrap: () => Promise<unknown> };
    updateItemAccess: (params: { projectId: string; itemId: string; viewAccess: string[] }) => { unwrap: () => Promise<unknown> };
    updateAdmins: (params: { projectId: string; userIds: string[] }) => { unwrap: () => Promise<unknown> };
}

export function AccessControlPanel({
    projectId,
    members,
    adminsData,
    onClose,
    updateFolderAccess,
    updateItemAccess,
    updateAdmins,
}: AccessControlPanelProps) {
    const [tab, setTab] = useState<AcTab>('view');

    useBodyScrollLock(true);

    // ── Admins tab state ──
    // Extract admin IDs from the backend response, ensuring they're trimmed strings
    const extractAdminIds = (data: (string | { _id: string })[] | undefined): string[] => {
        return (data ?? []).map((u) => {
            const id = typeof u === 'string' ? u : u._id;
            return typeof id === 'string' ? id.trim() : '';
        }).filter(Boolean);
    };

    const [adminSel, setAdminSel] = useState<string[]>(() => extractAdminIds(adminsData?.data));
    const [adminSaving, setAdminSaving] = useState(false);
    const [adminSaved, setAdminSaved] = useState(false);
    useEffect(() => { setAdminSel(extractAdminIds(adminsData?.data)); }, [adminsData]);

    const saveAdmins = async () => {
        setAdminSaving(true);
        try { await updateAdmins({ projectId, userIds: adminSel }).unwrap(); setAdminSaved(true); setTimeout(() => setAdminSaved(false), 2000); }
        finally { setAdminSaving(false); }
    };

    // ── View Access tab state ──
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedAccessItem>>(new Map());
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [viewSaving, setViewSaving] = useState(false);

    const { data: rootFoldersData, isLoading: rootFoldersLoading } = useGetDocFoldersQuery({ projectId, parentId: null });
    const { data: rootItemsData, isLoading: rootItemsLoading } = useGetDocItemsQuery({ projectId, folderId: null });
    const rootFolders: DocFolder[] = rootFoldersData?.data ?? [];
    const rootItems: DocItem[] = rootItemsData?.data ?? [];
    const rootLoading = rootFoldersLoading || rootItemsLoading;

    const addItems = useCallback((items: { id: string; type: 'folder' | 'file'; name: string; currentAccess: string[] }[]) => {
        setSelectedItems((prev) => {
            const next = new Map(prev);
            items.forEach(({ id, type, name, currentAccess }) => { if (!next.has(id)) next.set(id, { type, name, currentAccess }); });
            return next;
        });
    }, []);

    const removeItems = useCallback((ids: string[]) => {
        setSelectedItems((prev) => {
            const next = new Map(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    }, []);

    const toggleMember = (id: string) => {
        setSelectedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const handleGrantAccess = async () => {
        setViewSaving(true);
        try {
            for (const [id, { type, currentAccess }] of selectedItems) {
                const merged = Array.from(new Set([...currentAccess, ...selectedMembers]));
                if (type === 'folder') {
                    await updateFolderAccess({ projectId, folderId: id, viewAccess: merged }).unwrap().catch(() => { });
                } else {
                    await updateItemAccess({ projectId, itemId: id, viewAccess: merged }).unwrap().catch(() => { });
                }
            }
            // Close panel after successful grant
            onClose();
        } finally {
            setViewSaving(false);
        }
    };

    const TABS: { id: AcTab; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
        { id: 'view', label: 'View Access', icon: Eye },
        { id: 'admins', label: 'Admins', icon: Shield },
    ];

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />
            <div
                className="fixed top-0 right-0 h-full w-[480px] z-50 flex flex-col shadow-2xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', animation: 'slideInRight 0.28s cubic-bezier(0.22,1,0.36,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 pt-5 pb-0 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                                <Lock size={15} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Access Control</h2>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Manage who can view or manage documents</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
                                    style={{
                                        borderColor: active ? 'var(--color-primary)' : 'transparent',
                                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                        backgroundColor: 'transparent',
                                    }}
                                >
                                    <Icon size={14} />{t.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">

                    {/* ── View Access Tab ── */}
                    {tab === 'view' && (
                        <div className="p-5 space-y-4">
                            {/* Step Indicator */}
                            <div className="flex items-center gap-2 text-xs font-semibold">
                                <span className="px-3 py-1 rounded-full transition-colors"
                                    style={{ backgroundColor: step === 1 ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: step === 1 ? '#fff' : 'var(--color-text-secondary)' }}>
                                    1. Select Items
                                </span>
                                <ChevronRight size={13} style={{ color: 'var(--color-text-muted)' }} />
                                <span className="px-3 py-1 rounded-full transition-colors"
                                    style={{ backgroundColor: step === 2 ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: step === 2 ? '#fff' : 'var(--color-text-secondary)' }}>
                                    2. Select Members
                                </span>
                            </div>

                            {/* Step 1: Folder & File Tree */}
                            {step === 1 && (
                                <div className="space-y-3">
                                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        Select folders to share all files inside, or expand folders to pick specific files.
                                    </p>
                                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {rootLoading && (
                                            <div className="py-8 flex justify-center">
                                                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                        )}
                                        {!rootLoading && rootFolders.length === 0 && rootItems.length === 0 && (
                                            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No documents yet.</div>
                                        )}
                                        {!rootLoading && (
                                            <div className="py-1">
                                                {rootFolders.map((folder) => (
                                                    <FolderTreeNode
                                                        key={folder._id}
                                                        projectId={projectId}
                                                        folder={folder}
                                                        depth={0}
                                                        selectedItems={selectedItems}
                                                        onAddItems={addItems}
                                                        onRemoveItems={removeItems}
                                                    />
                                                ))}
                                                {rootItems.map((item) => {
                                                    const itemAccessIds = item.viewAccess.map((u: string | { _id: string }) => typeof u === 'string' ? u : u._id);
                                                    const isItemSel = selectedItems.has(item._id);
                                                    return (
                                                        <div
                                                            key={item._id}
                                                            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer mx-1 my-0.5"
                                                            style={{ backgroundColor: isItemSel ? 'var(--color-primary-soft)' : 'transparent' }}
                                                            onMouseEnter={(e) => { if (!isItemSel) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                                            onMouseLeave={(e) => { if (!isItemSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                            onClick={() => {
                                                                if (isItemSel) removeItems([item._id]);
                                                                else addItems([{ id: item._id, type: 'file', name: item.name, currentAccess: itemAccessIds }]);
                                                            }}
                                                        >
                                                            <div className="w-[17px]" />
                                                            <div
                                                                className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                                                style={{
                                                                    borderColor: isItemSel ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                                    backgroundColor: isItemSel ? 'var(--color-primary)' : 'transparent',
                                                                }}
                                                            >
                                                                {isItemSel && <Check size={9} className="text-white" strokeWidth={3} />}
                                                            </div>
                                                            <FileIcon mimeType={item.mimeType} size={14} className="flex-shrink-0 text-[var(--color-primary)]" />
                                                            <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                                                            {item.viewAccess.length > 0 && (
                                                                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                                                                    {item.viewAccess.length} member{item.viewAccess.length !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {selectedItems.size > 0 && (
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                                            </span>
                                            <button
                                                onClick={() => setStep(2)}
                                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors btn-primary"
                                            >
                                                Next: Select Members <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 2: Member selection */}
                            {step === 2 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            Choose which members can view the {selectedItems.size} selected item{selectedItems.size !== 1 ? 's' : ''}.
                                        </p>
                                        <button onClick={() => setStep(1)} className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>Back</button>
                                    </div>

                                    {/* Selection summary */}
                                    <div className="rounded-lg border p-2.5 space-y-1" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Sharing access to:</p>
                                        {Array.from(selectedItems.entries()).map(([id, { type, name }]) => (
                                            <div key={id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                                                {type === 'folder'
                                                    ? <Folder size={12} className="text-[#fbbd23] flex-shrink-0" fill="currentColor" fillOpacity={0.3} />
                                                    : <File size={12} className="flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                                                }
                                                <span className="truncate">{name}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        {members.length === 0 ? (
                                            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No team members assigned.</p>
                                        ) : (
                                            members.map((m) => {
                                                const sel = selectedMembers.includes(m.userId);
                                                return (
                                                    <button
                                                        key={m.userId}
                                                        type="button"
                                                        onClick={() => toggleMember(m.userId)}
                                                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors"
                                                        style={{
                                                            borderColor: sel ? 'var(--color-success)' : 'var(--color-border-default)',
                                                            backgroundColor: sel ? 'var(--color-success-soft)' : 'var(--color-bg-surface)',
                                                        }}
                                                    >
                                                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                                            style={{
                                                                borderColor: sel ? 'var(--color-success)' : 'var(--color-border-default)',
                                                                backgroundColor: sel ? 'var(--color-success)' : 'transparent',
                                                            }}>
                                                            {sel && <Check size={9} className="text-white" strokeWidth={3} />}
                                                        </div>
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor(m.name)}`}>
                                                            {initials(m.name)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                                                            {m.email && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{m.email}</p>}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {selectedMembers.length > 0 && (
                                        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <button
                                                onClick={handleGrantAccess}
                                                disabled={viewSaving}
                                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                                                style={{ backgroundColor: 'var(--color-success)' }}
                                            >
                                                {viewSaving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                                {viewSaving ? 'Granting…' : `Grant to ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Admins Tab ── */}
                    {tab === 'admins' && (
                        <div className="p-5 space-y-4">
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                Document Admins can <strong>upload, delete, create folders</strong>, and manage all access settings.
                            </p>
                            {members.length === 0 ? (
                                <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No team members assigned.</p>
                            ) : (
                                <div className="space-y-2">
                                    {members.map((m) => {
                                        const sel = adminSel.includes(m.userId);
                                        return (
                                            <button
                                                key={m.userId}
                                                type="button"
                                                onClick={() => setAdminSel((prev) => prev.includes(m.userId) ? prev.filter((x) => x !== m.userId) : [...prev, m.userId])}
                                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors"
                                                style={{
                                                    borderColor: sel ? 'var(--color-success)' : 'var(--color-border-default)',
                                                    backgroundColor: sel ? 'var(--color-success-soft)' : 'var(--color-bg-surface)',
                                                }}
                                            >
                                                <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                                    style={{
                                                        borderColor: sel ? 'var(--color-success)' : 'var(--color-border-default)',
                                                        backgroundColor: sel ? 'var(--color-success)' : 'transparent',
                                                    }}>
                                                    {sel && <Check size={9} className="text-white" strokeWidth={3} />}
                                                </div>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor(m.name)}`}>
                                                    {initials(m.name)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                                                    {m.email && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{m.email}</p>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button
                                    type="button"
                                    onClick={saveAdmins}
                                    disabled={adminSaving}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: adminSaved ? 'var(--color-success-dark, #16a34a)' : 'var(--color-success)' }}
                                >
                                    {adminSaving ? <Loader2 size={14} className="animate-spin" /> : adminSaved ? <Check size={14} /> : <Shield size={14} />}
                                    {adminSaving ? 'Saving…' : adminSaved ? 'Saved!' : 'Save Admins'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
