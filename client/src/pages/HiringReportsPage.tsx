import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useGetHiringReportSummaryQuery } from '@/features/hiring/hiringApi';
import type { ApplicationStatus } from '@/features/hiring/types/types';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
    new: 'New',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    'assignment-round': 'Assignment',
    'assignment-submitted': 'Assignment Submitted',
    interview: 'Interview',
    'interview-scheduled': 'Interview Scheduled',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
};

function toPercent(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(1)}%`;
}

export default function HiringReportsPage() {
    const navigate = useNavigate();
    const [lastDays, setLastDays] = useState(30);

    const { data, isLoading, error, refetch, isFetching } = useGetHiringReportSummaryQuery({
        lastDays,
    });

    if (isLoading) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading hiring analytics...
                </div>
            </div>
        );
    }

    if (error || !data?.data) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Unable to load hiring analytics.
                </div>
            </div>
        );
    }

    const report = data.data;

    return (
        <div
            className="px-8 py-6 max-w-[1280px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Hiring Analytics
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Pipeline conversion, stage aging, and recruiter performance overview
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={lastDays}
                        onChange={(event) => setLastDays(Number(event.target.value))}
                        className="h-9 px-3 text-sm rounded-lg border outline-none"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button
                        onClick={() => refetch()}
                        className="h-9 px-3 rounded-lg text-sm border inline-flex items-center gap-1.5"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => navigate('/hiring/applications')}
                        className="h-9 px-3 rounded-lg text-sm border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Back to Applications
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-6 gap-3 mb-6">
                {[
                    { label: 'Applications', value: report.overview.totalApplications },
                    { label: 'Active Jobs', value: report.overview.activeJobs },
                    { label: 'Offers Sent', value: report.overview.offersCount },
                    { label: 'Hired', value: report.overview.hiredCount },
                    { label: 'Rejected', value: report.overview.rejectedCount },
                    { label: 'Rejection Rate', value: `${report.overview.rejectionRate}%` },
                ].map((item) => (
                    <div
                        key={item.label}
                        className="p-4 rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                        <p className="text-xl font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                            {item.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div
                    className="rounded-xl border overflow-hidden"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Pipeline Conversion & Aging
                        </h2>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Stage', 'Count', 'Conversion', 'Avg Aging (days)'].map((head) => (
                                    <th
                                        key={head}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {head}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {report.pipeline.map((row) => (
                                <tr key={row.status} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                                        {STATUS_LABELS[row.status]}
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                        {row.count}
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                        {toPercent(row.conversionFromPrevious)}
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                        {row.avgAgingDays}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div
                    className="rounded-xl border overflow-hidden"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Recruiter Performance (Last {lastDays} days)
                        </h2>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Recruiter', 'Actions', 'Status Updates', 'Offers', 'Notes'].map((head) => (
                                    <th
                                        key={head}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {head}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {report.recruiterPerformance.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-sm"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        No recruiter activity found in selected range.
                                    </td>
                                </tr>
                            )}
                            {report.recruiterPerformance.map((row) => (
                                <tr key={row.userId} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                                        <p className="font-medium">{row.name || 'Unknown User'}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {row.email || '-'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.totalActions}</td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.statusChanges}</td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.offersSent}</td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.interviewNotes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
