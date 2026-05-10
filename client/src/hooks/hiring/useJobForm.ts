import { useState, useMemo, type ChangeEvent } from 'react';
import { useCreateJobMutation, useUpdateJobMutation } from '@/features/hiring/hiringApi';
import type { 
    EmploymentType, 
    StandardApplicationFieldId, 
    ApplicationStandardFieldSetting, 
    ApplicationCustomFieldDefinition, 
    JobApplicationFormConfig,
    JobTemplate
} from '@/features/hiring';
import { 
    DEFAULT_SELECTED_STANDARD_FIELDS, 
    DEFAULT_STANDARD_FIELD_SETTINGS, 
    OPTIONAL_STANDARD_FIELDS 
} from '@/data/hiring/jobFormConstants';

export interface FormState {
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

export interface FormErrors {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
}

export const EMPTY_FORM: FormState = {
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

export function isStandardFieldId(value: unknown): value is StandardApplicationFieldId {
    return OPTIONAL_STANDARD_FIELDS.some((field) => field.key === value);
}

export function buildApplicationFormState(applicationForm?: Partial<JobApplicationFormConfig>) {
    const incomingSelected = Array.isArray(applicationForm?.selectedStandardFields)
        ? applicationForm.selectedStandardFields.filter(isStandardFieldId)
        : [];
    const incomingSettings = Array.isArray(applicationForm?.standardFieldSettings)
        ? applicationForm.standardFieldSettings.filter((field) => isStandardFieldId(field?.key))
        : [];

    const selectedStandardFields = (
        incomingSelected.length > 0
            ? incomingSelected
            : incomingSettings.length > 0
                ? incomingSettings.map((field) => field.key)
                : DEFAULT_SELECTED_STANDARD_FIELDS
    ).filter((value, index, arr) => arr.indexOf(value) === index);

    const settingsByKey = incomingSettings.reduce<Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>>(
        (acc, field) => {
            acc[field.key] = field;
            return acc;
        },
        {} as Record<StandardApplicationFieldId, ApplicationStandardFieldSetting>
    );

    const standardFieldSettings = selectedStandardFields.map((key) => {
        const existing = settingsByKey[key];
        if (existing) return existing;
        return {
            key,
            label: DEFAULT_STANDARD_FIELD_SETTINGS[key].label,
            placeholder: DEFAULT_STANDARD_FIELD_SETTINGS[key].placeholder,
            helpText: DEFAULT_STANDARD_FIELD_SETTINGS[key].helpText,
        } as ApplicationStandardFieldSetting;
    });

    return {
        selectedStandardFields,
        standardFieldSettings,
        customFields: applicationForm?.customFields || [],
        pageSections: {
            showAboutCompany: true,
            showAboutRole: applicationForm?.pageSections?.showAboutRole ?? true,
            showRequirements: applicationForm?.pageSections?.showRequirements ?? true,
            showWhatYouGet: applicationForm?.pageSections?.showWhatYouGet ?? true,
            aboutCompany: '',
            whatYouGet: applicationForm?.pageSections?.whatYouGet || '',
        },
    };
}

export interface UseJobFormReturn {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    errors: FormErrors;
    setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
    serverError: string;
    setServerError: React.Dispatch<React.SetStateAction<string>>;
    successMsg: string;
    setSuccessMsg: React.Dispatch<React.SetStateAction<string>>;
    set: (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | unknown) => void;
    validate: () => boolean;
    handleImportTemplate: (e: ChangeEvent<HTMLSelectElement>, templates: JobTemplate[]) => void;
    handleSubmit: (e: React.FormEvent, options: { isEdit: boolean; id?: string; navigate: (path: string) => void }) => Promise<{ success: boolean; error?: string; data?: unknown }>;
    orderedOptionalFields: typeof OPTIONAL_STANDARD_FIELDS;
    importedCustomFields: ApplicationCustomFieldDefinition[];
    isSubmitting: boolean;
}

export function useJobForm(): UseJobFormReturn {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
    const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();

    const isSubmitting = isCreating || isUpdating;

    const set =
        (key: keyof FormState) =>
        (
            e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | unknown
        ) => {
            const isEvent = e && typeof e === 'object' && 'target' in e;
            const target = isEvent ? (e as ChangeEvent<HTMLInputElement>).target : null;
            
            const value = target
                ? target.type === 'checkbox'
                    ? target.checked
                    : target.value
                : e;

            setForm((prev) => {
                const next = { ...prev, [key]: value as never };
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

    const handleImportTemplate = (e: ChangeEvent<HTMLSelectElement>, templates: JobTemplate[]) => {
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
            applicationForm: buildApplicationFormState(selected.applicationForm),
        }));
        setSuccessMsg('Template applied successfully');
        window.setTimeout(() => setSuccessMsg(''), 3000);
        
        if (e.target) {
            e.target.value = '';
        }
    };

    const handleSubmit = async (
        e: React.FormEvent,
        { isEdit, id, navigate }: { isEdit: boolean; id?: string; navigate: (path: string) => void }
    ): Promise<{ success: boolean; error?: string; data?: unknown }> => {
        e.preventDefault();
        setServerError('');

        if (!validate()) {
            return { success: false, error: 'Validation failed' };
        }

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
            let result;
            if (isEdit && id) {
                result = await updateJob({ id, data: payload }).unwrap();
            } else {
                result = await createJob(payload).unwrap();
            }
            navigate('/hiring/jobs');
            return { success: true, data: result };
        } catch (err: unknown) {
            const errorObj = err as { data?: { message?: string } };
            const errorMsg = errorObj?.data?.message || 'Something went wrong. Please try again.';
            setServerError(errorMsg);
            return { success: false, error: errorMsg };
        }
    };

    const orderedOptionalFields = useMemo(() => {
        const selected = form.applicationForm.selectedStandardFields;
        const selectedSet = new Set(selected);
        const selectedOrdered = selected
            .map((key) => OPTIONAL_STANDARD_FIELDS.find((field) => field.key === key))
            .filter(Boolean) as typeof OPTIONAL_STANDARD_FIELDS;
        const unselected = OPTIONAL_STANDARD_FIELDS.filter((field) => !selectedSet.has(field.key));
        return [...selectedOrdered, ...unselected];
    }, [form.applicationForm.selectedStandardFields]);

    const importedCustomFields = useMemo(
        () => form.applicationForm.customFields,
        [form.applicationForm.customFields]
    );

    return {
        form,
        setForm,
        errors,
        setErrors,
        serverError,
        setServerError,
        successMsg,
        setSuccessMsg,
        set,
        validate,
        handleImportTemplate,
        handleSubmit,
        orderedOptionalFields,
        importedCustomFields,
        isSubmitting
    };
}
