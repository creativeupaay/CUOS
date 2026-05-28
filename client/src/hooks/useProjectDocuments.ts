import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetDocFoldersQuery,
    useCreateDocFolderMutation,
    useRenameDocFolderMutation,
    useDeleteDocFolderMutation,
    useUpdateDocFolderAccessMutation,
    useGetDocItemsQuery,
    useUploadDocItemMutation,
    useLazyGetDocItemUrlQuery,
    useRenameDocItemMutation,
    useDeleteDocItemMutation,
    useUpdateDocItemAccessMutation,
    useGetDocAdminsQuery,
    useUpdateDocAdminsMutation,
} from '@/features/project';
import type { Project, DocFolder, DocItem } from '@/features/project';
import { getProjectMembers } from '@/lib/utils/project';
import type { ViewTarget } from '@/components/organisms/project/ViewersPanel';

export function useProjectDocuments() {
    const { id: projectId } = useParams<{ id: string }>();
    const { project } = useOutletContext<{ project: Project }>();
    const currentUser = useSelector((state: RootState) => state.auth.user);
    const isPartnerSession = typeof window !== 'undefined' && !!window.sessionStorage.getItem('partnerPortalSlug');

    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showAccessControl, setShowAccessControl] = useState(false);
    const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
    const [renameFolderName, setRenameFolderName] = useState('');
    const [renameItemId, setRenameItemId] = useState<string | null>(null);
    const [renameItemName, setRenameItemName] = useState('');
    const [renameItemExt, setRenameItemExt] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const autoOpenedSharedFolderRef = useRef(false);

    // Queries
    const shouldSkipFolderListingQuery = !projectId || (isPartnerSession && currentFolderId === null);
    const { data: foldersData, isLoading: foldersLoading } = useGetDocFoldersQuery(
        { projectId: projectId!, parentId: currentFolderId },
        { skip: shouldSkipFolderListingQuery }
    );
    const { data: rootFoldersForSharedData } = useGetDocFoldersQuery(
        { projectId: projectId!, parentId: null }, { skip: !projectId }
    );
    const shouldSkipItemsQuery = !projectId || (isPartnerSession && currentFolderId === null);
    const { data: itemsData, isLoading: itemsLoading } = useGetDocItemsQuery(
        { projectId: projectId!, folderId: currentFolderId },
        { skip: shouldSkipItemsQuery }
    );
    const { data: adminsData } = useGetDocAdminsQuery(
        { projectId: projectId! }, { skip: !projectId }
    );

    // Mutations
    const [createFolder] = useCreateDocFolderMutation();
    const [renameFolder] = useRenameDocFolderMutation();
    const [deleteFolder] = useDeleteDocFolderMutation();
    const [updateFolderAccess] = useUpdateDocFolderAccessMutation();
    const [uploadItem] = useUploadDocItemMutation();
    const [getItemUrl] = useLazyGetDocItemUrlQuery();
    const [renameItem] = useRenameDocItemMutation();
    const [deleteItem] = useDeleteDocItemMutation();
    const [updateItemAccess] = useUpdateDocItemAccessMutation();
    const [updateAdmins] = useUpdateDocAdminsMutation();

    // Permissions logic
    const getRoleName = (role: { name: string } | string | undefined | null): string => { 
        if (!role) return ''; 
        if (typeof role === 'string') return role; 
        return role?.name ?? ''; 
    };
    
    const isSuperAdmin = ['super-admin', 'admin'].includes(getRoleName(currentUser?.role));
    const isPartnerUser = getRoleName(currentUser?.role).toLowerCase() === 'partner';
    
    const docAdminIds: string[] = (adminsData?.data ?? []).map((u: { _id: string } | string) => {
        const id = typeof u === 'string' ? u : u._id;
        return typeof id === 'string' ? id.trim() : '';
    }).filter(Boolean);
    
    const currentUserId = currentUser?._id?.trim?.() ?? currentUser?._id ?? '';
    const isDocAdmin = isSuperAdmin || docAdminIds.includes(currentUserId);

    const sharedFolder = useMemo(() => {
        const rootFolders: DocFolder[] = rootFoldersForSharedData?.data ?? [];
        return rootFolders.find(
            (f) => f.isSystem && f.isClientShared && f.isPartnerShared
        );
    }, [rootFoldersForSharedData?.data]);
    
    const sharedFolderId = sharedFolder?._id ?? null;
    const sharedFolderName = sharedFolder?.name || 'Shared Files';

    const shouldDeferPartnerRootView = useMemo(() => {
        if (!currentUser) return true;
        if (!isPartnerSession && !isPartnerUser) return false;
        if (currentFolderId !== null) return false;
        return !sharedFolderId;
    }, [currentUser, isPartnerSession, isPartnerUser, currentFolderId, sharedFolderId]);

    const canPartnerUploadInCurrentFolder = isPartnerUser && !!sharedFolderId && currentFolderId === sharedFolderId;
    
    const visibleFolders: DocFolder[] = useMemo(() => {
        const foldersList: DocFolder[] = foldersData?.data ?? [];
        if (shouldDeferPartnerRootView) return [];
        if (!isPartnerUser || currentFolderId !== null) return foldersList;
        return foldersList.filter((f) => !(f.isSystem && f.isClientShared && f.isPartnerShared));
    }, [foldersData?.data, isPartnerUser, currentFolderId, shouldDeferPartnerRootView]);

    const displayBreadcrumb = useMemo(() => {
        const withIndex = breadcrumb.map((crumb, idx) => ({ ...crumb, idx }));
        if (!isPartnerUser || !sharedFolderId) return withIndex;
        return withIndex.filter((crumb) => crumb.id !== sharedFolderId);
    }, [breadcrumb, isPartnerUser, sharedFolderId]);

    const items: DocItem[] = itemsData?.data ?? [];
    const members = useMemo(() => getProjectMembers(project), [project]);
    const isLoading = foldersLoading || itemsLoading || shouldDeferPartnerRootView;

    // Reset auto-open ref when project changes
    useEffect(() => {
        autoOpenedSharedFolderRef.current = false;
    }, [projectId]);

    // Partner-side auto-open shared folder
    useEffect(() => {
        if (!isPartnerUser || !sharedFolderId || autoOpenedSharedFolderRef.current) return;
        if (currentFolderId !== null) return;

        autoOpenedSharedFolderRef.current = true;
        setCurrentFolderId(sharedFolderId);
        setBreadcrumb([{ id: sharedFolderId, name: sharedFolderName }]);
    }, [isPartnerUser, sharedFolderId, sharedFolderName, currentFolderId]);

    // Handlers
    const navigateToFolder = useCallback((folder: DocFolder) => {
        setCurrentFolderId(folder._id);
        setBreadcrumb((p) => [...p, { id: folder._id, name: folder.name }]);
        setOpenMenuId(null);
    }, []);

    const navigateToBreadcrumb = useCallback((idx: number) => {
        if (idx === -1) {
            setCurrentFolderId(null);
            setBreadcrumb([]);
        } else {
            const c = breadcrumb[idx];
            setCurrentFolderId(c.id);
            setBreadcrumb((p) => p.slice(0, idx + 1));
        }
    }, [breadcrumb]);

    const handleCreateFolder = useCallback(async () => {
        const name = newFolderName.trim();
        if (!name || !projectId) return;
        setSaving(true);
        try {
            await createFolder({ projectId, name, parentId: currentFolderId }).unwrap();
            setNewFolderName('');
            setShowNewFolderInput(false);
        } finally {
            setSaving(false);
        }
    }, [newFolderName, projectId, currentFolderId, createFolder]);

    const handleRenameFolder = useCallback(async (folderId: string) => {
        const name = renameFolderName.trim();
        if (!name || !projectId) return;
        setSaving(true);
        try {
            await renameFolder({ projectId, folderId, name }).unwrap();
            setRenameFolderId(null);
        } finally {
            setSaving(false);
        }
    }, [renameFolderName, projectId, renameFolder]);

    const handleDeleteFolder = useCallback(async (folderId: string) => {
        if (!projectId || !confirm('Delete this folder and all its contents? This cannot be undone.')) return;
        await deleteFolder({ projectId, folderId }).unwrap().catch(() => { });
    }, [projectId, deleteFolder]);

    const handleRenameItem = useCallback(async (itemId: string) => {
        const name = renameItemName.trim();
        if (!name || !projectId) return;
        const finalName = name + renameItemExt;
        setSaving(true);
        try {
            await renameItem({ projectId, itemId, name: finalName }).unwrap();
            setRenameItemId(null);
        } finally {
            setSaving(false);
        }
    }, [renameItemName, renameItemExt, projectId, renameItem]);

    const handleDeleteItem = useCallback(async (itemId: string) => {
        if (!projectId || !confirm('Delete this file? This cannot be undone.')) return;
        await deleteItem({ projectId, itemId }).unwrap().catch(() => { });
    }, [projectId, deleteItem]);

    const handleViewFile = useCallback(async (item: DocItem) => {
        if (!projectId) return;
        try {
            const r = await getItemUrl({ projectId, itemId: item._id }).unwrap();
            window.open(r.data?.url, '_blank');
        } catch { /* ignore */ }
    }, [projectId, getItemUrl]);

    const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !projectId) return;
        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData();
                fd.append('file', files[i]);
                if (currentFolderId) fd.append('folderId', currentFolderId);
                await uploadItem({ projectId, formData: fd }).unwrap();
            }
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }, [projectId, currentFolderId, uploadItem]);

    return {
        // State
        projectId,
        project,
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
        
        // Data
        visibleFolders,
        items,
        members,
        adminsData,
        isLoading,
        isEmpty: !isLoading && visibleFolders.length === 0 && items.length === 0 && !showNewFolderInput,
        
        // Permissions
        isDocAdmin,
        isPartnerUser,
        canPartnerUploadInCurrentFolder,
        sharedFolderId,
        sharedFolderName,

        // Setters
        setCurrentFolderId,
        setBreadcrumb,
        setViewMode,
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

        // Handlers
        navigateToFolder,
        navigateToBreadcrumb,
        handleCreateFolder,
        handleRenameFolder,
        handleDeleteFolder,
        handleRenameItem,
        handleDeleteItem,
        handleViewFile,
        handleFileInputChange,
        
        // Direct mutation access if needed
        updateFolderAccess,
        updateItemAccess,
        updateAdmins,
    };
}
