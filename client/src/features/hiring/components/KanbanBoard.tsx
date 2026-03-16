import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Mail, Briefcase } from 'lucide-react';
import type { Application, ApplicationStatus } from '../types/types';

interface KanbanColumn {
    status: ApplicationStatus;
    label: string;
    color: string;
    bg: string;
    headerBg: string;
    droppable?: boolean;
    allowedSourceStatuses?: ApplicationStatus[];
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
    { status: 'new', label: 'New', color: '#1D4ED8', bg: '#DBEAFE', headerBg: '#EFF6FF' },
    { status: 'screening', label: 'Screening', color: '#92400E', bg: '#FEF3C7', headerBg: '#FFFBEB' },
    { status: 'shortlisted', label: 'Shortlisted', color: '#166534', bg: '#DCFCE7', headerBg: '#F0FDF4' },
    { status: 'assignment-round', label: 'Assignment', color: '#6D28D9', bg: '#EDE9FE', headerBg: '#F5F3FF' },
    { status: 'assignment-submitted', label: 'Assignment Submitted', color: '#7C3AED', bg: '#F3E8FF', headerBg: '#FAF5FF' },
    { status: 'interview', label: 'Interview', color: '#0F766E', bg: '#CCFBF1', headerBg: '#F0FDFA' },
    {
        status: 'offered',
        label: 'Offered',
        color: '#0369A1',
        bg: '#E0F2FE',
        headerBg: '#F0F9FF',
        droppable: false,
    },
    {
        status: 'hired',
        label: 'Hired',
        color: '#15803D',
        bg: '#DCFCE7',
        headerBg: '#F0FDF4',
        allowedSourceStatuses: ['offered'],
    },
    { status: 'rejected', label: 'Rejected', color: '#B91C1C', bg: '#FEE2E2', headerBg: '#FFF5F5' },
];

interface KanbanBoardProps {
    applications: Application[];
    onStatusChange: (id: string, status: ApplicationStatus) => void;
    isUpdating: boolean;
    updatingIds?: string[];
}

function KanbanCard({
    app,
    onDragStart,
    isPending,
}: {
    app: Application;
    onDragStart: (e: React.DragEvent, id: string) => void;
    isPending: boolean;
}) {
    const navigate = useNavigate();
    const jobTitle =
        app.jobId && typeof app.jobId === 'object' ? app.jobId.title || '—' : '—';

    return (
        <div
            draggable={!isPending}
            onDragStart={(e) => onDragStart(e, app._id)}
            className="rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
                opacity: isPending ? 0.65 : 1,
                cursor: isPending ? 'not-allowed' : 'grab',
            }}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <p
                    className="text-sm font-medium leading-tight"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {app.name}
                </p>
                <button
                    onClick={() => navigate(`/hiring/applications/${app._id}`)}
                    className="shrink-0 p-0.5 rounded hover:bg-gray-100"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <ExternalLink size={12} />
                </button>
            </div>

            <div className="flex items-center gap-1 mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Briefcase size={11} />
                <span className="text-xs">{jobTitle}</span>
            </div>

            <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Mail size={11} />
                <span className="text-xs truncate">{app.email}</span>
            </div>

            {app.tags && app.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {app.tags.slice(0, 2).map((tag) => (
                        <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                                backgroundColor: 'var(--color-bg-subtle)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                    {app.tags.length > 2 && (
                        <span
                            className="text-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            +{app.tags.length - 2}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export default function KanbanBoard({ applications, onStatusChange, isUpdating, updatingIds = [] }: KanbanBoardProps) {
    const dragItemId = useRef<string | null>(null);
    const [draggingOver, setDraggingOver] = useState<ApplicationStatus | null>(null);

    function handleDragStart(e: React.DragEvent, id: string) {
        dragItemId.current = id;
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e: React.DragEvent, status: ApplicationStatus) {
        const targetColumn = KANBAN_COLUMNS.find((col) => col.status === status);
        if (targetColumn?.droppable === false) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDraggingOver(status);
    }

    function handleDrop(e: React.DragEvent, targetStatus: ApplicationStatus) {
        e.preventDefault();
        setDraggingOver(null);
        const id = dragItemId.current;
        if (!id) return;
        const app = applications.find((a) => a._id === id);
        if (!app || app.status === targetStatus) return;
        const targetColumn = KANBAN_COLUMNS.find((col) => col.status === targetStatus);
        if (targetColumn?.droppable === false) return;
        if (
            targetColumn?.allowedSourceStatuses &&
            !targetColumn.allowedSourceStatuses.includes(app.status)
        ) {
            return;
        }
        onStatusChange(id, targetStatus);
        dragItemId.current = null;
    }

    function handleDragLeave() {
        setDraggingOver(null);
    }

    const grouped = KANBAN_COLUMNS.reduce<Record<ApplicationStatus, Application[]>>(
        (acc, col) => {
            acc[col.status] = applications.filter((a) => a.status === col.status);
            return acc;
        },
        {} as Record<ApplicationStatus, Application[]>
    );

    return (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 300px)' }}>
            {KANBAN_COLUMNS.map((col) => {
                const cards = grouped[col.status] || [];
                const isOver = draggingOver === col.status;
                const isDroppable = col.droppable !== false;
                return (
                    <div
                        key={col.status}
                        className="flex flex-col rounded-xl border transition-colors"
                        style={{
                            minWidth: 240,
                            width: 240,
                            flexShrink: 0,
                            borderColor: isOver ? col.color : 'var(--color-border-default)',
                            backgroundColor: isOver ? col.bg : 'var(--color-bg-subtle)',
                            opacity: isUpdating ? 0.7 : 1,
                            transition: 'border-color 0.15s, background-color 0.15s',
                        }}
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDrop={(e) => handleDrop(e, col.status)}
                        onDragLeave={handleDragLeave}
                    >
                        {/* Column header */}
                        <div
                            className="flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: col.headerBg,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: col.color }}
                                />
                                <span
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: col.color }}
                                >
                                    {col.label}
                                </span>
                            </div>
                            <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: col.bg, color: col.color }}
                            >
                                {cards.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="flex flex-col gap-2 p-2 flex-1">
                            {cards.length === 0 && (
                                <div
                                    className="flex items-center justify-center h-16 text-xs rounded-lg border-2 border-dashed"
                                    style={{
                                        borderColor:
                                            isDroppable && isOver
                                                ? col.color
                                                : 'var(--color-border-default)',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    {isDroppable ? 'Drop here' : 'Updated from final decision'}
                                </div>
                            )}
                            {cards.map((app) => (
                                <KanbanCard
                                    key={app._id}
                                    app={app}
                                    onDragStart={handleDragStart}
                                    isPending={updatingIds.includes(app._id)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
