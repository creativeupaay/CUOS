import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import type { Project } from '@/features/project';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import { ProjectStatsGrid } from '@/components/organisms/ProjectStatsGrid';
import { ProjectSummaryCard } from '@/components/organisms/ProjectSummaryCard';
import { ProjectTeamPanel } from '@/components/organisms/ProjectTeamPanel';

export default function ProjectOverviewTab() {
    const { project } = useOutletContext<{ project: Project }>();
    const currentUser = useSelector((s: RootState) => s.auth.user);

    // Check if user is super-admin
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);
    const isAdminUser = ['super-admin', 'super_admin', 'admin'].includes(roleName);
    const isPartnerUser = roleName === 'partner';
    const currentPartnerId = typeof currentUser?.partnerId === 'object' ? (currentUser.partnerId as any)?._id : currentUser?.partnerId;
    
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const projectPartnerId = typeof project.partnerId === 'object' ? (project.partnerId as any)?._id : project.partnerId;
    const partnerName = projectPartnerId
        ? (() => {
            const partner = partnersData?.data?.partners?.find((p: any) => p._id === projectPartnerId);
            return partner?.userId?.name || partner?.contactPerson || partner?.companyName;
        })()
        : undefined;
        
    const isPartnerOwnedProject = Boolean(isPartnerUser && currentPartnerId && projectPartnerId && String(currentPartnerId) === String(projectPartnerId));
    const canManageTeam = isSuperAdmin || isPartnerOwnedProject;

    return (
        <div className="space-y-5">
            <ProjectStatsGrid 
                project={project} 
                isSuperAdmin={isSuperAdmin} 
                canViewPaymentDetails={isAdminUser} 
            />

            <ProjectSummaryCard
                startDate={project.startDate}
                endDate={project.endDate}
                overdueDate={(project as any).overdueDate}
                deadline={project.deadline}
                billingType={project.billingType}
                budget={project.budget}
                currency={project.currency}
                hourlyRate={project.hourlyRate}
                partnerName={partnerName}
                client={project.clientId as any}
                isAdminUser={isAdminUser}
                isSuperAdmin={isSuperAdmin}
            />

            <ProjectTeamPanel
                project={project}
                isSuperAdmin={isSuperAdmin}
                canManageTeam={canManageTeam}
                isPartnerOwnedProject={isPartnerOwnedProject}
            />
        </div>
    );
}


