import React from 'react';
import { Plus, Trash2, Copy, Clipboard } from 'lucide-react';
import type { ScheduleFormState, ScheduleRangeFormState, DayScheduleMap } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_OPTIONS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

const WEEKDAY_FULL_NAMES: Record<string, string> = {
    Sun: 'Sunday',
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
};

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    form: ScheduleFormState;
    activeRangeIndex: number;
    todayDateInput: string;
    copiedRangeLabel: string;
    copiedRangeDaySchedules: DayScheduleMap | null;
    copyPanelDay: number | null;
    copyTargets: number[];
    copyPanelRef: React.RefObject<HTMLDivElement | null>;
    workingHoursSummary: string;
    onSetActiveRangeIndex: (index: number) => void;
    onAddRange: () => void;
    onRemoveRange: (index: number) => void;
    onSetRangeValue: (index: number, field: 'startDate' | 'endDate', value: string) => void;
    onToggleWeekday: (day: number) => void;
    onSetDaySlotTimeAtIndex: (
        day: number,
        slotIndex: number,
        field: 'startTime' | 'endTime',
        value: string
    ) => void;
    onAddDaySlot: (day: number) => void;
    onRemoveDaySlot: (day: number, slotIndex: number) => void;
    onOpenCopyPanel: (day: number) => void;
    onToggleCopyTarget: (day: number) => void;
    onToggleCopyAllTargets: () => void;
    onApplyCopyTargets: () => void;
    onCloseCopyPanel: () => void;
    onCopyCurrentRangeSchedule: () => void;
    onPasteToCurrentRangeSchedule: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleRangeSelector({
    form,
    activeRangeIndex,
    todayDateInput,
    copiedRangeLabel,
    copiedRangeDaySchedules,
    copyPanelDay,
    copyTargets,
    copyPanelRef,
    workingHoursSummary,
    onSetActiveRangeIndex,
    onAddRange,
    onRemoveRange,
    onSetRangeValue,
    onToggleWeekday,
    onSetDaySlotTimeAtIndex,
    onAddDaySlot,
    onRemoveDaySlot,
    onOpenCopyPanel,
    onToggleCopyTarget,
    onToggleCopyAllTargets,
    onApplyCopyTargets,
    onCloseCopyPanel,
    onCopyCurrentRangeSchedule,
    onPasteToCurrentRangeSchedule,
}: Props) {
    const activeRange: ScheduleRangeFormState | undefined = form.availableRanges[activeRangeIndex];
    const activeRangeDaySchedules = activeRange?.daySchedules ?? form.daySchedules;

    return (
        <>
            {/* ── Available Date Ranges ── */}
            <div
                className="rounded-lg border p-4"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-subtle)',
                }}
            >
                <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Available Date Ranges
                    </p>
                    <button
                        type="button"
                        onClick={onAddRange}
                        className="px-2.5 py-1.5 rounded-md text-xs inline-flex items-center gap-1"
                        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                    >
                        <Plus size={12} /> Add range
                    </button>
                </div>

                <div className="space-y-2">
                    {form.availableRanges.map((range, index) => (
                        <div
                            key={`range-${index}`}
                            className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                        >
                            <input
                                type="date"
                                value={range.startDate}
                                min={todayDateInput}
                                onChange={(e) => onSetRangeValue(index, 'startDate', e.target.value)}
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                            />
                            <input
                                type="date"
                                value={range.endDate}
                                min={range.startDate || todayDateInput}
                                onChange={(e) => onSetRangeValue(index, 'endDate', e.target.value)}
                                className="px-3 py-2.5 text-sm rounded-lg border w-full"
                                style={inputStyle}
                            />
                            <button
                                type="button"
                                onClick={() => onRemoveRange(index)}
                                className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                                title="Remove range"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                    Each range has its own timing tab below, so you can configure different weekday hours
                    for different date windows.
                </p>
            </div>

            {/* ── Per-Range Working Hours ── */}
            <div
                className="rounded-xl border p-4"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: '#FAFAFA',
                }}
            >
                {/* Range Tabs */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    {form.availableRanges.map((range, index) => {
                        const label =
                            range.startDate && range.endDate
                                ? `${range.startDate} to ${range.endDate}`
                                : `Range ${index + 1}`;
                        const isActive = activeRangeIndex === index;
                        return (
                            <button
                                key={`range-tab-${index}`}
                                type="button"
                                onClick={() => onSetActiveRangeIndex(index)}
                                className="px-3 py-2 rounded-lg border text-xs font-medium"
                                style={{
                                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-default)',
                                    backgroundColor: isActive ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                    color: isActive ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Working hours for{' '}
                    {activeRange?.startDate && activeRange?.endDate
                        ? `${activeRange.startDate} to ${activeRange.endDate}`
                        : `Range ${activeRangeIndex + 1}`}
                </p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    {workingHoursSummary}
                </p>

                {/* Weekday rows */}
                <div className="space-y-3">
                    {WEEKDAY_OPTIONS.map((day) => {
                        const dayState = activeRangeDaySchedules[day.value];
                        return (
                            <div
                                key={day.value}
                                className="grid grid-cols-[130px_1fr] md:grid-cols-[160px_1fr] items-start gap-4"
                            >
                                {/* Weekday toggle */}
                                <button
                                    type="button"
                                    onClick={() => onToggleWeekday(day.value)}
                                    className="inline-flex items-center gap-2 text-sm font-medium"
                                    style={{
                                        color: dayState.enabled
                                            ? 'var(--color-text-primary)'
                                            : 'var(--color-text-muted)',
                                    }}
                                >
                                    <span
                                        className="relative inline-block w-10 h-6 rounded-full"
                                        style={{
                                            backgroundColor: dayState.enabled
                                                ? 'var(--color-primary)'
                                                : 'var(--color-border-default)',
                                        }}
                                    >
                                        <span
                                            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                                            style={{
                                                transform: dayState.enabled
                                                    ? 'translateX(16px)'
                                                    : 'translateX(0)',
                                            }}
                                        />
                                    </span>
                                    {WEEKDAY_FULL_NAMES[day.label] ?? day.label}
                                </button>

                                {/* Time slots */}
                                <div className="space-y-2">
                                    {dayState.slots.map((slot, slotIndex) => (
                                        <div
                                            key={`${day.value}-${slotIndex}`}
                                            className="flex items-center gap-2 relative"
                                        >
                                            <input
                                                type="time"
                                                value={slot.startTime}
                                                onChange={(e) =>
                                                    onSetDaySlotTimeAtIndex(
                                                        day.value,
                                                        slotIndex,
                                                        'startTime',
                                                        e.target.value
                                                    )
                                                }
                                                disabled={!dayState.enabled}
                                                className="px-3 py-2 text-sm rounded-lg border"
                                                style={{
                                                    ...inputStyle,
                                                    width: '150px',
                                                    opacity: dayState.enabled ? 1 : 0.6,
                                                }}
                                            />
                                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                            <input
                                                type="time"
                                                value={slot.endTime}
                                                onChange={(e) =>
                                                    onSetDaySlotTimeAtIndex(
                                                        day.value,
                                                        slotIndex,
                                                        'endTime',
                                                        e.target.value
                                                    )
                                                }
                                                disabled={!dayState.enabled}
                                                className="px-3 py-2 text-sm rounded-lg border"
                                                style={{
                                                    ...inputStyle,
                                                    width: '150px',
                                                    opacity: dayState.enabled ? 1 : 0.6,
                                                }}
                                            />

                                            {slotIndex === 0 ? (
                                                <>
                                                    {/* Add interval */}
                                                    <button
                                                        type="button"
                                                        onClick={() => onAddDaySlot(day.value)}
                                                        title="Add interval"
                                                        disabled={!dayState.enabled}
                                                        className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                        style={{
                                                            borderColor: 'var(--color-border-default)',
                                                            color: 'var(--color-text-secondary)',
                                                            opacity: dayState.enabled ? 1 : 0.5,
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                        }}
                                                    >
                                                        <Plus size={14} />
                                                    </button>

                                                    {/* Copy panel trigger */}
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenCopyPanel(day.value)}
                                                            title="Copy times to selected days"
                                                            disabled={!dayState.enabled}
                                                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                            style={{
                                                                borderColor:
                                                                    copyPanelDay === day.value
                                                                        ? 'var(--color-primary)'
                                                                        : 'var(--color-border-default)',
                                                                color: 'var(--color-text-secondary)',
                                                                opacity: dayState.enabled ? 1 : 0.5,
                                                                backgroundColor:
                                                                    copyPanelDay === day.value
                                                                        ? 'var(--color-primary-soft)'
                                                                        : 'var(--color-bg-surface)',
                                                            }}
                                                        >
                                                            <Copy size={14} />
                                                        </button>

                                                        {/* Copy panel dropdown */}
                                                        {copyPanelDay === day.value && dayState.enabled && (
                                                            <div
                                                                ref={copyPanelRef}
                                                                className="absolute z-30 top-full mt-2 right-0 w-[270px] rounded-lg border p-3 shadow-md"
                                                                style={{
                                                                    borderColor: 'var(--color-border-default)',
                                                                    backgroundColor: 'var(--color-bg-surface)',
                                                                }}
                                                            >
                                                                <p
                                                                    className="text-[11px] font-semibold uppercase tracking-wide"
                                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                                >
                                                                    Copy Times To
                                                                </p>
                                                                <label
                                                                    className="mt-2 flex items-center gap-2 text-xs"
                                                                    style={{ color: 'var(--color-text-primary)' }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={copyTargets.length === WEEKDAY_OPTIONS.length}
                                                                        onChange={onToggleCopyAllTargets}
                                                                    />
                                                                    Select all
                                                                </label>
                                                                <div className="mt-2 space-y-1 max-h-[180px] overflow-y-auto pr-1">
                                                                    {WEEKDAY_OPTIONS.map((target) => (
                                                                        <label
                                                                            key={target.value}
                                                                            className="flex items-center gap-2 text-xs"
                                                                            style={{ color: 'var(--color-text-primary)' }}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={copyTargets.includes(target.value)}
                                                                                onChange={() =>
                                                                                    onToggleCopyTarget(target.value)
                                                                                }
                                                                            />
                                                                            {target.label}
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-3 flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={onCloseCopyPanel}
                                                                        className="px-2.5 py-1.5 rounded-md text-xs border"
                                                                        style={{
                                                                            borderColor: 'var(--color-border-default)',
                                                                            color: 'var(--color-text-secondary)',
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={onApplyCopyTargets}
                                                                        className="px-2.5 py-1.5 rounded-md text-xs"
                                                                        style={{
                                                                            backgroundColor: 'var(--color-primary)',
                                                                            color: '#fff',
                                                                        }}
                                                                    >
                                                                        Apply
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                /* Remove interval */
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveDaySlot(day.value, slotIndex)}
                                                    title="Remove interval"
                                                    disabled={!dayState.enabled || dayState.slots.length <= 1}
                                                    className="w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors"
                                                    style={{
                                                        borderColor: 'var(--color-border-default)',
                                                        color: 'var(--color-text-secondary)',
                                                        opacity: dayState.enabled ? 1 : 0.5,
                                                        backgroundColor: 'var(--color-bg-surface)',
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Copy/Paste working hours across ranges */}
                <div className="mt-4 flex items-center justify-end gap-2">
                    {copiedRangeLabel && (
                        <span className="text-xs mr-1" style={{ color: 'var(--color-text-muted)' }}>
                            Copied: {copiedRangeLabel}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onCopyCurrentRangeSchedule}
                        title="Copy working hours from this range"
                        className="w-9 h-9 rounded-lg border inline-flex items-center justify-center"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={onPasteToCurrentRangeSchedule}
                        disabled={!copiedRangeDaySchedules}
                        title="Paste copied working hours into this range"
                        className="w-9 h-9 rounded-lg border inline-flex items-center justify-center"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                            opacity: copiedRangeDaySchedules ? 1 : 0.55,
                        }}
                    >
                        <Clipboard size={14} />
                    </button>
                </div>
            </div>
        </>
    );
}
