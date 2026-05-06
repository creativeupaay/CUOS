import { useParams, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetCredentialsQuery,
    useCreateCredentialMutation,
    useGetCredentialByIdQuery,
    useLazyGetCredentialByIdQuery,
    useDeleteCredentialMutation,
    useGetCredentialAdminsQuery,
    useRevokeCredentialAccessMutation,
} from '@/features/project';
import type { Project } from '@/features/project';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import CredentialShareModal from '@/features/project/components/CredentialShareModal';
import { useState, useRef, useMemo } from 'react';
import {
    Loader2, Trash2, Shield, Code, TerminalSquare, Lock, Users, FileText,
    Plus, Upload, ChevronDown, ChevronUp, Copy, Check, Link, User, KeyRound, StickyNote, Share2, Eye, EyeOff, Filter, FolderPlus, X, UserMinus
} from 'lucide-react';
import { createPortal } from 'react-dom';

// ─── Types ───────────────────────────────────────────────────────────────────
type CredentialType = 'env' | 'ssh-key' | 'test-user' | 'account' | 'other';

type EnvRow = { id: number; key: string; value: string; note: string };
type SshRow = { id: number; name: string; keyContent: string; fileName: string };
type TestUserRow = { id: number; name: string; url: string; username: string; password: string };
type AccountRow = { id: number; name: string; url: string; username: string; email: string; password: string };
type OtherRow = { id: number; name: string; description: string; notes: string };
type EnvGroup = { id: number; label: string; rows: EnvRow[] };

const uid = () => Date.now() + Math.random();
const newEnvRow = (): EnvRow => ({ id: uid(), key: '', value: '', note: '' });
const newSshRow = (): SshRow => ({ id: uid(), name: '', keyContent: '', fileName: '' });
const newTestRow = (): TestUserRow => ({ id: uid(), name: '', url: '', username: '', password: '' });
const newAccountRow = (): AccountRow => ({ id: uid(), name: '', url: '', username: '', email: '', password: '' });
const newOtherRow = (): OtherRow => ({ id: uid(), name: '', description: '', notes: '' });
const newEnvGroup = (label = ''): EnvGroup => ({ id: uid(), label, rows: [newEnvRow()] });

// ─── Tab Config ──────────────────────────────────────────────────────────────
const TABS: { id: CredentialType; label: string; icon: any }[] = [
    { id: 'env', label: 'Env Variables', icon: Code },
    { id: 'ssh-key', label: 'SSH Keys', icon: TerminalSquare },
    { id: 'test-user', label: 'Testing', icon: Lock },
    { id: 'account', label: 'Accounts', icon: Users },
    { id: 'other', label: 'Other', icon: FileText },
];

// ─── Paste Parsers ────────────────────────────────────────────────────────────
/** Parse .env block: KEY="value" or KEY=value — supports { } wrapping */
function parseEnvBlock(text: string): Array<{ key: string; value: string }> {
    const cleaned = text.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '').trim();
    return cleaned.split(/\r?\n/).flatMap(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return [];
        const eq = t.indexOf('=');
        if (eq < 1) return [];
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        return key ? [{ key, value: val }] : [];
    });
}

/** Parse piped test-user block: URL|RoleName|username|password (or fewer columns) */
function parseTestBlock(text: string): Partial<TestUserRow>[] {
    return text.trim().split(/\r?\n/).flatMap(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 2) return [];
        const [url, name, username, password] = parts;
        return [{ url: url || '', name: name || '', username: username || '', password: password || '' }];
    });
}

/** Parse piped accounts block: Platform|URL|username|email|password */
function parseAccountBlock(text: string): Partial<AccountRow>[] {
    return text.trim().split(/\r?\n/).flatMap(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 2) return [];
        const [name, url, username, email, password] = parts;
        return [{ name: name || '', url: url || '', username: username || '', email: email || '', password: password || '' }];
    });
}

// ─── Shared Hooks / Utilities ─────────────────────────────────────────────────
function useCopy() {
    const [copied, setCopied] = useState<string | null>(null);
    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };
    return { copied, copy };
}

function CopyBtn({ text, id, copied, onCopy, label }: { text: string; id: string; copied: string | null; onCopy: (t: string, id: string) => void; label?: string }) {
    const isCopied = copied === id;
    return (
        <button onClick={() => onCopy(text, id)} title={label ?? 'Copy'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors ${label ? 'font-medium' : ''}`}
            style={{
                color: isCopied ? 'var(--color-success)' : 'var(--color-text-muted)',
                borderColor: isCopied ? 'var(--color-success)' : 'var(--color-border-default)',
                backgroundColor: 'transparent'
            }}>
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
            {label && <span>{isCopied ? 'Copied!' : label}</span>}
        </button>
    );
}

function normalizeCredentialUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
    if (/^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(trimmed)) return `http://${trimmed}`;
    return `https://${trimmed}`;
}

const inputCls = 'w-full px-3 rounded text-sm outline-none border transition-colors';
const inputStyle = {
    height: '38px',
    borderColor: 'var(--color-border-default)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
};
const textareaStyle = {
    borderColor: 'var(--color-border-default)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProjectCredentialsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const { project } = useOutletContext<{ project: Project }>();
    const currentUser = useSelector((state: RootState) => state.auth.user);

    const [activeTab, setActiveTab] = useState<CredentialType>('env');
    const [showShareModal, setShowShareModal] = useState(false);
    const [envGroupFilter, setEnvGroupFilter] = useState<string>('all');

    const { data, isLoading } = useGetCredentialsQuery({ projectId: projectId!, type: activeTab });
    const credentials = data?.data || [];

    // Derive distinct saved ENV group names for filter + form suggestions
    const savedEnvGroups = useMemo(() => {
        if (activeTab !== 'env') return [];
        const seen = new Set<string>();
        credentials.forEach((c: any) => { const g = c.description || 'General'; seen.add(g); });
        return Array.from(seen).sort();
    }, [credentials, activeTab]);

    // Reset group filter when tab changes
    const [_prevTab, _setPrevTab] = useState<CredentialType>('env');
    if (activeTab !== _prevTab) { _setPrevTab(activeTab); setEnvGroupFilter('all'); }
    const [createCredential, { isLoading: isCreating }] = useCreateCredentialMutation();
    const [deleteCredential] = useDeleteCredentialMutation();

    // Determine if current user is a credential admin
    // NOTE: role can be either a plain string OR a Role object {_id, name, ...}
    // We must handle both shapes.
    const getRoleName = (role: any): string => {
        if (!role) return '';
        if (typeof role === 'string') return role;
        return role.name ?? '';
    };

    const { data: adminsData } = useGetCredentialAdminsQuery({ projectId: projectId! });
    // Extract credential admin IDs with proper trimming for consistent comparison
    const credentialAdminIds: string[] = (adminsData?.data ?? []).map((a: any) => {
        const id = typeof a === 'string' ? a : a._id;
        return typeof id === 'string' ? id.trim() : '';
    }).filter(Boolean);
    const userRoleName = getRoleName(currentUser?.role);
    const isSuperAdmin = userRoleName === 'super-admin' || userRoleName === 'super_admin' || userRoleName === 'admin';
    const currentUserId = currentUser?._id?.trim?.() ?? currentUser?._id ?? '';
    // While adminsData is still loading, super-admins should still see full access
    const isCredAdmin = isSuperAdmin || credentialAdminIds.includes(currentUserId);

    const formRef = useRef<HTMLFormElement>(null);

    // ENV Groups state (replaces flat envRows)
    const [envGroups, setEnvGroups] = useState<EnvGroup[]>([newEnvGroup('')]);
    const [sshRows, setSshRows] = useState<SshRow[]>([newSshRow()]);
    const [testRows, setTestRows] = useState<TestUserRow[]>([newTestRow()]);
    const [accountRows, setAccountRows] = useState<AccountRow[]>([newAccountRow()]);
    const [otherRows, setOtherRows] = useState<OtherRow[]>([newOtherRow()]);
    const [showTestPw, setShowTestPw] = useState<Record<number, boolean>>({});
    const [showAccPw, setShowAccPw] = useState<Record<number, boolean>>({});

    const updateRow = <T extends { id: number }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number, patch: Partial<T>) =>
        setter(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));

    const removeRow = <T extends { id: number }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number) =>
        setter(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows);

    // ── ENV group helpers
    const updateEnvRow = (groupId: number, rowId: number, patch: Partial<EnvRow>) =>
        setEnvGroups(gs => gs.map(g => g.id === groupId ? { ...g, rows: g.rows.map(r => r.id === rowId ? { ...r, ...patch } : r) } : g));
    const removeEnvRow = (groupId: number, rowId: number) =>
        setEnvGroups(gs => gs.map(g => g.id === groupId ? { ...g, rows: g.rows.length > 1 ? g.rows.filter(r => r.id !== rowId) : g.rows } : g));
    const addEnvRow = (groupId: number) =>
        setEnvGroups(gs => gs.map(g => g.id === groupId ? { ...g, rows: [...g.rows, newEnvRow()] } : g));

    // ── ENV paste handler (per group)
    const handleEnvPaste = (groupId: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        const pairs = parseEnvBlock(text);
        if (pairs.length === 0) return;
        e.preventDefault();
        setEnvGroups(gs => gs.map(g => g.id === groupId ? { ...g, rows: pairs.map(p => ({ ...newEnvRow(), key: p.key, value: p.value })) } : g));
    };

    // ── Quick-add: select an existing saved group name for a form group
    const applyExistingGroupName = (groupId: number, name: string) =>
        setEnvGroups(gs => gs.map(g => g.id === groupId ? { ...g, label: name } : g));

    // ── SSH: paste key content OR upload file
    const handleSshFilePaste = (id: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const text = e.clipboardData.getData('text');
        if (text.length > 20) {
            e.preventDefault();
            updateRow(setSshRows, id, { keyContent: text, fileName: 'Pasted key' });
        }
    };

    const handleSshFileUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => updateRow(setSshRows, id, { keyContent: ev.target?.result as string, fileName: file.name });
        reader.readAsText(file);
    };

    // ── Test user paste handler
    const handleTestPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        const rows = parseTestBlock(text);
        if (rows.length <= 1) return;
        e.preventDefault();
        setTestRows(rows.map(r => ({ ...newTestRow(), ...r })));
    };

    // ── Account paste handler
    const handleAccountPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        const rows = parseAccountBlock(text);
        if (rows.length <= 1) return;
        e.preventDefault();
        setAccountRows(rows.map(r => ({ ...newAccountRow(), ...r })));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        let toCreate: any[] = [];

        switch (activeTab) {
            case 'env':
                toCreate = envGroups.flatMap(group =>
                    group.rows.filter(r => r.key && r.value)
                        .map(r => ({ name: r.key, type: 'env', description: group.label || 'General', credentials: { envKey: r.key, envValue: r.value, note: r.note } }))
                );
                break;
            case 'ssh-key':
                toCreate = sshRows.filter(r => r.name && r.keyContent)
                    .map(r => ({ name: r.name, type: 'ssh-key', credentials: { sshPrivateKey: r.keyContent } }));
                break;
            case 'test-user':
                toCreate = testRows.filter(r => r.name && r.username && r.password)
                    .map(r => ({ name: r.name, type: 'test-user', credentials: { url: r.url, username: r.username, password: r.password } }));
                break;
            case 'account':
                toCreate = accountRows.filter(r => r.name && r.password)
                    .map(r => ({ name: r.name, type: 'account', credentials: { url: r.url, username: r.username, email: r.email, password: r.password } }));
                break;
            case 'other':
                toCreate = otherRows.filter(r => r.name)
                    .map(r => ({ name: r.name, description: r.description, type: 'other', credentials: { notes: r.notes } }));
                break;
        }

        if (!toCreate.length) { alert('Please fill in all required fields.'); return; }

        try {
            await Promise.all(toCreate.map(cred => createCredential({ projectId: projectId!, data: cred }).unwrap()));
            if (formRef.current) formRef.current.reset();
            setEnvGroups([newEnvGroup('')]); setSshRows([newSshRow()]); setTestRows([newTestRow()]);
            setAccountRows([newAccountRow()]); setOtherRows([newOtherRow()]);
            alert('Credentials saved successfully!');
        } catch (err: any) {
            console.error('Failed to save credentials:', err);
            const errorMessage = err?.data?.message || err?.message || 'Unknown error';
            alert(`Failed to save: ${errorMessage}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this credential?')) return;
        try { await deleteCredential({ projectId: projectId!, id }).unwrap(); } catch (e) { console.error(e); }
    };

    return (
        <div className="space-y-6">

            {/* ─── Credentials Section Header ───────────────────────────── */}
            <div
                className="flex items-center justify-between px-4 py-3 rounded-xl border"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {/* Left: title + description */}
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center w-8 h-8 rounded-lg"
                        style={{ backgroundColor: 'var(--color-success-soft)' }}
                    >
                        <Shield size={16} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Credentials
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {isCredAdmin
                                ? 'You have full access — manage credentials and team permissions'
                                : 'Showing credentials shared with you'}
                        </p>
                    </div>
                </div>

                {/* Right: Share button — only for credential admins & super-admins */}
                {isCredAdmin && (
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                        style={{
                            backgroundColor: 'var(--color-success)',
                            color: '#ffffff',
                        }}
                    >
                        <Share2 size={14} />
                        Manage Access
                    </button>
                )}
            </div>

            {/* ─── Type Sub-tabs ────────────────────────────────────────── */}
            <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                {TABS.map(t => {
                    const isActive = activeTab === t.id;
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 font-medium"
                            style={{
                                color: isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                borderColor: isActive ? 'var(--color-success)' : 'transparent',
                                backgroundColor: isActive ? 'var(--color-success-soft)' : 'transparent',
                                borderTopLeftRadius: 6, borderTopRightRadius: 6
                            }}>
                            <Icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Card */}
            <div className="p-6 rounded-xl border shadow-sm" style={{ backgroundColor: 'var(--color-bg-body)', borderColor: 'var(--color-border-default)' }}>

                {/* Form Header */}
                <div className="flex items-center gap-2 mb-5">
                    {(() => { const I = TABS.find(t => t.id === activeTab)?.icon; return I ? <I size={18} style={{ color: 'var(--color-success)' }} /> : null; })()}
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {isCredAdmin ? `Add ${TABS.find(t => t.id === activeTab)?.label}` : `${TABS.find(t => t.id === activeTab)?.label}`}
                    </h3>
                </div>

                {/* ─── FORM — only visible to credential admins ─── */}
                {isCredAdmin && (<form ref={formRef} onSubmit={handleSubmit}
                    className="mb-8 p-5 rounded-xl border space-y-4"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>

                    {/* ENV VARIABLES */}
                    {activeTab === 'env' && (
                        <div className="space-y-3">
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Organise env vars into named groups (e.g. <em>Client</em>, <em>Server</em>, <em>Backend 2</em>). Paste a full <code style={{ color: 'var(--color-success)' }}>.env</code> block into any Key field to auto-fill that group's rows.
                            </p>
                            {envGroups.map((group) => (
                                <div key={group.id} className="rounded-xl border overflow-hidden"
                                    style={{ borderColor: 'var(--color-border-default)' }}>
                                    {/* Group header */}
                                    <div className="space-y-2 px-3 pt-2.5 pb-2 border-b"
                                        style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                        <div className="flex items-center gap-2">
                                            <Code size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                            <input
                                                value={group.label}
                                                onChange={e => setEnvGroups(gs => gs.map(g => g.id === group.id ? { ...g, label: e.target.value } : g))}
                                                className="flex-1 text-sm font-semibold bg-transparent outline-none"
                                                style={{ color: 'var(--color-text-primary)' }}
                                                list={`env-groups-${group.id}`}
                                                placeholder="Group name — type or pick existing…" />
                                            <datalist id={`env-groups-${group.id}`}>
                                                {savedEnvGroups.map(sg => <option key={sg} value={sg} />)}
                                            </datalist>
                                            {envGroups.length > 1 && (
                                                <button type="button"
                                                    onClick={() => setEnvGroups(gs => gs.filter(g => g.id !== group.id))}
                                                    className="p-1 rounded hover:bg-red-500/10 shrink-0"
                                                    style={{ color: 'var(--color-danger)' }} title="Remove this group card">
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                        {/* Existing group quick-select chips */}
                                        {savedEnvGroups.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className="text-[10px] self-center" style={{ color: 'var(--color-text-muted)' }}>Add to:</span>
                                                {savedEnvGroups.map(sg => (
                                                    <button key={sg} type="button"
                                                        onClick={() => applyExistingGroupName(group.id, sg)}
                                                        className="px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors"
                                                        style={{
                                                            borderColor: group.label === sg ? 'var(--color-success)' : 'var(--color-border-default)',
                                                            backgroundColor: group.label === sg ? 'var(--color-success-soft)' : 'transparent',
                                                            color: group.label === sg ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                                        }}>
                                                        {sg}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Rows */}
                                    <div className="p-3 space-y-2" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                                        <div className="flex items-center gap-3 pb-1">
                                            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Key</span>
                                            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Value</span>
                                            <div className="w-8" />
                                        </div>
                                        {group.rows.map(row => (
                                            <div key={row.id} className="space-y-1">
                                                <div className="flex gap-3 items-center">
                                                    <input value={row.key}
                                                        onChange={e => updateEnvRow(group.id, row.id, { key: e.target.value })}
                                                        onPaste={e => handleEnvPaste(group.id, e)}
                                                        className={inputCls} style={inputStyle} placeholder="KEY_NAME or paste .env block…" />
                                                    <input value={row.value}
                                                        onChange={e => updateEnvRow(group.id, row.id, { value: e.target.value })}
                                                        className={`${inputCls} font-mono`} style={inputStyle} placeholder="value" />
                                                    {group.rows.length > 1 && (
                                                        <button type="button" onClick={() => removeEnvRow(group.id, row.id)}
                                                            className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                                <input value={row.note}
                                                    onChange={e => updateEnvRow(group.id, row.id, { note: e.target.value })}
                                                    className="w-full bg-transparent text-[12px] outline-none pl-1"
                                                    style={{ color: 'var(--color-text-muted)' }}
                                                    placeholder="Note (optional)" />
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addEnvRow(group.id)}
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-white/5 mt-1"
                                            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                            <Plus size={12} /> Add Row
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setEnvGroups(gs => [...gs, newEnvGroup('')])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors"
                                style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', backgroundColor: 'var(--color-success-soft)' }}>
                                <FolderPlus size={14} /> New Group
                            </button>
                        </div>
                    )}

                    {/* SSH KEYS */}
                    {activeTab === 'ssh-key' && (
                        <div className="space-y-4">
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Upload a <code>.pem / .pub</code> file <strong>or</strong> paste the key content directly into the text area.
                            </p>
                            {sshRows.map(row => (
                                <div key={row.id} className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <div className="flex gap-3 items-center">
                                        <input value={row.name}
                                            onChange={e => updateRow(setSshRows, row.id, { name: e.target.value })}
                                            className={inputCls} style={{ ...inputStyle, maxWidth: '280px' }}
                                            placeholder="Key name (e.g. Production Server)" />
                                        {/* File upload trigger */}
                                        <label className="flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm transition-colors hover:bg-white/5"
                                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                                            <Upload size={14} />
                                            {row.fileName || 'Upload file'}
                                            <input type="file" accept=".pem,.key,.pub" className="hidden" onChange={e => handleSshFileUpload(row.id, e)} />
                                        </label>
                                        {sshRows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(setSshRows, row.id)}
                                                className="ml-auto p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        value={row.keyContent}
                                        onChange={e => updateRow(setSshRows, row.id, { keyContent: e.target.value })}
                                        onPaste={e => handleSshFilePaste(row.id, e)}
                                        className="w-full px-3 py-2 rounded text-xs font-mono outline-none border resize-none"
                                        style={{ ...textareaStyle, height: '100px' }}
                                        placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;Paste key content here or upload a file above…&#10;-----END RSA PRIVATE KEY-----" />
                                </div>
                            ))}
                            <button type="button" onClick={() => setSshRows(r => [...r, newSshRow()])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
                                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                <Plus size={14} /> Add Another Key
                            </button>
                        </div>
                    )}

                    {/* TEST USERS */}
                    {activeTab === 'test-user' && (
                        <div className="space-y-3">
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Paste multiple rows in <code style={{ color: 'var(--color-success)' }}>URL|RoleName|username|password</code> format into the Role field to auto-fill.
                            </p>
                            {testRows.map(row => (
                                <div key={row.id} className="p-3 rounded-lg border space-y-2"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                                    {/* Row 1: Role + URL + delete */}
                                    <div className="flex gap-2 items-center">
                                        <input value={row.name}
                                            onChange={e => updateRow(setTestRows, row.id, { name: e.target.value })}
                                            onPaste={handleTestPaste}
                                            className="flex-1 px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Role / Type (Admin, QA…)" />
                                        <input value={row.url}
                                            onChange={e => updateRow(setTestRows, row.id, { url: e.target.value })}
                                            className="flex-[2] px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Login URL (https://...)" />
                                        {testRows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(setTestRows, row.id)}
                                                className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Row 2: Username + Password with eye */}
                                    <div className="flex gap-2 items-center">
                                        <input value={row.username}
                                            onChange={e => updateRow(setTestRows, row.id, { username: e.target.value })}
                                            className="flex-1 px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Username / Email" />
                                        <div className="relative flex-1">
                                            <input
                                                type={showTestPw[row.id] ? 'text' : 'password'}
                                                value={row.password}
                                                onChange={e => updateRow(setTestRows, row.id, { password: e.target.value })}
                                                className="w-full px-3 pr-9 rounded text-sm outline-none border transition-colors font-mono"
                                                style={{ ...inputStyle, height: '36px' }}
                                                placeholder="Password" />
                                            <button type="button"
                                                onClick={() => setShowTestPw(p => ({ ...p, [row.id]: !p[row.id] }))}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
                                                style={{ color: 'var(--color-text-muted)' }}>
                                                {showTestPw[row.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setTestRows(r => [...r, newTestRow()])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
                                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                <Plus size={14} /> Add Another
                            </button>
                        </div>
                    )}

                    {/* ACCOUNTS */}
                    {activeTab === 'account' && (
                        <div className="space-y-3">
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Paste rows as <code style={{ color: 'var(--color-success)' }}>Platform|URL|username|email|password</code> into the Platform field.
                            </p>
                            {accountRows.map(row => (
                                <div key={row.id} className="p-3 rounded-lg border space-y-2"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                                    {/* Row 1: Platform + URL + delete */}
                                    <div className="flex gap-2 items-center">
                                        <input value={row.name}
                                            onChange={e => updateRow(setAccountRows, row.id, { name: e.target.value })}
                                            onPaste={handleAccountPaste}
                                            className="flex-1 px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Platform (AWS, GitHub…)" />
                                        <input value={row.url}
                                            onChange={e => updateRow(setAccountRows, row.id, { url: e.target.value })}
                                            className="flex-[2] px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Login URL (https://...)" />
                                        {accountRows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(setAccountRows, row.id)}
                                                className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Row 2: Username + Email + Password with eye */}
                                    <div className="flex gap-2 items-center">
                                        <input value={row.username}
                                            onChange={e => updateRow(setAccountRows, row.id, { username: e.target.value })}
                                            className="flex-1 px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Username" />
                                        <input value={row.email}
                                            onChange={e => updateRow(setAccountRows, row.id, { email: e.target.value })}
                                            className="flex-1 px-3 rounded text-sm outline-none border transition-colors"
                                            style={{ ...inputStyle, height: '36px' }}
                                            placeholder="Email" />
                                    <div className="relative flex-1">
                                        <input type={showAccPw[row.id] ? 'text' : 'password'} value={row.password}
                                            onChange={e => updateRow(setAccountRows, row.id, { password: e.target.value })}
                                            className={`w-full px-3 pr-9 rounded text-sm outline-none border transition-colors font-mono`}
                                            style={{ ...inputStyle, height: '36px' }} placeholder="Password" />
                                        <button type="button"
                                            onClick={() => setShowAccPw(p => ({ ...p, [row.id]: !p[row.id] }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
                                            style={{ color: 'var(--color-text-muted)' }}>
                                            {showAccPw[row.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={() => setAccountRows(r => [...r, newAccountRow()])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
                                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                <Plus size={14} /> Add Another
                            </button>
                        </div>
                    )}

                    {/* OTHER */}
                    {activeTab === 'other' && (
                        <div className="space-y-4">
                            {otherRows.map(row => (
                                <div key={row.id} className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <div className="flex gap-3 items-center">
                                        <input value={row.name}
                                            onChange={e => updateRow(setOtherRows, row.id, { name: e.target.value })}
                                            className={inputCls} style={{ ...inputStyle, maxWidth: '240px' }} placeholder="Credential name" />
                                        <input value={row.description}
                                            onChange={e => updateRow(setOtherRows, row.id, { description: e.target.value })}
                                            className={inputCls} style={inputStyle} placeholder="Short description (optional)" />
                                        {otherRows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(setOtherRows, row.id)}
                                                className="ml-auto p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                    <textarea value={row.notes}
                                        onChange={e => updateRow(setOtherRows, row.id, { notes: e.target.value })}
                                        className="w-full px-3 py-2 rounded text-sm outline-none border resize-none"
                                        style={{ ...textareaStyle, height: '80px' }}
                                        placeholder="Paste token, key, or any secure notes here…" />
                                </div>
                            ))}
                            <button type="button" onClick={() => setOtherRows(r => [...r, newOtherRow()])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
                                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                <Plus size={14} /> Add Another
                            </button>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <button type="submit" disabled={isCreating}
                            className="px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            style={{ backgroundColor: 'var(--color-success)' }}>
                            {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Save {TABS.find(t => t.id === activeTab)?.label}
                        </button>
                    </div>
                </form>)}

                {/* ─── SAVED LIST ───────────────────────────────────────────── */}
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                ) : credentials.length === 0 ? (
                    <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        No {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} saved yet.
                    </div>
                ) : (
                    <div>
                        {/* ── ENV group filter bar ── */}
                        {activeTab === 'env' && savedEnvGroups.length > 1 && (
                            <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                                <Filter size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>Filter by group:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => setEnvGroupFilter('all')}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                        style={{
                                            borderColor: envGroupFilter === 'all' ? 'var(--color-success)' : 'var(--color-border-default)',
                                            backgroundColor: envGroupFilter === 'all' ? 'var(--color-success)' : 'transparent',
                                            color: envGroupFilter === 'all' ? 'white' : 'var(--color-text-secondary)',
                                        }}>
                                        All ({credentials.length})
                                    </button>
                                    {savedEnvGroups.map(sg => {
                                        const count = credentials.filter((c: any) => (c.description || 'General') === sg).length;
                                        const isActive = envGroupFilter === sg;
                                        return (
                                            <button key={sg}
                                                onClick={() => setEnvGroupFilter(isActive ? 'all' : sg)}
                                                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                                                style={{
                                                    borderColor: isActive ? 'var(--color-success)' : 'var(--color-border-default)',
                                                    backgroundColor: isActive ? 'var(--color-success-soft)' : 'transparent',
                                                    color: isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                                }}>
                                                {sg} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                Saved — {TABS.find(t => t.id === activeTab)?.label} ({credentials.length})
                            </h4>
                        </div>
                        <div className="space-y-2">
                            {activeTab === 'env' ? (
                                (() => {
                                    const groups: Record<string, any[]> = {};
                                    credentials.forEach((c: any) => {
                                        const g = c.description || 'General';
                                        (groups[g] = groups[g] || []).push(c);
                                    });
                                    return Object.entries(groups)
                                        .filter(([gl]) => envGroupFilter === 'all' || gl === envGroupFilter)
                                        .map(([groupLabel, creds]) => (
                                            <div key={groupLabel} className="rounded-xl border overflow-hidden"
                                                style={{ borderColor: 'var(--color-border-default)' }}>
                                                <div className="flex items-center justify-between px-3 py-2 border-b"
                                                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                                    <div className="flex items-center gap-2">
                                                        <Code size={13} style={{ color: 'var(--color-success)' }} />
                                                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{groupLabel}</span>
                                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-muted)' }}>{creds.length}</span>
                                                    </div>
                                                    <CopyAllEnvButton credentials={creds} projectId={projectId!} />
                                                </div>
                                                <div className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                                    {creds.map(cred => (
                                                        <CredentialListItem key={cred._id} credential={cred} projectId={projectId!} onDelete={() => handleDelete(cred._id)} isCredAdmin={isCredAdmin} />
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                })()
                            ) : (
                                credentials.map(cred => (
                                    <CredentialListItem key={cred._id} credential={cred} projectId={projectId!} onDelete={() => handleDelete(cred._id)} isCredAdmin={isCredAdmin} />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Encryption notice */}
            <div className="flex items-center gap-2 text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                <Shield size={12} style={{ flexShrink: 0 }} />
                All credentials are encrypted at rest. Access is restricted to authorized users.
                {!isCredAdmin && (
                    <span className="ml-1">Contact a credential admin to gain access to more credentials.</span>
                )}
            </div>

            {/* Share Modal — rendered via portal so position:fixed works regardless of parent */}
            {showShareModal && project && createPortal(
                <CredentialShareModal
                    project={project}
                    projectId={projectId!}
                    onClose={() => setShowShareModal(false)}
                />,
                document.body
            )}
        </div>
    );
}

// ─── Credential List Item (type-aware) ───────────────────────────────────────
function CredentialListItem({ credential, onDelete, projectId, isCredAdmin }: { credential: any; onDelete: () => void; projectId: string; isCredAdmin?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const { data, isLoading } = useGetCredentialByIdQuery(
        { projectId, id: credential._id },
        { skip: !expanded }
    );
    const full = data?.data;
    const creds = full?.credentials ?? {};
    const [viewersOpen, setViewersOpen] = useState(false);
    const [revokeAccess, { isLoading: isRevoking }] = useRevokeCredentialAccessMutation();
    const { copied, copy } = useCopy();

    useBodyScrollLock(viewersOpen);

    const type: CredentialType = credential.type;
    const viewers: any[] = credential.viewAccess ?? [];

    const handleRevokeViewer = async (userId: string) => {
        try {
            await revokeAccess({ projectId, data: { credentialIds: [credential._id], userIds: [userId] } }).unwrap();
        } catch (e) {
            console.error('Revoke failed:', e);
        }
    };

    return (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{credential.name}</span>
                    {credential.description && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>— {credential.description}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* View-access badge — admins only */}
                    {isCredAdmin && (
                        <button
                            onClick={() => setViewersOpen(s => !s)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                            style={{
                                color: viewersOpen ? 'var(--color-success)' : viewers.length > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                                backgroundColor: viewersOpen ? 'var(--color-success-soft)' : 'transparent',
                                border: `1px solid ${viewersOpen ? 'var(--color-success)' : 'var(--color-border-default)'}`,
                            }}
                            title="Manage who can view this credential"
                        >
                            <Eye size={12} />
                            <span>{viewers.length}</span>
                        </button>
                    )}
                    <button onClick={() => setExpanded(s => !s)}
                        className="p-1.5 rounded transition-colors hover:bg-white/5"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isCredAdmin && (
                        <button onClick={onDelete}
                            className="p-1.5 rounded transition-colors hover:bg-red-500/10"
                            style={{ color: 'var(--color-danger)' }} title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* View-access side panel via portal */}
            {isCredAdmin && viewersOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[200]"
                        style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
                        onClick={() => setViewersOpen(false)}
                    />
                    <div
                        className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                        style={{
                            width: 'min(460px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-16px 0 48px rgba(0,0,0,0.13)',
                            animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>View Access</p>
                                <h2 className="text-base font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{credential.name}</h2>
                            </div>
                            <button
                                onClick={() => setViewersOpen(false)}
                                className="p-1.5 rounded transition-colors hover:bg-black/5 shrink-0 ml-3"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {viewers.length === 0 ? (
                                <div
                                    className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    <Eye size={32} className="mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.35 }} />
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No view-only access yet</p>
                                    <p className="text-xs mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
                                        Use “Manage Access → View Access” to grant specific users view permission for this credential.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                                        {viewers.length} {viewers.length === 1 ? 'person has' : 'people have'} view access
                                    </p>
                                    {viewers.map((v: any) => {
                                        const userId = typeof v === 'string' ? v : v._id;
                                        const name = typeof v === 'object' ? (v.name ?? 'User') : 'User';
                                        const email = typeof v === 'object' ? (v.email ?? '') : '';
                                        const initials = name.split(' ').map((n: string) => n[0] ?? '').join('').toUpperCase().slice(0, 2);
                                        return (
                                            <div
                                                key={userId}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl border group transition-all"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                                            >
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                                                    style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                                                >
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</p>
                                                    {email && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{email}</p>}
                                                </div>
                                                <button
                                                    onClick={() => handleRevokeViewer(userId)}
                                                    disabled={isRevoking}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-40"
                                                    style={{ color: 'var(--color-danger)', borderColor: 'var(--color-border-default)', backgroundColor: 'transparent' }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
                                                    title="Remove view access"
                                                >
                                                    <UserMinus size={12} /> Remove
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Type-specific detail area */}
            {expanded && (
                <div className="px-4 py-3 border-t" style={{ backgroundColor: 'var(--color-bg-body)', borderColor: 'var(--color-border-default)' }}>
                    {isLoading ? (
                        <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                    ) : !full ? (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No data.</span>
                    ) : type === 'env' ? (
                        /* ENV — KEY="value" single line */
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-sm font-mono break-all select-text rounded px-3 py-2 border"
                                style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                <span style={{ color: 'var(--color-success)' }}>{creds.envKey}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>=</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>"</span>
                                <span style={{ color: '#60a5fa' }}>{creds.envValue}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>"</span>
                            </code>
                            <CopyBtn text={`${creds.envKey}="${creds.envValue}"`} id={credential._id} copied={copied} onCopy={copy} label="Copy" />
                        </div>

                    ) : type === 'ssh-key' ? (
                        /* SSH KEY */
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Private key</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${creds.sshPrivateKey ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {creds.sshPrivateKey ? 'Loaded' : 'Empty'}
                                </span>
                                {creds.sshPrivateKey && (
                                    <CopyBtn text={creds.sshPrivateKey} id={credential._id} copied={copied} onCopy={copy} label="Copy Key" />
                                )}
                            </div>
                            {creds.sshPrivateKey && (
                                <pre className="text-[11px] font-mono rounded px-3 py-2 border overflow-hidden max-h-20 overflow-y-auto select-text"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                                    {creds.sshPrivateKey.slice(0, 120)}…
                                </pre>
                            )}
                        </div>

                    ) : type === 'test-user' ? (
                        /* TEST USER — horizontal chips */
                        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                            {creds.url && (
                                <FieldChip icon={<Link size={12} />} label="URL" value={creds.url}
                                    copyId={`${credential._id}-url`} copied={copied} onCopy={copy} isUrl />
                            )}
                            <FieldChip icon={<User size={12} />} label="Username" value={creds.username ?? ''}
                                copyId={`${credential._id}-user`} copied={copied} onCopy={copy} />
                            <FieldChip icon={<KeyRound size={12} />} label="Password" value={creds.password ?? ''} mono
                                copyId={`${credential._id}-pass`} copied={copied} onCopy={copy} />
                            {/* Copy both */}
                            <CopyBtn
                                text={`${creds.username}\n${creds.password}`}
                                id={`${credential._id}-both`} copied={copied} onCopy={copy}
                                label="Copy Credentials" />
                        </div>

                    ) : type === 'account' ? (
                        /* ACCOUNT — grid of chips */
                        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                            {credential.name && (
                                <FieldChip icon={<Users size={12} />} label="Platform" value={credential.name}
                                    copyId={`${credential._id}-platform`} copied={copied} onCopy={copy} />
                            )}
                            {creds.url && (
                                <FieldChip icon={<Link size={12} />} label="URL" value={creds.url}
                                    copyId={`${credential._id}-url`} copied={copied} onCopy={copy} isUrl />
                            )}
                            {creds.username && (
                                <FieldChip icon={<User size={12} />} label="Username" value={creds.username}
                                    copyId={`${credential._id}-user`} copied={copied} onCopy={copy} />
                            )}
                            {creds.email && (
                                <FieldChip icon={<User size={12} />} label="Email" value={creds.email}
                                    copyId={`${credential._id}-email`} copied={copied} onCopy={copy} />
                            )}
                            <FieldChip icon={<KeyRound size={12} />} label="Password" value={creds.password ?? ''} mono
                                copyId={`${credential._id}-pass`} copied={copied} onCopy={copy} />
                            <CopyBtn
                                text={[creds.username, creds.email, creds.password].filter(Boolean).join('\n')}
                                id={`${credential._id}-all`} copied={copied} onCopy={copy}
                                label="Copy All" />
                        </div>

                    ) : type === 'other' ? (
                        /* OTHER — notes */
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <StickyNote size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                                <pre className="flex-1 text-sm select-text whitespace-pre-wrap break-all font-mono"
                                    style={{ color: 'var(--color-text-primary)' }}>
                                    {creds.notes || '—'}
                                </pre>
                                {creds.notes && (
                                    <CopyBtn text={creds.notes} id={credential._id} copied={copied} onCopy={copy} label="Copy" />
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            )
            }
        </div >
    );
}

// ─── Field Chip sub-component ─────────────────────────────────────────────────
function FieldChip({ icon, label, value, mono, copyId, copied, onCopy, isUrl }: {
    icon: React.ReactNode; label: string; value: string; mono?: boolean; isUrl?: boolean;
    copyId: string; copied: string | null; onCopy: (t: string, id: string) => void;
}) {
    const href = isUrl ? normalizeCredentialUrl(value) : '';
    return (
        <div className="flex flex-col gap-0.5 min-w-[120px]">
            <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {icon} {label}
            </div>
            <div className="flex items-center gap-1.5">
                {href ? (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-sm select-text break-all hover:underline ${mono ? 'font-mono' : ''}`}
                        style={{ color: 'var(--color-primary)' }}
                    >
                        {value}
                    </a>
                ) : (
                    <span className={`text-sm select-text break-all ${mono ? 'font-mono' : ''}`}
                        style={{ color: 'var(--color-text-primary)' }}>
                        {value}
                    </span>
                )}
                <CopyBtn text={value} id={copyId} copied={copied} onCopy={onCopy} />
            </div>
        </div>
    );
}

function CopyAllEnvButton({ credentials, projectId }: { credentials: any[]; projectId: string }) {
    const [copied, setCopied] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchCredentialById] = useLazyGetCredentialByIdQuery();

    const handleCopyAll = async () => {
        if (isFetching) return;
        setIsFetching(true);
        try {
            const results = await Promise.all(
                credentials.map(async (c) => {
                    const detail = await fetchCredentialById({ projectId, id: c._id }, true).unwrap();
                    const envValue = detail?.data?.credentials?.envValue ?? '';
                    return `${c.name}="${envValue}"`;
                })
            );
            navigator.clipboard.writeText(results.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } finally {
            setIsFetching(false);
        }
    };

    if (!credentials.length) return null;
    return (
        <button onClick={handleCopyAll}
            disabled={isFetching}
            title="Copy all env variables as KEY=VALUE block"
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-60"
            style={{
                color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
                borderColor: copied ? 'var(--color-success)' : 'var(--color-border-default)',
                backgroundColor: 'transparent'
            }}>
            {isFetching ? <Loader2 size={13} className="animate-spin" /> : copied ? <Check size={13} /> : <Copy size={13} />}
            {isFetching ? 'Preparing...' : copied ? 'Copied!' : 'Copy All'}
        </button>
    );
}
