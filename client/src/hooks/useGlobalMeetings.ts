import { useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetProjectsQuery,
    useGetAllMeetingsQuery,
    useDeleteMeetingMutation,
    useGetIndividualMeetingsQuery,
    useDeleteIndividualMeetingMutation
} from '@/features/project';
import type { Meeting, Project } from '@/features/project';
import { hasModuleAdminAccess } from '@/utils/modulePermissions';

function getEntityId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return String(obj._id ?? obj.id ?? '');
    }
    return String(value);
}

function isAdminRole(user: any): boolean {
    if (!user) return false;
    const roleName = typeof user.role === 'object' ? (user.role as any).name : user.role;
    const isPartner = String(roleName || '').toLowerCase() === 'partner';
    return hasModuleAdminAccess(user, 'projectManagement') || isPartner;
}

export interface GlobalMeeting extends Meeting {
    _projectId: string;
    _projectName: string;
}

export type GlobalMeetingTypeFilter = 'all' | 'internal' | 'external';
export type GlobalMeetingOwnerFilter = 'my' | 'all';

export interface GlobalMeetingFilters {
    owner: GlobalMeetingOwnerFilter;
    type: GlobalMeetingTypeFilter;
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: string;
    search: string;
}



function useMeetingsForProjects(projectIds: string[], pollingInterval?: number): {
    meetingsByProject: Record<string, Meeting[]>;
    isLoading: boolean;
} {
    const validProjectIds = useMemo(() => projectIds.filter(Boolean), [projectIds.join(',')]);

    const { data: allMeetingsData, isLoading } = useGetAllMeetingsQuery(
        { projectIds: validProjectIds },
        { skip: validProjectIds.length === 0, pollingInterval }
    );

    const meetingsByProject = useMemo(() => {
        const obj: Record<string, Meeting[]> = {};
        validProjectIds.forEach(id => { obj[id] = []; });

        if (allMeetingsData?.data) {
            (allMeetingsData.data as Meeting[]).forEach(meeting => {
                const pid = typeof meeting.projectId === 'object' ? (meeting.projectId as any)._id : meeting.projectId;
                if (pid) {
                    if (!obj[pid]) obj[pid] = [];
                    obj[pid].push(meeting);
                }
            });
        }
        return obj;
    }, [allMeetingsData, validProjectIds]);

    return { meetingsByProject, isLoading };
}

export interface UseGlobalMeetingsReturn {
    allMeetings: GlobalMeeting[];
    filteredMeetings: GlobalMeeting[];
    myMeetingsCount: number;
    allMeetingsCount: number;
    projects: Project[];
    currentUserId: string;
    isAdmin: boolean;
    filters: GlobalMeetingFilters;
    setFilters: (f: Partial<GlobalMeetingFilters>) => void;
    isLoading: boolean;
    deleteMeeting: (id: string, projectId: string) => Promise<void>;
}

export function useGlobalMeetings(options?: { pollingInterval?: number }): UseGlobalMeetingsReturn {
    const { user } = useSelector((state: RootState) => state.auth);
    const currentUserId = user?._id ?? '';
    const isAdmin = isAdminRole(user);

    const { data: projData, isLoading: projLoading } = useGetProjectsQuery({});
    const projects: Project[] = useMemo(() => projData?.data ?? [], [projData]);

    const activeProjectIds = useMemo(() => {
        return projects
            .filter(p => p.status !== 'cancelled' && p.status !== 'completed')
            .map(p => p._id);
    }, [projects]);

    const { meetingsByProject, isLoading: meetingsLoading } = useMeetingsForProjects(activeProjectIds, options?.pollingInterval);
    const { data: individualMeetingsData, isLoading: individualMeetingsLoading } = useGetIndividualMeetingsQuery(undefined, { pollingInterval: options?.pollingInterval });

    const [deleteMeetingMut] = useDeleteMeetingMutation();
    const [deleteIndividualMeetingMut] = useDeleteIndividualMeetingMutation();

    const deleteMeeting = useCallback(async (id: string, projectId: string) => {
        if (projectId === 'general' || !projectId) {
            await deleteIndividualMeetingMut({ id }).unwrap();
        } else {
            await deleteMeetingMut({ projectId, id }).unwrap();
        }
    }, [deleteMeetingMut, deleteIndividualMeetingMut]);

    const allMeetings = useMemo(() => {
        const list: GlobalMeeting[] = [];

        Object.entries(meetingsByProject).forEach(([pid, meetings]) => {
            const p = projects.find(x => x._id === pid);
            if (!p) return;
            meetings.forEach(m => {
                list.push({
                    ...m,
                    _projectId: p._id,
                    _projectName: p.name,
                });
            });
        });

        // Add individual meetings
        const individualMeetings = (individualMeetingsData?.data as Meeting[]) || [];
        individualMeetings.forEach(m => {
            list.push({
                ...m,
                _projectId: 'general',
                _projectName: 'General Meeting',
            });
        });

        return list.sort((a, b) => {
            const da = new Date(a.scheduledAt || 0).getTime();
            const db = new Date(b.scheduledAt || 0).getTime();
            return db - da; // sort newest first
        });
    }, [meetingsByProject, projects, individualMeetingsData?.data]);

    const myMeetingsCount = useMemo(() => {
        return allMeetings.filter(m => {
            const isParticipant = m.participants?.some(p => getEntityId(p.userId) === currentUserId);
            const isCreator = getEntityId(m.createdBy) === currentUserId;
            return isParticipant || isCreator;
        }).length;
    }, [allMeetings, currentUserId]);

    const allMeetingsCount = allMeetings.length;

    const [filters, setFiltersState] = useState<GlobalMeetingFilters>({
        owner: 'my',
        type: 'all',
        projectId: '',
        dateFrom: '',
        dateTo: '',
        userId: '',
        search: '',
    });

    const setFilters = useCallback((f: Partial<GlobalMeetingFilters>) => {
        setFiltersState(prev => ({ ...prev, ...f }));
    }, []);

    const filteredMeetings = useMemo(() => {
        return allMeetings.filter(meeting => {
            if (filters.owner === 'my') {
                const isParticipant = meeting.participants?.some(p => getEntityId(p.userId) === currentUserId);
                const isCreator = getEntityId(meeting.createdBy) === currentUserId;
                if (!isParticipant && !isCreator) return false;
            }
            if (filters.type !== 'all' && meeting.type !== filters.type) return false;
            
            if (filters.projectId && meeting._projectId !== filters.projectId) {
                return false;
            }
            
            if (filters.dateFrom) {
                const from = new Date(filters.dateFrom);
                const sched = meeting.scheduledAt ? new Date(meeting.scheduledAt) : null;
                if (!sched || sched < from) return false;
            }
            
            if (filters.dateTo) {
                const to = new Date(filters.dateTo);
                to.setHours(23, 59, 59, 999);
                const sched = meeting.scheduledAt ? new Date(meeting.scheduledAt) : null;
                if (!sched || sched > to) return false;
            }
            
            if (filters.userId) {
                const isParticipant = meeting.participants?.some(p => getEntityId(p.userId) === filters.userId);
                const isCreator = getEntityId(meeting.createdBy) === filters.userId;
                if (!isParticipant && !isCreator) return false;
            }
            
            if (filters.search) {
                const q = filters.search.toLowerCase();
                const inTitle = meeting.title?.toLowerCase().includes(q) || false;
                const inProject = meeting._projectName.toLowerCase().includes(q);
                const inDesc = (meeting.description ?? '').toLowerCase().includes(q);
                const inType = (meeting.type ?? '').toLowerCase().includes(q);
                
                const inCreator = meeting.createdBy && typeof meeting.createdBy === 'object'
                    ? ((meeting.createdBy as any).name?.toLowerCase().includes(q) || (meeting.createdBy as any).email?.toLowerCase().includes(q))
                    : false;
                    
                const inParticipants = meeting.participants?.some(p => {
                    if (p.userId && typeof p.userId === 'object') {
                        return (p.userId as any).name?.toLowerCase().includes(q) || (p.userId as any).email?.toLowerCase().includes(q);
                    }
                    return false;
                });

                if (!inTitle && !inProject && !inDesc && !inCreator && !inParticipants && !inType) return false;
            }
            
            return true;
        });
    }, [allMeetings, filters, currentUserId]);

    return {
        allMeetings,
        filteredMeetings,
        myMeetingsCount,
        allMeetingsCount,
        projects,
        currentUserId,
        isAdmin,
        filters,
        setFilters,
        isLoading: projLoading || meetingsLoading || individualMeetingsLoading,
        deleteMeeting,
    };
}
