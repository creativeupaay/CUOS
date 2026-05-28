import React from 'react';
import { Folder, FolderOpen, MoreVertical, Pencil, Eye, Trash2, Download, Check, X, Loader2 } from 'lucide-react';
import { FileIcon } from '@/components/atoms';
import { ContextMenu } from '@/components/molecules/project/ContextMenu';
import { AccessBadge } from '@/components/organisms/project/ViewersPanel';
import { formatSize, timeAgo } from '@/lib/utils/formatters';
import type { DocFolder, DocItem } from '@/features/project';

interface DocumentCardProps {
    type: 'folder' | 'file';
    data: DocFolder | DocItem;
    view: 'grid' | 'list';
    isDocAdmin: boolean;
    isRenaming: boolean;
    renameValue: string;
    renameExt?: string;
    isMenuOpen: boolean;
    saving: boolean;
    onOpen: () => void;
    onView: () => void;
    onRenameStart: () => void;
    onRenameValueChange: (val: string) => void;
    onRenameConfirm: () => void;
    onRenameCancel: () => void;
    onDelete: () => void;
    onManageAccess: () => void;
    onMenuToggle: (isOpen: boolean) => void;
    onViewAccess: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
    type,
    data,
    view,
    isDocAdmin,
    isRenaming,
    renameValue,
    renameExt = '',
    isMenuOpen,
    saving,
    onOpen,
    onView,
    onRenameStart,
    onRenameValueChange,
    onRenameConfirm,
    onRenameCancel,
    onDelete,
    onManageAccess,
    onMenuToggle,
    onViewAccess,
}) => {
    const isFolder = type === 'folder';
    const folder = data as DocFolder;
    const item = data as DocItem;

    if (view === 'grid') {
        return (
            <div className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-[var(--color-bg-surface)] hover:shadow-md cursor-pointer transition-all select-none"
                style={{ borderColor: 'var(--color-border-default)' }}
                onDoubleClick={isFolder ? onOpen : onView}
                onClick={() => onMenuToggle(false)}>
                {isRenaming ? (
                    <>
                        {isFolder ? (
                            <Folder size={36} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                        ) : (
                            <FileIcon mimeType={item.mimeType} size={36} className="text-[var(--color-primary)]" />
                        )}
                        <div className="flex w-full items-center border rounded-md px-2 py-1 bg-[var(--color-bg-subtle)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]" style={{ borderColor: 'var(--color-border-default)' }}>
                            <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => onRenameValueChange(e.target.value)}
                                className="flex-1 text-xs text-center bg-transparent focus:outline-none min-w-0"
                                style={{ color: 'var(--color-text-primary)' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onRenameConfirm();
                                    if (e.key === 'Escape') onRenameCancel();
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {!isFolder && renameExt && (
                                <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{renameExt}</span>
                            )}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); onRenameConfirm(); }} disabled={saving} className="p-1 rounded text-green-600 hover:bg-green-100">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onRenameCancel(); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                        </div>
                    </>
                ) : (
                    <>
                        {isFolder ? (
                            <Folder size={40} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                        ) : (
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                <FileIcon mimeType={item.mimeType} size={24} className="text-[var(--color-primary)]" />
                            </div>
                        )}
                        <p className="text-xs font-medium text-center leading-tight max-w-full truncate w-full mt-1" style={{ color: 'var(--color-text-primary)' }} title={data.name}>{data.name}</p>
                        {isFolder && folder.isClientShared && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>Shared</span>
                        )}
                        {!isFolder && <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatSize(item.size)}</p>}
                        
                        <div className="flex items-center gap-1">
                            {isDocAdmin && (
                                <AccessBadge
                                    count={isFolder ? (folder as unknown as { accessCount?: number }).accessCount || 0 : item.viewAccess.length}
                                    onClick={onViewAccess}
                                />
                            )}
                            {isDocAdmin && (
                                <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); onMenuToggle(!isMenuOpen); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                        <MoreVertical size={13} />
                                    </button>
                                    {isMenuOpen && (
                                        <ContextMenu onClose={() => onMenuToggle(false)} items={[
                                            isFolder 
                                                ? { label: 'Open', icon: <FolderOpen size={14} />, onClick: onOpen }
                                                : { label: 'Open / Download', icon: <Download size={14} />, onClick: onView },
                                            ...(!isFolder || !folder.isSystem ? [
                                                { label: 'Rename', icon: <Pencil size={14} />, onClick: onRenameStart },
                                                { label: 'Manage access', icon: <Eye size={14} />, onClick: onManageAccess },
                                                { label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, danger: true },
                                            ] : [
                                                { label: 'Manage access', icon: <Eye size={14} />, onClick: onManageAccess },
                                            ]),
                                        ]} />
                                    )}
                                </div>
                            )}
                        </div>
                        {!isFolder && item.uploadedBy && (
                            <p className="text-[10px] truncate w-full text-center" style={{ color: 'var(--color-text-muted)' }}>
                                {typeof item.uploadedBy === 'object' ? item.uploadedBy.name : ''} · {timeAgo(item.createdAt)}
                            </p>
                        )}
                    </>
                )}
            </div>
        );
    }

    // List view
    return (
        <div className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-black/5 border-b last:border-0"
            style={{ borderColor: 'var(--color-border-default)' }}
            onDoubleClick={isFolder ? onOpen : onView}
            onClick={() => onMenuToggle(false)}>
            {isFolder ? (
                <Folder size={18} className="text-[#fbbd23] flex-shrink-0" fill="currentColor" fillOpacity={0.2} />
            ) : (
                <div className="w-[18px] flex-shrink-0"><FileIcon mimeType={item.mimeType} size={18} className="text-[var(--color-primary)]" /></div>
            )}
            
            {isRenaming ? (
                <div className="flex-1 flex items-center border-b" style={{ borderColor: 'var(--color-primary)' }}>
                    <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => onRenameValueChange(e.target.value)}
                        className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
                        style={{ color: 'var(--color-text-primary)' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onRenameConfirm();
                            if (e.key === 'Escape') onRenameCancel();
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    {!isFolder && renameExt && (
                        <span className="text-sm px-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{renameExt}</span>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{data.name}</span>
                    {isFolder && folder.isClientShared && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>Shared</span>
                    )}
                </div>
            )}

            {!isRenaming && (
                <>
                    <span className="text-xs w-16 text-right" style={{ color: 'var(--color-text-muted)' }}>
                        {isFolder ? 'Folder' : formatSize(item.size)}
                    </span>
                    {!isFolder && typeof item.uploadedBy === 'object' && (
                        <span className="text-xs hidden sm:block w-28 text-right truncate" style={{ color: 'var(--color-text-muted)' }}>{item.uploadedBy.name}</span>
                    )}
                    {!isFolder && (
                        <span className="text-xs hidden sm:block w-16 text-right" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(item.createdAt)}</span>
                    )}
                </>
            )}

            {isDocAdmin && (
                <AccessBadge
                    count={isFolder ? (folder as unknown as { accessCount?: number }).accessCount || 0 : item.viewAccess.length}
                    onClick={onViewAccess}
                />
            )}
            
            {isDocAdmin && (
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onMenuToggle(!isMenuOpen); }}
                        className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                        <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                        <ContextMenu onClose={() => onMenuToggle(false)} items={[
                            isFolder 
                                ? { label: 'Open', icon: <FolderOpen size={14} />, onClick: onOpen }
                                : { label: 'Open / Download', icon: <Download size={14} />, onClick: onView },
                            ...(!isFolder || !folder.isSystem ? [
                                { label: 'Rename', icon: <Pencil size={14} />, onClick: onRenameStart },
                                { label: 'Manage access', icon: <Eye size={14} />, onClick: onManageAccess },
                                { label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, danger: true },
                            ] : [
                                { label: 'Manage access', icon: <Eye size={14} />, onClick: onManageAccess },
                            ]),
                        ]} />
                    )}
                </div>
            )}
        </div>
    );
};
