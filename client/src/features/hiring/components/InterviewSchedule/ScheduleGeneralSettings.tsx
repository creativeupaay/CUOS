import React from 'react';
import type { UseScheduleFormReturn } from '@/features/hiring/index';
import { FormField } from '@/components/molecules/FormField';

interface Props {
    form: UseScheduleFormReturn['form'];
    setFormField: UseScheduleFormReturn['setFormField'];
}

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

export default function ScheduleGeneralSettings({ form, setFormField }: Props) {
    const set = (key: keyof typeof form) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const value =
            e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setFormField(key, value);
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            <FormField label="Timezone">
                <select
                    value={form.timezone}
                    onChange={set('timezone')}
                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                    style={inputStyle}
                >
                    {[
                        'Asia/Kolkata',
                        'Asia/Dubai',
                        'Europe/London',
                        'Europe/Berlin',
                        'America/New_York',
                        'America/Los_Angeles',
                        'Australia/Sydney',
                    ].map((timezone) => (
                        <option key={timezone} value={timezone}>
                            {timezone}
                        </option>
                    ))}
                </select>
            </FormField>
            <FormField label="Organizer">
                <input
                    type="text"
                    value={form.organizerName}
                    onChange={set('organizerName')}
                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                    style={inputStyle}
                />
            </FormField>

            <FormField label="Interview Duration (minutes)">
                <input
                    type="number"
                    min="15"
                    step="15"
                    value={form.durationMinutes}
                    onChange={set('durationMinutes')}
                    className="px-3 py-2.5 text-sm rounded-lg border w-full"
                    style={inputStyle}
                />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
                <FormField label="Buffer Before (min)">
                    <input
                        type="number"
                        min="0"
                        step="5"
                        value={form.beforeEventBufferMinutes}
                        onChange={set('beforeEventBufferMinutes')}
                        className="px-3 py-2.5 text-sm rounded-lg border w-full"
                        style={inputStyle}
                    />
                </FormField>
                <FormField label="Buffer After (min)">
                    <input
                        type="number"
                        min="0"
                        step="5"
                        value={form.afterEventBufferMinutes}
                        onChange={set('afterEventBufferMinutes')}
                        className="px-3 py-2.5 text-sm rounded-lg border w-full"
                        style={inputStyle}
                    />
                </FormField>
            </div>
        </div>
    );
}
