import React, { useRef } from 'react';
import { Loader2, Folder, FolderOpen, Check, X } from 'lucide-react';
import { useProjectDocuments } from '@/hooks/useProjectDocuments';
import { DocumentCard } from '@/components/molecules';
import { 
    ProjectDocumentsToolbar, 
    AccessControlPanel, 
    ViewersPanel 
} from '@/components/organisms';

const ProjectDocumentsTab: React.FC = () => {
    const {
        projectId,
        currentFolderId,
        displayBreadcrumb,
        viewMode,
        showAccessControl,
        viewTarget,
        showNewFolderInput,
        newFolderName,
        renameFolderId,
        renameFolderName,
        renameItemId,
        renameItemName,
        renameItemExt,
        openMenuId,
        saving,
        uploading,
        
        visibleFolders,
        items,
        members,
        adminsData,
        isLoading,
        isEmpty,
        
        isDocAdmin,
        isPartnerUser,
        canPartnerUploadInCurrentFolder,
        sharedFolderId,

        navigateToFolder,
        navigateToBreadcrumb,
        handleCreateFolder,
        handleRenameFolder,
        handleDeleteFolder,
        handleRenameItem,
        handleDeleteItem,
        handleViewFile,
        handleFileInputChange,
        
        setShowAccessControl,
        setViewTarget,
        setShowNewFolderInput,
        setNewFolderName,
        setRenameFolderId,
        setRenameFolderName,
        setRenameItemId,
        setRenameItemName,
        setRenameItemExt,
        setOpenMenuId,
        setViewMode,

        updateFolderAccess,
        updateItemAccess,
        updateAdmins,
    } = useProjectDocuments();

    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col h-full min-h-[500px] mt-4 rounded-xl border" 
             style={{ backgroundColor: 'var(--color-bg-app)', borderColor: 'var(--color-border-default)' }}>

            <ProjectDocumentsToolbar
                currentFolderId={currentFolderId}
                displayBreadcrumb={displayBreadcrumb}
                viewMode={viewMode}
                uploading={uploading}
                isDocAdmin={isDocAdmin}
                isPartnerUser={isPartnerUser}
                canPartnerUploadInCurrentFolder={canPartnerUploadInCurrentFolder}
                sharedFolderId={sharedFolderId}
                onNavigateToBreadcrumb={navigateToBreadcrumb}
                onNewFolder={() => { setShowNewFolderInput(true); setOpenMenuId(null); }}
                onUpload={() => fileInputRef.current?.click()}
                onShowAccessControl={() => setShowAccessControl(true)}
                onSetViewMode={setViewMode}
            />
            
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />

            <div className="flex-1 overflow-y-auto p-5">
                {isLoading && (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                    </div>
                )}

                {isEmpty && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <FolderOpen size={30} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {currentFolderId ? 'This folder is empty' : 'No documents yet'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                {isDocAdmin
                                    ? 'Create a folder or upload files to get started.'
                                    : canPartnerUploadInCurrentFolder
                                        ? 'Upload files here to share with CUOS and your client.'
                                        : 'Files shared with you will appear here.'}
                            </p>
                        </div>
                        {(isDocAdmin || canPartnerUploadInCurrentFolder) && (
                            <div className="flex gap-2 mt-1">
                                {isDocAdmin && (
                                    <button onClick={() => setShowNewFolderInput(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors btn-ghost" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <Folder size={14} />New Folder
                                    </button>
                                )}
                                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white transition-colors btn-primary">
                                    <FolderOpen size={14} />Upload File
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "rounded-xl border divide-y divide-[var(--color-border-default)]"}>
                    {showNewFolderInput && (
                        viewMode === 'grid' ? (
                            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed hover:shadow-sm" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}>
                                <Folder size={40} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                                <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name"
                                    className="w-full mt-1 px-2 py-1.5 text-xs text-center rounded-md border"
                                    style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }} />
                                <div className="flex gap-1">
                                    <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || saving} className="p-1 rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    </button>
                                    <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors"><X size={14} /></button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                                <Folder size={18} className="flex-shrink-0 text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                                <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder name"
                                    className="flex-1 text-sm bg-transparent border-b focus:outline-none"
                                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text-primary)' }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }} />
                                <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || saving} className="p-1 rounded disabled:opacity-40" style={{ color: 'var(--color-success)' }}><Check size={15} /></button>
                                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}><X size={15} /></button>
                            </div>
                        )
                    )}

                    {!isLoading && visibleFolders.map(folder => (
                        <DocumentCard
                            key={folder._id}
                            type="folder"
                            data={folder}
                            view={viewMode}
                            isDocAdmin={isDocAdmin}
                            isRenaming={renameFolderId === folder._id}
                            renameValue={renameFolderName}
                            isMenuOpen={openMenuId === folder._id}
                            saving={saving}
                            onOpen={() => navigateToFolder(folder)}
                            onView={() => {}}
                            onRenameStart={() => { setRenameFolderId(folder._id); setRenameFolderName(folder.name); setOpenMenuId(null); }}
                            onRenameValueChange={setRenameFolderName}
                            onRenameConfirm={() => handleRenameFolder(folder._id)}
                            onRenameCancel={() => setRenameFolderId(null)}
                            onDelete={() => handleDeleteFolder(folder._id)}
                            onManageAccess={() => setShowAccessControl(true)}
                            onMenuToggle={(isOpen) => setOpenMenuId(isOpen ? folder._id : null)}
                            onViewAccess={() => setViewTarget({ id: folder._id, type: 'folder', name: folder.name, viewAccess: folder.viewAccess })}
                        />
                    ))}

                    {!isLoading && items.map(item => (
                        <DocumentCard
                            key={item._id}
                            type="file"
                            data={item}
                            view={viewMode}
                            isDocAdmin={isDocAdmin}
                            isRenaming={renameItemId === item._id}
                            renameValue={renameItemName}
                            renameExt={renameItemExt}
                            isMenuOpen={openMenuId === item._id}
                            saving={saving}
                            onOpen={() => {}}
                            onView={() => handleViewFile(item)}
                            onRenameStart={() => {
                                const lastDotIdx = item.name.lastIndexOf('.');
                                if (lastDotIdx > 0 && lastDotIdx < item.name.length - 1) {
                                    setRenameItemName(item.name.substring(0, lastDotIdx));
                                    setRenameItemExt(item.name.substring(lastDotIdx));
                                } else {
                                    setRenameItemName(item.name);
                                    setRenameItemExt('');
                                }
                                setRenameItemId(item._id);
                                setOpenMenuId(null);
                            }}
                            onRenameValueChange={setRenameItemName}
                            onRenameConfirm={() => handleRenameItem(item._id)}
                            onRenameCancel={() => setRenameItemId(null)}
                            onDelete={() => handleDeleteItem(item._id)}
                            onManageAccess={() => setShowAccessControl(true)}
                            onMenuToggle={(isOpen) => setOpenMenuId(isOpen ? item._id : null)}
                            onViewAccess={() => setViewTarget({ id: item._id, type: 'file', name: item.name, viewAccess: item.viewAccess })}
                        />
                    ))}
                </div>
            </div>

            {showAccessControl && projectId && (
                <AccessControlPanel
                    projectId={projectId}
                    members={members}
                    adminsData={adminsData}
                    onClose={() => setShowAccessControl(false)}
                    updateFolderAccess={updateFolderAccess}
                    updateItemAccess={updateItemAccess}
                    updateAdmins={updateAdmins}
                />
            )}

            {viewTarget && projectId && (
                <ViewersPanel
                    target={viewTarget}
                    projectId={projectId}
                    members={members}
                    updateFolderAccess={updateFolderAccess}
                    updateItemAccess={updateItemAccess}
                    onClose={() => setViewTarget(null)}
                />
            )}
        </div>
    );
};

export default ProjectDocumentsTab;
