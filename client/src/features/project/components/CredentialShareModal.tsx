import { useState, useEffect } from 'react';
import { X, Shield, Eye, Users, Check, ChevronRight, Loader2, Code, TerminalSquare, Lock, FileText } from 'lucide-react';
import {
    useGetCredentialsQuery,
    useShareCredentialsMutation,
    useGetCredentialAdminsQuery,
    useUpdateCredentialAdminsMutation,
} from '@/features/project';
import type { Project, Credential } from '@/features/project';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CredentialShareModalProps {
    project: Project;
    projectId: string;
    onClose: () => void;
}

type ModalTab = 'edit' | 'view';

type CredentialCategory = 'env' | 'ssh-key' | 'test-user' | 'account' | 'other';

const CATEGORIES: { id: CredentialCategory; label: string; icon: any }[] = [
    { id: 'env', label: 'Env Variables', icon: Code },
    { id: 'ssh-key', label: 'SSH Keys', icon: TerminalSquare },
    { id: 'test-user', label: 'Testing', icon: Lock },
    { id: 'account', label: 'Accounts', icon: Users },
    { id: 'other', label: 'Other', icon: FileText },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getProjectMembers(project: Project): { userId: string; name: string; email: string }[] {
    const seen = new Set<string>();
    const members: { userId: string; name: string; email: string }[] = [];

    project.assignees?.forEach((a: any) => {
        let userId: string | undefined;
        let userData: any = null;

        if (a.employeeId) {
            const emp = typeof a.employeeId === 'object' ? a.employeeId : null;
            if (emp?.userId) {
                const u = typeof emp.userId === 'object' ? emp.userId : null;
                userId = u?._id ?? (typeof emp.userId === 'string' ? emp.userId : undefined);
                userData = u;
            }
        } else if (a.userId) {
            const u = typeof a.userId === 'object' ? a.userId : null;
            userId = u?._id ?? (typeof a.userId === 'string' ? a.userId : undefined);
            userData = u;
        }

        if (userId && !seen.has(userId)) {
            seen.add(userId);
            members.push({
                userId,
                name: userData?.name ?? 'Team Member',
                email: userData?.email ?? '',
            });
        }
    });

    return members;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberCheckbox({
    member,
    selected,
    onChange,
}: {
    member: { userId: string; name: string; email: string };
    selected: boolean;
    onChange: (id: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(member.userId)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors"
            style={{
                borderColor: selected ? 'var(--color-success)' : 'var(--color-border-default)',
                backgroundColor: selected ? 'var(--color-success-soft)' : 'var(--color-bg-surface)',
            }}
        >
            <div
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                style={{
                    borderColor: selected ? 'var(--color-success)' : 'var(--color-border-default)',
                    backgroundColor: selected ? 'var(--color-success)' : 'transparent',
                }}
            >
                {selected && <Check size={10} className="text-white" />}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {member.name}
                </p>
                {member.email && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {member.email}
                    </p>
                )}
            </div>
        </button>
    );
}

function CredentialCheckbox({
    credential,
    selected,
    onChange,
}: {
    credential: Credential;
    selected: boolean;
    onChange: (id: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(credential._id)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors"
            style={{
                borderColor: selected ? 'var(--color-success)' : 'var(--color-border-default)',
                backgroundColor: selected ? 'var(--color-success-soft)' : 'var(--color-bg-surface)',
            }}
        >
            <div
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                style={{
                    borderColor: selected ? 'var(--color-success)' : 'var(--color-border-default)',
                    backgroundColor: selected ? 'var(--color-success)' : 'transparent',
                }}
            >
                {selected && <Check size={10} className="text-white" />}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {credential.name}
                </p>
                {credential.description && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {credential.description}
                    </p>
                )}
            </div>
        </button>
    );
}

// ─── Edit Access Tab ──────────────────────────────────────────────────────────
function EditAccessTab({ project, projectId }: { project: Project; projectId: string }) {
    const { data: adminsData, isLoading: adminsLoading } = useGetCredentialAdminsQuery({ projectId });
    const [updateAdmins, { isLoading: isSaving }] = useUpdateCredentialAdminsMutation();

    const members = getProjectMembers(project);

    const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);

    // Sync selectedAdminIds once the admins data has loaded
    useEffect(() => {
        if (!adminsLoading && adminsData?.data) {
            const ids = adminsData.data.map((a: any) =>
                typeof a === 'string' ? a : a._id
            );
            setSelectedAdminIds(ids);
        }
    }, [adminsLoading, adminsData]);

    const toggleAdmin = (uid: string) => {
        setSelectedAdminIds((prev) =>
            prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
        );
        setSaved(false);
    };

    const handleSave = async () => {
        try {
            await updateAdmins({ projectId, data: { userIds: selectedAdminIds } }).unwrap();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Credential Admins can <strong>view, add, edit, and delete</strong> all credentials, and can also manage who has view access.
            </p>

            {adminsLoading ? (
                <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                </div>
            ) : members.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    No team members assigned to this project yet.
                </p>
            ) : (
                <div className="space-y-2">
                    {members.map((m) => (
                        <MemberCheckbox
                            key={m.userId}
                            member={m}
                            selected={selectedAdminIds.includes(m.userId)}
                            onChange={toggleAdmin}
                        />
                    ))}
                </div>
            )}

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: saved ? 'var(--color-success-dark, #16a34a)' : 'var(--color-success)' }}
                >
                    {isSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : saved ? (
                        <Check size={14} />
                    ) : (
                        <Shield size={14} />
                    )}
                    {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Edit Access'}
                </button>
            </div>
        </div>
    );
}

// ─── View Access Tab ──────────────────────────────────────────────────────────
function ViewAccessTab({ project, projectId }: { project: Project; projectId: string }) {
    const [category, setCategory] = useState<CredentialCategory>('env');
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedCredIds, setSelectedCredIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [shareCredentials, { isLoading: isSharing }] = useShareCredentialsMutation();
    const [sharedSuccessfully, setSharedSuccessfully] = useState(false);

    const { data, isLoading: credsLoading } = useGetCredentialsQuery({ projectId, type: category });
    const credentials: Credential[] = data?.data ?? [];
    const members = getProjectMembers(project);

    const toggleCred = (id: string) => {
        setSelectedCredIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const toggleUser = (id: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
        );
    };

    const handleShare = async () => {
        if (!selectedCredIds.length || !selectedUserIds.length) return;
        try {
            await shareCredentials({
                projectId,
                data: { credentialIds: selectedCredIds, userIds: selectedUserIds },
            }).unwrap();
            setSharedSuccessfully(true);
            setSelectedCredIds([]);
            setSelectedUserIds([]);
            setStep(1);
            setTimeout(() => setSharedSuccessfully(false), 3000);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Select specific credentials to share, then choose which team members can view them.
            </p>

            {sharedSuccessfully && (
                <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
                >
                    <Check size={14} /> Credentials shared successfully.
                </div>
            )}

            {/* Step Indicator */}
            <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                    className="px-3 py-1 rounded-full"
                    style={{
                        backgroundColor: step === 1 ? 'var(--color-success)' : 'var(--color-bg-subtle)',
                        color: step === 1 ? 'white' : 'var(--color-text-secondary)',
                    }}
                >
                    1. Select Credentials
                </span>
                <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span
                    className="px-3 py-1 rounded-full"
                    style={{
                        backgroundColor: step === 2 ? 'var(--color-success)' : 'var(--color-bg-subtle)',
                        color: step === 2 ? 'white' : 'var(--color-text-secondary)',
                    }}
                >
                    2. Choose Team Members
                </span>
            </div>

            {/* ── STEP 1: Category + Credential selection ── */}
            {step === 1 && (
                <div className="space-y-3">
                    {/* Category sub-tabs */}
                    <div className="flex flex-wrap gap-1">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            const isActive = category === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                    style={{
                                        backgroundColor: isActive ? 'var(--color-success-soft)' : 'var(--color-bg-subtle)',
                                        color: isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                        border: `1px solid ${isActive ? 'var(--color-success)' : 'var(--color-border-default)'}`,
                                    }}
                                >
                                    <Icon size={12} />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Credential list */}
                    <div
                        className="rounded-lg border overflow-hidden"
                        style={{ borderColor: 'var(--color-border-default)', maxHeight: '260px', overflowY: 'auto' }}
                    >
                        {credsLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                            </div>
                        ) : credentials.length === 0 ? (
                            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                                No credentials in this category yet.
                            </p>
                        ) : (
                            <div className="p-2 space-y-1.5">
                                {credentials.map((cred) => (
                                    <CredentialCheckbox
                                        key={cred._id}
                                        credential={cred}
                                        selected={selectedCredIds.includes(cred._id)}
                                        onChange={toggleCred}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedCredIds.length > 0 && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {selectedCredIds.length} credential{selectedCredIds.length > 1 ? 's' : ''} selected (you can switch categories to select more)
                        </p>
                    )}

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={selectedCredIds.length === 0}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition-colors"
                            style={{ backgroundColor: 'var(--color-success)' }}
                        >
                            Next: Choose Members <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 2: Team member selection ── */}
            {step === 2 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                            Team Members
                        </p>
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="text-xs underline"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            ← Back to credentials
                        </button>
                    </div>

                    {members.length === 0 ? (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                            No team members assigned to this project.
                        </p>
                    ) : (
                        <div
                            className="space-y-1.5 overflow-y-auto"
                            style={{ maxHeight: '260px' }}
                        >
                            {members.map((m) => (
                                <MemberCheckbox
                                    key={m.userId}
                                    member={m}
                                    selected={selectedUserIds.includes(m.userId)}
                                    onChange={toggleUser}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <p className="text-xs self-center" style={{ color: 'var(--color-text-muted)' }}>
                            {selectedCredIds.length} credential{selectedCredIds.length !== 1 ? 's' : ''} · {selectedUserIds.length} member{selectedUserIds.length !== 1 ? 's' : ''} selected
                        </p>
                        <button
                            type="button"
                            onClick={handleShare}
                            disabled={isSharing || selectedUserIds.length === 0 || selectedCredIds.length === 0}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition-colors"
                            style={{ backgroundColor: 'var(--color-success)' }}
                        >
                            {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                            {isSharing ? 'Sharing…' : 'Share Access'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CredentialShareModal({ project, projectId, onClose }: CredentialShareModalProps) {
    const [activeTab, setActiveTab] = useState<ModalTab>('edit');

    return (
        /* Backdrop */
        <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >

            {/* Modal */}
            <div
                className="relative w-full max-w-lg rounded-xl border shadow-lg overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-2">
                        <Shield size={18} style={{ color: 'var(--color-success)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Manage Credential Access
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded transition-colors hover:bg-gray-100"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab Bar */}
                <div
                    className="flex border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    {[
                        { id: 'edit' as ModalTab, label: 'Edit Access', icon: Shield, desc: 'Full control' },
                        { id: 'view' as ModalTab, label: 'View Access', icon: Eye, desc: 'Per credential' },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors flex-1 justify-center"
                                style={{
                                    color: isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                    borderColor: isActive ? 'var(--color-success)' : 'transparent',
                                    backgroundColor: isActive ? 'var(--color-success-soft)' : 'transparent',
                                }}
                            >
                                <Icon size={15} />
                                <span>{tab.label}</span>
                                <span
                                    className="text-xs px-1.5 py-0.5 rounded-full"
                                    style={{
                                        backgroundColor: isActive ? 'var(--color-success)' : 'var(--color-bg-subtle)',
                                        color: isActive ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {tab.desc}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1">
                    {activeTab === 'edit' ? (
                        <EditAccessTab project={project} projectId={projectId} />
                    ) : (
                        <ViewAccessTab project={project} projectId={projectId} />
                    )}
                </div>
            </div>
        </div>
    );
}
