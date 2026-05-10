import React, { type CSSProperties } from 'react';
import type { JobTemplate } from '@/features/hiring';

interface TemplatePickerHeaderProps {
    templates: JobTemplate[];
    onImport: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onManage: () => void;
}

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export const TemplatePickerHeader: React.FC<TemplatePickerHeaderProps> = ({
    templates,
    onImport,
    onManage,
}) => {
    return (
        <div className="flex items-center gap-2">
            <select
                onChange={onImport}
                className="h-10 min-w-[190px] rounded-lg border px-3 text-sm"
                style={inputStyle}
            >
                <option value="">+ Import from Template</option>
                {templates.map((template) => (
                    <option key={template._id} value={template._id}>
                        {template.templateName}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={onManage}
                className="rounded-lg border px-3 py-2 text-sm"
                style={inputStyle}
            >
                Manage Templates
            </button>
        </div>
    );
};
