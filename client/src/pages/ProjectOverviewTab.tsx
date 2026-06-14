import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import type { Project } from '@/features/project';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import type { Partner } from '@/features/partners/partnersApi';
import type { Client } from '@/features/client';
import type { Role } from '@/features/auth';
import { ProjectStatsGrid } from '@/components/organisms/ProjectStatsGrid';
import { ProjectSummaryCard } from '@/components/organisms/ProjectSummaryCard';
import { ProjectTeamPanel } from '@/components/organisms/ProjectTeamPanel';

export default function ProjectOverviewTab() {
    const { project } = useOutletContext<{ project: Project }>();
    const currentUser = useSelector((s: RootState) => s.auth.user);

    // Check if user is super-admin
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as Role).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);
    const isAdminUser = ['super-admin', 'super_admin', 'admin'].includes(roleName);
    const isPartnerUser = roleName === 'partner';
    const currentPartnerId = typeof currentUser?.partnerId === 'object' ? (currentUser.partnerId as { _id?: string })?._id : currentUser?.partnerId;
    
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const projectPartnerId = typeof project.partnerId === 'object' ? (project.partnerId as { _id?: string })?._id : project.partnerId;
    const partnerName = projectPartnerId
        ? (() => {
            const partner = partnersData?.data?.partners?.find((p: Partner) => p._id === projectPartnerId);
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
                overdueDate={project.overdueDate}
                deadline={project.deadline}
                billingType={project.billingType}
                budget={project.budget}
                currency={project.currency}
                hourlyRate={project.hourlyRate}
                gstApplicable={project.gstApplicable}
                gstRate={project.gstRate}
                budgetWithGst={project.budgetWithGst}
                partnerName={partnerName}
                client={
                    project.clientId && typeof project.clientId === 'object'
                        ? {
                              _id: (project.clientId as Client)._id,
                              name: (project.clientId as Client).name,
                              email: (project.clientId as Client).email || '',
                              phone: (project.clientId as Client).phone,
                          }
                        : undefined
                }
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


