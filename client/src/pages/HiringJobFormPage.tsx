import {
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type CSSProperties,
    type FormEvent,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    Loader2,
    Plus,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { dedupeDepartments, DEFAULT_DEPARTMENTS } from '@/utils/department';
import {
    useCreateJobMutation,
    useDeleteApplicationFieldMutation,
    useDeleteJobTemplateMutation,
    useGetApplicationFieldLibraryQuery,
    useGetJobByIdQuery,
    useGetJobTemplatesQuery,
    useSaveApplicationFieldMutation,
    useUpdateJobMutation,
    useCreateJobTemplateMutation,
    useGetHiringEmployeesListQuery,
} from '@/features/hiring/hiringApi';
import { useGetOrgSettingsQuery } from '@/features/overall-admin/api/adminApi';
import type {
    ApplicationCustomFieldDefinition,
    ApplicationFieldType,
    ApplicationStandardFieldSetting,
    EmploymentType,
    StandardApplicationFieldId,
} from '@/features/hiring/types/types';

const MANDATORY_FIELDS = [
    { key: 'name', label: 'Full Name', description: 'Always required in every job form.' },
    { key: 'email', label: 'Email', description: 'Primary communication channel for the candidate.' },
    { key: 'phone', label: 'Phone Number', description: 'Required for direct recruiter follow-up.' },
    { key: 'location', label: 'Current Location', description: 'Always collected for every application.' },
    { key: 'yearsOfExperience', label: 'Years of Experience', description: 'Numeric experience field shown on all jobs.' },
    { key: 'resume', label: 'Resume', description: 'Kept required so recruiter review flow stays intact.' },
] as const;

const OPTIONAL_STANDARD_FIELDS: Array<{
    key: StandardApplicationFieldId;
    label: string;
    description: string;
}> = [
    { key: 'portfolio', label: 'Portfolio URL', description: 'Great for design, marketing, and product roles.' },
    { key: 'github', label: 'GitHub URL', description: 'Useful for engineering and technical hiring.' },
    { key: 'linkedin', label: 'LinkedIn URL', description: 'Quick professional profile reference.' },
    { key: 'experience', label: 'Relevant Experience', description: 'Long-form written experience summary.' },
    { key: 'coverLetter', label: 'Cover Letter', description: 'Lets candidates explain why they are a fit.' },
    { key: 'figmaUrl', label: 'Figma URL', description: 'Useful for design and collaborative case studies.' },
];

const DEFAULT_STANDARD_FIELD_SETTINGS: Record<
    StandardApplicationFieldId,
    { label: string; placeholder?: string; helpText?: string }
> = {
    portfolio: { label: 'Portfolio URL', placeholder: 'https://your-portfolio.com' },
    github: { label: 'GitHub URL', placeholder: 'https://github.com/username' },
    linkedin: { label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/username' },
    experience: { label: 'Relevant Experience', placeholder: 'Briefly highlight your most relevant work' },
    coverLetter: { label: 'Cover Letter', placeholder: 'Tell us why you are a fit for this role' },
    figmaUrl: { label: 'Figma URL', placeholder: 'https://figma.com/file/...' },
};

const DEFAULT_SELECTED_STANDARD_FIELDS: StandardApplicationFieldId[] = [
    'portfolio',
    'linkedin',
    'experience',
    'coverLetter',
];

const FIELD_TYPE_OPTIONS: Array<{ value: ApplicationFieldType; label: string }> = [
    { value: 'text', label: 'Text' },
    { value: 'url', label: 'URL' },
    { value: 'number', label: 'Number' },
    { value: 'note', label: 'Note' },
    { value: 'date', label: 'Date' },
    { value: 'attachment', label: 'Attachment' },
];

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

interface FormState {
    title: string;
    department: string;
    locationType: 'Remote' | 'In-Office';
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    isHiring: boolean;
    assignmentRequired: boolean;
    managers: string[];
    applicationForm: {
        selectedStandardFields: StandardApplicationFieldId[];
        standardFieldSettings: ApplicationStandardFieldSetting[];
        customFields: ApplicationCustomFieldDefinition[];
        pageSections: {
            showAboutCompany: boolean;
            showAboutRole: boolean;
            showRequirements: boolean;
            showWhatYouGet: boolean;
            aboutCompany: string;
            whatYouGet: string;
        };
    };
}

interface FormErrors {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
}

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
}

const EMPTY_FORM: FormState = {
    title: '',
    department: '',
    locationType: 'In-Office',
    location: 'Udaipur, Rajasthan',
    description: '',
    requirements: '',
    employmentType: 'full-time',
    isHiring: false,
    assignmentRequired: false,
    managers: [],
    applicationForm: {
        selectedStandardFields: DEFAULT_SELECTED_STANDARD_FIELDS,
        standardFieldSettings: DEFAULT_SELECTED_STANDARD_FIELDS.map((key) => ({
            key,
            label: DEFAULT_STANDARD_FIELD_SETTINGS[key].label,
            placeholder: DEFAULT_STANDARD_FIELD_SETTINGS[key].placeholder,
            helpText: DEFAULT_STANDARD_FIELD_SETTINGS[key].helpText,
        })),
        customFields: [],
        pageSections: {
            showAboutCompany: true,
            showAboutRole: true,
            showRequirements: true,
            showWhatYouGet: true,
            aboutCompany: '',
            whatYouGet: '',
        },
    },
};

const EMPTY_NEW_FIELD: NewFieldState = {
    label: '',
    type: 'text',
    placeholder: '',
    helpText: '',
};

function normalizeFieldKey(label: string) {
    return label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}

function Field({
    label,
    required,
    error,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {label}
                {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
            </label>
            {children}
            {error && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

function Modal({
    open,
    title,
    children,
    onClose,
}: {
    open: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
                className="w-full max-w-lg rounded-2xl border p-6 shadow-xl"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default function HiringJobFormPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const { data: jobData, isLoading: isLoadingJob } = useGetJobByIdQuery(id ?? '', {
        skip: !isEdit,
    });
    const { data: orgSettingsData } = useGetOrgSettingsQuery();
    const { data: templatesData } = useGetJobTemplatesQuery();
    const { data: fieldLibraryData } = useGetApplicationFieldLibraryQuery();
    const { data: employeesData } = useGetHiringEmployeesListQuery();

    const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
    const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
    const [createTemplate, { isLoading: isCreatingTemplate }] = useCreateJobTemplateMutation();
    const [deleteTemplate, { isLoading: isDeletingTemplate }] = useDeleteJobTemplateMutation();
    const [saveApplicationField, { isLoading: isSavingField }] = useSaveApplicationFieldMutation();
    const [deleteApplicationField, { isLoading: isDeletingField }] =
        useDeleteApplicationFieldMutation();

    const isSubmitting = isCreating || isUpdating;
    const templates = templatesData?.data?.templates || [];
    const fieldLibrary = fieldLibraryData?.data?.fields || [];
    const employees = employeesData?.data?.employees || [];

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showManageTemplates, setShowManageTemplates] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [showNewFieldModal, setShowNewFieldModal] = useState(false);
    const [showEditFieldModal, setShowEditFieldModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newField, setNewField] = useState<NewFieldState>(EMPTY_NEW_FIELD);
    const [editingField, setEditingField] = useState<EditableFieldState | null>(null);

    const configuredDepartments = useMemo(() => {
        const orgDepartments = orgSettingsData?.data?.departments?.length
            ? dedupeDepartments(orgSettingsData.data.departments)
            : DEFAULT_DEPARTMENTS;

        return dedupeDepartments([...orgDepartments, 'Creative']);
    }, [orgSettingsData?.data?.departments]);

    const departmentOptions =
        form.department && !configuredDepartments.includes(form.department)
            ? [form.department, ...configuredDepartments]
            : configuredDepartments;

    const selectedCustomFieldKeys = useMemo(
        () => new Set(form.applicationForm.customFields.map((field) => field.key)),
        [form.applicationForm.customFields]
    );

    useEffect(() => {
        if (!isEdit || !jobData?.data.job) return;

        const job = jobData.data.job;
        setForm({
            title: job.title,
            department: job.department,
            locationType: job.locationType || 'In-Office',
            location: job.location,
            description: job.description,
            requirements: job.requirements,
            employmentType: job.employmentType,
            isHiring: job.isHiring,
            assignmentRequired: job.assignmentRequired,
            managers: job.managers?.map((m: any) => m._id) || [],
            applicationForm: {
                selectedStandardFields:
                    job.applicationForm?.selectedStandardFields?.length
                        ? job.applicationForm.selectedStandardFields
                        : DEFAULT_SELECTED_STANDARD_FIELDS,
                standardFieldSettings:
                    job.applicationForm?.standardFieldSettings?.length
                        ? job.applicationForm.standardFieldSettings
                        : (job.applicationForm?.selectedStandardFields?.length
                              ? job.applicationForm.selectedStandardFields
                              : DEFAULT_SELECTED_STANDARD_FIELDS
                          ).map((key) => ({
                              key,
                              label: DEFAULT_STANDARD_FIELD_SETTINGS[key].label,
                              placeholder: DEFAULT_STANDARD_FIELD_SETTINGS[key].placeholder,
                              helpText: DEFAULT_STANDARD_FIELD_SETTINGS[key].helpText,
                          })),
                customFields: job.applicationForm?.customFields || [],
                pageSections: {
                    showAboutCompany: true,
                    showAboutRole: job.applicationForm?.pageSections?.showAboutRole ?? true,
                    showRequirements: job.applicationForm?.pageSections?.showRequirements ?? true,
                    showWhatYouGet: job.applicationForm?.pageSections?.showWhatYouGet ?? true,
                    aboutCompany: '',
                    whatYouGet: job.applicationForm?.pageSections?.whatYouGet || '',
                },
            },
        });
    }, [isEdit, jobData]);

    const set =
        (key: keyof FormState) =>
        (
            e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
        ) => {
            const value =
                e && e.target
                    ? e.target.type === 'checkbox'
                        ? (e.target as HTMLInputElement).checked
                        : e.target.value
                    : e;

            setForm((prev) => {
                const next = { ...prev, [key]: value };
                if (key === 'locationType') {
                    if (value === 'Remote') {
                        next.location = 'Remote';
                    } else if (value === 'In-Office' && prev.locationType === 'Remote') {
                        next.location = 'Udaipur, Rajasthan';
                    }
                }
                return next;
            });

            if (errors[key as keyof FormErrors]) {
                setErrors((prev) => ({ ...prev, [key]: undefined }));
            }
        };

    const handleImportTemplate = (e: ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (!templateId) return;

        const selected = templates.find((template) => template._id === templateId);
        if (!selected) return;

        setForm((prev) => ({
            ...prev,
            title: selected.title || '',
            department: selected.department || '',
            locationType: selected.locationType || 'In-Office',
            location: selected.location || '',
            description: selected.description || '',
            requirements: selected.requirements || '',
            employmentType: selected.employmentType || 'full-time',
            applicationForm: {
                selectedStandardFields:
                    selected.applicationForm?.selectedStandardFields?.length
                        ? selected.applicationForm.selectedStandardFields
                        : DEFAULT_SELECTED_STANDARD_FIELDS,
                standardFieldSettings:
                    selected.applicationForm?.standardFieldSettings?.length
                        ? selected.applicationForm.standardFieldSettings
                        : (selected.applicationForm?.selectedStandardFields?.length
                              ? selected.applicationForm.selectedStandardFields
                              : DEFAULT_SELECTED_STANDARD_FIELDS
                          ).map((key) => ({
                              key,
                              label: DEFAULT_STANDARD_FIELD_SETTINGS[key].label,
                              placeholder: DEFAULT_STANDARD_FIELD_SETTINGS[key].placeholder,
                              helpText: DEFAULT_STANDARD_FIELD_SETTINGS[key].helpText,
                          })),
                customFields: selected.applicationForm?.customFields || [],
                pageSections: {
                    showAboutCompany: true,
                    showAboutRole: selected.applicationForm?.pageSections?.showAboutRole ?? true,
                    showRequirements:
                        selected.applicationForm?.pageSections?.showRequirements ?? true,
                    showWhatYouGet: selected.applicationForm?.pageSections?.showWhatYouGet ?? true,
                    aboutCompany: '',
                    whatYouGet: selected.applicationForm?.pageSections?.whatYouGet || '',
                },
            },
        }));
        setSuccessMsg('Template applied successfully');
        window.setTimeout(() => setSuccessMsg(''), 3000);
        e.target.value = '';
    };

    const validate = () => {
        const nextErrors: FormErrors = {};

        if (!form.title.trim()) nextErrors.title = 'Job title is required';
        if (!form.department.trim()) nextErrors.department = 'Department is required';
        if (form.locationType === 'In-Office' && !form.location.trim()) {
            nextErrors.location = 'Location is required';
        }
        if (!form.description.trim()) nextErrors.description = 'Description is required';
        if (!form.requirements.trim()) nextErrors.requirements = 'Requirements are required';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const toggleStandardField = (fieldKey: StandardApplicationFieldId) => {
        setForm((prev) => {
            const current = new Set(prev.applicationForm.selectedStandardFields);
            if (current.has(fieldKey)) {
                current.delete(fieldKey);
            } else {
                current.add(fieldKey);
            }

            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    selectedStandardFields: Array.from(current) as StandardApplicationFieldId[],
                    standardFieldSettings: Array.from(current).map((key) => {
                        const existing = prev.applicationForm.standardFieldSettings.find(
                            (item) => item.key === key
                        );
                        return (
                            existing || {
                                key: key as StandardApplicationFieldId,
                                label: DEFAULT_STANDARD_FIELD_SETTINGS[key as StandardApplicationFieldId].label,
                                placeholder:
                                    DEFAULT_STANDARD_FIELD_SETTINGS[key as StandardApplicationFieldId].placeholder,
                                helpText:
                                    DEFAULT_STANDARD_FIELD_SETTINGS[key as StandardApplicationFieldId].helpText,
                            }
                        );
                    }) as ApplicationStandardFieldSetting[],
                },
            };
        });
    };

    const toggleCustomField = (field: ApplicationCustomFieldDefinition) => {
        setForm((prev) => {
            const exists = prev.applicationForm.customFields.some(
                (customField) => customField.key === field.key
            );

            return {
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    customFields: exists
                        ? prev.applicationForm.customFields.filter(
                              (customField) => customField.key !== field.key
                          )
                        : [...prev.applicationForm.customFields, field],
                },
            };
        });
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return;

        setServerError('');
        try {
            await createTemplate({
                templateName: newTemplateName.trim(),
                title: form.title,
                department: form.department,
                locationType: form.locationType,
                location: form.locationType === 'Remote' ? '' : form.location,
                description: form.description,
                requirements: form.requirements,
                employmentType: form.employmentType,
                applicationForm: form.applicationForm,
            }).unwrap();

            setShowSaveTemplateModal(false);
            setNewTemplateName('');
            setSuccessMsg('Template saved successfully');
            window.setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setServerError(err?.data?.message || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        try {
            await deleteTemplate(templateId).unwrap();
        } catch (err: any) {
            setServerError(err?.data?.message || 'Failed to delete template');
        }
    };

    const handleSaveNewField = async () => {
        const label = newField.label.trim();
        if (!label) {
            setServerError('Field name is required');
            return;
        }

        setServerError('');
        try {
            const saved = await saveApplicationField({
                key: normalizeFieldKey(label),
                label,
                type: newField.type,
                placeholder: newField.placeholder.trim() || undefined,
                helpText: newField.helpText.trim() || undefined,
            }).unwrap();

            const latestField =
                saved.data.fields.find(
                    (field) => field.key === normalizeFieldKey(label)
                ) || {
                    key: normalizeFieldKey(label),
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
        } catch (err: any) {
            setServerError(err?.data?.message || 'Failed to save custom field');
        }
    };

    const handleDeleteSavedField = async (fieldKey: string) => {
        try {
            await deleteApplicationField(fieldKey).unwrap();
            setForm((prev) => ({
                ...prev,
                applicationForm: {
                    ...prev.applicationForm,
                    customFields: prev.applicationForm.customFields.filter(
                        (field) => field.key !== fieldKey
                    ),
                },
            }));
        } catch (err: any) {
            setServerError(err?.data?.message || 'Failed to delete custom field');
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
                                    }
                                  : field
                          )
                        : prev.applicationForm.customFields,
            },
        }));

        setShowEditFieldModal(false);
        setEditingField(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setServerError('');

        if (!validate()) return;

        const payload = {
            title: form.title.trim(),
            department: form.department.trim(),
            locationType: form.locationType,
            location: form.locationType === 'Remote' ? '' : form.location.trim(),
            description: form.description.trim(),
            requirements: form.requirements.trim(),
            employmentType: form.employmentType,
            isHiring: form.isHiring,
            assignmentRequired: form.assignmentRequired,
            managers: form.managers,
            applicationForm: {
                selectedStandardFields: form.applicationForm.selectedStandardFields,
                standardFieldSettings: form.applicationForm.standardFieldSettings,
                customFields: form.applicationForm.customFields,
                pageSections: form.applicationForm.pageSections,
            },
        };

        try {
            if (isEdit && id) {
                await updateJob({ id, data: payload }).unwrap();
            } else {
                await createJob(payload).unwrap();
            }
            navigate('/hiring/jobs');
        } catch (err: any) {
            setServerError(err?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    if (isEdit && isLoadingJob) {
        return (
            <div
                className="flex h-[calc(100vh-64px)] items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading job...
                </div>
            </div>
        );
    }

    return (
        <div
            className="mx-auto max-w-[900px] px-8 py-6"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <style>{`
                .builder-shell {
                    background:
                        linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.08) 0%, rgba(255,255,255,0) 28%),
                        var(--color-bg-surface);
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
            <button
                onClick={() => navigate('/hiring/jobs')}
                className="mb-6 flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
            >
                <ChevronLeft size={16} />
                Back to Jobs
            </button>

            <div className="mb-1 flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
                </h1>

                <div className="flex items-center gap-2">
                    <select
                        onChange={handleImportTemplate}
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
                        onClick={() => setShowManageTemplates(true)}
                        className="rounded-lg border px-3 py-2 text-sm"
                        style={inputStyle}
                    >
                        Manage Templates
                    </button>
                </div>
            </div>

            <p className="mb-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Configure the job details and control exactly which fields appear in the public application form.
            </p>

            {serverError && (
                <div
                    className="mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                    style={{
                        backgroundColor: 'var(--color-danger-soft)',
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                    }}
                >
                    <AlertCircle size={15} />
                    {serverError}
                </div>
            )}

            {successMsg && (
                <div
                    className="mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
                    style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: 'rgb(22, 163, 74)',
                        borderColor: 'rgb(34, 197, 94)',
                    }}
                >
                    <CheckCircle2 size={15} />
                    {successMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
                <div
                    className="rounded-xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="mb-5 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        Basic Information
                    </h2>

                    <div className="flex flex-col gap-5">
                        <Field label="Job Title" required error={errors.title}>
                            <input
                                type="text"
                                value={form.title}
                                onChange={set('title')}
                                placeholder="e.g. Frontend Developer"
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field label="Department" required error={errors.department}>
                                <select
                                    value={form.department}
                                    onChange={set('department')}
                                    className="h-11 w-full rounded-lg border px-3 text-sm"
                                    style={inputStyle}
                                >
                                    <option value="">Select department</option>
                                    {departmentOptions.map((department) => (
                                        <option key={department} value={department}>
                                            {department}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Employment Type">
                                <select
                                    value={form.employmentType}
                                    onChange={set('employmentType')}
                                    className="h-11 w-full rounded-lg border px-3 text-sm"
                                    style={inputStyle}
                                >
                                    <option value="full-time">Full-time</option>
                                    <option value="part-time">Part-time</option>
                                    <option value="contract">Contract</option>
                                    <option value="internship">Internship</option>
                                </select>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    Location Type <span style={{ color: 'var(--color-danger)' }}>*</span>
                                </label>
                                <div className="flex h-11 rounded-lg border p-1" style={inputStyle}>
                                    {(['In-Office', 'Remote'] as const).map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() =>
                                                set('locationType')({ target: { value: option } } as any)
                                            }
                                            className="flex-1 rounded-md text-sm font-medium transition-all"
                                            style={{
                                                backgroundColor:
                                                    form.locationType === option
                                                        ? 'var(--color-bg-app)'
                                                        : 'transparent',
                                                color:
                                                    form.locationType === option
                                                        ? 'var(--color-primary)'
                                                        : 'var(--color-text-secondary)',
                                            }}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.locationType === 'In-Office' && (
                                <Field label="Location" required error={errors.location}>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={set('location')}
                                        placeholder="e.g. Udaipur, Rajasthan"
                                        className="h-11 w-full rounded-lg border px-3 text-sm"
                                        style={inputStyle}
                                    />
                                </Field>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className="rounded-xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="mb-5 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        Role Details
                    </h2>

                    <div className="flex flex-col gap-5">
                        <Field label="Job Description" required error={errors.description}>
                            <textarea
                                value={form.description}
                                onChange={set('description')}
                                rows={5}
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="Requirements" required error={errors.requirements}>
                            <textarea
                                value={form.requirements}
                                onChange={set('requirements')}
                                rows={4}
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </Field>

                        <Field label="What you get">
                            <textarea
                                value={form.applicationForm.pageSections.whatYouGet}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        applicationForm: {
                                            ...prev.applicationForm,
                                            pageSections: {
                                                ...prev.applicationForm.pageSections,
                                                whatYouGet: e.target.value,
                                            },
                                        },
                                    }))
                                }
                                rows={5}
                                placeholder="Role specific perks, growth, benefits, and learning opportunities"
                                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                                style={inputStyle}
                            />
                        </Field>

                        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border-default)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                Job Details Page Sections
                            </p>
                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                About the Company is managed centrally in Org Settings. Use toggles to control visibility of role sections.
                            </p>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {[
                                    { key: 'showAboutRole', label: 'About the Role' },
                                    { key: 'showRequirements', label: 'Requirements & Qualifications' },
                                    { key: 'showWhatYouGet', label: 'What you get' },
                                ].map((section) => (
                                    <label
                                        key={section.key}
                                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(
                                                form.applicationForm.pageSections[
                                                    section.key as keyof typeof form.applicationForm.pageSections
                                                ]
                                            )}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    applicationForm: {
                                                        ...prev.applicationForm,
                                                        pageSections: {
                                                            ...prev.applicationForm.pageSections,
                                                            [section.key]: e.target.checked,
                                                        },
                                                    },
                                                }))
                                            }
                                        />
                                        <span style={{ color: 'var(--color-text-primary)' }}>{section.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="builder-shell rounded-[1.4rem] p-6"
                    style={{
                        borderColor: 'var(--color-border-default)',
                    }}
                >
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
                            <div className="space-y-3">
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
                            <div className="space-y-3">
                                {OPTIONAL_STANDARD_FIELDS.map((field) => {
                                    const selected = form.applicationForm.selectedStandardFields.includes(field.key);
                                    return (
                                        <label
                                            key={field.key}
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
                                                        borderColor: 'var(--color-border-default)',
                                                        color: 'var(--color-text-secondary)',
                                                        backgroundColor: 'var(--color-bg-surface)',
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                Reusable Custom Fields
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Saved here once, reusable in future jobs.
                            </p>
                        </div>

                        {fieldLibrary.length === 0 ? (
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
                            <div className="space-y-3">
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
                                            <label className="flex cursor-pointer items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleCustomField(field)}
                                                    className="mt-1"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        {field.label}
                                                    </p>
                                                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {FIELD_TYPE_OPTIONS.find((option) => option.value === field.type)?.label || field.type}
                                                        {field.helpText ? ` · ${field.helpText}` : ''}
                                                    </p>
                                                </div>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {selected && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditCustomField(field)}
                                                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                                                        style={{
                                                            borderColor: 'var(--color-border-default)',
                                                            color: 'var(--color-text-secondary)',
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSavedField(field.key)}
                                                    disabled={isDeletingField}
                                                    className="rounded-lg border p-2"
                                                    style={inputStyle}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>

                <div
                    className="rounded-xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                        Settings
                    </h2>

                    <div className="space-y-4">
                        {[
                            {
                                checked: form.isHiring,
                                onChange: set('isHiring'),
                                title: 'Actively Hiring',
                                description: 'When on, this job will appear on the public website.',
                            },
                            {
                                checked: form.assignmentRequired,
                                onChange: set('assignmentRequired'),
                                title: 'Assignment Required',
                                description: 'Shortlisted candidates will receive a task assignment.',
                            },
                        ].map((setting) => (
                            <label key={setting.title} className="flex cursor-pointer items-center gap-3">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={setting.checked}
                                        onChange={setting.onChange}
                                        className="sr-only"
                                    />
                                    <div
                                        className="h-6 w-10 rounded-full"
                                        style={{
                                            backgroundColor: setting.checked
                                                ? 'var(--color-primary)'
                                                : 'var(--color-border-default)',
                                        }}
                                    />
                                    <div
                                        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                                        style={{
                                            transform: setting.checked
                                                ? 'translateX(16px)'
                                                : 'translateX(0)',
                                        }}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {setting.title}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {setting.description}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <Field label="Job Managers (Optional)">
                            <div className="relative">
                                <select
                                    className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-blue-500"
                                    style={inputStyle}
                                    value=""
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val && !form.managers.includes(val)) {
                                            set('managers')([...form.managers, val]);
                                        }
                                    }}
                                >
                                    <option value="">Select Managers...</option>
                                    {employees
                                        .filter((emp) => !form.managers.includes(emp._id))
                                        .map((emp) => (
                                            <option key={emp._id} value={emp._id}>
                                                {emp.userId.name} ({emp.designation})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {form.managers.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {form.managers.map((managerId) => {
                                        const manager = employees.find((e) => e._id === managerId);
                                        if (!manager) return null;
                                        return (
                                            <div
                                                key={managerId}
                                                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                                                style={{
                                                    backgroundColor: 'var(--color-bg-surface-elevated)',
                                                    borderColor: 'var(--color-border-default)',
                                                    color: 'var(--color-text-primary)',
                                                }}
                                            >
                                                <span>{manager.userId.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        set('managers')(
                                                            form.managers.filter((id) => id !== managerId)
                                                        )
                                                    }
                                                    className="rounded-full p-0.5 hover:bg-black/10"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                                Job Managers can manage postings, applications, and interviews for this specific job.
                            </p>
                        </Field>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={() => setShowSaveTemplateModal(true)}
                        className="rounded-lg border px-4 py-2.5 text-sm font-medium"
                        style={{ ...inputStyle, color: 'var(--color-primary)' }}
                    >
                        Save as Template
                    </button>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isEdit ? 'Update Job' : 'Create Job'}
                    </button>
                </div>
            </form>

            <Modal
                open={showSaveTemplateModal}
                title="Save Job Template"
                onClose={() => setShowSaveTemplateModal(false)}
            >
                <div className="space-y-4">
                    <Field label="Template Name" required>
                        <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2.5 text-sm"
                            style={inputStyle}
                        />
                    </Field>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowSaveTemplateModal(false)}
                            className="rounded-lg border px-4 py-2 text-sm"
                            style={inputStyle}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveTemplate}
                            disabled={isCreatingTemplate}
                            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isCreatingTemplate ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={showManageTemplates}
                title="Manage Templates"
                onClose={() => setShowManageTemplates(false)}
            >
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
                                    onClick={() => handleDeleteTemplate(template._id)}
                                    disabled={isDeletingTemplate}
                                    className="rounded-lg border p-2"
                                    style={inputStyle}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            <Modal
                open={showNewFieldModal}
                title="Add Reusable Custom Field"
                onClose={() => setShowNewFieldModal(false)}
            >
                <div className="space-y-4">
                    <Field label="Field Name" required>
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
                    </Field>

                    <Field label="Field Type" required>
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
                    </Field>

                    <Field label="Placeholder">
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
                    </Field>

                    <Field label="Help Text">
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
                    </Field>

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
            </Modal>

            <Modal
                open={showEditFieldModal}
                title="Edit Selected Field"
                onClose={() => {
                    setShowEditFieldModal(false);
                    setEditingField(null);
                }}
            >
                {editingField && (
                    <div className="space-y-4">
                        <Field label="Field Label" required>
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
                        </Field>

                        <Field label="Placeholder">
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
                        </Field>

                        <Field label="Help Text">
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
                        </Field>

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
            </Modal>
        </div>
    );
}
