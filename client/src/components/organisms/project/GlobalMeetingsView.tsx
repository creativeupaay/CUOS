import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Video, Trash2, Calendar, BookOpen, Loader2, Plus, X, Search, Filter, Repeat, MoreHorizontal, Pencil, RefreshCw, Clock, Users, Hourglass } from 'lucide-react';
import { logger } from '@/utils/logger';
import { useGlobalMeetings, type GlobalMeeting } from '@/hooks/useGlobalMeetings';
import { useCreateMeetingMutation, useCreateIndividualMeetingMutation, useUpdateMeetingMutation, useUpdateIndividualMeetingMutation, type Meeting } from '@/features/project';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { useSyncMeetNowMutation, useGetUpcomingCalendarMeetingsQuery } from '@/features/integration/integrationApi';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { toast } from 'react-hot-toast';

type MeetingType = Meeting['type'];

interface MeetingForm {
    purpose: string;
    participants: { email?: string; userId?: string; name?: string; externalEmail?: string }[];
    datetime: string;
    duration: number;
    description: string;
    notesLink: string;
    type: MeetingType;
    projectId: string;
    isProjectMeeting: boolean;
    isRecurring: boolean;
    recurrenceFreq: 'daily' | 'weekly';
    recurrenceEndDate: string;
    recurrenceDays: number[];
    generateMeetLink: boolean;
}

const EMPTY_FORM: MeetingForm = {
    purpose: '',
    participants: [],
    datetime: '',
    duration: 30,
    description: '',
    notesLink: '',
    type: 'internal',
    projectId: '',
    isProjectMeeting: true,
    isRecurring: false,
    recurrenceFreq: 'weekly',
    recurrenceEndDate: '',
    recurrenceDays: [],
    generateMeetLink: false,
};

function RowActions({ meeting, onEdit, onDelete }: { meeting: GlobalMeeting; onEdit: (m: GlobalMeeting) => void; onDelete: (m: GlobalMeeting) => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, right: 0 });

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node)) return;
            if (menuRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        const scrollHandler = () => setOpen(false);
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', scrollHandler, true);
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', scrollHandler, true);
        };
    }, [open]);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }
        setOpen(!open);
    };

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className="p-1.5 rounded-lg transition-all hover:bg-black/5"
                style={{ color: 'var(--color-text-muted)' }}
            >
                <MoreHorizontal size={14} />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed w-32 rounded-xl border shadow-xl py-1 z-[9999]"
                    style={{ 
                        top: coords.top, 
                        right: coords.right,
                        backgroundColor: 'var(--color-bg-surface)', 
                        borderColor: 'var(--color-border-default)' 
                    }}
                >
                    <button
                        onClick={() => { onEdit(meeting); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        <Pencil size={12} /> Edit
                    </button>
                    <button
                        onClick={() => { onDelete(meeting); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}


export default function GlobalMeetingsView({ owner = 'my' }: { owner?: 'my' | 'all' }) {
    const { allMeetings, filteredMeetings, isLoading, deleteMeeting, projects, filters, setFilters, isAdmin, currentUserId } = useGlobalMeetings();

    const getDynamicMeetingTitle = (meeting: GlobalMeeting) => {
        if (meeting.title === 'Google Meet — Ad hoc' && meeting.participants && meeting.participants.length > 0) {
            const otherParticipants = meeting.participants.filter(p => {
                const pid = p.userId && typeof p.userId === 'object' ? (p.userId as any)._id || (p.userId as any).id : p.userId;
                return String(pid) !== String(currentUserId);
            });
            
            if (otherParticipants.length > 0) {
                const names = otherParticipants.map(p => {
                    return p.name || (p.userId && typeof p.userId === 'object' ? (p.userId as any).name : null) || p.externalEmail || 'Unknown User';
                }).filter(Boolean);
                
                if (names.length === 1) return `Meet with ${names[0]}`;
                if (names.length > 1) return `Meet with ${names[0]} and ${names.length - 1} others`;
            }
        }
        return meeting.title;
    };

    // Integrations hooks
    const [syncMeetNow, { isLoading: isSyncing }] = useSyncMeetNowMutation();
    const { data: upcomingResponse, isLoading: isUpcomingLoading, refetch: refetchUpcoming } = useGetUpcomingCalendarMeetingsQuery(undefined, {
        skip: owner !== 'my'
    });

    const { data: usersData } = useGetUsersQuery();
    const users = (usersData?.data as any)?.users || [];

    const upcomingMeetings = useMemo(() => upcomingResponse?.data || [], [upcomingResponse]);

    useEffect(() => {
        setFilters({ owner });
    }, [owner, setFilters]);

    const [showForm, setShowForm] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [meetingToEdit, setMeetingToEdit] = useState<GlobalMeeting | null>(null);
    const [selectedMeeting, setSelectedMeeting] = useState<GlobalMeeting | null>(null);
    const [form, setForm] = useState<MeetingForm>({ ...EMPTY_FORM });
    const [activeTab, setActiveTab] = useState<MeetingType | 'all'>('all');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; projectId: string; title: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [showFilters, setShowFilters] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [filterTab, setFilterTab] = useState<'project' | 'date' | 'user'>('project');
    const filterRef = useRef<HTMLDivElement>(null);
    const [externalEmailInput, setExternalEmailInput] = useState('');

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
    
    // As requested, only show completed meetings in the list (endTime is in the past)
    const nowForFilter = new Date();
    const completedMeetingsOnly = filteredByTab.filter(m => {
        if (!m.scheduledAt) return true; // fallback if no date
        const end = new Date(m.scheduledAt);
        end.setMinutes(end.getMinutes() + (m.duration || 0));
        return end < nowForFilter;
    });

    const totalPages = Math.ceil(completedMeetingsOnly.length / ITEMS_PER_PAGE);
    const paginatedMeetings = completedMeetingsOnly.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const setField = <K extends keyof MeetingForm>(k: K, v: MeetingForm[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    const openForm = () => {
        setForm({ ...EMPTY_FORM, type: activeTab === 'all' ? 'internal' : activeTab });
        setMeetingToEdit(null);
        setShowForm(true);
        setTimeout(() => setIsAnimating(true), 10);
    };

    const handleEdit = (meeting: GlobalMeeting) => {
        const d = new Date(meeting.scheduledAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localDatetime = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

        setForm({
            purpose: meeting.title,
            participants: (meeting.participants || []).map(p => {
                const isObj = typeof p.userId === 'object' && p.userId !== null;
                const uIdObj = isObj ? (p.userId as any) : null;
                return {
                    email: uIdObj?.email || p.externalEmail,
                    externalEmail: p.externalEmail,
                    name: p.name || uIdObj?.name,
                    userId: uIdObj?._id || p.userId
                };
            }),
            datetime: localDatetime,
            duration: meeting.duration || 30,
            description: meeting.description || '',
            notesLink: meeting.notes || '',
            type: meeting.type,
            projectId: meeting._projectId || 'general',
            isProjectMeeting: !!meeting._projectId,
            isRecurring: false,
            recurrenceFreq: 'weekly',
            recurrenceEndDate: '',
            recurrenceDays: [],
            generateMeetLink: false
        });
        setMeetingToEdit(meeting);
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
    const [updateMeeting] = useUpdateMeetingMutation();
    const [updateIndividualMeeting] = useUpdateIndividualMeetingMutation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.purpose || !form.datetime || (form.isProjectMeeting && !form.projectId)) {
            alert('Purpose, Date/Time, and Project are required.');
            return;
        }
        setIsSaving(true);
        try {
            const data = {
                title: form.purpose,
                description: form.description,
                scheduledAt: new Date(form.datetime).toISOString(),
                duration: form.duration || 30,
                notes: form.notesLink,
                type: form.type,
                participants: form.participants as any,
                generateMeetLink: form.generateMeetLink,
                ...(form.isRecurring && form.recurrenceEndDate ? {
                    recurrence: {
                        frequency: form.recurrenceFreq,
                        endDate: form.recurrenceEndDate,
                        daysOfWeek: form.recurrenceFreq === 'weekly' ? form.recurrenceDays : undefined,
                    }
                } : {})
            };

            if (meetingToEdit) {
                if (form.projectId === 'general' || !meetingToEdit._projectId) {
                    await updateIndividualMeeting({ id: meetingToEdit._id, data }).unwrap();
                } else {
                    await updateMeeting({ projectId: form.projectId, id: meetingToEdit._id, data }).unwrap();
                }
            } else {
                if (form.projectId === 'general') {
                    await createIndividualMeeting(data).unwrap();
                } else {
                    await createMeeting({
                        projectId: form.projectId,
                        data,
                    }).unwrap();
                }
            }

            // Invalidate/refetch upcoming meetings to reflect the new Meet
            if (form.generateMeetLink) {
                refetchUpcoming();
            }

            setForm({ ...EMPTY_FORM });
            setMeetingToEdit(null);
            closeForm();
        } catch (err: any) {
            logger.error('Failed to save meeting:', err);
            const errorMessage = err?.data?.message || err?.message || 'Failed to save meeting. Please try again.';
            toast.error(errorMessage, { duration: 5000 });
        } finally {
            setIsSaving(false);
        }
    };

    const executeDelete = async () => {
        if (!deleteConfirm) return;
        setIsDeleting(true);
        try {
            await deleteMeeting(deleteConfirm.id, deleteConfirm.projectId);
            setDeleteConfirm(null);
        } catch (e) {
            logger.error('Failed to delete meeting:', e);
        } finally {
            setIsDeleting(false);
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
                    {owner === 'my' && (
                        <button
                            onClick={async () => {
                                try {
                                    await syncMeetNow().unwrap();
                                    toast.success('Meetings synced successfully');
                                } catch (err: any) {
                                    if (err.status === 404) {
                                        toast.error('No connected Google account found');
                                    } else {
                                        toast.error('Failed to sync meetings');
                                    }
                                }
                            }}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all border disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                        >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            Sync Meetings
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

            {/* Upcoming Meetings Banner */}
            {owner === 'my' && activeTab === 'all' && (
                <div className="mb-4">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-primary/10">
                            <Calendar size={14} style={{ color: 'var(--color-primary)' }} /> 
                        </div>
                        Upcoming from Calendar
                    </h3>
                    {isUpcomingLoading ? (
                        <div className="flex items-center gap-2 py-4 px-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <Loader2 size={12} className="animate-spin" /> Fetching upcoming meetings...
                        </div>
                    ) : upcomingMeetings.length === 0 ? (
                        <div className="text-xs px-2" style={{ color: 'var(--color-text-muted)' }}>
                            No upcoming Google Meet events found in your calendar.
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                            {upcomingMeetings
                                .filter((event: any) => new Date(event.endTime) > new Date())
                                .map((event: any) => {
                                const startD = new Date(event.startTime);
                                const isToday = startD.toDateString() === new Date().toDateString();
                                const isTomorrow = startD.toDateString() === new Date(Date.now() + 86400000).toDateString();
                                const timeStr = startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : startD.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                const attendeesCount = event.attendees?.length || 0;
                                
                                return (
                                    <div 
                                        key={event.id}
                                        className="flex-shrink-0 flex flex-col justify-between w-[260px] rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md group bg-white relative overflow-hidden"
                                        style={{ borderColor: 'var(--color-border-subtle, #e5e7eb)' }}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2 gap-3">
                                                <h4 className="text-[14px] font-bold text-gray-900 line-clamp-2 leading-snug" title={event.title}>
                                                    {event.title}
                                                </h4>
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-600 bg-emerald-50">
                                                    <Video size={14} />
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col gap-2 mt-3">
                                                <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                                                    <Clock size={13} className="text-gray-400" />
                                                    <span>{dateLabel}, {timeStr}</span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between text-[11px] text-gray-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Hourglass size={12} className="text-gray-400" />
                                                        <span>{event.scheduledDurationMinutes} mins</span>
                                                    </div>
                                                    
                                                    {attendeesCount > 0 && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-gray-500 font-medium bg-gray-50">
                                                            <Users size={11} className="text-gray-400" />
                                                            <span>{attendeesCount} Guest{attendeesCount !== 1 && 's'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4 pt-3 border-t border-gray-100">
                                            {event.meetLink ? (
                                                <a 
                                                    href={event.meetLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full py-2 text-xs font-bold rounded-lg text-emerald-700 bg-emerald-50 transition-all hover:text-white"
                                                    style={{ 
                                                        '--hover-bg': 'var(--color-primary, #10B981)' 
                                                    } as any}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary, #10B981)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ecfdf5'}
                                                >
                                                    <Video size={14} />
                                                    Join Meet
                                                </a>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium rounded-lg text-gray-400 bg-gray-50 border border-dashed border-gray-200">
                                                    <Clock size={14} />
                                                    No Link Found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Meeting list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : completedMeetingsOnly.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        <Video size={22} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        No {activeTab !== 'all' ? activeTab : ''} meetings logged yet
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Click &ldquo;New Meeting&rdquo; to record one
                    </p>
                </div>
            ) : (
                <>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left whitespace-nowrap min-w-[800px]">
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
                                return (
                                    <tr 
                                        key={meeting._id} 
                                        onClick={() => setSelectedMeeting(meeting)}
                                        className="group border-b transition-colors hover:bg-black/[0.02] cursor-pointer" 
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        {/* Meeting Name */}
                                        <td className="py-2.5 pl-4 pr-2" style={{ minWidth: 200 }}>
                                            <span className="text-sm font-semibold truncate block max-w-[200px]" style={{ color: 'var(--color-text-primary)' }} title={getDynamicMeetingTitle(meeting)}>
                                                {getDynamicMeetingTitle(meeting)}
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
                                        <td className="py-2.5 px-3" style={{ minWidth: 100 }} onClick={e => e.stopPropagation()}>
                                            {meeting.meetLink ? (
                                                <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md transition-colors" style={{ color: '#10B981', backgroundColor: '#ecfdf5', border: '1px solid #10B981' }} title="Join Google Meet">
                                                    <Video size={12} /> Join Meet
                                                </a>
                                            ) : meeting.notes ? (
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
                                        <td className="py-2.5 pr-4 pl-2 text-right" onClick={e => e.stopPropagation()}>
                                            <RowActions 
                                                meeting={meeting} 
                                                onEdit={handleEdit} 
                                                onDelete={(m) => setDeleteConfirm({ id: m._id, projectId: m._projectId, title: m.title })} 
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
                    
                    {/* Pagination */}
                    <div className="border-t px-4 py-3 flex items-center justify-between mt-4 rounded-xl border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, completedMeetingsOnly.length)} of {completedMeetingsOnly.length} meetings
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
                            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {meetingToEdit ? 'Edit Meeting' : 'New Meeting'}
                            </h2>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <form id="global-meeting-form" onSubmit={handleSubmit} className="space-y-5">

                                {/* Is Project Meeting Toggle */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-semibold mb-2 cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={!form.isProjectMeeting}
                                            onChange={e => {
                                                const notProject = e.target.checked;
                                                setField('isProjectMeeting', !notProject);
                                                if (notProject) {
                                                    setField('projectId', 'general');
                                                } else {
                                                    setField('projectId', '');
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        Not a project meeting
                                    </label>
                                </div>

                                {/* Project selector */}
                                {form.isProjectMeeting && (
                                    <div>
                                        <label className={labelCls} style={labelSty}>Project *</label>
                                        <select
                                            value={form.projectId}
                                            onChange={e => setField('projectId', e.target.value)}
                                            className={inputCls}
                                            style={inputSty}
                                            required
                                        >
                                            <option value="">Select a project...</option>
                                            {projects.map(p => (
                                                <option key={p._id} value={p._id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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

                                {/* Duration */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Duration (minutes) *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.duration === 0 ? '' : form.duration}
                                        onChange={e => setField('duration', e.target.value === '' ? 0 : parseInt(e.target.value))}
                                        className={inputCls}
                                        style={inputSty}
                                        required
                                    />
                                </div>

                                {/* Participants */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Members / Attendees</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <select
                                                className={inputCls}
                                                style={inputSty}
                                                onChange={(e) => {
                                                    const empId = e.target.value;
                                                    if (!empId) return;
                                                    const emp = users.find((em: any) => em._id === empId);
                                                    if (emp) {
                                                        if (!form.participants.some(p => p.userId === emp._id)) {
                                                            setField('participants', [...form.participants, { userId: emp._id, name: emp.name, email: emp.email }]);
                                                        }
                                                    }
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">+ Add Employee</option>
                                                {users.map((emp: any) => (
                                                    <option key={emp._id} value={emp._id}>{emp.name || 'Unknown'} ({emp.email || ''})</option>
                                                ))}
                                            </select>
                                            <div className="flex w-full gap-1">
                                                <input
                                                    type="email"
                                                    placeholder="External client email..."
                                                    className={inputCls}
                                                    style={inputSty}
                                                    value={externalEmailInput}
                                                    onChange={e => setExternalEmailInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const email = externalEmailInput.trim();
                                                            if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                                                if (!form.participants.some(p => p.email === email || p.externalEmail === email)) {
                                                                    setField('participants', [...form.participants, { externalEmail: email, email }]);
                                                                }
                                                                setExternalEmailInput('');
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmailInput.trim())}
                                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                                    onClick={() => {
                                                        const email = externalEmailInput.trim();
                                                        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                                            if (!form.participants.some(p => p.email === email || p.externalEmail === email)) {
                                                                setField('participants', [...form.participants, { externalEmail: email, email }]);
                                                            }
                                                            setExternalEmailInput('');
                                                        }
                                                    }}
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                        {form.participants.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {form.participants.map((p, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                                                        <span className="truncate max-w-[150px]">{p.name || p.email || p.externalEmail}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setField('participants', form.participants.filter((_, idx) => idx !== i))}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Generate Meet Link Toggle */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-semibold mb-2 cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={form.generateMeetLink}
                                            onChange={e => setField('generateMeetLink', e.target.checked)}
                                            className="rounded"
                                        />
                                        <Video size={14} className="inline" style={{ color: form.generateMeetLink ? 'var(--color-primary)' : 'inherit' }} />
                                        Automatically create Google Meet link &amp; send Calendar invites
                                    </label>
                                </div>

                                {/* Description / Agenda */}
                                <div>
                                    <label className={labelCls} style={labelSty}>Description / Agenda</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setField('description', e.target.value)}
                                        className={inputCls}
                                        style={{ ...inputSty, height: '80px', paddingTop: '8px', resize: 'none' }}
                                        placeholder="Add meeting agenda or notes..."
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
                                className="px-5 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                                style={{
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
                                disabled={isSaving || isCreating}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                            >
                                {isSaving || isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                {meetingToEdit ? 'Save Changes' : 'New Meeting'}
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
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50 flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--color-danger)', color: '#fff' }}
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Meeting Details Modal */}
            {selectedMeeting && createPortal(
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    onClick={() => setSelectedMeeting(null)}
                >
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        aria-hidden="true"
                    />
                    
                    <div 
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl transition-all"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 bg-white px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Video size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 leading-tight pr-4">
                                        {getDynamicMeetingTitle(selectedMeeting)}
                                    </h2>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {selectedMeeting._projectName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMeeting(null)}
                                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="px-6 py-6 space-y-8">
                            
                            {/* Key Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type</div>
                                    <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
                                        <div className={`w-2 h-2 rounded-full ${selectedMeeting.type === 'internal' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                        {selectedMeeting.type === 'internal' ? 'Internal' : 'External'}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</div>
                                    <div className="font-semibold text-gray-900 text-sm capitalize">
                                        {selectedMeeting.conferenceStatus || 'Scheduled'}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Duration</div>
                                    <div className="font-semibold text-gray-900 text-sm">
                                        {selectedMeeting.actualDuration ? `${selectedMeeting.actualDuration} mins` : `${selectedMeeting.duration} mins`}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Source</div>
                                    <div className="font-semibold text-gray-900 text-sm capitalize">
                                        {selectedMeeting.source === 'google_meet' ? 'Google Meet' : 'Manual'}
                                    </div>
                                </div>
                            </div>

                            {/* Timing Details */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Clock size={16} className="text-gray-400" /> Date & Time
                                </h3>
                                <div className="bg-white border rounded-xl divide-y text-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <div className="flex justify-between py-3 px-4">
                                        <span className="text-gray-500 font-medium">Scheduled For</span>
                                        <span className="font-semibold text-gray-900">{formatDate(selectedMeeting.scheduledAt)}</span>
                                    </div>
                                    {selectedMeeting.actualStartTime && (
                                        <div className="flex justify-between py-3 px-4 bg-emerald-50/30">
                                            <span className="text-gray-500 font-medium">Actual Start</span>
                                            <span className="font-semibold text-gray-900">{new Date(selectedMeeting.actualStartTime).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedMeeting.actualEndTime && (
                                        <div className="flex justify-between py-3 px-4 bg-blue-50/30">
                                            <span className="text-gray-500 font-medium">Actual End</span>
                                            <span className="font-semibold text-gray-900">{new Date(selectedMeeting.actualEndTime).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Participants */}
                            {selectedMeeting.participants && selectedMeeting.participants.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Users size={16} className="text-gray-400" /> Participants ({selectedMeeting.participants.length})
                                    </h3>
                                    <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <ul className="divide-y text-sm">
                                            {selectedMeeting.participants.map((p, i) => (
                                                <li key={i} className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors" style={{ borderTopColor: 'var(--color-border-default)' }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs uppercase">
                                                            {p.name ? p.name[0] : (p.externalEmail ? p.externalEmail[0] : (p.userId && typeof p.userId === 'object' ? (p.userId as any).name?.[0] : '?'))}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900">
                                                                {p.name || (p.userId && typeof p.userId === 'object' ? (p.userId as any).name : 'Unknown User')}
                                                            </div>
                                                            {(p.externalEmail || (p.userId && typeof p.userId === 'object' && (p.userId as any).email)) && (
                                                                <div className="text-[11px] text-gray-500 mt-0.5">
                                                                    {p.externalEmail || (p.userId as any).email}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-md">
                                                        {p.role || 'Guest'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            
                            {/* Notes / Description */}
                            {(selectedMeeting.notes || selectedMeeting.description) && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <BookOpen size={16} className="text-gray-400" /> Additional Info
                                    </h3>
                                    <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-700" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {selectedMeeting.description && (
                                            <div className="mb-4">
                                                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description / Purpose</div>
                                                <p className="whitespace-pre-wrap">{selectedMeeting.description}</p>
                                            </div>
                                        )}
                                        {selectedMeeting.notes && (
                                            <div>
                                                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Notes Link</div>
                                                <a href={selectedMeeting.notes} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                    Open Notes <BookOpen size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
