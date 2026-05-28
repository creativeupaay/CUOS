import React from 'react';
import { Badge } from '../../atoms/Badge';
import type { BadgeVariant } from '../../atoms/Badge';

// ─── Status Badge ──────────────────────────────────────────────────────────────

type StatusKey =
    | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'cancelled'
    | 'completed' | 'in_progress' | 'on_hold' | 'open' | 'closed' | 'draft'
    | 'scheduled' | 'confirmed' | 'no_show' | 'rescheduled' | 'shortlisted'
    | 'hired' | 'applied' | 'withdrawn' | 'paid' | 'unpaid' | 'overdue';

const statusConfig: Record<StatusKey, { label: string; variant: BadgeVariant }> = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'neutral' },
    pending: { label: 'Pending', variant: 'warning' },
    approved: { label: 'Approved', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'neutral' },
    completed: { label: 'Completed', variant: 'success' },
    in_progress: { label: 'In Progress', variant: 'info' },
    on_hold: { label: 'On Hold', variant: 'warning' },
    open: { label: 'Open', variant: 'info' },
    closed: { label: 'Closed', variant: 'neutral' },
    draft: { label: 'Draft', variant: 'neutral' },
    scheduled: { label: 'Scheduled', variant: 'info' },
    confirmed: { label: 'Confirmed', variant: 'success' },
    no_show: { label: 'No Show', variant: 'danger' },
    rescheduled: { label: 'Rescheduled', variant: 'warning' },
    shortlisted: { label: 'Shortlisted', variant: 'purple' },
    hired: { label: 'Hired', variant: 'success' },
    applied: { label: 'Applied', variant: 'info' },
    withdrawn: { label: 'Withdrawn', variant: 'neutral' },
    paid: { label: 'Paid', variant: 'success' },
    unpaid: { label: 'Unpaid', variant: 'warning' },
    overdue: { label: 'Overdue', variant: 'danger' },
};

export interface StatusBadgeProps {
    status: string;
    className?: string;
    dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, dot }) => {
    const key = status?.toLowerCase().replace(/[\s-]+/g, '_') as StatusKey;
    const config = statusConfig[key] ?? { label: status, variant: 'neutral' as BadgeVariant };
    return (
        <Badge variant={config.variant} dot={dot} className={className}>
            {config.label}
        </Badge>
    );
};

// ─── Priority Badge ─────────────────────────────────────────────────────────────

type PriorityKey = 'low' | 'medium' | 'high' | 'critical' | 'urgent';

const priorityConfig: Record<PriorityKey, { label: string; variant: BadgeVariant }> = {
    low: { label: 'Low', variant: 'neutral' },
    medium: { label: 'Medium', variant: 'info' },
    high: { label: 'High', variant: 'warning' },
    critical: { label: 'Critical', variant: 'danger' },
    urgent: { label: 'Urgent', variant: 'danger' },
};

export interface PriorityBadgeProps {
    priority: string;
    className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
    const key = priority?.toLowerCase() as PriorityKey;
    const config = priorityConfig[key] ?? { label: priority, variant: 'neutral' as BadgeVariant };
    return (
        <Badge variant={config.variant} className={className}>
            {config.label}
        </Badge>
    );
};
