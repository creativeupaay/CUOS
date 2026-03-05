import { useParams, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetCredentialsQuery,
    useCreateCredentialMutation,
    useGetCredentialByIdQuery,
    useDeleteCredentialMutation,
    useGetCredentialAdminsQuery,
} from '@/features/project';
import type { Project } from '@/features/project';
import CredentialShareModal from '@/features/project/components/CredentialShareModal';
import { useState, useRef } from 'react';
import {
    Loader2, Trash2, Shield, Code, TerminalSquare, Lock, Users, FileText,
    Plus, Upload, ChevronDown, ChevronUp, Copy, Check, Link, User, KeyRound, StickyNote, Share2
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type CredentialType = 'env' | 'ssh-key' | 'test-user' | 'account' | 'other';

type EnvRow = { id: number; key: string; value: string; note: string };
type SshRow = { id: number; name: string; keyContent: string; fileName: string };
type TestUserRow = { id: number; name: string; url: string; username: string; password: string };
type AccountRow = { id: number; name: string; url: string; username: string; email: string; password: string };
type OtherRow = { id: number; name: string; description: string; notes: string };

const uid = () => Date.now() + Math.random();
const newEnvRow = (): EnvRow => ({ id: uid(), key: '', value: '', note: '' });
const newSshRow = (): SshRow => ({ id: uid(), name: '', keyContent: '', fileName: '' });
const newTestRow = (): TestUserRow => ({ id: uid(), name: '', url: '', username: '', password: '' });
const newAccountRow = (): AccountRow => ({ id: uid(), name: '', url: '', username: '', email: '', password: '' });
const newOtherRow = (): OtherRow => ({ id: uid(), name: '', description: '', notes: '' });

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

    const { data, isLoading } = useGetCredentialsQuery({ projectId: projectId!, type: activeTab });
    const credentials = data?.data || [];
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
    const credentialAdminIds: string[] = (adminsData?.data ?? []).map((a: any) =>
        typeof a === 'string' ? a : a._id
    );
    const userRoleName = getRoleName(currentUser?.role);
    const isSuperAdmin = userRoleName === 'super-admin' || userRoleName === 'super_admin' || userRoleName === 'admin';
    // While adminsData is still loading, super-admins should still see full access
    const isCredAdmin = isSuperAdmin || credentialAdminIds.includes(currentUser?._id ?? '');

    const formRef = useRef<HTMLFormElement>(null);

    const [envRows, setEnvRows] = useState<EnvRow[]>([newEnvRow()]);
    const [sshRows, setSshRows] = useState<SshRow[]>([newSshRow()]);
    const [testRows, setTestRows] = useState<TestUserRow[]>([newTestRow()]);
    const [accountRows, setAccountRows] = useState<AccountRow[]>([newAccountRow()]);
    const [otherRows, setOtherRows] = useState<OtherRow[]>([newOtherRow()]);

    const updateRow = <T extends { id: number }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number, patch: Partial<T>) =>
        setter(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));

    const removeRow = <T extends { id: number }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number) =>
        setter(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows);

    // ── ENV paste handler
    const handleEnvPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        const pairs = parseEnvBlock(text);
        if (pairs.length === 0) return;
        e.preventDefault();
        setEnvRows(pairs.map(p => ({ ...newEnvRow(), key: p.key, value: p.value })));
    };

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
                toCreate = envRows.filter(r => r.key && r.value)
                    .map(r => ({ name: r.key, type: 'env', description: r.note, credentials: { envKey: r.key, envValue: r.value } }));
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
            setEnvRows([newEnvRow()]); setSshRows([newSshRow()]); setTestRows([newTestRow()]);
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
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Key</span>
                                <span className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Value</span>
                                <div className="w-8" />
                            </div>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Paste a full <code style={{ color: 'var(--color-success)' }}>.env</code> block into the Key field to auto-populate all rows.
                            </p>
                            {envRows.map(row => (
                                <div key={row.id} className="space-y-1.5">
                                    <div className="flex gap-3 items-center">
                                        <input value={row.key}
                                            onChange={e => updateRow(setEnvRows, row.id, { key: e.target.value })}
                                            onPaste={handleEnvPaste}
                                            className={inputCls} style={inputStyle} placeholder="KEY_NAME or paste .env block…" />
                                        <input value={row.value}
                                            onChange={e => updateRow(setEnvRows, row.id, { value: e.target.value })}
                                            className={`${inputCls} font-mono`} style={inputStyle} placeholder="value" />
                                        {envRows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(setEnvRows, row.id)}
                                                className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                    <input value={row.note} onChange={e => updateRow(setEnvRows, row.id, { note: e.target.value })}
                                        className="w-full bg-transparent text-[13px] outline-none pl-1"
                                        style={{ color: 'var(--color-text-muted)' }} placeholder="Add note (optional)" />
                                </div>
                            ))}
                            <button type="button" onClick={() => setEnvRows(r => [...r, newEnvRow()])}
                                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded border transition-colors hover:bg-white/5"
                                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-default)' }}>
                                <Plus size={14} /> Add Another
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
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                {['Role / Type', 'Login URL', 'Username / Email', 'Password'].map(l => (
                                    <span key={l} className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
                                ))}
                            </div>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Paste multiple rows in <code style={{ color: 'var(--color-success)' }}>URL|RoleName|username|password</code> format into the Role field to auto-fill.
                            </p>
                            {testRows.map(row => (
                                <div key={row.id} className="flex gap-3 items-center">
                                    <input value={row.name}
                                        onChange={e => updateRow(setTestRows, row.id, { name: e.target.value })}
                                        onPaste={handleTestPaste}
                                        className={inputCls} style={inputStyle} placeholder="Admin / QA…" />
                                    <input value={row.url}
                                        onChange={e => updateRow(setTestRows, row.id, { url: e.target.value })}
                                        className={inputCls} style={inputStyle} placeholder="https://..." />
                                    <input value={row.username}
                                        onChange={e => updateRow(setTestRows, row.id, { username: e.target.value })}
                                        className={inputCls} style={inputStyle} placeholder="user@example.com" />
                                    <input type="password" value={row.password}
                                        onChange={e => updateRow(setTestRows, row.id, { password: e.target.value })}
                                        className={`${inputCls} font-mono`} style={inputStyle} placeholder="Password" />
                                    {testRows.length > 1 && (
                                        <button type="button" onClick={() => removeRow(setTestRows, row.id)}
                                            className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                            <Trash2 size={15} />
                                        </button>
                                    )}
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
                        <div className="space-y-4">
                            <div className="grid grid-cols-5 gap-3">
                                {['Platform', 'Login URL', 'Username', 'Email', 'Password'].map(l => (
                                    <span key={l} className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
                                ))}
                            </div>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Paste rows as <code style={{ color: 'var(--color-success)' }}>Platform|URL|username|email|password</code> into the Platform field.
                            </p>
                            {accountRows.map(row => (
                                <div key={row.id} className="flex gap-3 items-center">
                                    <input value={row.name}
                                        onChange={e => updateRow(setAccountRows, row.id, { name: e.target.value })}
                                        onPaste={handleAccountPaste}
                                        className={inputCls} style={inputStyle} placeholder="AWS / GitHub…" />
                                    <input value={row.url}
                                        onChange={e => updateRow(setAccountRows, row.id, { url: e.target.value })}
                                        className={inputCls} style={inputStyle} placeholder="https://..." />
                                    <input value={row.username}
                                        onChange={e => updateRow(setAccountRows, row.id, { username: e.target.value })}
                                        className={inputCls} style={inputStyle} placeholder="Username" />
                                    <input value={row.email}
                                        onChange={e => updateRow(setAccountRows, row.id, { email: e.target.value })}
                                        className={inputCls} style={inputStyle} placeholder="Email" />
                                    <input type="password" value={row.password}
                                        onChange={e => updateRow(setAccountRows, row.id, { password: e.target.value })}
                                        className={`${inputCls} font-mono`} style={inputStyle} placeholder="Password" />
                                    {accountRows.length > 1 && (
                                        <button type="button" onClick={() => removeRow(setAccountRows, row.id)}
                                            className="p-2 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--color-danger)' }}>
                                            <Trash2 size={15} />
                                        </button>
                                    )}
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
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                Saved — {TABS.find(t => t.id === activeTab)?.label} ({credentials.length})
                            </h4>
                            {activeTab === 'env' && <CopyAllEnvButton credentials={credentials} projectId={projectId!} />}
                        </div>
                        <div className="space-y-2">
                            {credentials.map(cred => (
                                <CredentialListItem key={cred._id} credential={cred} projectId={projectId!} onDelete={() => handleDelete(cred._id)} />
                            ))}
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

            {/* Share Modal */}
            {showShareModal && project && (
                <CredentialShareModal
                    project={project}
                    projectId={projectId!}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}

// ─── Credential List Item (type-aware) ───────────────────────────────────────
function CredentialListItem({ credential, onDelete, projectId }: { credential: any; onDelete: () => void; projectId: string }) {
    const { data, isLoading } = useGetCredentialByIdQuery({ projectId, id: credential._id });
    const full = data?.data;
    const creds = full?.credentials ?? {};
    const [expanded, setExpanded] = useState(true);
    const { copied, copy } = useCopy();

    const type: CredentialType = credential.type;

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
                    <button onClick={() => setExpanded(s => !s)}
                        className="p-1.5 rounded transition-colors hover:bg-white/5"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={onDelete}
                        className="p-1.5 rounded transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--color-danger)' }} title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

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
                                    copyId={`${credential._id}-url`} copied={copied} onCopy={copy} />
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
                            {creds.url && (
                                <FieldChip icon={<Link size={12} />} label="URL" value={creds.url}
                                    copyId={`${credential._id}-url`} copied={copied} onCopy={copy} />
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
function FieldChip({ icon, label, value, mono, copyId, copied, onCopy }: {
    icon: React.ReactNode; label: string; value: string; mono?: boolean;
    copyId: string; copied: string | null; onCopy: (t: string, id: string) => void;
}) {
    return (
        <div className="flex flex-col gap-0.5 min-w-[120px]">
            <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {icon} {label}
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`text-sm select-text break-all ${mono ? 'font-mono' : ''}`}
                    style={{ color: 'var(--color-text-primary)' }}>
                    {value}
                </span>
                <CopyBtn text={value} id={copyId} copied={copied} onCopy={onCopy} />
            </div>
        </div>
    );
}

// ─── Copy All Env ─────────────────────────────────────────────────────────────
function EnvValueFetcher({ credential, projectId, onLoaded }: {
    credential: any; projectId: string; onLoaded: (key: string, value: string) => void
}) {
    const { data } = useGetCredentialByIdQuery({ projectId, id: credential._id });
    const envValue = data?.data?.credentials?.envValue;
    if (envValue) onLoaded(credential.name, envValue);
    return null;
}

function CopyAllEnvButton({ credentials, projectId }: { credentials: any[]; projectId: string }) {
    const [copied, setCopied] = useState(false);
    const valuesRef = useRef<Record<string, string>>({});

    const handleCopyAll = () => {
        const lines = credentials
            .map(c => { const v = valuesRef.current[c._id]; return v ? `${c.name}="${v}"` : `${c.name}=`; })
            .join('\n');
        navigator.clipboard.writeText(lines);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!credentials.length) return null;
    return (
        <>
            {credentials.map(c => (
                <EnvValueFetcher key={c._id} credential={c} projectId={projectId}
                    onLoaded={(_k, v) => { valuesRef.current[c._id] = v; }} />
            ))}
            <button onClick={handleCopyAll}
                title="Copy all env variables as KEY=VALUE block"
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-colors"
                style={{
                    color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    borderColor: copied ? 'var(--color-success)' : 'var(--color-border-default)',
                    backgroundColor: 'transparent'
                }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy All'}
            </button>
        </>
    );
}
