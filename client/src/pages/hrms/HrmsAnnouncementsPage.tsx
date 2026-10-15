import { useMemo, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
    Megaphone,
    Send,
    Trash2,
    Loader2,
    AlertTriangle,
    Pin,
    Eye,
    Bell,
    CheckCircle2,
    Globe,
    Building2,
    Users,
    Check,
    Search,
    X,
    BarChart3,
    Plus,
    MessageSquare,
    HelpCircle,
} from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import {
    useCreateAnnouncementMutation,
    useDeleteAnnouncementMutation,
    useGetAnnouncementsQuery,
    useAcknowledgeAnnouncementMutation,
    useNudgeUnseenAnnouncementMutation,
    useVoteAnnouncementPollMutation,
    useGetEmployeesQuery,
} from '@/features/hrms/hrmsApi';
import { useGetOrgSettingsQuery } from '@/features/overall-admin/api/adminApi';
import { dedupeDepartments, DEFAULT_DEPARTMENTS } from '@/utils/department';
import { hasModuleAdminAccess } from '@/utils/modulePermissions';
import type { Announcement } from '@/features/hrms/types/types';
import AnnouncementReceiptsModal from './components/AnnouncementReceiptsModal';

type AdminTab = 'create' | 'history';

function getRoleName(user: any): string {
    return user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
}

function formatAnnouncementDate(value: string) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function AnnouncementCard({
    announcement,
    canManage,
    onDelete,
    isDeleting,
    onViewReceipts,
    onQuickNudge,
    isNudging,
    onAcknowledge,
    isAcknowledging,
    onVote,
    isVoting,
}: {
    announcement: Announcement;
    canManage: boolean;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
    onViewReceipts?: (id: string, title: string, tab?: 'unseen' | 'seen' | 'poll') => void;
    onQuickNudge?: (id: string) => void;
    isNudging?: boolean;
    onAcknowledge?: (id: string) => void;
    isAcknowledging?: boolean;
    onVote?: (announcementId: string, optionId?: string, textResponse?: string) => void;
    isVoting?: boolean;
}) {
    const isUrgent = announcement.priority === 'urgent';
    const isPinned = Boolean(announcement.isPinned);
    const poll = announcement.poll;

    const acknowledgedCount = announcement.acknowledgedCount ?? 0;
    const totalTargeted = announcement.totalTargetedCount ?? 0;
    const pendingCount = Math.max(0, totalTargeted - acknowledgedCount);

    // Results are immediately visible to admin/publishers OR if the current user has voted
    const showResults = Boolean(canManage || poll?.hasVoted);

    const [feedbackText, setFeedbackText] = useState(poll?.userTextResponse || '');
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);

    useEffect(() => {
        if (poll?.userTextResponse) {
            setFeedbackText(poll.userTextResponse);
        }
    }, [poll?.userTextResponse]);

    return (
        <div
            className="rounded-2xl border p-5 sm:p-6 transition-all hover:shadow-xs"
            style={{
                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                borderColor: isUrgent ? '#FECACA' : 'var(--color-border-default, #e2e8f0)',
                boxShadow: isUrgent
                    ? '0 4px 15px -3px rgba(239, 68, 68, 0.08)'
                    : 'var(--shadow-xs)',
            }}
        >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    {/* Top Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        {/* Priority Badge */}
                        {isUrgent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle size={12} />
                                URGENT
                            </span>
                        ) : null}

                        {/* Pinned Badge */}
                        {isPinned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Pin size={11} />
                                Pinned
                            </span>
                        ) : null}

                        {/* Poll / Question Badge */}
                        {poll ? (
                            <button
                                type="button"
                                onClick={() =>
                                    canManage &&
                                    onViewReceipts?.(
                                        announcement._id,
                                        announcement.title || 'Company Announcement',
                                        'poll'
                                    )
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 transition-colors ${
                                    canManage
                                        ? 'hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                                        : ''
                                }`}
                                title={canManage ? 'Click to view who voted what' : undefined}
                            >
                                <BarChart3 size={11} />
                                {poll.pollType === 'text' ? 'Question' : 'Poll'} ({poll.totalVotes}{' '}
                                {poll.pollType === 'text' ? 'responses' : 'votes'})
                                {canManage && (
                                    <span className="text-[10px] text-emerald-600 font-semibold ml-0.5">
                                        · View
                                    </span>
                                )}
                            </button>
                        ) : null}

                        {/* Target Audience Badge */}
                        {announcement.targetType === 'department' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                <Building2 size={11} />
                                {announcement.targetDepartments?.join(', ') || 'Department'}
                            </span>
                        ) : announcement.targetType === 'users' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200">
                                <Users size={11} />
                                Specific Members (
                                {Array.isArray(announcement.targetUsers)
                                    ? announcement.targetUsers.length
                                    : 0}
                                )
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <Globe size={11} />
                                All Company
                            </span>
                        )}
                    </div>

                    {/* Announcement Headline / Icon */}
                    <div className="flex items-start gap-3 mb-2">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                                background: isUrgent
                                    ? 'linear-gradient(135deg,#EF4444,#F97316)'
                                    : 'linear-gradient(135deg,#059669,#0EA5E9)',
                                color: 'white',
                            }}
                        >
                            {isUrgent ? <AlertTriangle size={16} /> : <Megaphone size={16} />}
                        </div>
                        <div className="min-w-0">
                            <h3
                                className="text-base font-bold text-slate-900 leading-snug"
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                            >
                                {announcement.title || 'Company Announcement'}
                            </h3>
                            <p className="text-xs mt-0.5 text-slate-500">
                                {formatAnnouncementDate(announcement.createdAt)} · Published by{' '}
                                <span className="font-semibold text-slate-700">
                                    {announcement.publishedBy?.name || 'Admin'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Message Body */}
                    <div className="mt-3 pl-0 sm:pl-12">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 font-normal">
                            {announcement.content}
                        </p>

                        {/* Poll Card if present */}
                        {poll && (
                            <div className="mt-4 p-4 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/30 to-white max-w-xl shadow-2xs">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        {poll.pollType === 'text' ? (
                                            <HelpCircle size={15} className="text-emerald-600" />
                                        ) : (
                                            <BarChart3 size={15} className="text-emerald-600" />
                                        )}
                                        <h4 className="text-xs font-bold text-slate-900">
                                            {poll.question}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                        {poll.pollType === 'text'
                                            ? 'Open question'
                                            : poll.allowMultiple
                                            ? 'Multiple choices'
                                            : 'Single choice'}
                                    </span>
                                </div>

                                {/* Choice Poll Options */}
                                {poll.pollType !== 'text' && (
                                    <div className="space-y-2 mt-2.5">
                                        {poll.options.map((opt) => {
                                            const isSelected = poll.userVotedOptionIds?.includes(opt._id);
                                            const percent = opt.percentage || 0;

                                            return (
                                                <button
                                                    key={opt._id}
                                                    type="button"
                                                    onClick={() => onVote?.(announcement._id, opt._id)}
                                                    disabled={isVoting}
                                                    className={`relative w-full text-left p-3 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                                                        isSelected
                                                            ? 'border-emerald-500 bg-emerald-50/60 shadow-2xs'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                                                    }`}
                                                >
                                                    {/* Progress bar visible to admin or user who voted */}
                                                    {showResults && (
                                                        <div
                                                            className="absolute inset-y-0 left-0 bg-emerald-100/60 transition-all duration-500"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    )}

                                                    <div className="relative flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div
                                                                className={`w-4 h-4 rounded-${
                                                                    poll.allowMultiple ? 'md' : 'full'
                                                                } border flex items-center justify-center shrink-0 transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                                                        : 'border-slate-300 bg-white'
                                                                }`}
                                                            >
                                                                {isSelected && <Check size={11} strokeWidth={3} />}
                                                            </div>
                                                            <span
                                                                className={`text-xs truncate ${
                                                                    isSelected
                                                                        ? 'font-bold text-emerald-950'
                                                                        : 'font-medium text-slate-800'
                                                                }`}
                                                            >
                                                                {opt.text}
                                                            </span>
                                                        </div>

                                                        {/* Percentage & Vote Count visible to admin or user who voted */}
                                                        {showResults && (
                                                            <div className="flex items-center gap-1.5 shrink-0 text-right">
                                                                <span className="text-xs font-bold text-emerald-700">
                                                                    {percent}%
                                                                </span>
                                                                <span className="text-[11px] text-slate-400">
                                                                    ({opt.voteCount})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Choice Poll Comment / Feedback Area */}
                                {poll.pollType !== 'text' && poll.allowTextResponse && (
                                    <div className="mt-3 pt-2.5 border-t border-emerald-100/70">
                                        {poll.userTextResponse && !isEditingFeedback ? (
                                            <div className="p-2.5 rounded-xl bg-white border border-emerald-100 flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                                                        <MessageSquare size={11} /> Your comment:
                                                    </p>
                                                    <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">
                                                        {poll.userTextResponse}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingFeedback(true)}
                                                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer shrink-0"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                                    <MessageSquare size={12} className="text-emerald-600" />
                                                    <span>Add feedback or note with your vote:</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feedbackText}
                                                        onChange={(e) => setFeedbackText(e.target.value)}
                                                        placeholder="Type optional comments..."
                                                        className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={!feedbackText.trim() || isVoting}
                                                        onClick={async () => {
                                                            await onVote?.(
                                                                announcement._id,
                                                                undefined,
                                                                feedbackText.trim()
                                                            );
                                                            setIsEditingFeedback(false);
                                                        }}
                                                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Open-Ended Question Input / Response Area */}
                                {poll.pollType === 'text' && (
                                    <div className="mt-2.5">
                                        {poll.userTextResponse && !isEditingFeedback ? (
                                            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                                                        <Check size={13} className="text-emerald-600" /> Your Response
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingFeedback(true)}
                                                        className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                                    {poll.userTextResponse}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={feedbackText}
                                                    onChange={(e) => setFeedbackText(e.target.value)}
                                                    placeholder="Type your response or answer here..."
                                                    rows={2}
                                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500 leading-relaxed"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    {isEditingFeedback && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFeedbackText(poll.userTextResponse || '');
                                                                setIsEditingFeedback(false);
                                                            }}
                                                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={!feedbackText.trim() || isVoting}
                                                        onClick={async () => {
                                                            await onVote?.(
                                                                announcement._id,
                                                                undefined,
                                                                feedbackText.trim()
                                                            );
                                                            setIsEditingFeedback(false);
                                                        }}
                                                        className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                                                    >
                                                        {isVoting ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Send size={12} />
                                                        )}
                                                        {poll.userTextResponse
                                                            ? 'Update Response'
                                                            : 'Submit Response'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Poll Card Footer */}
                                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                                    <div className="flex items-center gap-2">
                                        <span>
                                            {poll.totalVotes}{' '}
                                            {poll.pollType === 'text'
                                                ? poll.totalVotes === 1
                                                    ? 'response'
                                                    : 'responses'
                                                : poll.totalVotes === 1
                                                ? 'vote'
                                                : 'votes'}{' '}
                                            cast
                                        </span>
                                        {canManage && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onViewReceipts?.(
                                                        announcement._id,
                                                        announcement.title || 'Company Announcement',
                                                        'poll'
                                                    )
                                                }
                                                className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer hover:underline inline-flex items-center gap-0.5"
                                            >
                                                View who voted what →
                                            </button>
                                        )}
                                    </div>
                                    {poll.hasVoted && (
                                        <span className="text-emerald-600 font-semibold">
                                            ✓ You {poll.pollType === 'text' ? 'responded' : 'voted'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Row: Read Receipts (Admin) or Acknowledgment Status (Employee) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-12">
                        {canManage ? (
                            /* Admin View: Read Stats and Receipts Trigger */
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        onViewReceipts?.(
                                            announcement._id,
                                            announcement.title || 'Company Announcement'
                                        )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                                    title="View who has seen this announcement"
                                >
                                    <Eye size={13} className="text-slate-500" />
                                    <span>
                                        Read Receipts:{' '}
                                        <strong className="text-emerald-700">
                                            {acknowledgedCount}
                                        </strong>
                                        {totalTargeted > 0 ? ` / ${totalTargeted}` : ''} Seen
                                    </span>
                                </button>

                                {pendingCount > 0 && onQuickNudge && (
                                    <button
                                        type="button"
                                        onClick={() => onQuickNudge(announcement._id)}
                                        disabled={isNudging}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer disabled:opacity-60"
                                        title="Send reminder notification to pending members"
                                    >
                                        {isNudging ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <Bell size={12} />
                                        )}
                                        Nudge Pending ({pendingCount})
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Employee View: Acknowledged or Mark as Read */
                            <div className="flex items-center gap-3">
                                {announcement.isAcknowledged ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 size={13} />
                                        Acknowledged
                                        {announcement.acknowledgedAt
                                            ? ` (${formatAnnouncementDate(announcement.acknowledgedAt)})`
                                            : ''}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onAcknowledge?.(announcement._id)}
                                        disabled={isAcknowledging}
                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl text-white transition-all cursor-pointer disabled:opacity-70 shadow-sm"
                                        style={{
                                            background: isUrgent
                                                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                                : 'linear-gradient(135deg, #10B981, #059669)',
                                        }}
                                    >
                                        {isAcknowledging ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                            <Check size={13} />
                                        )}
                                        Mark as Acknowledged
                                    </button>
                                )}
                            </div>
                        )}

                        {canManage && onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(announcement._id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 text-red-700 bg-red-50 hover:bg-red-100 border-red-200 ml-auto"
                            >
                                {isDeleting ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Trash2 size={13} />
                                )}
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function HrmsAnnouncementsPage() {
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const roleName = getRoleName(user);
    const isPartner = roleName === 'partner' || !!user?.isPartnerEmployee;
    const isHrAdmin = [
        'super-admin',
        'admin',
        'super_admin',
        'hr',
        'hr-admin',
        'hr_admin',
        'hr-manager',
        'hrmanager',
        'human-resources',
    ].includes(roleName) || hasModuleAdminAccess(user, 'hrms') || hasModuleAdminAccess(user, 'overallAdmin');

    const isAdminSide = location.pathname.startsWith('/hrms/') || ((location.pathname === '/announcements' || location.pathname.startsWith('/my-hrms/announcements')) && isHrAdmin);

    const [activeTab, setActiveTab] = useState<AdminTab>('create');

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
    const [isPinned, setIsPinned] = useState(false);
    const [targetType, setTargetType] = useState<'all' | 'department' | 'users'>('all');
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Poll creation state
    const [includePoll, setIncludePoll] = useState(false);
    const [pollType, setPollType] = useState<'choice' | 'text'>('choice');
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
    const [pollAllowTextResponse, setPollAllowTextResponse] = useState(false);

    // Modal state for Read Receipts & Poll Breakdown
    const [receiptModalId, setReceiptModalId] = useState<string | null>(null);
    const [receiptModalTitle, setReceiptModalTitle] = useState('');
    const [receiptModalTab, setReceiptModalTab] = useState<'unseen' | 'seen' | 'poll'>('unseen');

    // Queries & Mutations
    const { data, isLoading, isFetching } = useGetAnnouncementsQuery(undefined, {
        skip: isPartner,
    });
    const [createAnnouncement, { isLoading: isPublishing }] = useCreateAnnouncementMutation();
    const [deleteAnnouncement, { isLoading: isDeleting }] = useDeleteAnnouncementMutation();
    const [acknowledgeAnnouncement, { isLoading: isAcknowledging }] =
        useAcknowledgeAnnouncementMutation();
    const [nudgeUnseen, { isLoading: isNudging }] = useNudgeUnseenAnnouncementMutation();
    const [votePoll, { isLoading: isVoting }] = useVoteAnnouncementPollMutation();

    // Query active employees and departments for targeting selectors
    const { data: orgSettingsData } = useGetOrgSettingsQuery();
    const { data: employeesData } = useGetEmployeesQuery(
        { status: 'active', limit: 200 },
        { skip: !isAdminSide }
    );

    const availableDepartments = useMemo(() => {
        const configured = orgSettingsData?.data?.departments;
        return dedupeDepartments(configured && configured.length > 0 ? configured : DEFAULT_DEPARTMENTS);
    }, [orgSettingsData]);

    const activeEmployees = useMemo(() => {
        return employeesData?.data?.employees || [];
    }, [employeesData]);

    const filteredEmployeeOptions = useMemo(() => {
        if (!userSearchTerm.trim()) return activeEmployees;
        const q = userSearchTerm.toLowerCase();
        return activeEmployees.filter(
            (emp) =>
                emp.userId?.name?.toLowerCase().includes(q) ||
                emp.userId?.email?.toLowerCase().includes(q) ||
                emp.department?.toLowerCase().includes(q) ||
                emp.designation?.toLowerCase().includes(q)
        );
    }, [activeEmployees, userSearchTerm]);

    const announcements = useMemo(() => data?.data?.announcements || [], [data]);

    if (isPartner) return <Navigate to="/dashboard" replace />;
    if (isAdminSide && !isHrAdmin) return <Navigate to="/my-hrms/announcements" replace />;

    const toggleDepartment = (dept: string) => {
        setSelectedDepartments((prev) =>
            prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
        );
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleAddPollOption = () => {
        if (pollOptions.length < 6) {
            setPollOptions((prev) => [...prev, '']);
        }
    };

    const handleRemovePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            setPollOptions((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const handlePollOptionChange = (index: number, val: string) => {
        setPollOptions((prev) => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleVoteFromCard = async (
        announcementId: string,
        optionId?: string,
        textResponse?: string
    ) => {
        const ann = announcements.find((a) => a._id === announcementId);
        if (!ann || !ann.poll || isVoting) return;

        let nextSelected: string[] | undefined = undefined;
        if (optionId) {
            if (ann.poll.allowMultiple) {
                const currentSelected = ann.poll.userVotedOptionIds || [];
                if (currentSelected.includes(optionId)) {
                    nextSelected = currentSelected.filter((id) => id !== optionId);
                    if (nextSelected.length === 0 && !textResponse) return;
                } else {
                    nextSelected = [...currentSelected, optionId];
                }
            } else {
                nextSelected = [optionId];
            }
        }

        try {
            await votePoll({
                announcementId,
                optionIds: nextSelected,
                textResponse,
            }).unwrap();
        } catch {
            // Handled
        }
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            setErrorMessage('Please write the announcement content before publishing.');
            return;
        }

        if (targetType === 'department' && selectedDepartments.length === 0) {
            setErrorMessage('Please select at least one department for department-targeted announcement.');
            return;
        }

        if (targetType === 'users' && selectedUserIds.length === 0) {
            setErrorMessage('Please select at least one team member for user-targeted announcement.');
            return;
        }

        let pollPayload: any = undefined;
        if (includePoll) {
            const trimmedQuestion = pollQuestion.trim();
            if (!trimmedQuestion) {
                setErrorMessage('Please enter a question or prompt for the poll.');
                return;
            }
            if (pollType === 'choice') {
                const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
                if (cleanOptions.length < 2) {
                    setErrorMessage('Please provide at least 2 non-empty options for the poll.');
                    return;
                }
                pollPayload = {
                    question: trimmedQuestion,
                    pollType: 'choice',
                    options: cleanOptions,
                    allowMultiple: pollAllowMultiple,
                    allowTextResponse: pollAllowTextResponse,
                };
            } else {
                pollPayload = {
                    question: trimmedQuestion,
                    pollType: 'text',
                    options: [],
                    allowMultiple: false,
                    allowTextResponse: true,
                };
            }
        }

        try {
            setErrorMessage('');
            await createAnnouncement({
                title: title.trim() || 'Company Announcement',
                content: trimmedContent,
                priority,
                isPinned,
                targetType,
                targetDepartments: targetType === 'department' ? selectedDepartments : [],
                targetUsers: targetType === 'users' ? selectedUserIds : [],
                poll: pollPayload,
            }).unwrap();

            // Reset form
            setTitle('');
            setContent('');
            setPriority('normal');
            setIsPinned(false);
            setTargetType('all');
            setSelectedDepartments([]);
            setSelectedUserIds([]);
            setUserSearchTerm('');
            setIncludePoll(false);
            setPollType('choice');
            setPollQuestion('');
            setPollOptions(['', '']);
            setPollAllowMultiple(false);
            setPollAllowTextResponse(false);
            setActiveTab('history');
        } catch (error: any) {
            setErrorMessage(error?.data?.message || 'Failed to publish announcement.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await deleteAnnouncement(id).unwrap();
        } catch (error: any) {
            setErrorMessage(error?.data?.message || 'Failed to delete announcement.');
        }
    };

    const handleQuickNudge = async (id: string) => {
        try {
            await nudgeUnseen(id).unwrap();
        } catch {
            // Handled
        }
    };

    const handleAcknowledge = async (id: string) => {
        try {
            await acknowledgeAnnouncement(id).unwrap();
        } catch {
            // Handled
        }
    };

    const openReceiptsModal = (
        id: string,
        annTitle: string,
        tab: 'unseen' | 'seen' | 'poll' = 'unseen'
    ) => {
        setReceiptModalId(id);
        setReceiptModalTitle(annTitle);
        setReceiptModalTab(tab);
    };

    return (
        <div className="mx-auto page-enter" style={{ maxWidth: '1080px' }}>
            {/* Page Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1
                        className="text-2xl font-bold tracking-tight text-slate-900"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                        {isAdminSide ? 'Company Announcements' : 'Announcements'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isAdminSide
                            ? 'Broadcast targeted announcements, create team votes & polls, track read receipts, and nudge pending members.'
                            : 'Stay updated with company notices, participate in team polls, and mark announcements acknowledged.'}
                    </p>
                </div>
            </div>

            {/* Admin Tabs */}
            {isAdminSide ? (
                <>
                    <div className="flex gap-2 mb-6">
                        {[
                            { key: 'create' as const, label: 'Make an Announcement' },
                            {
                                key: 'history' as const,
                                label: `Previous Announcements (${announcements.length})`,
                            },
                        ].map((tab) => {
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
                                    style={
                                        active
                                            ? {
                                                  backgroundColor: 'var(--color-primary-soft, #ECFDF5)',
                                                  borderColor: 'var(--color-primary, #10B981)',
                                                  color: 'var(--color-primary-darker, #047857)',
                                              }
                                            : {
                                                  backgroundColor: 'var(--color-bg-surface, #ffffff)',
                                                  borderColor: 'var(--color-border-default, #e2e8f0)',
                                                  color: 'var(--color-text-secondary, #64748b)',
                                              }
                                    }
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Announcement Creation Form */}
                    {activeTab === 'create' ? (
                        <div
                            className="rounded-2xl border p-6 sm:p-7 shadow-xs"
                            style={{
                                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                                borderColor: 'var(--color-border-default, #e2e8f0)',
                            }}
                        >
                            <form onSubmit={handlePublish} className="space-y-6">
                                {/* Title / Headline */}
                                <div>
                                    <label
                                        htmlFor="announcement-title"
                                        className="block text-sm font-semibold text-slate-900 mb-2"
                                    >
                                        Announcement Headline / Title
                                    </label>
                                    <input
                                        id="announcement-title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Q4 Town Hall Meeting, Office Holiday Notice..."
                                        maxLength={150}
                                        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors border-slate-200 bg-slate-50/70"
                                    />
                                </div>

                                {/* Content Body */}
                                <div>
                                    <label
                                        htmlFor="announcement-content"
                                        className="block text-sm font-semibold text-slate-900 mb-2"
                                    >
                                        Announcement Message <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        id="announcement-content"
                                        required
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Write your announcement details here. Recipients will view this in their feed and in an unread popup modal..."
                                        rows={6}
                                        className="w-full rounded-2xl border px-4 py-3 text-sm resize-y outline-none transition-colors leading-relaxed border-slate-200 bg-slate-50/70"
                                    />
                                </div>

                                {/* Priority & Pinning Options */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Priority Level */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                                            Priority Level
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPriority('normal')}
                                                className="flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                                style={
                                                    priority === 'normal'
                                                        ? {
                                                              backgroundColor: '#F0FDF4',
                                                              borderColor: '#22C55E',
                                                              color: '#15803D',
                                                          }
                                                        : {
                                                              backgroundColor: 'transparent',
                                                              borderColor: '#e2e8f0',
                                                              color: '#64748b',
                                                          }
                                                }
                                            >
                                                <Megaphone size={14} />
                                                Normal
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPriority('urgent')}
                                                className="flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                                style={
                                                    priority === 'urgent'
                                                        ? {
                                                              backgroundColor: '#FEF2F2',
                                                              borderColor: '#EF4444',
                                                              color: '#B91C1C',
                                                          }
                                                        : {
                                                              backgroundColor: 'transparent',
                                                              borderColor: '#e2e8f0',
                                                              color: '#64748b',
                                                          }
                                                }
                                            >
                                                <AlertTriangle size={14} />
                                                Urgent (Requires Ack)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pin Announcement */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                                            Pinning
                                        </label>
                                        <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={isPinned}
                                                onChange={(e) => setIsPinned(e.target.checked)}
                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                                <Pin size={13} className="text-emerald-600" />
                                                Pin announcement to the top of feed
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Target Audience Selector */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                                        Target Audience
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            {
                                                type: 'all' as const,
                                                label: 'All Company',
                                                description: 'Every active employee & admin',
                                                icon: Globe,
                                            },
                                            {
                                                type: 'department' as const,
                                                label: 'Specific Department(s)',
                                                description: 'Target by department',
                                                icon: Building2,
                                            },
                                            {
                                                type: 'users' as const,
                                                label: 'Specific Team Members',
                                                description: 'Select individual employees',
                                                icon: Users,
                                            },
                                        ].map((opt) => {
                                            const active = targetType === opt.type;
                                            const Icon = opt.icon;
                                            return (
                                                <div
                                                    key={opt.type}
                                                    onClick={() => setTargetType(opt.type)}
                                                    className="p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between"
                                                    style={
                                                        active
                                                            ? {
                                                                  backgroundColor: '#ECFDF5',
                                                                  borderColor: '#10B981',
                                                                  boxShadow: '0 0 0 1px #10B981',
                                                              }
                                                            : {
                                                                  backgroundColor: '#f8fafc',
                                                                  borderColor: '#e2e8f0',
                                                              }
                                                    }
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <Icon
                                                                size={16}
                                                                className={
                                                                    active ? 'text-emerald-600' : 'text-slate-500'
                                                                }
                                                            />
                                                            <span className="text-xs font-bold text-slate-900">
                                                                {opt.label}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                                active
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                                                    : 'border-slate-300'
                                                            }`}
                                                        >
                                                            {active && <Check size={10} />}
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500">
                                                        {opt.description}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Department multi-select */}
                                    {targetType === 'department' && (
                                        <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                                            <p className="text-xs font-semibold text-slate-800 mb-2.5">
                                                Select Departments ({selectedDepartments.length} selected):
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableDepartments.map((dept) => {
                                                    const isSelected = selectedDepartments.includes(dept);
                                                    return (
                                                        <button
                                                            key={dept}
                                                            type="button"
                                                            onClick={() => toggleDepartment(dept)}
                                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5"
                                                            style={
                                                                isSelected
                                                                    ? {
                                                                          backgroundColor: '#10B981',
                                                                          borderColor: '#10B981',
                                                                          color: '#ffffff',
                                                                      }
                                                                    : {
                                                                          backgroundColor: '#ffffff',
                                                                          borderColor: '#CBD5E1',
                                                                          color: '#334155',
                                                                      }
                                                            }
                                                        >
                                                            {isSelected && <Check size={12} />}
                                                            {dept}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* User multi-select */}
                                    {targetType === 'users' && (
                                        <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                                            <div className="flex items-center justify-between mb-2.5 gap-2">
                                                <p className="text-xs font-semibold text-slate-800">
                                                    Select Team Members ({selectedUserIds.length} selected):
                                                </p>
                                                {selectedUserIds.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedUserIds([])}
                                                        className="text-[11px] text-emerald-600 hover:underline font-semibold"
                                                    >
                                                        Clear all
                                                    </button>
                                                )}
                                            </div>

                                            <div className="relative mb-3">
                                                <Search
                                                    size={14}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Search by name, role, or department..."
                                                    value={userSearchTerm}
                                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none"
                                                />
                                            </div>

                                            {selectedUserIds.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto p-1">
                                                    {selectedUserIds.map((uid) => {
                                                        const emp = activeEmployees.find(
                                                            (e) => e.userId?._id === uid
                                                        );
                                                        return (
                                                            <span
                                                                key={uid}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                            >
                                                                {emp?.userId?.name || 'Employee'}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleUser(uid)}
                                                                    className="hover:text-emerald-950 cursor-pointer"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-white rounded-xl border border-slate-200 p-2">
                                                {filteredEmployeeOptions.length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-4">
                                                        No matching team members found
                                                    </p>
                                                ) : (
                                                    filteredEmployeeOptions.map((emp) => {
                                                        const uid = emp.userId?._id;
                                                        if (!uid) return null;
                                                        const isSelected = selectedUserIds.includes(uid);
                                                        return (
                                                            <div
                                                                key={emp._id}
                                                                onClick={() => toggleUser(uid)}
                                                                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}}
                                                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-slate-800 truncate">
                                                                            {emp.userId.name}
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-500 truncate">
                                                                            {emp.designation} · {emp.department}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Team Poll / Voting Section */}
                                <div className="p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 size={18} className="text-emerald-600" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">
                                                    Interactive Poll / Vote
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Collect instant feedback and votes from your team
                                                </p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={includePoll}
                                                onChange={(e) => setIncludePoll(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                                        </label>
                                    </div>

                                    {includePoll && (
                                        <div className="pt-3 border-t border-emerald-100 space-y-4">
                                            {/* Poll Format Selector */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-800 mb-2">
                                                    Poll Format
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPollType('choice')}
                                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                                                            pollType === 'choice'
                                                                ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <BarChart3
                                                            size={16}
                                                            className={
                                                                pollType === 'choice'
                                                                    ? 'text-emerald-600 shrink-0 mt-0.5'
                                                                    : 'text-slate-400 shrink-0 mt-0.5'
                                                            }
                                                        />
                                                        <div>
                                                            <p
                                                                className={`text-xs font-bold ${
                                                                    pollType === 'choice'
                                                                        ? 'text-emerald-950'
                                                                        : 'text-slate-800'
                                                                }`}
                                                            >
                                                                Choice Poll (Options)
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                                Members vote on defined options (e.g. Yes/No, Dates)
                                                            </p>
                                                        </div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setPollType('text')}
                                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                                                            pollType === 'text'
                                                                ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <HelpCircle
                                                            size={16}
                                                            className={
                                                                pollType === 'text'
                                                                    ? 'text-emerald-600 shrink-0 mt-0.5'
                                                                    : 'text-slate-400 shrink-0 mt-0.5'
                                                            }
                                                        />
                                                        <div>
                                                            <p
                                                                className={`text-xs font-bold ${
                                                                    pollType === 'text'
                                                                        ? 'text-emerald-950'
                                                                        : 'text-slate-800'
                                                                }`}
                                                            >
                                                                Open Question / Feedback
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                                Ask for member input, suggestions, or text responses
                                                            </p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                                                    {pollType === 'text' ? 'Question or Prompt' : 'Poll Question'}{' '}
                                                    <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={pollQuestion}
                                                    onChange={(e) => setPollQuestion(e.target.value)}
                                                    placeholder={
                                                        pollType === 'text'
                                                            ? 'e.g. What suggestions do you have for the upcoming project kickoff?'
                                                            : 'e.g. Which date works best for the quarterly team outing?'
                                                    }
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none"
                                                />
                                            </div>

                                            {pollType === 'choice' ? (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                                                            Poll Options (min 2, max 6)
                                                        </label>
                                                        <div className="space-y-2">
                                                            {pollOptions.map((opt, idx) => (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold text-slate-400 w-5">
                                                                        {idx + 1}.
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        value={opt}
                                                                        onChange={(e) =>
                                                                            handlePollOptionChange(idx, e.target.value)
                                                                        }
                                                                        placeholder={`Option ${idx + 1}...`}
                                                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs outline-none"
                                                                    />
                                                                    {pollOptions.length > 2 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemovePollOption(idx)}
                                                                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                                                                            title="Remove option"
                                                                        >
                                                                            <X size={15} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {pollOptions.length < 6 && (
                                                            <button
                                                                type="button"
                                                                onClick={handleAddPollOption}
                                                                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                                                            >
                                                                <Plus size={13} />
                                                                Add Option
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2 pt-1">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={pollAllowMultiple}
                                                                onChange={(e) =>
                                                                    setPollAllowMultiple(e.target.checked)
                                                                }
                                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                            />
                                                            <span className="text-xs font-semibold text-slate-700">
                                                                Allow team members to select multiple choices
                                                            </span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={pollAllowTextResponse}
                                                                onChange={(e) =>
                                                                    setPollAllowTextResponse(e.target.checked)
                                                                }
                                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                            />
                                                            <span className="text-xs font-semibold text-slate-700">
                                                                Allow team members to add comments / feedback with their vote
                                                            </span>
                                                        </label>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-slate-600 leading-relaxed">
                                                    💡 Team members will be prompted to type their answer directly. All user responses will be tracked and visible in the <strong>Receipts & Responses</strong> modal.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Form Actions */}
                                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-500">
                                        Targeted recipients will receive an instant push notification and unread announcement popup.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={isPublishing}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 shadow-md shrink-0"
                                        style={{
                                            background: 'linear-gradient(135deg,#059669,#0EA5E9)',
                                        }}
                                    >
                                        {isPublishing ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Send size={16} />
                                        )}
                                        Publish Announcement
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : null}
                </>
            ) : null}

            {/* Error Message banner */}
            {errorMessage && (
                <div
                    className="rounded-xl px-4 py-3 mb-5 text-sm flex items-center justify-between gap-2"
                    style={{
                        backgroundColor: '#FEF2F2',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                    }}
                >
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        onClick={() => setErrorMessage('')}
                        className="text-red-600 hover:text-red-800"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Announcements List Feed (History Tab for Admin, Main View for Employee) */}
            {(!isAdminSide || activeTab === 'history') && (
                <div className={isAdminSide ? 'mt-6' : ''}>
                    {isLoading || isFetching ? (
                        <div
                            className="rounded-2xl border p-12 flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                                borderColor: 'var(--color-border-default, #e2e8f0)',
                            }}
                        >
                            <Loader2
                                size={18}
                                className="animate-spin"
                                style={{ color: 'var(--color-primary, #10B981)' }}
                            />
                            <span
                                className="text-sm"
                                style={{ color: 'var(--color-text-muted, #64748b)' }}
                            >
                                Loading announcements...
                            </span>
                        </div>
                    ) : announcements.length === 0 ? (
                        <div
                            className="rounded-2xl border p-12 text-center"
                            style={{
                                backgroundColor: 'var(--color-bg-surface, #ffffff)',
                                borderColor: 'var(--color-border-default, #e2e8f0)',
                            }}
                        >
                            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-slate-100 text-slate-400">
                                <Megaphone size={26} />
                            </div>
                            <p className="text-base font-bold text-slate-800 mb-1">
                                No announcements yet
                            </p>
                            <p className="text-sm text-slate-500">
                                {isAdminSide
                                    ? 'Published announcements will appear here with delivery stats and read receipts.'
                                    : 'Company announcements will appear here once published by management.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {announcements.map((announcement) => (
                                <AnnouncementCard
                                    key={announcement._id}
                                    announcement={announcement}
                                    canManage={isAdminSide}
                                    onDelete={handleDelete}
                                    isDeleting={isDeleting}
                                    onViewReceipts={openReceiptsModal}
                                    onQuickNudge={handleQuickNudge}
                                    isNudging={isNudging}
                                    onAcknowledge={handleAcknowledge}
                                    isAcknowledging={isAcknowledging}
                                    onVote={handleVoteFromCard}
                                    isVoting={isVoting}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Read Receipts & Poll Breakdown Modal */}
            <AnnouncementReceiptsModal
                announcementId={receiptModalId}
                announcementTitle={receiptModalTitle}
                initialTab={receiptModalTab}
                onClose={() => setReceiptModalId(null)}
            />
        </div>
    );
}
