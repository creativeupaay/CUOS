export type NotificationType =
    | 'leave_submitted'
    | 'attendance_reminder'
    | 'employee_onboarding'
    | 'partner_onboarding'
    | 'client_onboarding'
    | 'holiday_declared'
    | 'company_announcement'
    | 'task_assigned'
    | 'leave_status_updated'
    | 'credential_access_granted'
    | 'document_access_granted'
    | 'note_mentioned';

export interface INotification {
    _id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
