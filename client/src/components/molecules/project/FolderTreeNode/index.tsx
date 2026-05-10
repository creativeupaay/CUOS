import React, { useState, useMemo } from 'react';
import { ChevronRight, Folder, Check, Loader2 } from 'lucide-react';
import { useGetDocFoldersQuery, useGetDocItemsQuery } from '@/features/project';
import type { DocFolder, DocItem } from '@/features/project';
import { FileIcon } from '@/components/atoms';

export type SelectedAccessItem = { type: 'folder' | 'file'; currentAccess: string[]; name: string };

export interface FolderTreeNodeProps {
    projectId: string;
    folder: DocFolder;
    depth: number;
    selectedItems: Map<string, SelectedAccessItem>;
    onAddItems: (items: { id: string; type: 'folder' | 'file'; name: string; currentAccess: string[] }[]) => void;
    onRemoveItems: (ids: string[]) => void;
    parentFolderSelected?: boolean;
}

export function FolderTreeNode({
    projectId,
    folder,
    depth,
    selectedItems,
    onAddItems,
    onRemoveItems,
    parentFolderSelected = false,
}: FolderTreeNodeProps) {
    const [expanded, setExpanded] = useState(false);

    const { data: subFoldersData, isLoading: subFoldersLoading } = useGetDocFoldersQuery(
        { projectId, parentId: folder._id },
        { skip: !expanded }
    );
    const { data: subItemsData, isLoading: subItemsLoading } = useGetDocItemsQuery(
        { projectId, folderId: folder._id },
        { skip: !expanded }
    );
    const subFolders: DocFolder[] = subFoldersData?.data ?? [];
    const subItems: DocItem[] = subItemsData?.data ?? [];
    const isLoadingChildren = subFoldersLoading || subItemsLoading;

    const folderAccessIds = folder.viewAccess.map((u: string | { _id: string }) => typeof u === 'string' ? u : u._id);
    const isSelected = selectedItems.has(folder._id) || parentFolderSelected;
    const isFolderDirectlySelected = selectedItems.has(folder._id);

    // Calculate indeterminate state: some children selected individually (not via this folder)
    const childFileIds = subItems.map(i => i._id);
    const selectedChildFilesCount = useMemo(() => {
        return childFileIds.filter(id => selectedItems.has(id)).length;
    }, [childFileIds, selectedItems]);

    const hasIndividualChildSelections = selectedChildFilesCount > 0 && !isFolderDirectlySelected && !parentFolderSelected;
    const isIndeterminate = hasIndividualChildSelections && selectedChildFilesCount < childFileIds.length;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolderDirectlySelected) {
            // Deselect folder - also remove any individually selected children
            const idsToRemove = [folder._id];
            childFileIds.forEach(id => {
                if (selectedItems.has(id)) idsToRemove.push(id);
            });
            onRemoveItems(idsToRemove);
        } else {
            // Select folder (which grants access to ALL files in the folder via backend)
            // Also remove any individually selected files since folder-level access covers them
            const idsToRemove = childFileIds.filter(id => selectedItems.has(id));
            if (idsToRemove.length > 0) {
                onRemoveItems(idsToRemove);
            }
            setExpanded(true);
            onAddItems([{ id: folder._id, type: 'folder', name: folder.name, currentAccess: folderAccessIds }]);
        }
    };

    return (
        <div>
            <div
                className="group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer mx-1 my-0.5"
                style={{
                    paddingLeft: `${depth * 20 + 12}px`,
                    backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className="p-0.5 rounded flex-shrink-0 transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <ChevronRight size={13} className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
                </button>
                <div
                    className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
                    style={{
                        borderColor: isSelected ? 'var(--color-primary)' : isIndeterminate ? 'var(--color-primary)' : 'var(--color-border-default)',
                        backgroundColor: isSelected ? 'var(--color-primary)' : isIndeterminate ? 'var(--color-primary)' : 'transparent',
                    }}
                    onClick={handleToggle}
                >
                    {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    {isIndeterminate && <div className="w-2 h-0.5 bg-white rounded-full" />}
                </div>
                <Folder size={15} className="text-[#fbbd23] flex-shrink-0" fill="currentColor" fillOpacity={0.2} />
                <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                    onClick={handleToggle}
                >
                    {folder.name}
                </span>
                {(folder as DocFolder & { accessCount?: number }).accessCount !== undefined && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {(folder as DocFolder & { accessCount: number }).accessCount} member{(folder as DocFolder & { accessCount: number }).accessCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {expanded && (
                <div>
                    {isLoadingChildren && (
                        <div style={{ paddingLeft: `${(depth + 1) * 20 + 20}px` }} className="py-1.5">
                            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                    )}
                    {!isLoadingChildren && subFolders.length === 0 && subItems.length === 0 && (
                        <div
                            className="py-1.5 text-xs italic"
                            style={{ paddingLeft: `${(depth + 1) * 20 + 28}px`, color: 'var(--color-text-muted)' }}
                        >
                            Empty folder
                        </div>
                    )}
                    {subFolders.map((sf) => (
                        <FolderTreeNode
                            key={sf._id}
                            projectId={projectId}
                            folder={sf}
                            depth={depth + 1}
                            selectedItems={selectedItems}
                            onAddItems={onAddItems}
                            onRemoveItems={onRemoveItems}
                            parentFolderSelected={isSelected}
                        />
                    ))}
                    {subItems.map((item) => {
                        const itemAccessIds = item.viewAccess.map((u: string | { _id: string }) => typeof u === 'string' ? u : u._id);
                        // File is selected if directly selected OR parent folder is selected
                        const isItemSelected = selectedItems.has(item._id) || isSelected;
                        const isItemDirectlySelected = selectedItems.has(item._id);
                        return (
                            <div
                                key={item._id}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer mx-1 my-0.5"
                                style={{
                                    paddingLeft: `${(depth + 1) * 20 + 32}px`,
                                    backgroundColor: isItemSelected ? 'var(--color-primary-soft)' : 'transparent',
                                }}
                                onMouseEnter={(e) => { if (!isItemSelected) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                onMouseLeave={(e) => { if (!isItemSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                onClick={() => {
                                    // Don't allow individual file selection if parent folder is selected
                                    if (isSelected) return;
                                    if (isItemDirectlySelected) onRemoveItems([item._id]);
                                    else onAddItems([{ id: item._id, type: 'file', name: item.name, currentAccess: itemAccessIds }]);
                                }}
                            >
                                <div
                                    className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                                    style={{
                                        borderColor: isItemSelected ? 'var(--color-primary)' : 'var(--color-border-default)',
                                        backgroundColor: isItemSelected ? 'var(--color-primary)' : 'transparent',
                                    }}
                                >
                                    {isItemSelected && <Check size={9} className="text-white" strokeWidth={3} />}
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
    );
}
