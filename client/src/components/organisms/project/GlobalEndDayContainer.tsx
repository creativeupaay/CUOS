import { useCallback, useMemo, useState } from 'react';
import { useGlobalTasks } from '@/hooks/useGlobalTasks';
import { useGlobalMeetings } from '@/hooks/useGlobalMeetings';
import type { TaskSummaryEntry, MeetingSummaryEntry } from './EndOfDayModal';
import EndOfDayModal from './EndOfDayModal';
import GlobalTaskFormPanel, { type NewTaskFormData } from './GlobalTaskFormPanel';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';

interface GlobalEndDayContainerProps {
    timerSeconds: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function GlobalEndDayContainer({ timerSeconds, onClose, onSuccess }: GlobalEndDayContainerProps) {
    const { allTasks, projects, updateTask, logTime, createTask } = useGlobalTasks();
    const { allMeetings } = useGlobalMeetings();
    const currentUserId = useSelector((state: RootState) => state.auth.user?._id) || '';
    
    const [showTaskForm, setShowTaskForm] = useState(false);

    const todayMeetings = useMemo(() => allMeetings.filter(m => {
        if (!m.scheduledAt) return false;
        const d = new Date(m.scheduledAt);
        const today = new Date();
        const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        if (!isToday) return false;

        const isParticipant = m.participants?.some(p => {
            const pId = p.userId && typeof p.userId === 'object' ? (p.userId as any)._id : p.userId;
            return pId === currentUserId;
        });
        const creatorId = m.createdBy && typeof m.createdBy === 'object' ? (m.createdBy as any)._id : m.createdBy;
        const isCreator = creatorId === currentUserId;

        return isParticipant || isCreator;
    }), [allMeetings, currentUserId]);

    // ── IMPORTANT: myTasks must be defined BEFORE handleEndDaySubmit ──────────
    // useCallback creates a closure over variables in scope at call time.
    // If myTasks is defined after the callback, it captures `undefined`.
    const myTasks = useMemo(() => allTasks.filter(t => {
        let isAssignedToMe = false;
        let hasOtherAssignees = false;

        if (Array.isArray(t.assignees)) {
            hasOtherAssignees = t.assignees.length > 0;
            isAssignedToMe = t.assignees.some((a: any) => {
                const aId = a && typeof a === 'object' ? (a as any)._id : a;
                return aId === currentUserId;
            });
        }
        
        if (isAssignedToMe) return true;

        const creatorId = t.createdBy && typeof t.createdBy === 'object' ? (t.createdBy as any)._id : t.createdBy;
        const isCreator = creatorId === currentUserId;

        if (isCreator && !hasOtherAssignees) return true;

        return false;
    }), [allTasks, currentUserId]);

    const handleEndDaySubmit = useCallback(async (entries: TaskSummaryEntry[], meetingEntries: MeetingSummaryEntry[], unallocatedMinutes: number) => {
        let hasAnyError = false;

        // Update task statuses and log time for each task
        for (const entry of entries) {
            try {
                const hasChange = entry.status !== entry.task.status || entry.priority !== entry.task.priority || entry.deadline !== (entry.task.deadline ? new Date(entry.task.deadline).toISOString().slice(0, 10) : '') || entry.projectId !== entry.task._projectId;
                if (hasChange) {
                    await updateTask(entry.task._projectId, entry.task._id, { status: entry.status, priority: entry.priority, deadline: entry.deadline || undefined, projectId: entry.projectId || undefined });
                }
                if (entry.allocatedMinutes > 0) {
                    await logTime(entry.projectId, entry.task._id, entry.allocatedMinutes, entry.notes || `End of day - ${entry.status}`);
                }
            } catch (err) {
                console.error(`Failed to update/log task "${entry.task.title}":`, err);
                hasAnyError = true;
                // Continue with other tasks rather than aborting the entire EOD
            }
        }

        // Log time for meetings
        for (const mEntry of meetingEntries) {
            if (mEntry.allocatedMinutes > 0) {
                try {
                    await logTime(mEntry.meeting._projectId, mEntry.meeting._id, mEntry.allocatedMinutes, `Meeting: ${mEntry.meeting.title}`);
                } catch (err) {
                    console.error(`Failed to log meeting time for "${mEntry.meeting.title}":`, err);
                    hasAnyError = true;
                }
            }
        }

        // Log unallocated time
        if (unallocatedMinutes > 0) {
            try {
                // myTasks is now correctly defined above this callback — no more closure bug
                let unallocatedTask = myTasks.find(t => t.title === 'Unallocated Time' && !t._projectId);
                let targetTaskId = '000000000000000000000000';
                
                if (unallocatedTask) {
                    targetTaskId = unallocatedTask._id;
                } else if (createTask) {
                    const newTask = await createTask('', { 
                        title: 'Unallocated Time', 
                        status: 'completed', 
                        priority: 'low',
                        description: 'Automatically created to store unallocated tracked time.',
                    });
                    if (newTask) {
                        targetTaskId = newTask._id;
                    }
                }
                
                await logTime('', targetTaskId, unallocatedMinutes, 'Unallocated Time');
            } catch (err) {
                console.error('Failed to log unallocated time:', err);
                hasAnyError = true;
            }
        }

        if (hasAnyError) {
            toast.error('Day ended with some errors. Some time may not have been logged. Please check manually.');
        } else {
            toast.success('Day ended successfully!');
        }
        // Always call onSuccess so the timer is stopped even if some logs failed
        onSuccess();
    }, [updateTask, logTime, createTask, onSuccess, myTasks]);

    return (
        <>
            <EndOfDayModal
                allTasks={myTasks}
                todayMeetings={todayMeetings}
                projects={projects}
                timerSeconds={timerSeconds}
                onClose={onClose}
                onSubmit={handleEndDaySubmit}
                onAddNewTask={() => setShowTaskForm(true)}
            />

            {showTaskForm && (
                <GlobalTaskFormPanel
                    isCreating={false}
                    onClose={() => setShowTaskForm(false)}
                    onSubmit={async (data: NewTaskFormData) => {
                        try {
                            await createTask('', {
                                title: data.title,
                                description: data.description || undefined,
                                status: data.status,
                                priority: data.priority,
                                deadline: data.deadline || undefined,
                                estimatedHours: (data.timeSpentHours + data.timeSpentMins / 60) || undefined,
                                projectId: data.taskType === 'project' ? data.projectId : undefined,
                            });
                            toast.success('Task created successfully!');
                            setShowTaskForm(false);
                        } catch (err) {
                            console.error('Failed to create task:', err);
                            toast.error('Failed to create task.');
                        }
                    }}
                    projects={projects}
                />
            )}
        </>
    );
}
