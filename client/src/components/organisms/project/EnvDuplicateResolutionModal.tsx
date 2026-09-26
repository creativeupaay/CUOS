import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, RefreshCw, FastForward, Check, Loader2 } from 'lucide-react';

export interface EnvConflictItem {
    id?: string;
    key: string;
    newValue: string;
    newNote?: string;
    newGroup: string;
    existingCredentialId: string;
    existingGroup: string;
    existingNote?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    conflicts: EnvConflictItem[];
    newItemsCount: number;
    onConfirm: (decisions: Record<string, 'update' | 'skip'>) => void;
    isSaving?: boolean;
}

export default function EnvDuplicateResolutionModal({
    isOpen,
    onClose,
    conflicts,
    newItemsCount,
    onConfirm,
    isSaving = false,
}: Props) {
    // Decision map: key -> 'update' | 'skip' (default all to 'update')
    const [decisions, setDecisions] = useState<Record<string, 'update' | 'skip'>>(() => {
        const initial: Record<string, 'update' | 'skip'> = {};
        conflicts.forEach(c => {
            initial[c.key] = 'update';
        });
        return initial;
    });

    if (!isOpen || typeof document === 'undefined') return null;

    const setAllDecisions = (action: 'update' | 'skip') => {
        const updated: Record<string, 'update' | 'skip'> = {};
        conflicts.forEach(c => {
            updated[c.key] = action;
        });
        setDecisions(updated);
    };

    const toggleDecision = (key: string, action: 'update' | 'skip') => {
        setDecisions(prev => ({
            ...prev,
            [key]: action,
        }));
    };

    const updateCount = Object.values(decisions).filter(d => d === 'update').length;
    const skipCount = Object.values(decisions).filter(d => d === 'skip').length;

    const handleConfirm = () => {
        onConfirm(decisions);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSaving) onClose();
            }}
        >
            <div
                className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500 shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                Existing Environment Variables Detected
                            </h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {conflicts.length} variable{conflicts.length === 1 ? '' : 's'} already exist in this project
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-1.5 rounded-lg border transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Info & Bulk Controls */}
                <div
                    className="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
                    style={{
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {newItemsCount > 0 && (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                +{newItemsCount} new to add
                            </span>
                        )}
                        {newItemsCount > 0 && <span>•</span>}
                        <span>{updateCount} to update</span>
                        <span>•</span>
                        <span>{skipCount} to skip</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setAllDecisions('update')}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1"
                            style={{
                                borderColor: 'var(--color-primary)',
                                backgroundColor: 'var(--color-primary-soft)',
                                color: 'var(--color-primary-darker)',
                            }}
                        >
                            <RefreshCw size={12} />
                            Update All
                        </button>
                        <button
                            type="button"
                            onClick={() => setAllDecisions('skip')}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            <FastForward size={12} />
                            Skip All
                        </button>
                    </div>
                </div>

                {/* Conflicting Items List */}
                <div className="p-6 space-y-3 overflow-y-auto flex-1">
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Choose whether to overwrite each existing variable with the new value or keep the current one:
                    </p>

                    <div className="space-y-2">
                        {conflicts.map((item) => {
                            const decision = decisions[item.key] || 'update';
                            const isUpdate = decision === 'update';

                            return (
                                <div
                                    key={item.key}
                                    className="p-3 rounded-xl border transition-colors flex items-center justify-between gap-3"
                                    style={{
                                        backgroundColor: isUpdate ? 'var(--color-bg-surface)' : 'var(--color-bg-subtle)',
                                        borderColor: isUpdate ? 'rgba(5, 150, 105, 0.25)' : 'var(--color-border-default)',
                                    }}
                                >
                                    {/* Left details */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className="px-2 py-0.5 rounded font-mono text-xs font-bold"
                                                style={{
                                                    backgroundColor: 'var(--color-primary-soft)',
                                                    color: 'var(--color-primary-darker)',
                                                }}
                                            >
                                                {item.key}
                                            </span>
                                            <span
                                                className="text-[11px] px-1.5 py-0.5 rounded border"
                                                style={{
                                                    backgroundColor: 'var(--color-bg-subtle)',
                                                    borderColor: 'var(--color-border-default)',
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                Group: {item.newGroup || 'General'}
                                            </span>
                                            {item.existingGroup && item.existingGroup !== item.newGroup && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                                    (Currently in &ldquo;{item.existingGroup}&rdquo;)
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1 flex items-center gap-2 text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                            <span className="truncate">
                                                New value: <span className="font-mono text-gray-700 dark:text-gray-300">{item.newValue ? '••••••••' : '(empty)'}</span>
                                            </span>
                                            {item.newNote && (
                                                <span className="italic truncate">• &ldquo;{item.newNote}&rdquo;</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Update vs Skip toggle */}
                                    <div className="flex items-center gap-1 shrink-0 p-0.5 rounded-lg border bg-gray-100/80 dark:bg-gray-800/80" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <button
                                            type="button"
                                            onClick={() => toggleDecision(item.key, 'update')}
                                            disabled={isSaving}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                                isUpdate
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Check size={12} />
                                            Update
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleDecision(item.key, 'skip')}
                                            disabled={isSaving}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                                !isUpdate
                                                    ? 'bg-gray-700 text-white shadow-xs'
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <FastForward size={12} />
                                            Skip
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
                    style={{
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-semibold rounded-xl border transition-colors cursor-pointer"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                        }}
                    >
                        {isSaving && <Loader2 size={15} className="animate-spin" />}
                        Apply & Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
