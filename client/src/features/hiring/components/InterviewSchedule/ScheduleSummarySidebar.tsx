
import type { Job } from '@/features/hiring/index';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SyncedSummary {
    timezone: string;
    weekdays: string;
    hours: string;
    availableRanges: string;
    dateOverridesCount: number;
    durationMinutes: number | string;
    beforeEventBufferMinutes: number | string;
    afterEventBufferMinutes: number | string;
    reminderMinutesBefore: string;
    eventTypeId: number | string;
    scheduleId: number | string;
}

interface Props {
    job: Job;
    syncedSummary: SyncedSummary | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleSummarySidebar({ job, syncedSummary }: Props) {
    const scheduling = job.interviewScheduling;

    return (
        <>
            {/* Sync status banner */}
            <div
                className="rounded-lg border p-4 text-xs"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-secondary)',
                }}
            >
                <div className="flex flex-wrap gap-4">
                    <span>
                        Sync: <strong>{scheduling?.syncStatus || 'not_configured'}</strong>
                    </span>
                    <span>
                        Active: <strong>{scheduling?.active ? 'yes' : 'no'}</strong>
                    </span>
                    <span>
                        URL: <strong>{scheduling?.bookingUrl ? 'available' : 'missing'}</strong>
                    </span>
                    <span>
                        Last synced:{' '}
                        <strong>
                            {scheduling?.lastSyncedAt
                                ? new Date(scheduling.lastSyncedAt).toLocaleString('en-IN')
                                : '-'}
                        </strong>
                    </span>
                </div>
                {scheduling?.syncError && (
                    <p className="mt-2" style={{ color: 'var(--color-danger)' }}>
                        Sync error: {scheduling.syncError}
                    </p>
                )}
            </div>

            {/* Last synced config summary */}
            <div
                className="rounded-lg border p-4"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: '#F8FFFB',
                }}
            >
                <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#166534' }}
                >
                    Last Synced Config Summary
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Values below are from the currently saved job schedule that gets pushed to Cal.com.
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {[
                        { label: 'Timezone', value: syncedSummary?.timezone || '-' },
                        { label: 'Weekdays', value: syncedSummary?.weekdays || '-' },
                        { label: 'Working Hours', value: syncedSummary?.hours || '-' },
                        { label: 'Date Ranges', value: syncedSummary?.availableRanges || '-' },
                        { label: 'Duration', value: syncedSummary ? `${syncedSummary.durationMinutes} min` : '-' },
                        {
                            label: 'Buffers',
                            value: syncedSummary
                                ? `${syncedSummary.beforeEventBufferMinutes} min before / ${syncedSummary.afterEventBufferMinutes} min after`
                                : '-',
                        },
                        { label: 'Reminders', value: syncedSummary?.reminderMinutesBefore || '-' },
                        {
                            label: 'Custom Date Overrides',
                            value: String(syncedSummary?.dateOverridesCount ?? 0),
                        },
                        {
                            label: 'Cal IDs',
                            value: syncedSummary
                                ? `schedule ${syncedSummary.scheduleId} / event ${syncedSummary.eventTypeId}`
                                : '-',
                        },
                    ].map(({ label, value }) => (
                        <p key={label} style={{ color: 'var(--color-text-secondary)' }}>
                            {label}:{' '}
                            <strong style={{ color: 'var(--color-text-primary)' }}>{value}</strong>
                        </p>
                    ))}
                </div>
            </div>
        </>
    );
}
