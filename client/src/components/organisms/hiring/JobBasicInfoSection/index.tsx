import React, { type CSSProperties } from 'react';
import { FormField } from '@/components/molecules/FormField';
import type { FormState } from '@/hooks/hiring/useJobForm';

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export interface JobBasicInfoSectionProps {
    form: Pick<FormState, 'title' | 'department' | 'employmentType' | 'locationType' | 'location'>;
    errors: Partial<Record<keyof FormState, string>>;
    departmentOptions: string[];
    set: <K extends keyof FormState>(
        field: K
    ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | string) => void;
}

export const JobBasicInfoSection: React.FC<JobBasicInfoSectionProps> = ({
    form,
    errors,
    departmentOptions,
    set,
}) => {
    return (
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
                <FormField label="Job Title" required error={errors.title}>
                    <input
                        type="text"
                        value={form.title}
                        onChange={set('title')}
                        placeholder="e.g. Frontend Developer"
                        className="w-full rounded-lg border px-3 py-2.5 text-sm"
                        style={inputStyle}
                    />
                </FormField>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FormField label="Department" required error={errors.department}>
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
                    </FormField>

                    <FormField label="Employment Type">
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
                    </FormField>
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
                                    onClick={() => set('locationType')(option)}
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
                        <FormField label="Location" required error={errors.location}>
                            <input
                                type="text"
                                value={form.location}
                                onChange={set('location')}
                                placeholder="e.g. Udaipur, Rajasthan"
                                className="h-11 w-full rounded-lg border px-3 text-sm"
                                style={inputStyle}
                            />
                        </FormField>
                    )}
                </div>
            </div>
        </div>
    );
};
