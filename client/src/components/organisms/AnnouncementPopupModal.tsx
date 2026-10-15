import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Megaphone,
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Calendar,
    User,
    Building2,
    Pin,
    BarChart3,
    Check,
    MessageSquare,
    HelpCircle,
    Send,
} from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { socket } from '@/services/socket';
import {
    useGetUnreadAnnouncementsQuery,
    useAcknowledgeAnnouncementMutation,
    useVoteAnnouncementPollMutation,
} from '@/features/hrms/hrmsApi';
import type { Announcement } from '@/features/hrms/types/types';

function formatDate(value: string) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function AnnouncementPopupModal() {
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner' || !!user?.isPartnerEmployee;
    const canManage = [
        'super-admin',
        'admin',
        'super_admin',
        'hr',
        'hr-admin',
        'hr_admin',
        'hr-manager',
        'hrmanager',
        'human-resources',
    ].includes(roleName);

    // Dismissed announcements for this browser session (if user clicked "Remind me later" on non-urgent ones)
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);

    const { data, refetch } = useGetUnreadAnnouncementsQuery(undefined, {
        skip: !isAuthenticated || isPartner,
        pollingInterval: 60000,
    });

    const [acknowledgeAnnouncement, { isLoading: isAcknowledging }] =
        useAcknowledgeAnnouncementMutation();
    const [votePoll, { isLoading: isVoting }] = useVoteAnnouncementPollMutation();

    // Listen for real-time announcements & poll updates from socket
    useEffect(() => {
        if (!isAuthenticated || isPartner) return;

        const handleNewAnnouncement = () => {
            refetch();
        };

        const handlePollUpdated = () => {
            refetch();
        };

        socket.on('announcement:new', handleNewAnnouncement);
        socket.on('announcement:pollUpdated', handlePollUpdated);

        return () => {
            socket.off('announcement:new', handleNewAnnouncement);
            socket.off('announcement:pollUpdated', handlePollUpdated);
        };
    }, [isAuthenticated, isPartner, refetch]);

    const unreadList: Announcement[] = useMemo(() => {
        const raw = data?.data?.announcements || [];
        return raw.filter((item) => !dismissedIds.has(item._id));
    }, [data?.data?.announcements, dismissedIds]);

    // Keep currentIndex in bounds
    useEffect(() => {
        if (currentIndex >= unreadList.length && unreadList.length > 0) {
            setCurrentIndex(unreadList.length - 1);
        }
    }, [unreadList.length, currentIndex]);

    const currentAnnouncement = unreadList[currentIndex];

    const [feedbackText, setFeedbackText] = useState('');
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);

    useEffect(() => {
        setFeedbackText(currentAnnouncement?.poll?.userTextResponse || '');
        setIsEditingFeedback(false);
    }, [currentAnnouncement?._id, currentAnnouncement?.poll?.userTextResponse]);

    const handleAcknowledge = useCallback(async () => {
        if (!currentAnnouncement) return;
        try {
            await acknowledgeAnnouncement(currentAnnouncement._id).unwrap();
        } catch {
            // Handled in API
        }
    }, [currentAnnouncement, acknowledgeAnnouncement]);

    const handleRemindLater = useCallback(() => {
        if (!currentAnnouncement) return;
        if (currentAnnouncement.priority !== 'urgent') {
            setDismissedIds((prev) => new Set([...prev, currentAnnouncement._id]));
        }
    }, [currentAnnouncement]);

    const handleOptionVote = async (optionId?: string, textResponse?: string) => {
        if (!currentAnnouncement || !currentAnnouncement.poll || isVoting) return;
        const poll = currentAnnouncement.poll;
        let nextSelected: string[] | undefined = undefined;

        if (optionId) {
            if (poll.allowMultiple) {
                const currentSelected = poll.userVotedOptionIds || [];
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
                announcementId: currentAnnouncement._id,
                optionIds: nextSelected,
                textResponse,
            }).unwrap();
        } catch {
            // Handled
        }
    };

    // Prevent body scrolling while popup modal is visible
    useEffect(() => {
        if (!isAuthenticated || isPartner || unreadList.length === 0 || !currentAnnouncement) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isAuthenticated, isPartner, unreadList.length, currentAnnouncement]);

    if (!isAuthenticated || isPartner || unreadList.length === 0 || !currentAnnouncement) {
        return null;
    }
    if (typeof document === 'undefined') return null;

    const isUrgent = currentAnnouncement.priority === 'urgent';
    const isPinned = Boolean(currentAnnouncement.isPinned);
    const poll = currentAnnouncement.poll;
    const showResults = Boolean(canManage || poll?.hasVoted);

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.72)',
                backdropFilter: 'blur(8px)',
            }}
        >
            <div
                className="relative w-full max-w-xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    backgroundColor: 'var(--color-bg-surface, #ffffff)',
                    borderColor: isUrgent ? '#FCA5A5' : 'var(--color-border-default, #e2e8f0)',
                    boxShadow: isUrgent
                        ? '0 20px 45px -10px rgba(239, 68, 68, 0.25), 0 0 0 1px rgba(239, 68, 68, 0.2)'
                        : '0 20px 45px -10px rgba(0, 0, 0, 0.15)',
                }}
            >
                {/* Top Banner Accent */}
                <div
                    className="h-1.5 w-full shrink-0"
                    style={{
                        background: isUrgent
                            ? 'linear-gradient(90deg, #EF4444, #F97316)'
                            : 'linear-gradient(90deg, #10B981, #0EA5E9)',
                    }}
                />

                {/* Header Section */}
                <div className="p-5 sm:p-6 pb-2.5 shrink-0">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Priority Badge */}
                            {isUrgent ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                    <AlertTriangle size={13} />
                                    URGENT ANNOUNCEMENT
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Megaphone size={13} />
                                    COMPANY ANNOUNCEMENT
                                </span>
                            )}

                            {isPinned && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Pin size={11} />
                                    Pinned
                                </span>
                            )}

                            {currentAnnouncement.targetType === 'department' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    <Building2 size={11} />
                                    {currentAnnouncement.targetDepartments?.join(', ') || 'Department'}
                                </span>
                            )}
                        </div>

                        {/* Top counter badge */}
                        {unreadList.length > 1 && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/60">
                                {currentIndex + 1} of {unreadList.length}
                            </span>
                        )}
                    </div>

                    {/* Announcement Headline */}
                    <h3
                        className="text-xl font-bold text-slate-900 mb-1.5 leading-snug"
                        style={{ fontFamily: 'Outfit, sans-serif' }}
                    >
                        {currentAnnouncement.title || 'Company Announcement'}
                    </h3>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pb-2.5 border-b border-slate-100">
                        <span className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400" />
                            {currentAnnouncement.publishedBy?.name || 'Management'}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            {formatDate(currentAnnouncement.createdAt)}
                        </span>
                    </div>
                </div>

                {/* Announcement Content & Poll Area */}
                <div className="px-5 sm:px-6 pt-1 pb-4 flex-1 min-h-0 overflow-y-auto space-y-4">
                    {/* Message Body */}
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                        {currentAnnouncement.content}
                    </p>

                    {/* Poll / Voting Card */}
                    {poll && (
                        <div className="mt-4 p-4 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/30 to-white shadow-xs">
                            <div className="flex items-center justify-between gap-2 mb-2.5">
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

                            {/* Options List for Choice Polls */}
                            {poll.pollType !== 'text' && (
                                <div className="space-y-2 mt-3">
                                    {poll.options.map((opt) => {
                                        const isSelected = poll.userVotedOptionIds?.includes(opt._id);
                                        const percent = opt.percentage || 0;

                                        return (
                                            <button
                                                key={opt._id}
                                                type="button"
                                                onClick={() => handleOptionVote(opt._id)}
                                                disabled={isVoting}
                                                className={`relative w-full text-left p-3 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                                                    isSelected
                                                        ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                                                }`}
                                            >
                                                {/* Filled Progress Bar if user has voted or admin */}
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

                                                    {/* Percentage / Vote Count */}
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

                            {/* Comment Area for Choice Poll with allowTextResponse */}
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
                                                <span>Add comment with your vote:</span>
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
                                                        await handleOptionVote(
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
                                                            setFeedbackText(
                                                                poll.userTextResponse || ''
                                                            );
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
                                                        await handleOptionVote(
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

                            {/* Poll Footer */}
                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
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
                                {poll.hasVoted && (
                                    <span className="text-emerald-600 font-semibold">
                                        ✓ Your {poll.pollType === 'text' ? 'response' : 'vote'} is recorded
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Clean, Polished & Perfectly Proportioned Footer */}
                <div
                    className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0"
                    style={{
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderColor: 'var(--color-border-default, #e2e8f0)',
                    }}
                >
                    {/* Left: Sleek Carousel Navigation if multiple */}
                    {unreadList.length > 1 ? (
                        <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                                disabled={currentIndex === 0}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                aria-label="Previous announcement"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-semibold text-slate-600 px-1.5 select-none">
                                {currentIndex + 1} / {unreadList.length}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentIndex((prev) =>
                                        Math.min(unreadList.length - 1, prev + 1)
                                    )
                                }
                                disabled={currentIndex === unreadList.length - 1}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                aria-label="Next announcement"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="hidden sm:block text-xs text-slate-400 font-medium">
                            {isUrgent ? (
                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Acknowledgment required
                                </span>
                            ) : (
                                <span>Official Company Update</span>
                            )}
                        </div>
                    )}

                    {/* Right: Actions with uniform 40px height */}
                    <div className="flex items-center gap-2.5 ml-auto">
                        {!isUrgent && (
                            <button
                                type="button"
                                onClick={handleRemindLater}
                                className="h-10 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer select-none"
                            >
                                Remind Me Later
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleAcknowledge}
                            disabled={isAcknowledging}
                            className="h-10 px-5 text-xs font-bold rounded-xl text-white transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 shadow-sm hover:shadow active:scale-98 flex items-center justify-center gap-2 select-none"
                            style={{
                                background: isUrgent
                                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                    : 'linear-gradient(135deg, #10B981, #059669)',
                            }}
                        >
                            {isAcknowledging ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <CheckCircle2 size={15} />
                            )}
                            I Have Read & Acknowledge
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
