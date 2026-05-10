import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Loader2, X } from 'lucide-react';
import { avatarColor, initials } from '@/lib/utils';

export function AccessBadge({ count, onClick }: { count: number; onClick: (e: React.MouseEvent) => void }) {
    return (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e); }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors"
            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-soft)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            title="View who has access">
            <Eye size={12} /><span>{count}</span>
        </button>
    );
}

export type ViewTarget = { id: string; type: 'folder' | 'file'; name: string; viewAccess: (string | { _id: string; name?: string })[] };

export interface ViewersPanelProps {
    target: ViewTarget;
    projectId: string;
    members: { userId: string; name: string; email: string }[];
    updateFolderAccess: (params: { projectId: string; folderId: string; viewAccess: string[] }) => { unwrap: () => Promise<unknown> };
    updateItemAccess: (params: { projectId: string; itemId: string; viewAccess: string[] }) => { unwrap: () => Promise<unknown> };
    onClose: () => void;
}

export function ViewersPanel({
    target,
    projectId,
    members,
    updateFolderAccess,
    updateItemAccess,
    onClose,
}: ViewersPanelProps) {
    const [removing, setRemoving] = useState<string | null>(null);
    const [localAccess, setLocalAccess] = useState<(string | { _id: string; name?: string })[]>(target.viewAccess);

    const viewers = localAccess.map((u) => {
        const uid = typeof u === 'string' ? u : u._id;
        const populated = typeof u === 'object' && 'name' in u ? u.name : undefined;
        const member = members.find(m => m.userId === uid);
        return { userId: uid, name: populated || member?.name || 'Unknown', email: member?.email || '' };
    });

    const handleRemove = async (userId: string) => {
        setRemoving(userId);
        try {
            const newAccess = localAccess
                .map((u) => typeof u === 'string' ? u : u._id)
                .filter((id: string) => id !== userId);
            if (target.type === 'folder') {
                await updateFolderAccess({ projectId, folderId: target.id, viewAccess: newAccess }).unwrap();
            } else {
                await updateItemAccess({ projectId, itemId: target.id, viewAccess: newAccess }).unwrap();
            }
            setLocalAccess(prev => prev.filter((u) => (typeof u === 'string' ? u : u._id) !== userId));
        } finally {
            setRemoving(null);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
            <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-xl border shadow-2xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                            <Eye size={14} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>View Access</p>
                            <p className="text-xs truncate max-w-[200px]" style={{ color: 'var(--color-text-muted)' }}>{target.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 max-h-72 overflow-y-auto">
                    {viewers.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No one has view access to this {target.type} yet.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {viewers.map((v) => (
                                <div key={v.userId} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor(v.name)}`}>
                                        {initials(v.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{v.name}</p>
                                        {v.email && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{v.email}</p>}
                                    </div>
                                    <button
                                        onClick={() => handleRemove(v.userId)}
                                        disabled={removing === v.userId}
                                        className="p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
                                        style={{ color: 'var(--color-danger)' }}
                                        title="Remove access"
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-danger-soft, #FEE2E2)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        {removing === v.userId ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
