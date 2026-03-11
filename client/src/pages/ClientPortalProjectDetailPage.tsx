import { useState, useRef, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
    useGetPortalProjectQuery,
    useGetPortalTasksQuery,
    useGetPortalMeetingsQuery,
    useGetPortalCredentialsQuery,
    useGetPortalDocumentsQuery,
    useUploadPortalDocumentMutation,
    useGetPortalDocumentUrlQuery,
    useGetPortalCommentsQuery,
    useAddPortalCommentMutation,
    type PortalTask,
    type PortalMeeting,
    type PortalCredential,
    type PortalComment,
} from '@/features/client-portal/clientPortalApi';
import {
    Loader2, Calendar, Clock, CheckCircle2, Circle, Pause,
    PlayCircle, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Upload,
    FileText, Download, Send, MessageSquare, Lock, Globe, Users, FolderOpen,
    Code, TerminalSquare, Check, User as UserIcon, Star,
} from 'lucide-react';

type Tab = 'overview' | 'tasks' | 'meetings' | 'credentials' | 'documents';

const TASK_STATUSES = [
    { value: '', label: 'All', color: '#64748B', bg: '#F1F5F9' },
    { value: 'todo', label: 'To Do', color: '#3B82F6', bg: '#EFF6FF' },
    { value: 'in-progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
    { value: 'paused', label: 'Paused', color: '#EF4444', bg: '#FEF2F2' },
    { value: 'completed', label: 'Completed', color: '#22C55E', bg: '#F0FDF4' },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
    todo: <Circle size={14} style={{ color: '#3B82F6' }} />,
    'in-progress': <PlayCircle size={14} style={{ color: '#F59E0B' }} />,
    paused: <Pause size={14} style={{ color: '#EF4444' }} />,
    completed: <CheckCircle2 size={14} style={{ color: '#22C55E' }} />,
};

function formatDate(d?: string) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d?: string) {
    if (!d) return null;
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

function CommentsPanel({
    projectId,
    entityType,
    entityId,
}: {
    projectId: string;
    entityType: 'tasks' | 'meetings';
    entityId: string;
}) {
    // useAppSelector was calling clientPortal state for token
    const [text, setText] = useState('');
    const { data, isLoading } = useGetPortalCommentsQuery({ projectId, entityType, entityId });
    const [addComment, { isLoading: isSending }] = useAddPortalCommentMutation();

    const comments = data?.data.comments ?? [];

    const handleSend = async () => {
        if (!text.trim()) return;
        try {
            await addComment({ projectId, entityType, entityId, content: text.trim() }).unwrap();
            setText('');
        } catch { }
    };

    return (
        <div
            className="mt-4 rounded-xl border p-4"
            style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
        >
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: '#64748B' }}>
                <MessageSquare size={13} /> Comments
            </p>

            {isLoading && (
                <div className="flex justify-center py-4">
                    <Loader2 size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
                </div>
            )}

            {!isLoading && comments.length === 0 && (
                <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
                    No comments yet. Be the first to leave one.
                </p>
            )}

            <div className="space-y-2 mb-3">
                {comments.map((c: PortalComment) => (
                    <div key={c._id} className="flex gap-2">
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                            style={{ backgroundColor: c.authorType === 'client' ? '#6366F1' : '#3B82F6' }}
                        >
                            {c.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xs font-medium" style={{ color: '#1E293B' }}>
                                    {c.authorType === 'client' ? 'You' : c.authorName}
                                </span>
                                <span className="text-xs" style={{ color: '#94A3B8' }}>
                                    {formatDateTime(c.createdAt)}
                                </span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                                {c.content}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 px-3 py-2 rounded-lg border text-xs outline-none"
                    style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', color: '#1E293B' }}
                />
                <button
                    onClick={handleSend}
                    disabled={isSending || !text.trim()}
                    className="p-2 rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#111827', color: '#FFFFFF' }}
                >
                    {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ projectId }: { projectId: string }) {
    const { data, isLoading } = useGetPortalProjectQuery(projectId);
    const project = data?.data.project;

    if (isLoading) return <TabLoader />;
    if (!project) return <TabEmpty text="Could not load project details." />;

    const phases: any[] = (project as any).phases ?? [];
    const completedPhases = phases.filter((p) => p.status === 'completed').length;
    const progressPct = phases.length > 0 ? Math.round((completedPhases / phases.length) * 100) : null;

    return (
        <div className="space-y-5">
            {/* Phase progress */}
            {phases.length > 0 && (
                <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>Project Progress</p>
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#6366F1' }}>{progressPct}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 8, backgroundColor: '#F1F5F9' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)' }}
                        />
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>{completedPhases} of {phases.length} phases completed</p>

                    {/* Phase list */}
                    <div className="mt-4 space-y-2">
                        {phases.map((phase: any, i: number) => {
                            const isDone = phase.status === 'completed';
                            const isActive = phase.status === 'in-progress';
                            return (
                                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl transition-colors" style={{ backgroundColor: '#F8FAFC' }}>
                                    <div className="flex-shrink-0">
                                        {isDone ? (
                                            <CheckCircle2 size={16} style={{ color: '#22C55E' }} />
                                        ) : isActive ? (
                                            <div className="w-4 h-4 rounded-full border-2 border-indigo-400 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                            </div>
                                        ) : (
                                            <Circle size={16} style={{ color: '#CBD5E1' }} />
                                        )}
                                    </div>
                                    <span className="flex-1 text-sm" style={{ color: isDone ? '#64748B' : '#1E293B', textDecoration: isDone ? 'line-through' : 'none' }}>
                                        {phase.name}
                                    </span>
                                    {isActive && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>In Progress</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Key dates */}
            {[
                { label: 'Start Date', value: formatDate((project as any).startDate) },
                { label: 'End Date', value: formatDate((project as any).endDate) },
                { label: 'Deadline', value: formatDate((project as any).deadline) },
            ].filter((d) => d.value).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Start Date', value: formatDate((project as any).startDate) },
                            { label: 'End Date', value: formatDate((project as any).endDate) },
                            { label: 'Deadline', value: formatDate((project as any).deadline) },
                        ].filter((d) => d.value).map((d) => (
                            <div key={d.label} className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                                <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>{d.label}</p>
                                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: '#1E293B' }}>
                                    <Calendar size={13} style={{ color: '#6366F1' }} />{d.value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

            {/* Description */}
            {(project as any).description && (
                <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>About</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>{(project as any).description}</p>
                </div>
            )}
        </div>
    );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ projectId }: { projectId: string }) {
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    const { data, isLoading } = useGetPortalTasksQuery({
        projectId,
        status: statusFilter || undefined,
    });
    const tasks = data?.data.tasks ?? [];

    return (
        <div>
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2 mb-5">
                {TASK_STATUSES.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => setStatusFilter(s.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{
                            backgroundColor: statusFilter === s.value ? s.color : s.bg,
                            color: statusFilter === s.value ? '#FFFFFF' : s.color,
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {isLoading && <TabLoader />}

            {!isLoading && tasks.length === 0 && (
                <TabEmpty text={statusFilter ? `No ${statusFilter} tasks.` : 'No tasks yet.'} />
            )}

            <div className="space-y-2">
                {tasks.map((task: PortalTask) => {
                    const isOpen = expandedTask === task._id;
                    return (
                        <div
                            key={task._id}
                            className="rounded-xl border overflow-hidden"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                        >
                            <button
                                className="w-full flex items-center gap-3 p-4 text-left"
                                onClick={() => setExpandedTask(isOpen ? null : task._id)}
                            >
                                {STATUS_ICON[task.status] ?? <Circle size={14} />}
                                <span className="flex-1 text-sm font-medium" style={{ color: '#1E293B' }}>
                                    {task.title}
                                </span>
                                <span
                                    className="text-xs px-2 py-0.5 rounded-full mr-2"
                                    style={{
                                        backgroundColor: TASK_STATUSES.find((s) => s.value === task.status)?.bg ?? '#F1F5F9',
                                        color: TASK_STATUSES.find((s) => s.value === task.status)?.color ?? '#64748B',
                                    }}
                                >
                                    {TASK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status}
                                </span>
                                {isOpen ? (
                                    <ChevronUp size={16} style={{ color: '#94A3B8' }} />
                                ) : (
                                    <ChevronDown size={16} style={{ color: '#94A3B8' }} />
                                )}
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 border-t" style={{ borderColor: '#F1F5F9' }}>
                                    {task.description && (
                                        <p className="text-sm mt-3 mb-3" style={{ color: '#475569' }}>
                                            {task.description}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                        {task.priority && (
                                            <span className="text-xs" style={{ color: '#64748B' }}>
                                                Priority: {task.priority}
                                            </span>
                                        )}
                                        {task.deadline && (
                                            <span className="text-xs flex items-center gap-1" style={{ color: '#64748B' }}>
                                                <Calendar size={11} />
                                                Due {formatDate(task.deadline)}
                                            </span>
                                        )}
                                        {task.estimatedHours && (
                                            <span className="text-xs flex items-center gap-1" style={{ color: '#64748B' }}>
                                                <Clock size={11} />
                                                ~{task.estimatedHours}h
                                            </span>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Meetings Tab ─────────────────────────────────────────────────────────────

function MeetingsTab({ projectId }: { projectId: string }) {
    const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
    const { data, isLoading } = useGetPortalMeetingsQuery(projectId);
    const meetings = data?.data.meetings ?? [];

    return (
        <div>
            {isLoading && <TabLoader />}
            {!isLoading && meetings.length === 0 && (
                <TabEmpty text="No external meetings scheduled yet." />
            )}

            <div className="space-y-2">
                {meetings.map((meeting: PortalMeeting) => {
                    const isOpen = expandedMeeting === meeting._id;
                    return (
                        <div
                            key={meeting._id}
                            className="rounded-xl border overflow-hidden"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                        >
                            <button
                                className="w-full flex items-center gap-3 p-4 text-left"
                                onClick={() => setExpandedMeeting(isOpen ? null : meeting._id)}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: '#EFF6FF' }}
                                >
                                    <Globe size={15} style={{ color: '#3B82F6' }} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium" style={{ color: '#1E293B' }}>
                                        {meeting.title}
                                    </p>
                                    <p className="text-xs" style={{ color: '#64748B' }}>
                                        {formatDateTime(meeting.scheduledAt)}
                                        {meeting.duration ? ` · ${meeting.duration} min` : ''}
                                        {meeting.location && !meeting.location.startsWith('http')
                                            ? ` · ${meeting.location}`
                                            : ''}
                                    </p>
                                </div>
                                {isOpen ? (
                                    <ChevronUp size={16} style={{ color: '#94A3B8' }} />
                                ) : (
                                    <ChevronDown size={16} style={{ color: '#94A3B8' }} />
                                )}
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 border-t" style={{ borderColor: '#F1F5F9' }}>

                                    {/* Join Meeting CTA for URL-based locations */}
                                    {(meeting.location?.startsWith('http') || (meeting as any).meetingLink) && (
                                        <a
                                            href={
                                                meeting.location?.startsWith('http')
                                                    ? meeting.location
                                                    : (meeting as any).meetingLink
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 mt-4 mb-1 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#FFFFFF' }}
                                        >
                                            <Globe size={14} />
                                            Join Meeting
                                        </a>
                                    )}

                                    {meeting.description && (
                                        <p className="text-sm mt-3" style={{ color: '#475569' }}>
                                            {meeting.description}
                                        </p>
                                    )}
                                    {meeting.agenda && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>
                                                Agenda
                                            </p>
                                            <p className="text-sm" style={{ color: '#475569' }}>
                                                {meeting.agenda}
                                            </p>
                                        </div>
                                    )}
                                    {meeting.notes && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>
                                                Notes
                                            </p>
                                            <p className="text-sm" style={{ color: '#475569' }}>
                                                {meeting.notes}
                                            </p>
                                        </div>
                                    )}
                                    {meeting.actionItems && meeting.actionItems.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>
                                                Action Items
                                            </p>
                                            <div className="space-y-1">
                                                {meeting.actionItems.map((ai, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-sm">
                                                        {ai.completed
                                                            ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#22C55E' }} />
                                                            : <Circle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#94A3B8' }} />}
                                                        <span style={{ color: '#475569' }}>{ai.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <CommentsPanel
                                        projectId={projectId}
                                        entityType="meetings"
                                        entityId={meeting._id}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Credentials Tab ──────────────────────────────────────────────────────────

type CredSubTab = 'env' | 'ssh-key' | 'test-user' | 'account' | 'other';

const CRED_SUBTABS: { id: CredSubTab; label: string; icon: ReactNode; types: string[] }[] = [
    { id: 'env', label: 'Env Variables', icon: <Code size={13} />, types: ['env'] },
    { id: 'ssh-key', label: 'SSH Keys', icon: <TerminalSquare size={13} />, types: ['ssh-key'] },
    { id: 'test-user', label: 'Testing', icon: <UserIcon size={13} />, types: ['test-user'] },
    { id: 'account', label: 'Accounts', icon: <Users size={13} />, types: ['account'] },
    { id: 'other', label: 'Other', icon: <FileText size={13} />, types: ['other'] },
];

function useCopy() {
    const [copied, setCopied] = useState<string | null>(null);
    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };
    return { copied, copy };
}

// Keys that are too sensitive or irrelevant for clients — never shown
const HIDDEN_KEYS = new Set(['backupCodes', 'totpSecret']);

// Human-readable labels for known credential field keys
const FIELD_LABELS: Record<string, string> = {
    envKey: 'Key', envValue: 'Value',
    sshHost: 'Host', sshPort: 'Port', sshUser: 'Username',
    sshPrivateKey: 'Private Key', sshPassphrase: 'Passphrase',
    username: 'Username', password: 'Password', url: 'URL',
    apiKey: 'API Key', apiSecret: 'API Secret',
    fullName: 'Full Name', email: 'Email', role: 'Role',
    notes: 'Notes', details: 'Details', accountType: 'Type',
};
const fieldLabel = (key: string) =>
    FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^\w/, (c) => c.toUpperCase()).trim();

function PortalCredCard({ credential }: { credential: PortalCredential }) {
    const { copied, copy } = useCopy();
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});

    const SENSITIVE_KEYS = new Set([
        'envValue', 'sshPrivateKey', 'sshPassphrase', 'password',
        'apiKey', 'apiSecret', 'notes',
    ]);

    const creds = credential.credentials ?? {};
    // Filter out empty values AND fields that clients should never see
    const credEntries = Object.entries(creds).filter(([k, v]) => v && !HIDDEN_KEYS.has(k));

    const copyAll = () => {
        const text = credEntries.map(([k, v]) => `${k}: ${v}`).join('\n');
        copy(text, `all-${credential._id}`);
    };

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' }}>
                <div className="flex items-center gap-2 min-w-0">
                    <Lock size={14} style={{ color: '#6366F1' }} />
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{credential.name}</p>
                </div>
                <button
                    onClick={copyAll}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all flex-shrink-0"
                    style={{
                        borderColor: copied === `all-${credential._id}` ? '#22C55E' : '#E2E8F0',
                        color: copied === `all-${credential._id}` ? '#22C55E' : '#64748B',
                        backgroundColor: copied === `all-${credential._id}` ? '#F0FDF4' : 'transparent',
                    }}
                >
                    {copied === `all-${credential._id}` ? <Check size={11} /> : <Copy size={11} />}
                    {copied === `all-${credential._id}` ? 'Copied!' : 'Copy all'}
                </button>
            </div>
            {/* Fields */}
            {credEntries.length > 0 ? (
                <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {credEntries.map(([key, value]) => {
                        const isSensitive = SENSITIVE_KEYS.has(key);
                        const isRevealed = revealed[key];
                        const display = isSensitive && !isRevealed ? '••••••••' : String(value);
                        const copyId = `${credential._id}-${key}`;
                        return (
                            <div key={key} className="flex items-center px-4 py-2.5 gap-3 group" style={{ borderColor: '#F8FAFC' }}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#94A3B8' }}>
                                        {fieldLabel(key)}
                                    </p>
                                    <p className="text-xs font-mono truncate" style={{ color: '#1E293B' }}>{display}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {isSensitive && (
                                        <button
                                            onClick={() => setRevealed((r) => ({ ...r, [key]: !r[key] }))}
                                            className="p-1.5 rounded-lg transition-colors hover:bg-neutral-100"
                                            style={{ color: '#94A3B8' }}
                                        >
                                            {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => copy(String(value), copyId)}
                                        className="p-1.5 rounded-lg transition-colors hover:bg-neutral-100"
                                        style={{ color: copied === copyId ? '#22C55E' : '#94A3B8' }}
                                    >
                                        {copied === copyId ? <Check size={13} /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>No fields stored.</p>
            )}
            {credential.description && (
                <div className="px-4 pb-3 pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
                    <p className="text-xs" style={{ color: '#64748B' }}>{credential.description}</p>
                </div>
            )}
        </div>
    );
}

function CredentialsTab({ projectId }: { projectId: string }) {
    const [activeSubTab, setActiveSubTab] = useState<CredSubTab>('env');
    const { data, isLoading } = useGetPortalCredentialsQuery(projectId);
    const credentials = data?.data.credentials ?? [];

    if (isLoading) return <TabLoader />;
    if (credentials.length === 0) return <TabEmpty text="No credentials shared for this project." />;

    // Filter credentials by active sub-tab type
    const filtered = credentials.filter((c) => {
        const sub = CRED_SUBTABS.find((s) => s.id === activeSubTab);
        return sub?.types.includes(c.type) ?? false;
    });

    // Count per sub-tab
    const countFor = (sub: typeof CRED_SUBTABS[0]) =>
        credentials.filter((c) => sub.types.includes(c.type)).length;

    return (
        <div>
            {/* Sub-tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 mb-5">
                {CRED_SUBTABS.map((sub) => {
                    const count = countFor(sub);
                    const isActive = activeSubTab === sub.id;
                    return (
                        <button
                            key={sub.id}
                            onClick={() => setActiveSubTab(sub.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0 transition-all"
                            style={isActive
                                ? { background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#FFFFFF' }
                                : { backgroundColor: '#F1F5F9', color: '#64748B' }
                            }
                        >
                            {sub.icon}
                            {sub.label}
                            {count > 0 && (
                                <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={isActive
                                        ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFFFFF' }
                                        : { backgroundColor: '#E2E8F0', color: '#64748B' }
                                    }
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 ? (
                <TabEmpty text={`No ${CRED_SUBTABS.find(s => s.id === activeSubTab)?.label ?? 'credentials'} for this project.`} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {filtered.map((cred) => <PortalCredCard key={cred._id} credential={cred} />)}
                </div>
            )}
        </div>
    );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DownloadButton({ projectId, itemId, fileName }: { projectId: string; itemId: string; fileName: string }) {
    const [fetch, setFetch] = useState(false);
    const { data } = useGetPortalDocumentUrlQuery({ projectId, itemId }, { skip: !fetch });

    const handleDownload = async () => {
        if (data?.data.url) {
            window.open(data.data.url, '_blank');
        } else {
            setFetch(true);
        }
    };

    // When URL loads after first click, open it
    if (fetch && data?.data.url) {
        window.open(data.data.url, '_blank');
    }

    return (
        <button
            onClick={handleDownload}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: '#64748B' }}
            title={`Download ${fileName}`}
        >
            <Download size={14} />
        </button>
    );
}

function DocumentsTab({ projectId }: { projectId: string }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const { data, isLoading } = useGetPortalDocumentsQuery(projectId);
    const [uploadDoc] = useUploadPortalDocumentMutation();

    const items = data?.data.items ?? [];

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError('');
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await uploadDoc({ projectId, formData }).unwrap();
        } catch (err: any) {
            setUploadError(err?.data?.message ?? 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    if (isLoading) return <TabLoader />;

    return (
        <div>
            {/* Upload area */}
            <div
                className="rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center mb-5 text-center cursor-pointer transition-colors"
                style={{ borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#64748B';
                    e.currentTarget.style.backgroundColor = '#F1F5F9';
                }}
                onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        if (fileRef.current) fileRef.current.files = dt.files;
                        handleUpload({ target: fileRef.current } as any);
                    }
                }}
            >
                {uploading ? (
                    <>
                        <Loader2 size={20} className="animate-spin mb-2" style={{ color: '#64748B' }} />
                        <p className="text-sm" style={{ color: '#64748B' }}>Uploading…</p>
                    </>
                ) : (
                    <>
                        <Upload size={20} className="mb-2" style={{ color: '#94A3B8' }} />
                        <p className="text-sm font-medium" style={{ color: '#1E293B' }}>
                            Click to upload or drag &amp; drop
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                            Files are added to the Shared Files folder
                        </p>
                    </>
                )}
            </div>
            <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
            />

            {uploadError && (
                <p className="text-xs mb-3" style={{ color: '#EF4444' }}>
                    {uploadError}
                </p>
            )}

            {/* File list */}
            {items.length === 0 ? (
                <TabEmpty text="No files in the Shared Files folder yet." />
            ) : (
                <div className="space-y-2">
                    {items.map((item) => (
                        <div
                            key={item._id}
                            className="flex items-center gap-3 rounded-xl border p-3.5"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                        >
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#EFF6FF' }}
                            >
                                <FileText size={16} style={{ color: '#3B82F6' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                                    {item.name}
                                </p>
                                <p className="text-xs" style={{ color: '#94A3B8' }}>
                                    {formatBytes(item.size)} · {formatDate(item.createdAt)}
                                </p>
                            </div>
                            <DownloadButton
                                projectId={projectId}
                                itemId={item._id}
                                fileName={item.name}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TabLoader() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader2 size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
    );
}

function TabEmpty({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm" style={{ color: '#94A3B8' }}>
                {text}
            </p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Star size={14} /> },
    { key: 'tasks', label: 'Tasks', icon: <CheckCircle2 size={14} /> },
    { key: 'meetings', label: 'Meetings', icon: <Users size={14} /> },
    { key: 'credentials', label: 'Credentials', icon: <Lock size={14} /> },
    { key: 'documents', label: 'Files', icon: <FolderOpen size={14} /> },
];

export default function ClientPortalProjectDetailPage() {
    const { id: projectId } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const { data: projectData, isLoading } = useGetPortalProjectQuery(projectId!);
    const project = projectData?.data.project;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 size={22} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <p style={{ color: '#94A3B8' }}>Project not found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Project header */}
            <div className="px-6 pt-6 pb-0 flex-shrink-0" style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
                <div className="flex items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                            {project.name}
                        </h1>
                        {(project as any).description && (
                            <p className="text-sm mt-1 line-clamp-2" style={{ color: '#64748B' }}>
                                {(project as any).description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Underline tabs */}
                <div className="flex gap-0 overflow-x-auto -mb-px">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-2 px-4 py-3 text-sm font-medium flex-shrink-0 transition-colors border-b-2"
                            style={activeTab === tab.key
                                ? { color: '#6366F1', borderColor: '#6366F1' }
                                : { color: '#94A3B8', borderColor: 'transparent' }
                            }
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {activeTab === 'overview' && <OverviewTab projectId={projectId!} />}
                {activeTab === 'tasks' && <TasksTab projectId={projectId!} />}
                {activeTab === 'meetings' && <MeetingsTab projectId={projectId!} />}
                {activeTab === 'credentials' && <CredentialsTab projectId={projectId!} />}
                {activeTab === 'documents' && <DocumentsTab projectId={projectId!} />}
            </div>
        </div>
    );
}
