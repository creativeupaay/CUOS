import type { SessionStatus } from '../types/gameZone.types';

const STATUS_CONFIGS: Record<SessionStatus, { label: string; bg: string; color: string; dot: string }> = {
  lobby: {
    label: 'Waiting',
    bg: 'rgba(16,185,129,0.1)',
    color: '#059669',
    dot: '#10B981',
  },
  active: {
    label: 'In Progress',
    bg: 'rgba(99,102,241,0.12)',
    color: '#4F46E5',
    dot: '#6366F1',
  },
  finished: {
    label: 'Finished',
    bg: 'rgba(107,114,128,0.1)',
    color: '#6B7280',
    dot: '#9CA3AF',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'rgba(239,68,68,0.1)',
    color: '#DC2626',
    dot: '#EF4444',
  },
};

interface GameStatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

export default function GameStatusBadge({ status, className = '' }: GameStatusBadgeProps) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.finished;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ background: config.bg, color: config.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: config.dot, boxShadow: `0 0 4px ${config.dot}` }}
      />
      {config.label}
    </span>
  );
}
