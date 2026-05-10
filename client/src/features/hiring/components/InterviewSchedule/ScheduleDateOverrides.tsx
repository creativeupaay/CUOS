import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ScheduleFormState } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DateOverride = ScheduleFormState['dateOverrides'][number];

// ─── Constants ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    dateOverrides: DateOverride[];
    availableRangeDates: string[];
    onAddDateOverride: () => void;
    onRemoveDateOverride: (index: number) => void;
    onSetDateOverrideDate: (index: number, date: string) => void;
    onAddDateOverrideSlot: (index: number) => void;
    onRemoveDateOverrideSlot: (index: number, slotIndex: number) => void;
    onSetDateOverrideSlotTime: (
        index: number,
        slotIndex: number,
        field: 'startTime' | 'endTime',
        value: string
    ) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleDateOverrides({
    dateOverrides,
    availableRangeDates,
    onAddDateOverride,
    onRemoveDateOverride,
    onSetDateOverrideDate,
    onAddDateOverrideSlot,
    onRemoveDateOverrideSlot,
    onSetDateOverrideSlotTime,
}: Props) {
    const hasRangeDates = availableRangeDates.length > 0;
    const hasOverrides = dateOverrides.length > 0;

    return (
        <div
            className="rounded-xl border p-4"
            style={{
                borderColor: 'var(--color-border-default)',
                backgroundColor: '#F9FBFF',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Date-Specific Availability Overrides
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Pick dates from selected ranges and set custom slots for those dates only.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAddDateOverride}
                    disabled={!hasRangeDates}
                    className="px-2.5 py-1.5 rounded-md text-xs inline-flex items-center gap-1"
                    style={{
                        backgroundColor: 'var(--color-primary)',
                        color: '#fff',
                        opacity: hasRangeDates ? 1 : 0.6,
                    }}
                >
                    <Plus size={12} /> Add custom date
                </button>
            </div>

            {/* Empty states */}
            {!hasRangeDates && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Add valid Available Date Ranges first to enable date-specific changes.
                </p>
            )}
            {hasRangeDates && !hasOverrides && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No custom dates yet. Use Add custom date to set exceptions such as breaks or different
                    hours.
                </p>
            )}

            {/* Override list */}
            {hasRangeDates && hasOverrides && (
                <div className="space-y-4">
                    {dateOverrides.map((override, overrideIndex) => (
                        <div
                            key={`override-${overrideIndex}`}
                            className="rounded-lg border p-3"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                        >
                            {/* Date selector + add/remove slot controls */}
                            <div className="flex items-center gap-2 mb-3">
                                <select
                                    value={override.date}
                                    onChange={(e) => onSetDateOverrideDate(overrideIndex, e.target.value)}
                                    className="px-3 py-2 text-sm rounded-lg border"
                                    style={inputStyle}
                                >
                                    <option value="">Select date</option>
                                    {availableRangeDates.map((date) => (
                                        <option key={date} value={date}>
                                            {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
                                                weekday: 'short',
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => onAddDateOverrideSlot(overrideIndex)}
                                    title="Add interval"
                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-secondary)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                    }}
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRemoveDateOverride(overrideIndex)}
                                    title="Remove custom date"
                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-secondary)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Time slots */}
                            <div className="space-y-2">
                                {override.slots.map((slot, slotIndex) => (
                                    <div
                                        key={`override-${overrideIndex}-slot-${slotIndex}`}
                                        className="flex items-center gap-2"
                                    >
                                        <input
                                            type="time"
                                            value={slot.startTime}
                                            onChange={(e) =>
                                                onSetDateOverrideSlotTime(
                                                    overrideIndex,
                                                    slotIndex,
                                                    'startTime',
                                                    e.target.value
                                                )
                                            }
                                            className="px-3 py-2 text-sm rounded-lg border"
                                            style={{ ...inputStyle, width: '150px' }}
                                        />
                                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                        <input
                                            type="time"
                                            value={slot.endTime}
                                            onChange={(e) =>
                                                onSetDateOverrideSlotTime(
                                                    overrideIndex,
                                                    slotIndex,
                                                    'endTime',
                                                    e.target.value
                                                )
                                            }
                                            className="px-3 py-2 text-sm rounded-lg border"
                                            style={{ ...inputStyle, width: '150px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onRemoveDateOverrideSlot(overrideIndex, slotIndex)
                                            }
                                            title="Remove interval"
                                            disabled={override.slots.length <= 1}
                                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                color: 'var(--color-text-secondary)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
