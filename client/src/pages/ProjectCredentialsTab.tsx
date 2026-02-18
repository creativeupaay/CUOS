import { useParams } from 'react-router-dom';
import {
    useGetCredentialsQuery,
    useCreateCredentialMutation,
    useGetCredentialByIdQuery,
    useDeleteCredentialMutation,
} from '@/features/project';
import { useState } from 'react';
import { Plus, Loader2, KeyRound, X, Eye, EyeOff, Trash2, Shield } from 'lucide-react';

export default function ProjectCredentialsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const [showForm, setShowForm] = useState(false);
    const [viewingId, setViewingId] = useState<string | null>(null);

    const { data, isLoading } = useGetCredentialsQuery({ projectId: projectId! });
    const credentials = data?.data || [];

    const [createCredential, { isLoading: isCreating }] = useCreateCredentialMutation();
    const [deleteCredential] = useDeleteCredentialMutation();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const credData: any = {
            name: formData.get('name') as string,
            type: formData.get('type') as string,
            description: formData.get('description') as string,
            credentials: {
                username: formData.get('username') as string,
                password: formData.get('password') as string,
                url: formData.get('url') as string,
                notes: formData.get('notes') as string,
            },
        };

        try {
            await createCredential({ projectId: projectId!, data: credData }).unwrap();
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create credential:', error);
        }
    };

    const handleDelete = async (credId: string) => {
        if (!confirm('Delete this credential?')) return;
        try {
            await deleteCredential({ projectId: projectId!, id: credId }).unwrap();
        } catch (error) {
            console.error('Failed to delete credential:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    Loading credentials...
                </div>
            </div>
        );
    }

    const inputStyle = {
        height: '36px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    const typeIcons: Record<string, string> = {
        'env': '🔧',
        'ssh-key': '🔑',
        'test-user': '👤',
        'account': '🏢',
        '2fa': '📱',
        'other': '📋',
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Credentials
                    <span
                        className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        {credentials.length}
                    </span>
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >
                    <Plus size={15} />
                    Add Credential
                </button>
            </div>

            {/* Security Notice */}
            <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--color-warning-soft)', color: '#92400E' }}
            >
                <Shield size={14} />
                <span><strong>Security Notice:</strong> Credentials are encrypted at rest. Only authorized team members can view sensitive information.</span>
            </div>

            {/* Create Form */}
            {showForm && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Add Credential
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Name *</label>
                                <input type="text" name="name" required className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="e.g. Production Database" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Type *</label>
                                <select name="type" required className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle}>
                                    <option value="env">Environment Variable</option>
                                    <option value="ssh-key">SSH Key</option>
                                    <option value="test-user">Test User</option>
                                    <option value="account">Account</option>
                                    <option value="2fa">2FA Info</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                            <input type="text" name="description" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="Brief description" />
                        </div>

                        <div
                            className="p-4 rounded-lg"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Credential Details</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Username / Key</label>
                                    <input type="text" name="username" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="Username" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Password / Secret</label>
                                    <input type="password" name="password" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="••••••••" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>URL</label>
                                <input type="text" name="url" className="w-full px-3 rounded-lg border text-sm outline-none" style={inputStyle} placeholder="https://..." />
                            </div>
                            <div className="mt-3">
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Notes</label>
                                <textarea
                                    name="notes"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    placeholder="Additional notes..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-4 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '36px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                Add Credential
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{ height: '36px', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Viewing Detail Modal */}
            {viewingId && (
                <CredentialDetailView
                    projectId={projectId!}
                    credentialId={viewingId}
                    onClose={() => setViewingId(null)}
                />
            )}

            {/* Credential Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {credentials.map((credential) => (
                    <div
                        key={credential._id}
                        className="p-4 rounded-lg border transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-base">{typeIcons[credential.type] || '📋'}</span>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {credential.name}
                                    </h3>
                                    <p className="text-[11px] capitalize" style={{ color: 'var(--color-text-muted)' }}>
                                        {credential.type}
                                    </p>
                                </div>
                            </div>
                            <span
                                className="text-[11px] px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                {credential.accessUsers.length} users
                            </span>
                        </div>

                        {credential.description && (
                            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                {credential.description}
                            </p>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewingId(credential._id)}
                                className="flex items-center gap-1 text-xs font-medium transition-colors"
                                style={{ color: 'var(--color-primary)' }}
                            >
                                <Eye size={12} />
                                View Details
                            </button>
                            <button
                                onClick={() => handleDelete(credential._id)}
                                className="flex items-center gap-1 text-xs font-medium transition-colors"
                                style={{ color: 'var(--color-danger)' }}
                            >
                                <Trash2 size={12} />
                                Delete
                            </button>
                        </div>
                    </div>
                ))}

                {credentials.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center justify-center py-12">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <KeyRound size={20} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No credentials stored</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Add your first credential</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CredentialDetailView({
    projectId,
    credentialId,
    onClose,
}: {
    projectId: string;
    credentialId: string;
    onClose: () => void;
}) {
    const { data, isLoading } = useGetCredentialByIdQuery({ projectId, id: credentialId });
    const credential = data?.data;
    const [showSecrets, setShowSecrets] = useState(false);

    return (
        <div
            className="p-5 rounded-lg border"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Credential Details
                </h3>
                <button onClick={onClose} className="p-1" style={{ color: 'var(--color-text-muted)' }}>
                    <X size={16} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-6">
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                </div>
            ) : credential ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {credential.name}
                        </p>
                        <button
                            onClick={() => setShowSecrets(!showSecrets)}
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                            {showSecrets ? 'Hide' : 'Show'} Secrets
                        </button>
                    </div>

                    {credential.credentials && (
                        <div
                            className="p-3 rounded-lg space-y-2"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            {Object.entries(credential.credentials).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between text-xs">
                                    <span className="font-medium capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                                        {key}
                                    </span>
                                    <span
                                        className="font-mono"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {showSecrets ? String(value) : '••••••••'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Access denied or credential not found
                </p>
            )}
        </div>
    );
}
