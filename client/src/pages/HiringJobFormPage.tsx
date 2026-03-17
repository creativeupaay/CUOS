import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import {
    useCreateJobMutation,
    useGetJobByIdQuery,
    useUpdateJobMutation,
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
        <div className="flex flex-col gap-1.5">
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
    location: '',
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

    const [createJob, { isLoading: isCreating }] = useCreateJobMutation();
    const [updateJob, { isLoading: isUpdating }] = useUpdateJobMutation();
    const isSubmitting = isCreating || isUpdating;

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [serverError, setServerError] = useState('');

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

            setForm((prev) => ({ ...prev, [key]: value }));
            if (errors[key as keyof FormErrors]) {
                setErrors((prev) => ({ ...prev, [key]: undefined }));
            }
        };

    const validate = () => {
        const nextErrors: FormErrors = {};

        if (!form.title.trim()) nextErrors.title = 'Job title is required';
        if (!form.department.trim()) nextErrors.department = 'Department is required';
        if (!form.location.trim()) nextErrors.location = 'Location is required';
        if (!form.description.trim()) nextErrors.description = 'Description is required';
        if (!form.requirements.trim()) nextErrors.requirements = 'Requirements are required';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');

        if (!validate()) return;

        const payload = {
            title: form.title,
            department: form.department,
            location: form.location,
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
            className="px-8 py-6 max-w-[720px] mx-auto"
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

            <h1
                className="text-2xl font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
            </h1>
            <p
                className="text-sm mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {isEdit
                    ? 'Update the details of this job posting.'
                    : 'Fill in the details to publish a new job position.'}
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

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Department" required error={errors.department}>
                            <select
                                value={form.department}
                                onChange={set('department')}
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
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

                        <Field label="Location" required error={errors.location}>
                            <input
                                type="text"
                                value={form.location}
                                onChange={set('location')}
                                placeholder="e.g. Remote / Bengaluru"
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                            />
                        </Field>
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

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => navigate('/hiring/jobs')}
                        className="px-5 py-2.5 rounded-lg text-sm border transition-colors"
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
                        className="px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
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
            </form>
        </div>
    );
}
