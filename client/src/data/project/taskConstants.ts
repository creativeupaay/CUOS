import type { Task } from '@/features/project';
import type { FC } from 'react';
import type { LucideProps } from 'lucide-react';

export type StatusId = 'todo' | 'in-progress' | 'paused' | 'completed';

export interface StatusStyle {
    bg: string;
    text: string;
    dot: string;
    icon?: FC<LucideProps>;
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
    todo: { bg: 'transparent', text: 'var(--color-text-secondary)', dot: '#9CA3AF' },
    'in-progress': { bg: 'transparent', text: 'var(--color-text-primary)', dot: '#3B82F6' },
    paused: { bg: 'transparent', text: '#D97706', dot: '#F59E0B' },
    completed: { bg: 'transparent', text: 'var(--color-text-primary)', dot: '#10B981' },
};

export const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#7F1D1D', text: '#FCA5A5' },
    high: { bg: '#7F1D1D', text: '#FCA5A5' },
    medium: { bg: '#78350F', text: '#FCD34D' },
    low: { bg: '#14532D', text: '#86EFAC' },
};

export const STATUS_LABELS: Record<StatusId, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'paused': 'Paused',
    'completed': 'Completed',
};

/** Forward transition rules — prevents going backwards or re-opening completed tasks. */
export const ALLOWED_NEXT: Record<string, Task['status'][]> = {
    'todo': ['in-progress'],
    'in-progress': ['paused', 'completed'],
    'paused': ['in-progress', 'completed'],
    'completed': [],
};
