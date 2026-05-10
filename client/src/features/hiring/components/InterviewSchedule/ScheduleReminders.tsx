import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ScheduleFormState, ReminderUnit } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

interface ReminderOption {
    value: number;
    label: string;
}

interface ReminderUnitOption {
    value: ReminderUnit;
    label: string;
}

const REMINDER_OPTIONS: ReminderOption[] = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' },
    { value: 1440, label: '1 day' },
];

const REMINDER_UNITS: ReminderUnitOption[] = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
];

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReminderLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${minutes / 60} hr`;
    return `${minutes / 1440} day${minutes / 1440 !== 1 ? 's' : ''}`;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    form: Pick<
        ScheduleFormState,
        'reminderMinutesBefore' | 'customReminderValue' | 'customReminderUnit'
    >;
    onToggleReminderOption: (value: number) => void;
    onChangeCustomReminderValue: (value: string) => void;
    onChangeCustomReminderUnit: (value: ReminderUnit) => void;
    onAddCustomReminder: () => void;
    onRemoveReminder: (minutes: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleReminders({
    form,
    onToggleReminderOption,
    onChangeCustomReminderValue,
    onChangeCustomReminderUnit,
    onAddCustomReminder,
    onRemoveReminder,
}: Props) {
    return (
        <div
            className="rounded-lg border p-4"
            style={{
                borderColor: 'var(--color-border-default)',
                backgroundColor: 'var(--color-bg-subtle)',
            }}
        >
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Reminder Email Timings
            </p>

            {/* Preset checkboxes */}
            <div className="mt-2 flex flex-wrap gap-3">
                {REMINDER_OPTIONS.map((option) => (
                    <label
                        key={option.value}
                        className="inline-flex items-center gap-2 text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        <input
                            type="checkbox"
                            checked={form.reminderMinutesBefore.includes(option.value)}
                            onChange={() => onToggleReminderOption(option.value)}
                        />
                        {option.label}
                    </label>
                ))}
            </div>

            {/* Custom reminder row */}
            <div className="mt-3 flex items-center gap-2">
                <input
                    type="number"
                    min={0}
                    max={10080}
                    value={form.customReminderValue}
                    onChange={(e) => onChangeCustomReminderValue(e.target.value)}
                    placeholder="Custom value"
                    className="px-3 py-2.5 text-sm rounded-lg border w-[130px]"
                    style={inputStyle}
                />
                <select
                    value={form.customReminderUnit}
                    onChange={(e) => onChangeCustomReminderUnit(e.target.value as ReminderUnit)}
                    className="px-3 py-2.5 text-sm rounded-lg border"
                    style={inputStyle}
                >
                    {REMINDER_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                            {unit.label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={onAddCustomReminder}
                    className="px-2.5 py-2 rounded-md text-xs"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                >
                    Add timing
                </button>
            </div>

            {/* Active reminder chips */}
            {form.reminderMinutesBefore.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {form.reminderMinutesBefore.map((minutes) => (
                        <span
                            key={minutes}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-border-default)',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            {formatReminderLabel(minutes)}
                            <button
                                type="button"
                                onClick={() => onRemoveReminder(minutes)}
                                className="inline-flex items-center"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
