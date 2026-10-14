import { useState, useMemo, useEffect } from 'react';
import {
    X,
    Eye,
    Clock,
    Bell,
    Search,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Users,
    BarChart3,
    MessageSquare,
    HelpCircle,
} from 'lucide-react';
import {
    useGetAnnouncementReceiptsQuery,
    useNudgeUnseenAnnouncementMutation,
} from '@/features/hrms/hrmsApi';

interface AnnouncementReceiptsModalProps {
    announcementId: string | null;
    announcementTitle?: string;
    initialTab?: 'unseen' | 'seen' | 'poll';
    onClose: () => void;
}

function formatSeenAt(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function AnnouncementReceiptsModal({
    announcementId,
    announcementTitle,
    initialTab = 'unseen',
    onClose,
}: AnnouncementReceiptsModalProps) {
    const [activeTab, setActiveTab] = useState<'unseen' | 'seen' | 'poll'>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab, announcementId]);

    const { data, isLoading, isFetching } = useGetAnnouncementReceiptsQuery(
        announcementId || '',
        { skip: !announcementId }
    );

    const [nudgeUnseen, { isLoading: isNudging }] = useNudgeUnseenAnnouncementMutation();

    const receipts = data?.data?.receipts;
    const totalTargeted = receipts?.totalTargeted ?? 0;
    const seenCount = receipts?.seenCount ?? 0;
    const unseenCount = receipts?.unseenCount ?? 0;
    const seenPercent = totalTargeted > 0 ? Math.round((seenCount / totalTargeted) * 100) : 0;
    const pollResults = receipts?.pollResults;

    const filteredSeen = useMemo(() => {
        if (!receipts?.seen) return [];
        if (!searchTerm.trim()) return receipts.seen;
        const q = searchTerm.toLowerCase();
        return receipts.seen.filter(
            (item) =>
                item.user.name.toLowerCase().includes(q) ||
                item.user.email.toLowerCase().includes(q) ||
                item.user.department.toLowerCase().includes(q) ||
                item.user.designation.toLowerCase().includes(q)
        );
    }, [receipts?.seen, searchTerm]);

    const filteredUnseen = useMemo(() => {
        if (!receipts?.unseen) return [];
        if (!searchTerm.trim()) return receipts.unseen;
        const q = searchTerm.toLowerCase();
        return receipts.unseen.filter(
            (item) =>
                item.user.name.toLowerCase().includes(q) ||
                item.user.email.toLowerCase().includes(q) ||
                item.user.department.toLowerCase().includes(q) ||
                item.user.designation.toLowerCase().includes(q)
        );
    }, [receipts?.unseen, searchTerm]);

    const filteredTextResponses = useMemo(() => {
        if (!pollResults?.textResponses) return [];
        if (!searchTerm.trim()) return pollResults.textResponses;
        const q = searchTerm.toLowerCase();
        return pollResults.textResponses.filter(
            (tr) =>
                tr.user.name.toLowerCase().includes(q) ||
                tr.user.email.toLowerCase().includes(q) ||
                tr.user.department.toLowerCase().includes(q) ||
                (tr.text && tr.text.toLowerCase().includes(q)) ||
                (tr.optionText && tr.optionText.toLowerCase().includes(q))
        );
    }, [pollResults?.textResponses, searchTerm]);

    if (!announcementId) return null;

    const handleNudgeAll = async () => {
        if (!announcementId || unseenCount === 0) return;
        try {
            await nudgeUnseen(announcementId).unwrap();
        } catch {
            // Handled via toast in RTK Query
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
                style={{
                    backgroundColor: 'var(--color-bg-surface, #ffffff)',
                    borderColor: 'var(--color-border-default, #e2e8f0)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ borderColor: 'var(--color-border-default, #e2e8f0)' }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #059669, #10B981)',
                                color: '#ffffff',
                            }}
                        >
                            <Eye size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2
                                className="text-base font-bold truncate text-slate-900"
                                style={{ fontFamily: 'Outfit, sans-serif' }}
                            >
                                Read Receipts & Stats
                            </h2>
                            <p className="text-xs truncate text-slate-500">
                                {announcementTitle || 'Announcement Read History'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Statistics Banner */}
                <div
                    className="px-6 py-4 border-b"
                    style={{
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderColor: 'var(--color-border-default, #e2e8f0)',
                    }}
                >
                    <div className={`grid ${pollResults ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mb-3 text-center`}>
                        <div className="p-3 rounded-xl border bg-white border-slate-200">
                            <p className="text-xs font-medium text-slate-500">Targeted</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{totalTargeted}</p>
                        </div>
                        <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50">
                            <p className="text-xs font-semibold text-emerald-700">Acknowledged</p>
                            <p className="text-lg font-bold text-emerald-800 mt-0.5">{seenCount}</p>
                        </div>
                        <div className="p-3 rounded-xl border border-amber-100 bg-amber-50">
                            <p className="text-xs font-semibold text-amber-700">Pending</p>
                            <p className="text-lg font-bold text-amber-800 mt-0.5">{unseenCount}</p>
                        </div>
                        {pollResults && (
                            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50">
                                <p className="text-xs font-semibold text-emerald-700 truncate">
                                    {pollResults.pollType === 'text' ? 'Responses' : 'Votes Cast'}
                                </p>
                                <p className="text-lg font-bold text-emerald-800 mt-0.5">
                                    {pollResults.totalVotes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600">Acknowledgment Progress</span>
                            <span className="font-bold text-emerald-600">{seenPercent}% Seen</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${seenPercent}%`,
                                    background: 'linear-gradient(90deg, #10B981, #059669)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs & Search Bar */}
                <div
                    className="p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                    style={{ borderColor: 'var(--color-border-default, #e2e8f0)' }}
                >
                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setActiveTab('unseen')}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer"
                            style={
                                activeTab === 'unseen'
                                    ? {
                                          backgroundColor: '#FEF3C7',
                                          borderColor: '#F59E0B',
                                          color: '#92400E',
                                      }
                                    : {
                                          backgroundColor: 'transparent',
                                          borderColor: 'var(--color-border-default, #e2e8f0)',
                                          color: 'var(--color-text-secondary, #475569)',
                                      }
                            }
                        >
                            <AlertCircle size={14} />
                            Pending ({unseenCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('seen')}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer"
                            style={
                                activeTab === 'seen'
                                    ? {
                                          backgroundColor: '#D1FAE5',
                                          borderColor: '#10B981',
                                          color: '#065F46',
                                      }
                                    : {
                                          backgroundColor: 'transparent',
                                          borderColor: 'var(--color-border-default, #e2e8f0)',
                                          color: 'var(--color-text-secondary, #475569)',
                                      }
                            }
                        >
                            <CheckCircle2 size={14} />
                            Seen ({seenCount})
                        </button>

                        {pollResults && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('poll')}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer"
                                style={
                                    activeTab === 'poll'
                                        ? {
                                              backgroundColor: '#D1FAE5',
                                              borderColor: '#10B981',
                                              color: '#065F46',
                                          }
                                        : {
                                              backgroundColor: 'transparent',
                                              borderColor: 'var(--color-border-default, #e2e8f0)',
                                              color: 'var(--color-text-secondary, #475569)',
                                          }
                                }
                            >
                                <BarChart3 size={14} />
                                {pollResults.pollType === 'text' ? 'Responses' : 'Poll Breakdown'} (
                                {pollResults.totalVotes})
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-48">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                placeholder={activeTab === 'poll' ? 'Search voters or responses...' : 'Filter team members...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none"
                            />
                        </div>

                        {activeTab === 'unseen' && unseenCount > 0 && (
                            <button
                                type="button"
                                onClick={handleNudgeAll}
                                disabled={isNudging}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 shadow-sm shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
                                }}
                                title="Send push notification reminder to all pending members"
                            >
                                {isNudging ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Bell size={13} />
                                )}
                                Nudge All ({unseenCount})
                            </button>
                        )}
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px]">
                    {isLoading || isFetching ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Loader2 size={24} className="animate-spin text-emerald-500" />
                            <p className="text-xs">Loading records...</p>
                        </div>
                    ) : activeTab === 'poll' && pollResults ? (
                        /* Poll Results Breakdown */
                        <div className="space-y-4">
                            {/* Poll Header Box */}
                            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                                    {pollResults.pollType === 'text' ? (
                                        <HelpCircle size={16} />
                                    ) : (
                                        <BarChart3 size={16} />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                        {pollResults.question}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {pollResults.pollType === 'text'
                                            ? `Open-ended question · ${pollResults.totalVotes} responses received`
                                            : `Total votes: ${pollResults.totalVotes} · ${
                                                  pollResults.allowMultiple
                                                      ? 'Multiple choices allowed'
                                                      : 'Single choice'
                                              }${pollResults.allowTextResponse ? ' · Feedback comments enabled' : ''}`}
                                    </p>
                                </div>
                            </div>

                            {/* Options Breakdown for Choice Polls */}
                            {pollResults.pollType !== 'text' && pollResults.options.length > 0 && (
                                <div className="space-y-3">
                                    {pollResults.options.map((opt) => {
                                        const matchingVoters = searchTerm.trim()
                                            ? opt.voters.filter(
                                                  (v) =>
                                                      v.user.name
                                                          .toLowerCase()
                                                          .includes(searchTerm.toLowerCase()) ||
                                                      v.user.department
                                                          .toLowerCase()
                                                          .includes(searchTerm.toLowerCase())
                                              )
                                            : opt.voters;

                                        return (
                                            <div
                                                key={opt._id}
                                                className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-bold text-slate-900">
                                                        {opt.text}
                                                    </span>
                                                    <div className="text-right">
                                                        <span className="text-xs font-extrabold text-emerald-700">
                                                            {opt.percentage}%
                                                        </span>
                                                        <span className="text-xs text-slate-400 ml-1">
                                                            ({opt.voteCount}{' '}
                                                            {opt.voteCount === 1 ? 'vote' : 'votes'})
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                                                        style={{ width: `${opt.percentage}%` }}
                                                    />
                                                </div>

                                                {/* Voters Chips */}
                                                {matchingVoters.length > 0 ? (
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <p className="text-[11px] font-semibold text-slate-500 mb-2">
                                                            Voted by ({matchingVoters.length}):
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {matchingVoters.map((v) => (
                                                                <div
                                                                    key={v.user._id}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                                                                >
                                                                    {v.user.profilePhotoUrl ? (
                                                                        <img
                                                                            src={v.user.profilePhotoUrl}
                                                                            alt={v.user.name}
                                                                            className="w-4 h-4 rounded-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                                                                            {v.user.name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                    <span className="font-semibold text-slate-800">
                                                                        {v.user.name}
                                                                    </span>
                                                                    <span className="text-slate-400">
                                                                        · {v.user.department}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">
                                                        {searchTerm.trim()
                                                            ? 'No matching voters for this option'
                                                            : 'No votes yet for this option'}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* User Feedback & Text Responses Section */}
                            {(pollResults.pollType === 'text' ||
                                (pollResults.textResponses && pollResults.textResponses.length > 0)) && (
                                <div className="pt-2 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare size={15} className="text-emerald-600" />
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                            {pollResults.pollType === 'text'
                                                ? 'Team Responses'
                                                : 'Feedback & Comments'}{' '}
                                            ({filteredTextResponses.length})
                                        </h4>
                                    </div>

                                    {filteredTextResponses.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                            <p className="text-xs">
                                                {searchTerm.trim()
                                                    ? 'No responses match the search filter.'
                                                    : 'No text responses submitted yet.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {filteredTextResponses.map((tr) => (
                                                <div
                                                    key={tr._id}
                                                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-2xs"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {tr.user.profilePhotoUrl ? (
                                                                <img
                                                                    src={tr.user.profilePhotoUrl}
                                                                    alt={tr.user.name}
                                                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                    {tr.user.name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-bold text-slate-800 truncate mr-2">
                                                                    {tr.user.name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 truncate">
                                                                    {tr.user.department}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {tr.optionText && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                    Voted: {tr.optionText}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400">
                                                                {formatSeenAt(tr.submittedAt)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2.5 border border-slate-100 whitespace-pre-wrap leading-relaxed">
                                                        {tr.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'unseen' ? (
                        filteredUnseen.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                                <p className="text-sm font-bold text-slate-800">
                                    {searchTerm ? 'No matching members found' : 'All clear! Everyone has seen this.'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {searchTerm
                                        ? 'Try clearing the search query.'
                                        : 'Every targeted internal member has acknowledged this announcement.'}
                                </p>
                            </div>
                        ) : (
                            filteredUnseen.map((item) => (
                                <div
                                    key={item.user._id}
                                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50/50"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {item.user.profilePhotoUrl ? (
                                            <img
                                                src={item.user.profilePhotoUrl}
                                                alt={item.user.name}
                                                className="w-9 h-9 rounded-full object-cover shrink-0"
                                            />
                                        ) : (
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                style={{
                                                    background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
                                                }}
                                            >
                                                {item.user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-900 truncate">
                                                {item.user.name}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {item.user.designation} · {item.user.department}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            <Clock size={11} />
                                            Pending
                                        </span>
                                    </div>
                                </div>
                            ))
                        )
                    ) : filteredSeen.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                            <Users size={36} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-800">
                                {searchTerm ? 'No matching members found' : 'No acknowledgments yet'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {searchTerm
                                    ? 'Try clearing the search query.'
                                    : 'Recipients will appear here as soon as they read and mark this announcement.'}
                            </p>
                        </div>
                    ) : (
                        filteredSeen.map((item) => (
                            <div
                                key={item.user._id}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50/50"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {item.user.profilePhotoUrl ? (
                                        <img
                                            src={item.user.profilePhotoUrl}
                                            alt={item.user.name}
                                            className="w-9 h-9 rounded-full object-cover shrink-0"
                                        />
                                    ) : (
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                            style={{
                                                background: 'linear-gradient(135deg, #10B981, #059669)',
                                            }}
                                        >
                                            {item.user.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-900 truncate">
                                            {item.user.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate">
                                            {item.user.designation} · {item.user.department}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-0.5">
                                        <CheckCircle2 size={11} />
                                        Acknowledged
                                    </span>
                                    <p className="text-[10px] text-slate-400">
                                        {formatSeenAt(item.seenAt)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div
                    className="px-6 py-3 border-t flex justify-end"
                    style={{ borderColor: 'var(--color-border-default, #e2e8f0)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

