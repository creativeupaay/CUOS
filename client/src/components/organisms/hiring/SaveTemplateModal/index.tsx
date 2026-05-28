import React, { type CSSProperties } from 'react';
import { HiringModal, HiringField } from '@/components/molecules/hiring';

interface SaveTemplateModalProps {
    open: boolean;
    onClose: () => void;
    newTemplateName: string;
    setNewTemplateName: (val: string) => void;
    onSaveTemplate: () => void;
    isCreatingTemplate: boolean;
}

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
    open,
    onClose,
    newTemplateName,
    setNewTemplateName,
    onSaveTemplate,
    isCreatingTemplate,
}) => {
    return (
        <HiringModal open={open} title="Save Job Template" onClose={onClose}>
            <div className="space-y-4">
                <HiringField label="Template Name" required>
                    <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                        style={inputStyle}
                    />
                </HiringField>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border px-4 py-2 text-sm"
                        style={inputStyle}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSaveTemplate}
                        disabled={isCreatingTemplate}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isCreatingTemplate ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>
        </HiringModal>
    );
};
