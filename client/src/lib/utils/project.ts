import type { Project } from '@/features/project';

export function getProjectMembers(project: Project): { userId: string; name: string; email: string }[] {
    const seen = new Set<string>();
    const members: { userId: string; name: string; email: string }[] = [];
    project.assignees?.forEach((a: any) => {
        let userId: string | undefined;

        if (typeof a.userId === 'string' && a.userId) {
            userId = a.userId.trim();
        } else if (a.userId && typeof a.userId === 'object' && a.userId._id) {
            const id = typeof a.userId._id === 'string' ? a.userId._id : a.userId._id?.toString?.();
            userId = id?.trim();
        } else if (a.employeeId?.userId?._id) {
            const id = typeof a.employeeId.userId._id === 'string'
                ? a.employeeId.userId._id
                : a.employeeId.userId._id?.toString?.();
            userId = id?.trim();
        }

        if (userId && !seen.has(userId)) {
            seen.add(userId);
            members.push({
                userId,
                name: a.displayName ?? a.employeeId?.userId?.name ?? a.partnerEmployeeId?.name ?? 'Team Member',
                email: a.displayEmail ?? a.employeeId?.userId?.email ?? a.partnerEmployeeId?.email ?? '',
            });
        }
    });
    return members;
}

export function getAssigneeMeta(assignee: any) {
    const employee = assignee?.employeeId && typeof assignee.employeeId === 'object' ? assignee.employeeId : null;
    const partnerEmployee = assignee?.partnerEmployeeId && typeof assignee.partnerEmployeeId === 'object' ? assignee.partnerEmployeeId : null;
    const partner = assignee?.partnerId && typeof assignee.partnerId === 'object' ? assignee.partnerId : null;
    const employeeUser = employee?.userId && typeof employee.userId === 'object' ? employee.userId : null;
    const plainUser = assignee?.userId && typeof assignee.userId === 'object' ? assignee.userId : null;

    const sourceType = assignee?.sourceType
        || (assignee?.memberType === 'partner' || assignee?.memberType === 'partner-employee' || partnerEmployee || partner ? 'partner' : 'cu');
    const memberId = assignee?.memberId
        || partner?._id
        || partnerEmployee?._id
        || employee?._id
        || plainUser?._id
        || (typeof assignee?.partnerId === 'string' ? assignee.partnerId : typeof assignee?.partnerEmployeeId === 'string' ? assignee.partnerEmployeeId : assignee?.employeeId || assignee?.userId);
    const displayName = assignee?.displayName
        || (partner?.userId && typeof partner.userId === 'object' ? partner.userId.name : null)
        || partner?.contactPerson
        || partner?.companyName
        || partnerEmployee?.name
        || employeeUser?.name
        || plainUser?.name
        || 'Team Member';
    const displayEmail = assignee?.displayEmail
        || (partner?.userId && typeof partner.userId === 'object' ? partner.userId.email : null)
        || partner?.email
        || partnerEmployee?.email
        || employeeUser?.email
        || plainUser?.email
        || '';
    const displayDesignation = assignee?.displayDesignation
        || (assignee?.memberType === 'partner' || partner ? 'Partner Admin' : '')
        || partnerEmployee?.designation
        || employee?.designation
        || '';
    const displayCode = assignee?.displayCode || (sourceType === 'partner' ? 'Partner' : 'CU');

    return {
        memberId: String(memberId || ''),
        sourceType,
        displayName,
        displayEmail,
        displayDesignation,
        displayCode,
        protectedFromRemoval: Boolean(assignee?.protectedFromRemoval),
    };
}
