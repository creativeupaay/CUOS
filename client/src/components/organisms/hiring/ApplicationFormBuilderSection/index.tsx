import { useState, type Dispatch, type SetStateAction, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Check, Sparkles } from 'lucide-react';
import {
    MANDATORY_FIELDS,
    DEFAULT_STANDARD_FIELD_SETTINGS,
    FIELD_TYPE_OPTIONS,
} from '@/data/hiring/jobFormConstants';
import type {
    ApplicationCustomFieldDefinition,
    ApplicationFieldType,
    StandardApplicationFieldId,
    ApplicationStandardFieldSetting,
} from '@/features/hiring';
import { useSaveApplicationFieldMutation } from '@/features/hiring/hiringApi';
import type { FormState } from '@/hooks/hiring/useJobForm';
import { HiringField, HiringModal } from '@/components/molecules/hiring';

interface NewFieldState {
    label: string;
    type: ApplicationFieldType;
    placeholder: string;
    helpText: string;
}

interface EditableFieldState {
    mode: 'standard' | 'custom';
    key: string;
    label: string;
    placeholder: string;
    helpText: string;
    required: boolean;
}

const EMPTY_NEW_FIELD: NewFieldState = {
    label: '',
    type: 'text',
    placeholder: '',
    helpText: '',
};

function normalizeFieldKey(label: string) {
    return label
        .normalize('NFKC')
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}

function buildSafeFieldKey(label: string) {
    const normalized = normalizeFieldKey(label);
    if (normalized) return normalized;
    return `field_${Date.now().toString(36)}`;
}

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

interface ApplicationFormBuilderSectionProps {
    form: FormState;
    setForm: Dispatch<SetStateAction<FormState>>;
    orderedOptionalFields: Array<{
        key: StandardApplicationFieldId;
        label: string;
        description: string;
    }>;
    importedCustomFields: ApplicationCustomFieldDefinition[];
    fieldLibrary: ApplicationCustomFieldDefinition[];
    selectedCustomFieldKeys: Set<string>;
    setServerError: (error: string) => void;
    setSuccessMsg: (msg: string) => void;
}

export function ApplicationFormBuilderSection({
    form,
    setForm,
    orderedOptionalFields,
    importedCustomFields,
    fieldLibrary,
    selectedCustomFieldKeys,
    setServerError,
    setSuccessMsg,
}: ApplicationFormBuilderSectionProps) {
    const [saveApplicationField, { isLoading: isSavingField }] = useSaveApplicationFieldMutation();

    const [showNewFieldModal, setShowNewFieldModal] = useState(false);
    const [showEditFieldModal, setShowEditFieldModal] = useState(false);
    const [showReusableFields, setShowReusableFields] = useState(false);
    const [draggingStandardFieldKey, setDraggingStandardFieldKey] = useState<StandardApplicationFieldId | null>(null);
    const [draggingCustomFieldKey, setDraggingCustomFieldKey] = useState<string | null>(null);
    const [newField, setNewField] = useState<NewFieldState>(EMPTY_NEW_FIELD);
    const [editingField, setEditingField] = useState<EditableFieldState | null>(null);

    const toggleStandardField = (fieldKey: StandardApplicationFieldId) => {
        setForm((prev) => {
            const exists = prev.applicationForm.selectedStandardFields.includes(fieldKey);
            const selectedStandardFields = exists
                ? prev.applicationForm.selectedStandardFields.filter((key) => key !== fieldKey)
                : [...prev.applicationForm.selectedStandardFields, fieldKey];

            const settingsByKey = prev.applicationForm.standardFieldSettings.reduce<
                Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>
            >((acc, setting) => {
                acc[setting.key] = setting;
                return acc;
            }, {} as Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>);

            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    selectedStandardFields,
                    standardFieldSettings: selectedStandardFields.map((key) => {
                        const existing = settingsByKey[key];
                        return (
                            existing || {
                                key,
                                label: DEFAULT_STANDARD_FIELD_SETTINGS[key].label,
                                placeholder: DEFAULT_STANDARD_FIELD_SETTINGS[key].placeholder,
                                helpText: DEFAULT_STANDARD_FIELD_SETTINGS[key].helpText,
                            }
                        );
                    }),
                },
            };
        });
    };

    const moveStandardField = (
        sourceKey: StandardApplicationFieldId,
        targetKey: StandardApplicationFieldId
    ) => {
        if (sourceKey === targetKey) return;

        setForm((prev) => {
            const current = [...prev.applicationForm.selectedStandardFields];
            const sourceIndex = current.indexOf(sourceKey);
            const targetIndex = current.indexOf(targetKey);
            if (sourceIndex < 0 || targetIndex < 0) return prev;

            current.splice(sourceIndex, 1);
            current.splice(targetIndex, 0, sourceKey);

            const settingsByKey = prev.applicationForm.standardFieldSettings.reduce<
                Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>
            >((acc, setting) => {
                acc[setting.key] = setting;
                return acc;
            }, {} as Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>);

            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    selectedStandardFields: current,
                    standardFieldSettings: current.map((key) => settingsByKey[key]).filter(Boolean),
                },
            };
        });
    };

    const importCustomFieldFromLibrary = (field: ApplicationCustomFieldDefinition) => {
        setForm((prev) => {
            if (prev.applicationForm.customFields.some((customField) => customField.key === field.key)) {
                return prev;
            }
            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    customFields: [...prev.applicationForm.customFields, field],
                },
            };
        });
    };

    const removeCustomField = (fieldKey: string) => {
        setForm((prev) => {
            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    customFields: prev.applicationForm.customFields.filter(
                        (customField) => customField.key !== fieldKey
                    ),
                },
            };
        });
    };

    const moveCustomField = (sourceKey: string, targetKey: string) => {
        if (sourceKey === targetKey) return;

        setForm((prev) => {
            const current = [...prev.applicationForm.customFields];
            const sourceIndex = current.findIndex((field) => field.key === sourceKey);
            const targetIndex = current.findIndex((field) => field.key === targetKey);
            if (sourceIndex < 0 || targetIndex < 0) return prev;

            const [sourceField] = current.splice(sourceIndex, 1);
            current.splice(targetIndex, 0, sourceField);

            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    customFields: current,
                },
            };
        });
    };

    const handleSaveNewField = async () => {
        const label = newField.label.trim();
        if (!label) {
            setServerError('Field name is required');
            return;
        }

        const safeKey = buildSafeFieldKey(label);

        setServerError('');
        try {
            const saved = await saveApplicationField({
                key: safeKey,
                label,
                type: newField.type,
                placeholder: newField.placeholder.trim() || undefined,
                helpText: newField.helpText.trim() || undefined,
            }).unwrap();

            const latestField =
                saved.data.fields.find(
                    (field) => field.key === safeKey
                ) || {
                    key: safeKey,
                    label,
                    type: newField.type,
                    placeholder: newField.placeholder.trim() || undefined,
                    helpText: newField.helpText.trim() || undefined,
                };

            setForm((prev) => {
                if (prev.applicationForm.customFields.some((field) => field.key === latestField.key)) {
                    return prev;
                }

                return {
                    ...prev,
                    applicationForm: {
                        ...prev.applicationForm,
                        customFields: [...prev.applicationForm.customFields, latestField],
                    },
                };
            });

            setNewField(EMPTY_NEW_FIELD);
            setShowNewFieldModal(false);
            setSuccessMsg('Custom field saved to your reusable library');
            window.setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: unknown) {
            const error = err as { data?: { message?: string } };
            setServerError(error?.data?.message || 'Failed to save custom field');
        }
    };

    const openEditStandardField = (fieldKey: StandardApplicationFieldId) => {
        const existing = form.applicationForm.standardFieldSettings.find((item) => item.key === fieldKey);
        const defaults = DEFAULT_STANDARD_FIELD_SETTINGS[fieldKey];
        setEditingField({
            mode: 'standard',
            key: fieldKey,
            label: existing?.label || defaults.label,
            placeholder: existing?.placeholder || defaults.placeholder || '',
            helpText: existing?.helpText || defaults.helpText || '',
            required: Boolean(existing?.required),
        });
        setShowEditFieldModal(true);
    };

    const openEditCustomField = (field: ApplicationCustomFieldDefinition) => {
        setEditingField({
            mode: 'custom',
            key: field.key,
            label: field.label,
            placeholder: field.placeholder || '',
            helpText: field.helpText || '',
            required: Boolean(field.required),
        });
        setShowEditFieldModal(true);
    };

    const handleSaveFieldEdits = () => {
        if (!editingField) return;

        setForm((prev) => ({
            ...prev,
            applicationForm: {
                ...prev.applicationForm,
                standardFieldSettings:
                    editingField.mode === 'standard'
                        ? prev.applicationForm.standardFieldSettings.map((field) =>
                              field.key === editingField.key
                                  ? {
                                        ...field,
                                        label: editingField.label.trim() || field.label,
                                        placeholder: editingField.placeholder.trim() || undefined,
                                        helpText: editingField.helpText.trim() || undefined,
                                        required: editingField.required,
                                    }
                                  : field
                          )
                        : prev.applicationForm.standardFieldSettings,
                customFields:
                    editingField.mode === 'custom'
                        ? prev.applicationForm.customFields.map((field) =>
                              field.key === editingField.key
                                  ? {
                                        ...field,
                                        label: editingField.label.trim() || field.label,
                                        placeholder: editingField.placeholder.trim() || undefined,
                                        helpText: editingField.helpText.trim() || undefined,
                                        required: editingField.required,
                                    }
                                  : field
                          )
                        : prev.applicationForm.customFields,
            },
        }));

        setShowEditFieldModal(false);
        setEditingField(null);
    };

    return (
        <div
            className="builder-shell rounded-[1.4rem] p-6"
            style={{
                borderColor: 'var(--color-border-default)',
            }}
        >
            <style>{`
                .builder-shell {
                    background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.08) 0%, rgba(255,255,255,0) 28%), var(--color-bg-surface);
                    border: 1px solid var(--color-border-default);
                    box-shadow: 0 18px 45px -20px rgba(15, 23, 42, 0.18);
                }
                .field-choice {
                    transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
                }
                .field-choice:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 20px -18px rgba(15, 23, 42, 0.35);
                }
            `}</style>
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                            backgroundColor: 'rgba(var(--color-primary-rgb), 0.12)',
                            color: 'var(--color-primary)',
                        }}
                    >
                        <Sparkles size={14} />
                        Application Form Builder
                    </div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Application Form Builder
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Mandatory fields stay locked for every job. Optional and custom fields can be selected per posting.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowNewFieldModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                    style={{ ...inputStyle, color: 'var(--color-primary)' }}
                >
                    <Plus size={16} />
                    Add New Field
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                        Always Included
                    </p>
                    <div
                        className="max-h-[26.75rem] space-y-3 overflow-y-auto rounded-2xl border p-3"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'rgba(255,255,255,0.45)',
                        }}
                    >
                        {MANDATORY_FIELDS.map((field) => (
                            <div
                                key={field.key}
                                className="field-choice rounded-2xl border px-4 py-4"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.7)',
                                    borderColor: 'var(--color-border-default)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {field.label}
                                        </p>
                                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {field.description}
                                        </p>
                                    </div>
                                    <span
                                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                                        style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                                    >
                                        Required
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                        Optional Standard Fields
                    </p>
                    <div
                        className="max-h-[26.75rem] space-y-3 overflow-y-auto rounded-2xl border p-3"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'rgba(255,255,255,0.45)',
                        }}
                    >
                        {orderedOptionalFields.map((field) => {
                            const selected = form.applicationForm.selectedStandardFields.includes(field.key);
                            return (
                                <label
                                    key={field.key}
                                    draggable={selected}
                                    onDragStart={() => {
                                        if (!selected) return;
                                        setDraggingStandardFieldKey(field.key);
                                    }}
                                    onDragOver={(e) => {
                                        if (!draggingStandardFieldKey || !selected) return;
                                        e.preventDefault();
                                    }}
                                    onDrop={() => {
                                        if (!draggingStandardFieldKey || !selected) return;
                                        moveStandardField(draggingStandardFieldKey, field.key);
                                        setDraggingStandardFieldKey(null);
                                    }}
                                    onDragEnd={() => setDraggingStandardFieldKey(null)}
                                    className="field-choice flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4"
                                    style={{
                                        backgroundColor: selected
                                            ? 'rgba(var(--color-primary-rgb), 0.12)'
                                            : 'rgba(255,255,255,0.72)',
                                        borderColor: selected
                                            ? 'var(--color-primary)'
                                            : 'var(--color-border-default)',
                                    }}
                                >
                                    <div
                                        className="mt-0.5"
                                        style={{
                                            color: selected
                                                ? 'var(--color-primary)'
                                                : 'var(--color-text-muted)',
                                            cursor: selected ? 'grab' : 'default',
                                        }}
                                        title={selected ? 'Drag to reorder selected fields' : 'Select field to reorder'}
                                    >
                                        <GripVertical size={16} />
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => toggleStandardField(field.key)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {field.label}
                                        </p>
                                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {field.description}
                                        </p>
                                    </div>
                                    {selected && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                openEditStandardField(field.key);
                                            }}
                                            className="ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                            style={{
                                                borderColor: form.applicationForm.standardFieldSettings.find((item) => item.key === field.key)?.required
                                                    ? '#15803D'
                                                    : '#2563EB',
                                                color: form.applicationForm.standardFieldSettings.find((item) => item.key === field.key)?.required
                                                    ? '#15803D'
                                                    : '#2563EB',
                                                backgroundColor: form.applicationForm.standardFieldSettings.find((item) => item.key === field.key)?.required
                                                    ? '#DCFCE7'
                                                    : '#DBEAFE',
                                            }}
                                        >
                                            {form.applicationForm.standardFieldSettings.find((item) => item.key === field.key)?.required
                                                ? 'Edit · Required'
                                                : 'Edit · Optional'}
                                        </button>
                                    )}
                                </label>
                            );
                        })}

                        {importedCustomFields.length > 0 && (
                            <div className="pt-1">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                    Imported From Reusable Fields
                                </p>
                                <div className="space-y-3">
                                    {importedCustomFields.map((field) => (
                                        <div
                                            key={field.key}
                                            draggable
                                            onDragStart={() => setDraggingCustomFieldKey(field.key)}
                                            onDragOver={(e) => {
                                                if (!draggingCustomFieldKey) return;
                                                e.preventDefault();
                                            }}
                                            onDrop={() => {
                                                if (!draggingCustomFieldKey) return;
                                                moveCustomField(draggingCustomFieldKey, field.key);
                                                setDraggingCustomFieldKey(null);
                                            }}
                                            onDragEnd={() => setDraggingCustomFieldKey(null)}
                                            className="field-choice flex items-start gap-3 rounded-2xl border px-4 py-4"
                                            style={{
                                                backgroundColor: 'rgba(var(--color-primary-rgb), 0.12)',
                                                borderColor: 'var(--color-primary)',
                                            }}
                                        >
                                            <div
                                                className="mt-0.5"
                                                style={{
                                                    color: 'var(--color-primary)',
                                                    cursor: 'grab',
                                                }}
                                                title="Drag to reorder imported custom fields"
                                            >
                                                <GripVertical size={16} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    removeCustomField(field.key);
                                                }}
                                                className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border"
                                                style={{
                                                    borderColor: '#B91C1C',
                                                    color: '#B91C1C',
                                                    backgroundColor: '#FEE2E2',
                                                }}
                                                title="Remove from optional fields"
                                                aria-label="Remove imported reusable field"
                                            >
                                                <span className="text-base leading-none">-</span>
                                            </button>
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                    {field.label}
                                                </p>
                                                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    {FIELD_TYPE_OPTIONS.find((option) => option.value === field.type)?.label || field.type}
                                                    {field.helpText ? ` · ${field.helpText}` : ''}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    openEditCustomField(field);
                                                }}
                                                className="ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                                style={{
                                                    borderColor: field.required ? '#15803D' : '#2563EB',
                                                    color: field.required ? '#15803D' : '#2563EB',
                                                    backgroundColor: field.required ? '#DCFCE7' : '#DBEAFE',
                                                }}
                                            >
                                                {field.required ? 'Edit · Required' : 'Edit · Optional'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <button
                    type="button"
                    onClick={() => setShowReusableFields((prev) => !prev)}
                    className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'rgba(255,255,255,0.6)',
                    }}
                >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                        Reusable Custom Fields
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Saved once, reusable in future jobs.
                        </p>
                        {showReusableFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                </button>

                {showReusableFields && (fieldLibrary.length === 0 ? (
                    <div
                        className="rounded-xl border border-dashed px-4 py-5 text-sm"
                        style={{
                            backgroundColor: 'var(--color-bg-app)',
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        No custom fields saved yet. Use “Add New Field” to build your reusable library.
                    </div>
                ) : (
                    <div
                        className="max-h-[26.75rem] space-y-3 overflow-y-auto rounded-2xl border p-3"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'rgba(255,255,255,0.45)',
                        }}
                    >
                        {fieldLibrary.map((field) => {
                            const selected = selectedCustomFieldKeys.has(field.key);
                            return (
                                <div
                                    key={field.key}
                                    className="field-choice flex items-start justify-between gap-3 rounded-2xl border px-4 py-4"
                                    style={{
                                        backgroundColor: selected
                                            ? 'rgba(var(--color-primary-rgb), 0.12)'
                                            : 'rgba(255,255,255,0.72)',
                                        borderColor: selected
                                            ? 'var(--color-primary)'
                                            : 'var(--color-border-default)',
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                importCustomFieldFromLibrary(field);
                                            }}
                                            className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border"
                                            style={{
                                                borderColor: selected
                                                    ? 'var(--color-primary)'
                                                    : 'var(--color-border-default)',
                                                color: selected
                                                    ? 'var(--color-primary)'
                                                    : 'var(--color-text-secondary)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                            }}
                                            title={selected ? 'Already added to this job form' : 'Add this field to this job form'}
                                            aria-label={selected ? 'Field added' : 'Add reusable custom field'}
                                        >
                                            {selected ? <Check size={13} /> : <Plus size={13} />}
                                        </button>
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {field.label}
                                            </p>
                                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                {FIELD_TYPE_OPTIONS.find((option) => option.value === field.type)?.label || field.type}
                                                {field.helpText ? ` · ${field.helpText}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditCustomField(field)}
                                            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                            style={{
                                                borderColor: field.required ? '#15803D' : '#2563EB',
                                                color: field.required ? '#15803D' : '#2563EB',
                                                backgroundColor: field.required ? '#DCFCE7' : '#DBEAFE',
                                            }}
                                        >
                                            {field.required ? 'Edit · Required' : 'Edit · Optional'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <HiringModal
                open={showNewFieldModal}
                title="Add Reusable Custom Field"
                onClose={() => setShowNewFieldModal(false)}
            >
                <div className="space-y-4">
                    <HiringField label="Field Name" required>
                        <input
                            type="text"
                            value={newField.label}
                            onChange={(e) =>
                                setNewField((prev) => ({ ...prev, label: e.target.value }))
                            }
                            placeholder="e.g. Dribbble URL"
                            className="w-full rounded-lg border px-3 py-2.5 text-sm"
                            style={inputStyle}
                        />
                    </HiringField>

                    <HiringField label="Field Type" required>
                        <select
                            value={newField.type}
                            onChange={(e) =>
                                setNewField((prev) => ({
                                    ...prev,
                                    type: e.target.value as ApplicationFieldType,
                                }))
                            }
                            className="w-full rounded-lg border px-3 py-2.5 text-sm"
                            style={inputStyle}
                        >
                            {FIELD_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </HiringField>

                    <HiringField label="Placeholder">
                        <input
                            type="text"
                            value={newField.placeholder}
                            onChange={(e) =>
                                setNewField((prev) => ({ ...prev, placeholder: e.target.value }))
                            }
                            placeholder="Optional helper placeholder"
                            className="w-full rounded-lg border px-3 py-2.5 text-sm"
                            style={inputStyle}
                        />
                    </HiringField>

                    <HiringField label="Help Text">
                        <input
                            type="text"
                            value={newField.helpText}
                            onChange={(e) =>
                                setNewField((prev) => ({ ...prev, helpText: e.target.value }))
                            }
                            placeholder="Optional note shown in the checklist"
                            className="w-full rounded-lg border px-3 py-2.5 text-sm"
                            style={inputStyle}
                        />
                    </HiringField>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowNewFieldModal(false)}
                            className="rounded-lg border px-4 py-2 text-sm"
                            style={inputStyle}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveNewField}
                            disabled={isSavingField}
                            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isSavingField ? 'Saving...' : 'Save Field'}
                        </button>
                    </div>
                </div>
            </HiringModal>

            <HiringModal
                open={showEditFieldModal}
                title="Edit Selected Field"
                onClose={() => {
                    setShowEditFieldModal(false);
                    setEditingField(null);
                }}
            >
                {editingField && (
                    <div className="space-y-4">
                        <HiringField label="Field Label" required>
                            <input
                                type="text"
                                value={editingField.label}
                                onChange={(e) =>
                                    setEditingField((prev) =>
                                        prev ? { ...prev, label: e.target.value } : prev
                                    )
                                }
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </HiringField>

                        <HiringField label="Placeholder">
                            <input
                                type="text"
                                value={editingField.placeholder}
                                onChange={(e) =>
                                    setEditingField((prev) =>
                                        prev ? { ...prev, placeholder: e.target.value } : prev
                                    )
                                }
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </HiringField>

                        <HiringField label="Help Text">
                            <input
                                type="text"
                                value={editingField.helpText}
                                onChange={(e) =>
                                    setEditingField((prev) =>
                                        prev ? { ...prev, helpText: e.target.value } : prev
                                    )
                                }
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </HiringField>

                        <label
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                        >
                            <input
                                type="checkbox"
                                checked={editingField.required}
                                onChange={(e) =>
                                    setEditingField((prev) =>
                                        prev ? { ...prev, required: e.target.checked } : prev
                                    )
                                }
                            />
                            Required for this job posting
                        </label>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEditFieldModal(false);
                                    setEditingField(null);
                                }}
                                className="rounded-lg border px-4 py-2 text-sm"
                                style={inputStyle}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveFieldEdits}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </HiringModal>
        </div>
    );
}
