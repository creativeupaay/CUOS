import React, { type CSSProperties } from 'react';
import { Trash2 } from 'lucide-react';
import { HiringModal } from '@/components/molecules/hiring';
import type { JobTemplate } from '@/features/hiring';

interface ManageTemplatesModalProps {
    open: boolean;
    onClose: () => void;
    templates: JobTemplate[];
    onDeleteTemplate: (id: string) => void;
    isDeleting: boolean;
}

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export const ManageTemplatesModal: React.FC<ManageTemplatesModalProps> = ({
    open,
    onClose,
    templates,
    onDeleteTemplate,
    isDeleting,
}) => {
    return (
        <HiringModal open={open} title="Manage Templates" onClose={onClose}>
            <div className="space-y-3">
                {templates.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        No templates saved yet.
                    </p>
                ) : (
                    templates.map((template) => (
                        <div
                            key={template._id}
                            className="flex items-center justify-between rounded-xl border px-4 py-3"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {template.templateName}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {template.title || 'Untitled role'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDeleteTemplate(template._id)}
                                disabled={isDeleting}
                                className="rounded-lg border p-2"
                                style={inputStyle}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </HiringModal>
    );
};
