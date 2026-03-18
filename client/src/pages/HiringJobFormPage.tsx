import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import {
    useCreateJobMutation,
    useGetJobByIdQuery,
    useUpdateJobMutation,
    useGetJobTemplatesQuery,
    useCreateJobTemplateMutation,
    useDeleteJobTemplateMutation,
} from '@/features/hiring/hiringApi';
import { useGetOrgSettingsQuery } from '@/features/overall-admin/api/adminApi';
import type { EmploymentType } from '@/features/hiring/types/types';

const DEFAULT_DEPARTMENTS = [
    'Engineering',
    'Design',
    'Marketing',
    'Finance',
    'HR',
    'Operations',
];

function Field({
    label,
    required,
    error,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
            >
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

const inputStyle: React.CSSProperties = {
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
}

interface FormErrors {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
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
};

export default function HiringJobFormPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);

    const { data: jobData, isLoading: isLoadingJob } = useGetJobByIdQuery(id ?? '', {
        skip: !isEdit,
    });
    const { data: orgSettingsData } = useGetOrgSettingsQuery();

    const { data: templatesData } = useGetJobTemplatesQuery();
    const [createTemplate, { isLoading: isCreatingTemplate }] = useCreateJobTemplateMutation();
    const [deleteTemplate, { isLoading: isDeletingTemplate }] = useDeleteJobTemplateMutation();

    const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
    const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
    const isSubmitting = isCreating || isUpdating;

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [showManageTemplates, setShowManageTemplates] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const templates = templatesData?.data?.templates || [];

    const configuredDepartments = orgSettingsData?.data?.departments?.length
        ? orgSettingsData.data.departments
        : DEFAULT_DEPARTMENTS;
    const departmentOptions =
        form.department && !configuredDepartments.includes(form.department)
            ? [form.department, ...configuredDepartments]
            : configuredDepartments;

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
        });
    }, [isEdit, jobData]);

    const set =
        (key: keyof FormState) =>
        (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
        ) => {
            const value =
                e.target.type === 'checkbox'
                    ? (e.target as HTMLInputElement).checked
                    : e.target.value;

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

    const handleImportTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (!templateId) return;
        const selected = templates.find((t) => t._id === templateId);
        if (selected) {
            setForm((prev) => ({
                ...prev,
                title: selected.title || '',
                department: selected.department || '',
                locationType: selected.locationType || 'In-Office',
                location: selected.location || '',
                description: selected.description || '',
                requirements: selected.requirements || '',
                employmentType: selected.employmentType || 'full-time',
            }));
            setSuccessMsg('Template applied successfully');
            setTimeout(() => setSuccessMsg(''), 3000);
            e.target.value = ''; // Reset dropdown
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

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return;
        setServerError('');
        try {
            await createTemplate({
                templateName: newTemplateName,
                title: form.title,
                department: form.department,
                locationType: form.locationType,
                location: form.locationType === 'Remote' ? '' : form.location,
                description: form.description,
                requirements: form.requirements,
                employmentType: form.employmentType,
            }).unwrap();
            setShowSaveTemplateModal(false);
            setNewTemplateName('');
            setSuccessMsg('Template saved successfully');
            setTimeout(() => setSuccessMsg(''), 3000);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');

        if (!validate()) return;

        const payload = {
            title: form.title,
            department: form.department,
            locationType: form.locationType,
            location: form.locationType === 'Remote' ? '' : form.location,
            description: form.description,
            requirements: form.requirements,
            employmentType: form.employmentType,
            isHiring: form.isHiring,
            assignmentRequired: form.assignmentRequired,
        };

        try {
            if (isEdit && id) {
                await updateJob({ id, data: payload }).unwrap();
            } else {
                await createJob(payload).unwrap();
            }
            navigate('/hiring/jobs');
        } catch (err: any) {
            setServerError(
                err?.data?.message || 'Something went wrong. Please try again.'
            );
        }
    };

    if (isEdit && isLoadingJob) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    <Loader2 size={18} className="animate-spin" />
                    Loading job...
                </div>
            </div>
        );
    }

    return (
        <div
            className="px-8 py-6 max-w-[720px] mx-auto relative"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <button
                onClick={() => navigate('/hiring/jobs')}
                className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
            >
                <ChevronLeft size={16} />
                Back to Jobs
            </button>

            <div className="flex items-center justify-between mb-1">
                <h1
                    className="text-2xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
                </h1>
                
                <div className="flex items-center gap-2">
                    <select
                        onChange={handleImportTemplate}
                        className="px-3 py-2 text-sm rounded-lg border cursor-pointer"
                        style={{ ...inputStyle, minWidth: '180px' }}
                    >
                        <option value="">+ Import from Template</option>
                        {templates.map(t => (
                            <option key={t._id} value={t._id}>{t.templateName}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowManageTemplates(true)}
                        className="px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Manage Templates
                    </button>
                </div>
            </div>
            <p
                className="text-sm mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {isEdit
                    ? 'Update the details of this job posting.'
                    : 'Fill in the details to publish a new job position or import a template to start quickly.'}
            </p>

            {serverError && (
                <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm"
                    style={{
                        backgroundColor: 'var(--color-danger-soft)',
                        color: 'var(--color-danger)',
                        border: '1px solid var(--color-danger)',
                    }}
                >
                    <AlertCircle size={15} />
                    {serverError}
                </div>
            )}

            {successMsg && (
                <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm"
                    style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: 'rgb(22, 163, 74)',
                        border: '1px solid rgb(34, 197, 94)',
                    }}
                >
                    <CheckCircle2 size={15} />
                    {successMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
                <div
                    className="rounded-xl p-6 flex flex-col gap-5"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Basic Information
                    </h2>

                    <Field label="Job Title" required error={errors.title}>
                        <input
                            type="text"
                            value={form.title}
                            onChange={set('title')}
                            placeholder="e.g. Frontend Developer"
                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                            style={inputStyle}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-5 w-full">
                        <Field label="Department" required error={errors.department}>
                            <select
                                value={form.department}
                                onChange={set('department')}
                                className="px-3 py-2.5 text-sm rounded-lg border w-full h-11"
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

                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Location Type <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <div 
                                className="flex bg-[var(--color-bg-surface)] p-1 rounded-lg border w-full h-11" 
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => set('locationType')({ target: { value: 'In-Office' } } as any)}
                                    className={`flex-1 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                                        form.locationType === 'In-Office'
                                            ? 'shadow-sm border'
                                            : 'hover:-translate-y-px hover:shadow-sm'
                                    }`}
                                    style={{
                                        backgroundColor: form.locationType === 'In-Office' ? 'var(--color-bg-app)' : 'transparent',
                                        color: form.locationType === 'In-Office' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                        borderColor: form.locationType === 'In-Office' ? 'var(--color-border-default)' : 'transparent'
                                    }}
                                >
                                    In-Office
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set('locationType')({ target: { value: 'Remote' } } as any)}
                                    className={`flex-1 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                                        form.locationType === 'Remote'
                                            ? 'shadow-sm border'
                                            : 'hover:-translate-y-px hover:shadow-sm'
                                    }`}
                                    style={{
                                        backgroundColor: form.locationType === 'Remote' ? 'var(--color-bg-app)' : 'transparent',
                                        color: form.locationType === 'Remote' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                        borderColor: form.locationType === 'Remote' ? 'var(--color-border-default)' : 'transparent'
                                    }}
                                >
                                    Remote
                                </button>
                            </div>
                        </div>

                        {form.locationType === 'In-Office' && (
                            <div className="col-span-2">
                                <Field label="Location" required error={errors.location}>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={set('location')}
                                        placeholder="e.g. Udaipur, Rajasthan"
                                        className="px-3 py-2.5 text-sm rounded-lg border w-full h-11"
                                        style={inputStyle}
                                    />
                                </Field>
                            </div>
                        )}
                    </div>

                    <Field label="Employment Type">
                        <select
                            value={form.employmentType}
                            onChange={set('employmentType')}
                            className="px-3 py-2.5 text-sm rounded-lg border w-full"
                            style={inputStyle}
                        >
                            <option value="full-time">Full-time</option>
                            <option value="part-time">Part-time</option>
                            <option value="contract">Contract</option>
                            <option value="internship">Internship</option>
                        </select>
                    </Field>
                </div>

                <div
                    className="rounded-xl p-6 flex flex-col gap-5"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Role Details
                    </h2>

                    <Field label="Job Description" required error={errors.description}>
                        <textarea
                            value={form.description}
                            onChange={set('description')}
                            rows={5}
                            placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
                            className="px-3 py-2.5 text-sm rounded-lg border w-full resize-y"
                            style={inputStyle}
                        />
                    </Field>

                    <Field label="Requirements" required error={errors.requirements}>
                        <textarea
                            value={form.requirements}
                            onChange={set('requirements')}
                            rows={4}
                            placeholder="List skills, qualifications, and experience required..."
                            className="px-3 py-2.5 text-sm rounded-lg border w-full resize-y"
                            style={inputStyle}
                        />
                    </Field>
                </div>

                <div
                    className="rounded-xl p-6 flex flex-col gap-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Settings
                    </h2>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={form.isHiring}
                                onChange={set('isHiring')}
                                className="sr-only"
                            />
                            <div
                                className="w-10 h-6 rounded-full transition-colors duration-200"
                                style={{
                                    backgroundColor: form.isHiring
                                        ? 'var(--color-primary)'
                                        : 'var(--color-border-default)',
                                }}
                            />
                            <div
                                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                                style={{
                                    transform: form.isHiring
                                        ? 'translateX(16px)'
                                        : 'translateX(0)',
                                }}
                            />
                        </div>
                        <div>
                            <p
                                className="text-sm font-medium"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Actively Hiring
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                When on, this job will appear on the public website.
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={form.assignmentRequired}
                                onChange={set('assignmentRequired')}
                                className="sr-only"
                            />
                            <div
                                className="w-10 h-6 rounded-full transition-colors duration-200"
                                style={{
                                    backgroundColor: form.assignmentRequired
                                        ? 'var(--color-primary)'
                                        : 'var(--color-border-default)',
                                }}
                            />
                            <div
                                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                                style={{
                                    transform: form.assignmentRequired
                                        ? 'translateX(16px)'
                                        : 'translateX(0)',
                                }}
                            />
                        </div>
                        <div>
                            <p
                                className="text-sm font-medium"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Assignment Required
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                Shortlisted candidates will receive a task assignment.
                            </p>
                        </div>
                    </label>

                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={() => setShowSaveTemplateModal(true)}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-primary)',
                            backgroundColor: 'transparent',
                        }}
                    >
                        Save as Template
                    </button>
                    
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/hiring/jobs')}
                            className="px-5 py-2.5 rounded-lg text-sm border transition-colors hover:opacity-80"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#fff',
                                opacity: isSubmitting ? 0.7 : 1,
                            }}
                        >
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                            {isEdit ? 'Save Changes' : 'Create Job'}
                        </button>
                    </div>
                </div>
            </form>

            {/* Modal - Save Template */}
            {showSaveTemplateModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div 
                        className="rounded-xl w-full max-w-sm p-6 shadow-2xl"
                        style={{ backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-default)' }}
                    >
                        <h3 className="text-lg font-bold mb-2 cursor-default" style={{ color: 'var(--color-text-primary)' }}>Save Template</h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                            Save your current form data as a reusable template.
                        </p>
                        
                        <Field label="Template Name" required>
                            <input
                                autoFocus
                                type="text"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g. Senior Backend Dev"
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                            />
                        </Field>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowSaveTemplateModal(false);
                                    setNewTemplateName('');
                                }}
                                className="px-4 py-2 flex-grow rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTemplate}
                                disabled={isCreatingTemplate || !newTemplateName.trim()}
                                className="px-4 py-2 flex-grow rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 hover:opacity-90 shadow-sm"
                                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                            >
                                {isCreatingTemplate ? <Loader2 size={16} className="animate-spin" /> : 'Save Template'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Slide-over Drawer - Manage Templates */}
            {showManageTemplates && createPortal(
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowManageTemplates(false)}
                    />
                    
                    <div 
                        className="relative w-full max-w-sm h-full shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]"
                        style={{ backgroundColor: 'var(--color-bg-app)', borderLeft: '1px solid var(--color-border-default)' }}
                    >
                        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Manage Templates</h3>
                                <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>Review and remove saved templates.</p>
                            </div>
                            <button
                                onClick={() => setShowManageTemplates(false)}
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-default)' }}
                            >
                                <ChevronLeft size={18} className="rotate-180" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                            {templates.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed rounded-xl" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                        No templates available
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Save a job as a template to see it here.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {templates.map((t) => (
                                        <div 
                                            key={t._id}
                                            className="flex items-start justify-between p-4 rounded-xl border transition-all hover:shadow-sm group"
                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                                        >
                                            <div className="flex flex-col gap-1.5">
                                                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{t.templateName}</p>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {t.department && (
                                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                                                            {t.department}
                                                        </span>
                                                    )}
                                                    {t.locationType && (
                                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                                                            {t.locationType}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteTemplate(t._id)}
                                                disabled={isDeletingTemplate}
                                                className="p-2 -mr-1 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-50 transition-colors"
                                                title="Delete template"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Define animation via inline style inject for simple slide */}
                        <style>{`
                            @keyframes slideIn {
                                from { transform: translateX(100%); }
                                to { transform: translateX(0); }
                            }
                        `}</style>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
