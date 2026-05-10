import React, { type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { HiringField } from '@/components/molecules/hiring';
import type { FormState } from '@/hooks/hiring/useJobForm';

export interface HiringEmployee {
    _id: string;
    userId: { _id: string; name: string; email: string };
    designation: string;
    department: string;
    profilePhoto?: { url?: string };
}

interface ToggleSetting {
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement> | unknown) => void;
    title: string;
    description: string;
}

export interface JobSettingsSectionProps {
    form: Pick<FormState, 'isHiring' | 'assignmentRequired' | 'managers'>;
    set: <K extends keyof FormState>(
        field: K
    ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | unknown) => void;
    employees: HiringEmployee[];
}

const inputStyle: CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export const JobSettingsSection: React.FC<JobSettingsSectionProps> = ({ form, set, employees }) => {
    const toggleSettings: ToggleSetting[] = [
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
    ];

    return (
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
                {toggleSettings.map((setting) => (
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
                                    transform: setting.checked ? 'translateX(16px)' : 'translateX(0)',
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

            <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--color-border-default)' }}>
                <HiringField label="Job Managers (Optional)">
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

                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Job Managers can manage postings, applications, and interviews for this specific job.
                    </p>
                </HiringField>
            </div>
        </div>
    );
};
