import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Video, Trash2, Calendar, BookOpen, Loader2, Plus, X, Search, Filter, Repeat } from 'lucide-react';
import { logger } from '@/utils/logger';
import { useGlobalMeetings, type GlobalMeeting } from '@/hooks/useGlobalMeetings';
import { useCreateMeetingMutation, useCreateIndividualMeetingMutation, type Meeting } from '@/features/project';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

type MeetingType = Meeting['type'];

interface MeetingForm {
    purpose: string;
    members: string;
    datetime: string;
    notesLink: string;
    type: MeetingType;
    projectId: string;
    isRecurring: boolean;
    recurrenceFreq: 'daily' | 'weekly';
    recurrenceEndDate: string;
    recurrenceDays: number[];
}

const EMPTY_FORM: MeetingForm = {
    purpose: '',
    members: '',
    datetime: '',
    notesLink: '',
    type: 'internal',
    projectId: '',
    isRecurring: false,
    recurrenceFreq: 'weekly',
    recurrenceEndDate: '',
    recurrenceDays: [],
};

export default function GlobalMeetingsView({ owner = 'my' }: { owner?: 'my' | 'all' }) {
    const { allMeetings, filteredMeetings, isLoading, deleteMeeting, projects, filters, setFilters, isAdmin } = useGlobalMeetings();

    useEffect(() => {
        setFilters({ owner });
    }, [owner, setFilters]);

    const [showForm, setShowForm] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [form, setForm] = useState<MeetingForm>({ ...EMPTY_FORM });
    const [activeTab, setActiveTab] = useState<MeetingType | 'all'>('all');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; projectId: string; title: string } | null>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [filterTab, setFilterTab] = useState<'project' | 'date' | 'user'>('project');
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showFilters) return;
        const handler = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFilters]);

    const usersFilterList = useMemo(() => {
        const userMap = new Map<string, { _id: string; name: string }>();
        allMeetings.forEach(m => {
            m.participants?.forEach(p => {
                if (p.userId && typeof p.userId === 'object' && (p.userId as any)._id && ((p.userId as any).name || (p.userId as any).email)) {
                    userMap.set((p.userId as any)._id, { _id: (p.userId as any)._id, name: (p.userId as any).name || (p.userId as any).email });
                }
            });
            if (m.createdBy && typeof m.createdBy === 'object' && (m.createdBy as any)._id && ((m.createdBy as any).name || (m.createdBy as any).email)) {
                userMap.set((m.createdBy as any)._id, { _id: (m.createdBy as any)._id, name: (m.createdBy as any).name || (m.createdBy as any).email });
            }
        });
        return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allMeetings]);

    const [createMeeting, { isLoading: isCreating }] = useCreateMeetingMutation();
    useBodyScrollLock(showForm);

    // Count by type from filtered meetings (so it matches owner='my' if that's active)
    const internalCount = filteredMeetings.filter(m => m.type === 'internal').length;
    const externalCount = filteredMeetings.filter(m => m.type === 'external').length;

    // Meetings shown: filtered by activeTab (type)
    const filteredByTab = activeTab === 'all' ? filteredMeetings : filteredMeetings.filter(m => m.type === activeTab);
    const totalPages = Math.ceil(filteredByTab.length / ITEMS_PER_PAGE);
    const paginatedMeetings = filteredByTab.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const setField = <K extends keyof MeetingForm>(k: K, v: MeetingForm[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    const openForm = () => {
        setForm({ ...EMPTY_FORM, type: activeTab === 'all' ? 'internal' : activeTab, projectId: 'general' });
        setShowForm(true);
        setTimeout(() => setIsAnimating(true), 10);
    };

    const closeForm = () => {
        setIsAnimating(false);
        setTimeout(() => setShowForm(false), 300);
    };

    useEffect(() => {
        const handleOpen = () => openForm();
        window.addEventListener('cuos:openMeetingForm', handleOpen);
        return () => window.removeEventListener('cuos:openMeetingForm', handleOpen);
    }, [activeTab]); // Depend on activeTab so openForm captures the right tab

    const [createIndividualMeeting] = useCreateIndividualMeetingMutation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.purpose || !form.datetime || !form.projectId) {
            alert('Purpose, Date/Time, and Project are required.');
            return;
        }
        try {
            const data = {
                title: form.purpose,
                description: form.members,
                scheduledAt: form.datetime,
                notes: form.notesLink,
                type: form.type,
                participants: [],
                duration: 1,
                ...(form.isRecurring && form.recurrenceEndDate ? {
                    recurrence: {
                        frequency: form.recurrenceFreq,
                        endDate: form.recurrenceEndDate,
                        daysOfWeek: form.recurrenceFreq === 'weekly' ? form.recurrenceDays : undefined,
                    }
                } : {})
            };

            if (form.projectId === 'general') {
                await createIndividualMeeting(data).unwrap();
            } else {
                await createMeeting({
                    projectId: form.projectId,
                    data,
                }).unwrap();
            }

            setForm({ ...EMPTY_FORM });
            closeForm();
        } catch (err) {
            logger.error('Failed to save meeting:', err);
            alert('Failed to save meeting. Please try again.');
        }
    };

    const executeDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await deleteMeeting(deleteConfirm.id, deleteConfirm.projectId);
            setDeleteConfirm(null);
        } catch (e) {
            logger.error('Failed to delete meeting:', e);
        }
    };

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
            });
        } catch { return iso; }
    };

    const inputCls = 'w-full px-3 rounded-lg border text-sm outline-none transition-colors';
    const inputSty = {
        height: '38px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };
    const labelCls = 'block text-xs font-semibold mb-1.5';
    const labelSty = { color: 'var(--color-text-secondary)' };

    return (
        <div className="space-y-5">
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                    {(['all', 'internal', 'external'] as const).map(t => {
                        const count = t === 'all' ? filteredMeetings.length : t === 'internal' ? internalCount : externalCount;
                        const isActive = activeTab === t;
                        let label = 'All Meetings';
                        if (t === 'internal') label = '🏢 Internal';
                        if (t === 'external') label = '🌐 External';

                        return (
                            <button
                                key={t}
                                onClick={() => { setActiveTab(t); setPage(1); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all border"
                                style={{
                                    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-default)',
                                }}
                            >
                                {label}
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{
                                        backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-subtle)',
                                        color: isActive ? '#fff' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                    {(filters.projectId || filters.dateFrom || filters.dateTo || filters.userId || filters.search) && (
                        <button
                            onClick={() => setFilters({ projectId: '', dateFrom: '', dateTo: '', userId: '', search: '' })}
                            className="p-1 rounded-full border shadow-sm transition-transform hover:scale-110 flex-shrink-0"
                            style={{ backgroundColor: '#ffffff', borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                            title="Clear all filters"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div 
                        className="relative flex items-center transition-all duration-300 ease-in-out overflow-hidden rounded-lg border"
                        style={{ 
                            width: searchExpanded || filters.search ? '208px' : '32px',
                            height: '30px',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)'
                        }}
                    >
                        <div className="absolute left-0 top-0 w-[30px] h-full flex items-center justify-center pointer-events-none">
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ search: e.target.value })}
                            onFocus={() => setSearchExpanded(true)}
                            onBlur={() => {
                                if (!filters.search) setSearchExpanded(false);
                            }}
                            placeholder="Search meetings…"
                            className={`absolute left-0 top-0 pl-8 pr-3 h-full text-xs bg-transparent outline-none transition-opacity duration-300 ${(!searchExpanded && !filters.search) ? 'opacity-0 cursor-pointer' : 'opacity-100 cursor-text'}`}
                            style={{ color: 'var(--color-text-primary)', width: '208px' }}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div ref={filterRef} className="relative">
                        <button
                            onClick={() => setShowFilters(p => !p)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-black/5"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        >
                            <Filter size={12} />
                            Filters
                            {(filters.projectId || filters.dateFrom || filters.dateTo || filters.userId) && (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                            )}
                        </button>

                        {showFilters && (
                            <div
                                className="absolute right-0 top-full mt-2 w-[240px] rounded-xl shadow-xl border z-50 flex overflow-hidden"
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                {/* Left side tabs */}
                                <div className="w-1/3 border-r bg-black/5" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <button
                                        onClick={() => setFilterTab('project')}
                                        className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                        style={{ backgroundColor: filterTab === 'project' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'project' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        Project
                                    </button>
                                    <button
                                        onClick={() => setFilterTab('date')}
                                        className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                        style={{ backgroundColor: filterTab === 'date' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'date' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                    >
                                        Date
                                    </button>
                                    {isAdmin && owner === 'all' && (
                                        <button
                                            onClick={() => setFilterTab('user')}
                                            className="w-full text-left px-4 py-3 text-xs font-semibold transition-colors"
                                            style={{ backgroundColor: filterTab === 'user' ? 'var(--color-bg-surface)' : 'transparent', color: filterTab === 'user' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                                        >
                                            User
                                        </button>
                                    )}
                                </div>

                                {/* Right side content */}
                                <div className="w-2/3 p-4">
                                    {filterTab === 'project' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Select Project</label>
                                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" checked={filters.projectId === '__personal__'} onChange={() => setFilters({ projectId: '__personal__' })} />
                                                    <span className="text-xs truncate">Personal Tasks</span>
                                                </label>
                                                {projects.map(p => (
                                                    <label key={p._id} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" checked={filters.projectId === p._id} onChange={() => setFilters({ projectId: p._id })} />
                                                        <span className="text-xs truncate" title={p.name}>{p.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filterTab === 'date' && (
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Start Date</label>
                                                <input type="date" value={filters.dateFrom} onChange={e => setFilters({ dateFrom: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none cursor-text"
                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>End Date</label>
                                                <input type="date" value={filters.dateTo} onChange={e => setFilters({ dateTo: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none cursor-text"
                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {filterTab === 'user' && isAdmin && owner === 'all' && (
                                        <div>
                                            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Select User</label>
                                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" checked={filters.userId === ''} onChange={() => setFilters({ userId: '' })} />
                                                    <span className="text-xs truncate">All Users</span>
                                                </label>
                                                {usersFilterList.map((u: { _id: string; name: string }) => (
                                                    <label key={u._id} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" checked={filters.userId === u._id} onChange={() => setFilters({ userId: u._id })} />
                                                        <span className="text-xs truncate" title={u.name}>{u.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Meeting list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : filteredByTab.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        <Video size={22} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        No {activeTab !== 'all' ? activeTab : ''} meetings logged yet
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Click &ldquo;Add Meeting&rdquo; to record one
                    </p>
                </div>
            ) : (
                <>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                                <th className="py-2.5 pl-4 pr-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Meeting Name</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Type</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Scheduled For</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Project</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Members</th>
                                <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Notes</th>
                                {isAdmin && <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Created By</th>}
                                <th className="py-2.5 pr-4 pl-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedMeetings.map((meeting: GlobalMeeting) => {
                                const hasLink = !!meeting.notes;
                                return (
                                    <tr key={meeting._id} className="group border-b transition-colors hover:bg-black/[0.02]" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {/* Meeting Name */}
                                        <td className="py-2.5 pl-4 pr-2" style={{ minWidth: 200 }}>
                                            <span className="text-sm font-semibold truncate block max-w-[200px]" style={{ color: 'var(--color-text-primary)' }} title={meeting.title}>
                                                {meeting.title}
                                            </span>
                                        </td>
                                        
                                        {/* Type */}
                                        <td className="py-2.5 px-3" style={{ minWidth: 100 }}>
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium w-max" style={{ color: meeting.type === 'internal' ? '#3B82F6' : '#10B981', backgroundColor: meeting.type === 'internal' ? '#3B82F615' : '#10B98115' }}>
                                                {meeting.type === 'internal' ? 'Internal' : 'External'}
                                            </div>
                                        </td>
                                        
                                        {/* Scheduled For */}
                                        <td className="py-2.5 px-3" style={{ minWidth: 150 }}>
                                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                <Calendar size={11} />
                                                {formatDate(meeting.scheduledAt)}
                                            </span>
                                        </td>
                                        
                                        {/* Project */}
                                        <td className="py-2.5 px-3" style={{ minWidth: 120 }}>
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-[120px] inline-block" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }} title={meeting._projectName}>
                                                {meeting._projectName}
                                            </span>
                                        </td>
                                        
                                        {/* Members */}
                                        <td className="py-2.5 px-3" style={{ minWidth: 150 }}>
                                            {meeting.description ? (
                                                <span className="text-xs truncate block max-w-[150px]" style={{ color: 'var(--color-text-secondary)' }} title={meeting.description}>
                                                    {meeting.description}
                                                </span>
                                            ) : (
                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                                            )}
                                        </td>
                                        
                                        {/* Notes */}
                                        <td className="py-2.5 px-3" style={{ minWidth: 100 }}>
                                            {hasLink ? (
                                                <a href={meeting.notes} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs transition-colors hover:underline" style={{ color: 'var(--color-primary)' }} title={meeting.notes}>
                                                    <BookOpen size={12} /> Link
                                                </a>
                                            ) : (
                                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                                            )}
                                        </td>
                                        
                                        {/* Created By (Admin only) */}
                                        {isAdmin && (
                                            <td className="py-2.5 px-3" style={{ minWidth: 120 }}>
                                                <span className="text-xs truncate block max-w-[120px]" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {meeting.createdBy && typeof meeting.createdBy === 'object' ? (meeting.createdBy as any).name || (meeting.createdBy as any).email : '—'}
                                                </span>
                                            </td>
                                        )}
                                        
                                        {/* Actions */}
                                        <td className="py-2.5 pr-4 pl-2 text-right">
                                            <button onClick={() => setDeleteConfirm({ id: meeting._id, projectId: meeting._projectId, title: meeting.title })} className="p-1.5 rounded transition-colors hover:bg-red-500/10 opacity-0 group-hover:opacity-100" style={{ color: 'var(--color-danger)' }} title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                    
                    {/* Pagination */}
                    <div className="border-t px-4 py-3 flex items-center justify-between mt-4 rounded-xl border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredByTab.length)} of {filteredByTab.length} meetings
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-2.5 py-1 text-xs rounded border disabled:opacity-50 transition-colors hover:bg-black/5"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    Prev
                                </button>
                                <div className="text-xs font-semibold px-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {page} / {totalPages}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-2.5 py-1 text-xs rounded border disabled:opacity-50 transition-colors hover:bg-black/5"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                </>
            )}

            {/* Slide-in Add Meeting panel */}
            {showForm && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        onClick={closeForm}
                        className="fixed inset-0 z-40 transition-opacity duration-300"
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            opacity: isAnimating ? 1 : 0,
                        }}
                    />

                    {/* Panel */}
                    <div
                        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out"
                        style={{
                            transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
                            width: 'min(480px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-12px 0 48px rgba(0,0,0,0.14)',
                        }}
                    >
                        {/* Panel header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--color-border-default)' }}>
                            <button
                                onClick={closeForm}
                                className="p-1.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
                                style={{ color: 'var(--color-text-muted)' }}
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                New Meeting Entry
                            </span>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <form id="global-meeting-form" onSubmit={handleSubmit} className="space-y-5">

                                {/* Project selector */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Project *</label>
                                    <select
                                        value={form.projectId}
                                        onChange={e => setField('projectId', e.target.value)}
                                        className={inputCls}
                                        style={inputSty}
                                        required
                                    >
                                        <option value="general">Select a project... (General Meeting)</option>
                                        {projects.map(p => (
                                            <option key={p._id} value={p._id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Meeting Type Toggle */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Type *</label>
                                    <div className="flex gap-2">
                                        {(['internal', 'external'] as MeetingType[]).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setField('type', t)}
                                                className="flex-1 py-2 text-sm font-medium rounded-lg border transition-all"
                                                style={{
                                                    borderColor: form.type === t ? 'var(--color-primary)' : 'var(--color-border-default)',
                                                    backgroundColor: form.type === t ? 'var(--color-primary)' : 'transparent',
                                                    color: form.type === t ? '#fff' : 'var(--color-text-secondary)',
                                                }}
                                            >
                                                {t === 'internal' ? '🏢 Internal' : '🌐 External'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Purpose */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Purpose *</label>
                                    <input
                                        value={form.purpose}
                                        onChange={e => setField('purpose', e.target.value)}
                                        className={inputCls}
                                        style={inputSty}
                                        placeholder="e.g. Sprint Planning, Client Sync…"
                                        required
                                    />
                                </div>

                                {/* DateTime */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Date &amp; Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.datetime}
                                        onChange={e => setField('datetime', e.target.value)}
                                        className={inputCls}
                                        style={inputSty}
                                        required
                                    />
                                </div>

                                {/* Recurrence (Repeat Meeting) */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-semibold mb-2 cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={form.isRecurring}
                                            onChange={e => setField('isRecurring', e.target.checked)}
                                            className="rounded"
                                        />
                                        <Repeat size={14} className="inline" />
                                        Repeat Meeting
                                    </label>
                                    
                                    {form.isRecurring && (
                                        <div className="p-3 rounded-xl border mt-2 space-y-3" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                            <div>
                                                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Frequency</label>
                                                <select
                                                    value={form.recurrenceFreq}
                                                    onChange={e => setField('recurrenceFreq', e.target.value as 'daily' | 'weekly')}
                                                    className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none appearance-none"
                                                    style={inputSty}
                                                >
                                                    <option value="daily">Daily</option>
                                                    <option value="weekly">Weekly</option>
                                                </select>
                                            </div>
                                            
                                            {form.recurrenceFreq === 'weekly' && (
                                                <div>
                                                    <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Repeat on</label>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {[0, 1, 2, 3, 4, 5, 6].map(day => {
                                                            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                            const isSelected = form.recurrenceDays.includes(day);
                                                            return (
                                                                <button
                                                                    key={day}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            setField('recurrenceDays', form.recurrenceDays.filter(d => d !== day));
                                                                        } else {
                                                                            setField('recurrenceDays', [...form.recurrenceDays, day]);
                                                                        }
                                                                    }}
                                                                    className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${isSelected ? 'border-primary' : ''}`}
                                                                    style={{
                                                                        backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                                                        color: isSelected ? '#fff' : 'var(--color-text-muted)',
                                                                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border-default)'
                                                                    }}
                                                                >
                                                                    {dayNames[day]}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>End Date (Required)</label>
                                                <input
                                                    type="date"
                                                    required={form.isRecurring}
                                                    value={form.recurrenceEndDate}
                                                    onChange={e => setField('recurrenceEndDate', e.target.value)}
                                                    className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none"
                                                    style={inputSty}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Members */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Members / Attendees</label>
                                    <input
                                        value={form.members}
                                        onChange={e => setField('members', e.target.value)}
                                        className={inputCls}
                                        style={inputSty}
                                        placeholder="e.g. Vinay, Rahul, Priya (comma-separated)"
                                    />
                                </div>

                                {/* Notes Link */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Meeting Notes Link</label>
                                    <input
                                        type="url"
                                        value={form.notesLink}
                                        onChange={e => setField('notesLink', e.target.value)}
                                        className={inputCls}
                                        style={inputSty}
                                        placeholder="https://docs.google.com/… or Notion link"
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Panel footer */}
                        <div
                            className="px-5 py-3.5 border-t flex justify-end gap-2 flex-shrink-0"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <button
                                type="button"
                                onClick={closeForm}
                                className="px-4 text-sm font-medium rounded-lg border transition-colors"
                                style={{
                                    height: '34px',
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="global-meeting-form"
                                disabled={isCreating}
                                className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ height: '34px', backgroundColor: 'var(--color-primary)' }}
                            >
                                {isCreating && <Loader2 size={14} className="animate-spin" />}
                                <Plus size={14} /> Save Meeting
                            </button>
                        </div>
                    </div>
                </>
            , document.body)}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-2xl shadow-2xl w-full max-w-sm p-6 relative" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                        <button onClick={() => setDeleteConfirm(null)} className="absolute top-4 right-4 transition-colors hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <Trash2 size={24} style={{ color: 'var(--color-danger)' }} />
                            </div>
                            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Delete Meeting</h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                                Are you sure you want to delete <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>"{deleteConfirm.title}"</span>? This action cannot be undone.
                            </p>
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                                    style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
