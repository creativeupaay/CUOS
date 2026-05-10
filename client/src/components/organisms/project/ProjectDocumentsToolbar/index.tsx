import React from 'react';
import { Home, ChevronRight, FolderPlus, Upload, Lock, LayoutGrid, List, Loader2 } from 'lucide-react';

interface BreadcrumbItem {
    id: string;
    name: string;
    idx: number;
}

interface ProjectDocumentsToolbarProps {
    currentFolderId: string | null;
    displayBreadcrumb: BreadcrumbItem[];
    viewMode: 'grid' | 'list';
    uploading: boolean;
    isDocAdmin: boolean;
    isPartnerUser: boolean;
    canPartnerUploadInCurrentFolder: boolean;
    sharedFolderId: string | null;
    onNavigateToBreadcrumb: (idx: number) => void;
    onNewFolder: () => void;
    onUpload: () => void;
    onShowAccessControl: () => void;
    onSetViewMode: (mode: 'grid' | 'list') => void;
}

export const ProjectDocumentsToolbar: React.FC<ProjectDocumentsToolbarProps> = ({
    currentFolderId,
    displayBreadcrumb,
    viewMode,
    uploading,
    isDocAdmin,
    isPartnerUser,
    canPartnerUploadInCurrentFolder,
    sharedFolderId,
    onNavigateToBreadcrumb,
    onNewFolder,
    onUpload,
    onShowAccessControl,
    onSetViewMode,
}) => {
    const isRootActive = isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null;

    return (
        <div className="flex items-center gap-2 px-5 py-4 border-b flex-wrap gap-y-2 rounded-t-xl" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
            <nav className="flex items-center gap-1 flex-1 min-w-0 text-sm overflow-hidden">
                <button onClick={() => {
                    if (isPartnerUser && sharedFolderId) {
                        onNavigateToBreadcrumb(displayBreadcrumb.find(b => b.id === sharedFolderId)?.idx ?? -1);
                        return;
                    }
                    onNavigateToBreadcrumb(-1);
                }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors`}
                    style={{
                        color: isRootActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        backgroundColor: isRootActive ? 'var(--color-primary-soft)' : 'transparent',
                        fontWeight: isRootActive ? 500 : 400
                    }}
                    onMouseEnter={(e) => {
                        if (!isRootActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                        if (!isRootActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <Home size={14} /><span>Documents</span>
                </button>
                {displayBreadcrumb.map((crumb, idx) => (
                    <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                        <ChevronRight size={13} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
                        <button onClick={() => onNavigateToBreadcrumb(crumb.idx)}
                            className={`px-3 py-1.5 rounded-full min-w-0 truncate max-w-[160px] transition-colors`}
                            style={{
                                color: idx === displayBreadcrumb.length - 1 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                backgroundColor: idx === displayBreadcrumb.length - 1 ? 'var(--color-primary-soft)' : 'transparent',
                                fontWeight: idx === displayBreadcrumb.length - 1 ? 500 : 400
                            }}
                            onMouseEnter={(e) => { if (idx !== displayBreadcrumb.length - 1) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)' }}
                            onMouseLeave={(e) => { if (idx !== displayBreadcrumb.length - 1) e.currentTarget.style.backgroundColor = 'transparent' }}
                            title={crumb.name}>{crumb.name}
                        </button>
                    </span>
                ))}
            </nav>

            <div className="flex items-center gap-3 flex-shrink-0">
                {(isDocAdmin || canPartnerUploadInCurrentFolder) && (
                    <>
                        {isDocAdmin && (
                            <button onClick={onNewFolder}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg border transition-colors btn-ghost"
                                style={{ borderColor: 'var(--color-border-default)' }}>
                                <FolderPlus size={15} />New Folder
                            </button>
                        )}
                        <button onClick={onUpload} disabled={uploading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-60 btn-primary">
                            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                        {isDocAdmin && (
                            <button onClick={onShowAccessControl}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg border transition-colors btn-ghost"
                                style={{ borderColor: 'var(--color-border-default)' }}>
                                <Lock size={15} />Access Control
                            </button>
                        )}
                    </>
                )}
                <div className="flex items-center border rounded-lg p-0.5" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <button onClick={() => onSetViewMode('grid')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: viewMode === 'grid' ? 'var(--color-bg-surface)' : 'transparent',
                            color: viewMode === 'grid' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                        }}>
                        <LayoutGrid size={15} />
                    </button>
                    <button onClick={() => onSetViewMode('list')}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: viewMode === 'list' ? 'var(--color-bg-surface)' : 'transparent',
                            color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                        }}>
                        <List size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
};
