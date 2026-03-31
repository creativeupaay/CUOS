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
import {
    useState,
    useRef,
    useMemo,
    useCallback,
    useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import {
    Folder,
    FolderOpen,
    FileText,
    FileImage,
    FileVideo,
    FileArchive,
    FileCode,
    FileSpreadsheet,
    FilePenLine,
    File,
    ChevronRight,
    Home,
    FolderPlus,
    Upload,
    Shield,
    LayoutGrid,
    List,
    Eye,
    Trash2,
    Pencil,
    MoreVertical,
    X,
    Check,
    Loader2,
    UserPlus,
    Download,
    Lock,
} from 'lucide-react';

// ─── Helper: Project Members ──────────────────────────────────────────────────

function getProjectMembers(project: Project): { userId: string; name: string; email: string }[] {
    const seen = new Set<string>();
    const members: { userId: string; name: string; email: string }[] = [];
    project.assignees?.forEach((a: any) => {
        // Extract User ID - try multiple sources in order of preference:
        // 1. Direct userId field (if it's a string, it's the User/PartnerEmployee ID)
        // 2. Populated userId object's _id
        // 3. Populated employeeId.userId._id (for CU employees)
        let userId: string | undefined;

        if (typeof a.userId === 'string' && a.userId) {
            userId = a.userId.trim();
        } else if (a.userId && typeof a.userId === 'object' && a.userId._id) {
            const id = typeof a.userId._id === 'string' ? a.userId._id : a.userId._id?.toString?.();
            userId = id?.trim();
        } else if (a.employeeId?.userId?._id) {
            const id = typeof a.employeeId.userId._id === 'string'
                ? a.employeeId.userId._id
                : a.employeeId.userId._id?.toString?.();
            userId = id?.trim();
        }

        if (userId && !seen.has(userId)) {
            seen.add(userId);
            members.push({
                userId,
                name: a.displayName ?? a.employeeId?.userId?.name ?? a.partnerEmployeeId?.name ?? 'Team Member',
                email: a.displayEmail ?? a.employeeId?.userId?.email ?? a.partnerEmployeeId?.email ?? '',
            });
        }
    });
    return members;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}
const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500', 'bg-yellow-500', 'bg-indigo-500'];
function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[h];
}

function FileIcon({ mimeType, size = 20, className = '' }: { mimeType: string; size?: number; className?: string }) {
    if (mimeType.startsWith('image/')) return <FileImage size={size} className={className} />;
    if (mimeType.startsWith('video/')) return <FileVideo size={size} className={className} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return <FileSpreadsheet size={size} className={className} />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FilePenLine size={size} className={className} />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('archive')) return <FileArchive size={size} className={className} />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html')) return <FileCode size={size} className={className} />;
    if (mimeType.startsWith('text/')) return <FileText size={size} className={className} />;
    return <File size={size} className={className} />;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days < 30 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContextMenu({ items, onClose }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[]; onClose: () => void }) {
    useEffect(() => {
        const h = () => onClose();
        window.addEventListener('click', h);
        return () => window.removeEventListener('click', h);
    }, [onClose]);
    return (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-lg border shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-100"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
                <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); item.onClick(); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${item.danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-black/5'}`}
                    style={{ color: item.danger ? undefined : 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => { if (!item.danger) e.currentTarget.style.color = 'var(--color-text-primary)' }}
                    onMouseLeave={(e) => { if (!item.danger) e.currentTarget.style.color = 'var(--color-text-secondary)' }}>
                    {item.icon}{item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Folder Tree Node (for Access Control panel) ──────────────────────────────

type SelectedAccessItem = { type: 'folder' | 'file'; currentAccess: string[]; name: string };

function FolderTreeNode({
    projectId,
    folder,
    depth,
    selectedItems,
    onAddItems,
    onRemoveItems,
    parentFolderSelected = false,
}: {
    projectId: string;
    folder: DocFolder;
    depth: number;
    selectedItems: Map<string, SelectedAccessItem>;
    onAddItems: (items: { id: string; type: 'folder' | 'file'; name: string; currentAccess: string[] }[]) => void;
    onRemoveItems: (ids: string[]) => void;
    parentFolderSelected?: boolean;
}) {
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

    const folderAccessIds = folder.viewAccess.map((u: any) => typeof u === 'string' ? u : u._id);
    const isSelected = selectedItems.has(folder._id) || parentFolderSelected;
    const isFolderDirectlySelected = selectedItems.has(folder._id);

    // Calculate indeterminate state: some children selected individually (not via this folder)
    const childFileIds = subItems.map(i => i._id);
    const selectedChildFilesCount = useMemo(() => {
        return childFileIds.filter(id => selectedItems.has(id)).length;
    }, [childFileIds, selectedItems]);

    const hasIndividualChildSelections = selectedChildFilesCount > 0 && !isFolderDirectlySelected && !parentFolderSelected;
    const isIndeterminate = hasIndividualChildSelections && selectedChildFilesCount < childFileIds.length;

    const handleFolderToggle = () => {
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
                    onClick={handleFolderToggle}
                >
                    {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    {isIndeterminate && <div className="w-2 h-0.5 bg-white rounded-full" />}
                </div>
                <Folder size={15} className="text-[#fbbd23] flex-shrink-0" fill="currentColor" fillOpacity={0.2} />
                <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                    onClick={handleFolderToggle}
                >
                    {folder.name}
                </span>
                {(folder as any).accessCount > 0 && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {(folder as any).accessCount} member{(folder as any).accessCount !== 1 ? 's' : ''}
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
                        const itemAccessIds = item.viewAccess.map((u: any) => typeof u === 'string' ? u : u._id);
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

// ─── Access Control Panel ─────────────────────────────────────────────────────

type AcTab = 'view' | 'admins';

function AccessControlPanel({
    projectId,
    members,
    adminsData,
    onClose,
    updateFolderAccess,
    updateItemAccess,
    updateAdmins,
}: {
    projectId: string;
    members: { userId: string; name: string; email: string }[];
    adminsData: any;
    onClose: () => void;
    updateFolderAccess: any;
    updateItemAccess: any;
    updateAdmins: any;
}) {
    const [tab, setTab] = useState<AcTab>('view');

    // ── Admins tab state ──
    // Extract admin IDs from the backend response, ensuring they're trimmed strings
    const extractAdminIds = (data: any[] | undefined): string[] => {
        return (data ?? []).map((u: any) => {
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

    const TABS: { id: AcTab; label: string; icon: any }[] = [
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
                                                    const itemAccessIds = item.viewAccess.map((u: any) => typeof u === 'string' ? u : u._id);
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

function AccessBadge({ count, onClick }: { count: number; onClick: (e: React.MouseEvent) => void }) {
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

// ─── Viewers Panel (shows who has access to a specific folder/file) ───────────
type ViewTarget = { id: string; type: 'folder' | 'file'; name: string; viewAccess: any[] };

function ViewersPanel({
    target,
    projectId,
    members,
    updateFolderAccess,
    updateItemAccess,
    onClose,
}: {
    target: ViewTarget;
    projectId: string;
    members: { userId: string; name: string; email: string }[];
    updateFolderAccess: any;
    updateItemAccess: any;
    onClose: () => void;
}) {
    const [removing, setRemoving] = useState<string | null>(null);
    const [localAccess, setLocalAccess] = useState<any[]>(target.viewAccess);

    const viewers = localAccess.map((u: any) => {
        const uid = typeof u === 'string' ? u : u._id;
        const populated = typeof u === 'object' && u.name ? u.name : undefined;
        const member = members.find(m => m.userId === uid);
        return { userId: uid, name: populated || member?.name || 'Unknown', email: member?.email || '' };
    });

    const handleRemove = async (userId: string) => {
        setRemoving(userId);
        try {
            const newAccess = localAccess
                .map((u: any) => typeof u === 'string' ? u : u._id)
                .filter((id: string) => id !== userId);
            if (target.type === 'folder') {
                await updateFolderAccess({ projectId, folderId: target.id, viewAccess: newAccess }).unwrap();
            } else {
                await updateItemAccess({ projectId, itemId: target.id, viewAccess: newAccess }).unwrap();
            }
            setLocalAccess(prev => prev.filter((u: any) => (typeof u === 'string' ? u : u._id) !== userId));
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

// ─── Main Component ───────────────────────────────────────────────────────────

const ProjectDocumentsTab: React.FC = () => {
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
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
    const [renameFolderName, setRenameFolderName] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const [renameItemId, setRenameItemId] = useState<string | null>(null);
    const [renameItemName, setRenameItemName] = useState('');
    const [renameItemExt, setRenameItemExt] = useState('');
    const renameItemInputRef = useRef<HTMLInputElement>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoOpenedSharedFolderRef = useRef(false);

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

    const getRoleName = (role: any): string => { if (!role) return ''; if (typeof role === 'string') return role; return role?.name ?? ''; };
    const isSuperAdmin = ['super-admin', 'admin'].includes(getRoleName(currentUser?.role));
    const isPartnerUser = getRoleName(currentUser?.role).toLowerCase() === 'partner';
    // Extract doc admin IDs with proper trimming for consistent comparison
    const docAdminIds: string[] = (adminsData?.data ?? []).map((u: any) => {
        const id = typeof u === 'string' ? u : u._id;
        return typeof id === 'string' ? id.trim() : '';
    }).filter(Boolean);
    const currentUserId = currentUser?._id?.trim?.() ?? currentUser?._id ?? '';
    const isDocAdmin = isSuperAdmin || docAdminIds.includes(currentUserId);
    const rootFoldersForShared: DocFolder[] = rootFoldersForSharedData?.data ?? [];
    const sharedFolderId = useMemo(() => {
        const shared = rootFoldersForShared.find(
            (f) => f.isSystem && f.isClientShared && f.isPartnerShared
        );
        return shared?._id ?? null;
    }, [rootFoldersForShared]);
    const sharedFolderName = useMemo(() => {
        const shared = rootFoldersForShared.find(
            (f) => f.isSystem && f.isClientShared && f.isPartnerShared
        );
        return shared?.name || 'Shared Files';
    }, [rootFoldersForShared]);

    const shouldDeferPartnerRootView = useMemo(() => {
        // Prevent root-folder flash on refresh before partner/shared-folder context is fully ready.
        if (!currentUser) return true;
        if (!isPartnerSession && !isPartnerUser) return false;
        if (currentFolderId !== null) return false;
        return !sharedFolderId;
    }, [currentUser, isPartnerSession, isPartnerUser, currentFolderId, sharedFolderId]);

    const canPartnerUploadInCurrentFolder = isPartnerUser && !!sharedFolderId && currentFolderId === sharedFolderId;
    const folders: DocFolder[] = foldersData?.data ?? [];
    const visibleFolders: DocFolder[] = useMemo(() => {
        if (shouldDeferPartnerRootView) return [];
        if (!isPartnerUser || currentFolderId !== null) return folders;
        return folders.filter((f) => !(f.isSystem && f.isClientShared && f.isPartnerShared));
    }, [folders, isPartnerUser, currentFolderId, shouldDeferPartnerRootView]);
    const displayBreadcrumb = useMemo(() => {
        const withIndex = breadcrumb.map((crumb, idx) => ({ ...crumb, idx }));
        if (!isPartnerUser || !sharedFolderId) return withIndex;
        return withIndex.filter((crumb) => crumb.id !== sharedFolderId);
    }, [breadcrumb, isPartnerUser, sharedFolderId]);
    const items: DocItem[] = itemsData?.data ?? [];
    const members = useMemo(() => getProjectMembers(project), [project]);
    const isLoading = foldersLoading || itemsLoading || shouldDeferPartnerRootView;

    useEffect(() => { if (showNewFolderInput) setTimeout(() => newFolderInputRef.current?.focus(), 50); }, [showNewFolderInput]);
    useEffect(() => { if (renameFolderId) setTimeout(() => renameInputRef.current?.focus(), 50); }, [renameFolderId]);
    useEffect(() => { if (renameItemId) setTimeout(() => renameItemInputRef.current?.focus(), 50); }, [renameItemId]);
    useEffect(() => {
        autoOpenedSharedFolderRef.current = false;
    }, [projectId]);

    // Partner-side users (partner + partner employees) only work in Shared Files by default.
    useEffect(() => {
        if (!isPartnerUser || !sharedFolderId || autoOpenedSharedFolderRef.current) return;
        if (currentFolderId !== null) return;

        autoOpenedSharedFolderRef.current = true;
        setCurrentFolderId(sharedFolderId);
        setBreadcrumb([{ id: sharedFolderId, name: sharedFolderName }]);
    }, [isPartnerUser, sharedFolderId, sharedFolderName, currentFolderId]);

    const navigateToFolder = useCallback((folder: DocFolder) => {
        setCurrentFolderId(folder._id); setBreadcrumb((p) => [...p, { id: folder._id, name: folder.name }]); setOpenMenuId(null);
    }, []);
    const navigateToBreadcrumb = useCallback((idx: number) => {
        if (idx === -1) { setCurrentFolderId(null); setBreadcrumb([]); }
        else { const c = breadcrumb[idx]; setCurrentFolderId(c.id); setBreadcrumb((p) => p.slice(0, idx + 1)); }
    }, [breadcrumb]);

    const handleCreateFolder = useCallback(async () => {
        const name = newFolderName.trim(); if (!name || !projectId) return;
        setSaving(true);
        try { await createFolder({ projectId, name, parentId: currentFolderId }).unwrap(); setNewFolderName(''); setShowNewFolderInput(false); }
        finally { setSaving(false); }
    }, [newFolderName, projectId, currentFolderId, createFolder]);

    const handleStartRename = useCallback((folder: DocFolder) => {
        setRenameFolderId(folder._id); setRenameFolderName(folder.name); setOpenMenuId(null);
    }, []);

    const handleStartRenameItem = useCallback((item: DocItem) => {
        const lastDotIdx = item.name.lastIndexOf('.');
        if (lastDotIdx > 0 && lastDotIdx < item.name.length - 1) {
            setRenameItemName(item.name.substring(0, lastDotIdx));
            setRenameItemExt(item.name.substring(lastDotIdx));
        } else {
            setRenameItemName(item.name);
            setRenameItemExt('');
        }
        setRenameItemId(item._id); setOpenMenuId(null);
    }, []);

    const handleRenameFolder = useCallback(async (folderId: string) => {
        const name = renameFolderName.trim(); if (!name || !projectId) return;
        setSaving(true);
        try { await renameFolder({ projectId, folderId, name }).unwrap(); setRenameFolderId(null); }
        finally { setSaving(false); }
    }, [renameFolderName, projectId, renameFolder]);

    const handleRenameItem = useCallback(async (itemId: string) => {
        const name = renameItemName.trim(); if (!name || !projectId) return;
        const finalName = name + renameItemExt;
        setSaving(true);
        try { await renameItem({ projectId, itemId, name: finalName }).unwrap(); setRenameItemId(null); }
        finally { setSaving(false); }
    }, [renameItemName, renameItemExt, projectId, renameItem]);

    const handleDeleteFolder = useCallback(async (folderId: string) => {
        if (!projectId || !confirm('Delete this folder and all its contents? This cannot be undone.')) return;
        await deleteFolder({ projectId, folderId }).unwrap().catch(() => { });
    }, [projectId, deleteFolder]);

    const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files || !projectId) return;
        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData(); fd.append('file', files[i]);
                if (currentFolderId) fd.append('folderId', currentFolderId);
                await uploadItem({ projectId, formData: fd }).unwrap();
            }
        } finally { setUploading(false); e.target.value = ''; }
    }, [projectId, currentFolderId, uploadItem]);

    const handleViewFile = useCallback(async (item: DocItem) => {
        if (!projectId) return;
        try { const r = await getItemUrl({ projectId, itemId: item._id }).unwrap(); window.open(r.data?.url, '_blank'); }
        catch { /* ignore */ }
    }, [projectId, getItemUrl]);

    const handleDeleteItem = useCallback(async (itemId: string) => {
        if (!projectId || !confirm('Delete this file? This cannot be undone.')) return;
        await deleteItem({ projectId, itemId }).unwrap().catch(() => { });
    }, [projectId, deleteItem]);

    const isEmpty = !isLoading && visibleFolders.length === 0 && items.length === 0 && !showNewFolderInput;

    // ─── Folder Card ─────────────────────────────────────────────────────────
    const renderFolderCard = (folder: DocFolder) => (
        <div key={folder._id}
            className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-[var(--color-bg-surface)] hover:shadow-md cursor-pointer transition-all select-none"
            style={{ borderColor: 'var(--color-border-default)' }}
            onDoubleClick={() => navigateToFolder(folder)} onClick={() => setOpenMenuId(null)}>
            {renameFolderId === folder._id ? (
                <>
                    <Folder size={36} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                    <input ref={renameInputRef} type="text" value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)}
                        className="w-full px-2 py-1 text-xs text-center rounded-md border focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder._id); if (e.key === 'Escape') setRenameFolderId(null); }}
                        onClick={(e) => e.stopPropagation()} />
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder._id); }} className="p-1 rounded text-green-600 hover:bg-green-100"><Check size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setRenameFolderId(null); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                    </div>
                </>
            ) : (
                <>
                    <Folder size={40} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                    <p className="text-xs font-medium text-center leading-tight max-w-full truncate w-full mt-1" style={{ color: 'var(--color-text-primary)' }} title={folder.name}>{folder.name}</p>
                    {folder.isClientShared && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>Shared</span>
                    )}
                    <div className="flex items-center gap-1">
                        {isDocAdmin && <AccessBadge count={(folder as any).accessCount || 0} onClick={() => setViewTarget({ id: folder._id, type: 'folder', name: folder.name, viewAccess: folder.viewAccess })} />}
                        {isDocAdmin && (
                            <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === folder._id ? null : folder._id); }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                    <MoreVertical size={13} />
                                </button>
                                {openMenuId === folder._id && (
                                    <ContextMenu onClose={() => setOpenMenuId(null)} items={[
                                        { label: 'Open', icon: <FolderOpen size={14} />, onClick: () => navigateToFolder(folder) },
                                        ...(!folder.isSystem ? [
                                            { label: 'Rename', icon: <Pencil size={14} />, onClick: () => handleStartRename(folder) },
                                            { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                            { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteFolder(folder._id), danger: true },
                                        ] : [
                                            { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                        ]),
                                    ]} />
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    // ─── File Card ────────────────────────────────────────────────────────────
    const renderFileCard = (item: DocItem) => {
        const uploader = typeof item.uploadedBy === 'object' ? item.uploadedBy : null;
        return (
            <div key={item._id}
                className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-[var(--color-bg-surface)] hover:shadow-md cursor-pointer transition-all select-none"
                style={{ borderColor: 'var(--color-border-default)' }}
                onDoubleClick={() => handleViewFile(item)} onClick={() => setOpenMenuId(null)}>
                {renameItemId === item._id ? (
                    <>
                        <FileIcon mimeType={item.mimeType} size={36} className="text-[var(--color-primary)]" />
                        <div className="flex w-full items-center border rounded-md px-2 py-1 bg-[var(--color-bg-subtle)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]" style={{ borderColor: 'var(--color-border-default)' }}>
                            <input ref={renameItemInputRef} type="text" value={renameItemName} onChange={(e) => setRenameItemName(e.target.value)}
                                className="flex-1 text-xs text-right bg-transparent focus:outline-none min-w-0"
                                style={{ color: 'var(--color-text-primary)' }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameItem(item._id); if (e.key === 'Escape') setRenameItemId(null); }}
                                onClick={(e) => e.stopPropagation()} />
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{renameItemExt}</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleRenameItem(item._id); }} className="p-1 rounded text-green-600 hover:bg-green-100"><Check size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setRenameItemId(null); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <FileIcon mimeType={item.mimeType} size={24} className="text-[var(--color-primary)]" />
                        </div>
                        <p className="text-xs font-medium text-center leading-tight max-w-full truncate w-full mt-1" style={{ color: 'var(--color-text-primary)' }} title={item.name}>{item.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatSize(item.size)}</p>
                        <div className="flex items-center gap-1">
                            {isDocAdmin && <AccessBadge count={item.viewAccess.length} onClick={() => setViewTarget({ id: item._id, type: 'file', name: item.name, viewAccess: item.viewAccess })} />}
                            {isDocAdmin && (
                                <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item._id ? null : item._id); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                        <MoreVertical size={13} />
                                    </button>
                                    {openMenuId === item._id && (
                                        <ContextMenu onClose={() => setOpenMenuId(null)} items={[
                                            { label: 'Open / Download', icon: <Download size={14} />, onClick: () => handleViewFile(item) },
                                            { label: 'Rename', icon: <Pencil size={14} />, onClick: () => handleStartRenameItem(item) },
                                            { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                            { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteItem(item._id), danger: true },
                                        ]} />
                                    )}
                                </div>
                            )}
                        </div>
                        {uploader && <p className="text-[10px] truncate w-full text-center" style={{ color: 'var(--color-text-muted)' }}>{uploader.name} · {timeAgo(item.createdAt)}</p>}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-[500px] mt-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-app)', borderColor: 'var(--color-border-default)' }}>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-5 py-4 border-b flex-wrap gap-y-2 rounded-t-xl" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                <nav className="flex items-center gap-1 flex-1 min-w-0 text-sm overflow-hidden">
                    <button onClick={() => {
                        if (isPartnerUser && sharedFolderId) {
                            setCurrentFolderId(sharedFolderId);
                            setBreadcrumb([{ id: sharedFolderId, name: sharedFolderName }]);
                            return;
                        }
                        navigateToBreadcrumb(-1);
                    }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors`}
                        style={{
                            color: (isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            backgroundColor: (isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null) ? 'var(--color-primary-soft)' : 'transparent',
                            fontWeight: (isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null) ? 500 : 400
                        }}
                        onMouseEnter={(e) => {
                            const isActive = isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null;
                            if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                            const isActive = isPartnerUser ? currentFolderId === sharedFolderId : currentFolderId === null;
                            if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <Home size={14} /><span>Documents</span>
                    </button>
                    {displayBreadcrumb.map((crumb, idx) => (
                        <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                            <ChevronRight size={13} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
                            <button onClick={() => navigateToBreadcrumb(crumb.idx)}
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
                                <button onClick={() => { setShowNewFolderInput(true); setOpenMenuId(null); }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg border transition-colors btn-ghost"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <FolderPlus size={15} />New Folder
                                </button>
                            )}
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-60 btn-primary">
                                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                {uploading ? 'Uploading…' : 'Upload'}
                            </button>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
                            {isDocAdmin && (
                                <button onClick={() => setShowAccessControl(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg border transition-colors btn-ghost"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    <Lock size={15} />Access Control
                                </button>
                            )}
                        </>
                    )}
                    <div className="flex items-center border rounded-lg p-0.5" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                        <button onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'shadow-sm' : ''}`}
                            style={{
                                backgroundColor: viewMode === 'grid' ? 'var(--color-bg-surface)' : 'transparent',
                                color: viewMode === 'grid' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                            }}>
                            <LayoutGrid size={15} />
                        </button>
                        <button onClick={() => setViewMode('list')}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
                {isLoading && (
                    <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                )}

                {isEmpty && (
                    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-subtle)' }}><FolderOpen size={30} style={{ color: 'var(--color-text-muted)' }} /></div>
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{currentFolderId ? 'This folder is empty' : 'No documents yet'}</p>
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
                                    <button onClick={() => setShowNewFolderInput(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors btn-ghost" style={{ borderColor: 'var(--color-border-default)' }}><FolderPlus size={14} />New Folder</button>
                                )}
                                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white transition-colors btn-primary"><Upload size={14} />Upload File</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Grid view */}
                {!isLoading && viewMode === 'grid' && (visibleFolders.length > 0 || items.length > 0 || showNewFolderInput) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {showNewFolderInput && (
                            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed hover:shadow-sm" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}>
                                <Folder size={40} className="text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                                <input ref={newFolderInputRef} type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name"
                                    className="w-full mt-1 px-2 py-1.5 text-xs text-center rounded-md border"
                                    style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }} />
                                <div className="flex gap-1">
                                    <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || saving} className="p-1 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-40 transition-colors">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    </button>
                                    <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={14} /></button>
                                </div>
                            </div>
                        )}
                        {visibleFolders.map(renderFolderCard)}
                        {items.map(renderFileCard)}
                    </div>
                )}

                {/* List view */}
                {!isLoading && viewMode === 'list' && (visibleFolders.length > 0 || items.length > 0 || showNewFolderInput) && (
                    <div className="rounded-xl border divide-y divide-[var(--color-border-default)]" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        {showNewFolderInput && (
                            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                                <Folder size={18} className="flex-shrink-0 text-[#fbbd23]" fill="currentColor" fillOpacity={0.2} />
                                <input ref={newFolderInputRef} type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder name"
                                    className="flex-1 text-sm bg-transparent border-b focus:outline-none"
                                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text-primary)' }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }} />
                                <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || saving} className="p-1 rounded disabled:opacity-40" style={{ color: 'var(--color-success)' }}><Check size={15} /></button>
                                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}><X size={15} /></button>
                            </div>
                        )}
                        {visibleFolders.map((folder) => (
                            <div key={folder._id} className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-black/5 border-b"
                                style={{ borderColor: 'var(--color-border-default)' }}
                                onDoubleClick={() => navigateToFolder(folder)}>
                                <Folder size={18} className="text-[#fbbd23] flex-shrink-0" fill="currentColor" fillOpacity={0.2} />
                                {renameFolderId === folder._id ? (
                                    <input ref={renameInputRef} type="text" value={renameFolderName} onChange={(e) => setRenameFolderName(e.target.value)}
                                        className="flex-1 text-sm bg-transparent border-b focus:outline-none"
                                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text-primary)' }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder._id); if (e.key === 'Escape') setRenameFolderId(null); }}
                                        onClick={(e) => e.stopPropagation()} />
                                ) : (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{folder.name}</span>
                                        {folder.isClientShared && (
                                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>Shared</span>
                                        )}
                                    </div>
                                )}
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Folder</span>
                                {isDocAdmin && <AccessBadge count={(folder as any).accessCount || 0} onClick={() => setViewTarget({ id: folder._id, type: 'folder', name: folder.name, viewAccess: folder.viewAccess })} />}
                                {isDocAdmin && (
                                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === folder._id ? null : folder._id); }}
                                            className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                                            <MoreVertical size={14} />
                                        </button>
                                        {openMenuId === folder._id && (
                                            <ContextMenu onClose={() => setOpenMenuId(null)} items={[
                                                { label: 'Open', icon: <FolderOpen size={14} />, onClick: () => navigateToFolder(folder) },
                                                ...(!folder.isSystem ? [
                                                    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => handleStartRename(folder) },
                                                    { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                                    { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteFolder(folder._id), danger: true },
                                                ] : [
                                                    { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                                ]),
                                            ]} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {items.map((item) => {
                            const uploader = typeof item.uploadedBy === 'object' ? item.uploadedBy : null;
                            return (
                                <div key={item._id} className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-black/5 border-b last:border-0"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                    onDoubleClick={() => handleViewFile(item)}>
                                    <div className="w-[18px] flex-shrink-0"><FileIcon mimeType={item.mimeType} size={18} className="text-[var(--color-primary)]" /></div>
                                    {renameItemId === item._id ? (
                                        <div className="flex-1 flex items-center border-b" style={{ borderColor: 'var(--color-primary)' }}>
                                            <input ref={renameItemInputRef} type="text" value={renameItemName} onChange={(e) => setRenameItemName(e.target.value)}
                                                className="flex-1 text-sm bg-transparent focus:outline-none min-w-0"
                                                style={{ color: 'var(--color-text-primary)' }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameItem(item._id); if (e.key === 'Escape') setRenameItemId(null); }}
                                                onClick={(e) => e.stopPropagation()} />
                                            {renameItemExt && <span className="text-sm px-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{renameItemExt}</span>}
                                        </div>
                                    ) : (
                                        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                                    )}
                                    <span className="text-xs w-16 text-right" style={{ color: 'var(--color-text-muted)' }}>{formatSize(item.size)}</span>
                                    {uploader && <span className="text-xs hidden sm:block w-28 text-right truncate" style={{ color: 'var(--color-text-muted)' }}>{uploader.name}</span>}
                                    <span className="text-xs hidden sm:block w-16 text-right" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(item.createdAt)}</span>
                                    {isDocAdmin && <AccessBadge count={item.viewAccess.length} onClick={() => setViewTarget({ id: item._id, type: 'file', name: item.name, viewAccess: item.viewAccess })} />}
                                    {isDocAdmin && (
                                        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item._id ? null : item._id); }}
                                                className="p-1 rounded hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                                                <MoreVertical size={14} />
                                            </button>
                                            {openMenuId === item._id && (
                                                <ContextMenu onClose={() => setOpenMenuId(null)} items={[
                                                    { label: 'Open / Download', icon: <Download size={14} />, onClick: () => handleViewFile(item) },
                                                    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => handleStartRenameItem(item) },
                                                    { label: 'Manage access', icon: <Eye size={14} />, onClick: () => setShowAccessControl(true) },
                                                    { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDeleteItem(item._id), danger: true },
                                                ]} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Access Control Panel */}
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

            {/* Viewers Panel */}
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
