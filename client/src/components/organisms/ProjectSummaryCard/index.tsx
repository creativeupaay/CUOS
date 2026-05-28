import { Calendar, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InfoItem } from '@/components/molecules/InfoItem';
import { ProjectTabHeader } from '@/components/organisms/ProjectTabHeader';

export interface ProjectSummaryCardProps {
    startDate: string;
    endDate?: string;
    overdueDate?: string;
    deadline?: string;
    billingType: string;
    budget?: number;
    currency?: string;
    hourlyRate?: number;
    partnerName?: string;
    client?: {
        _id: string;
        name: string;
        email: string;
        phone?: string;
    };
    isAdminUser: boolean;
    isSuperAdmin: boolean;
}

export function ProjectSummaryCard({
    startDate,
    endDate,
    overdueDate,
    deadline,
    billingType,
    budget,
    currency,
    hourlyRate,
    partnerName,
    client,
    isAdminUser,
    isSuperAdmin,
}: ProjectSummaryCardProps) {
    return (
        <div className="space-y-5">
            {/* Project Info - Admin */}
            {isAdminUser && (
                <div
                    className="p-5 rounded-[1rem] shadow-premium border-0"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <ProjectTabHeader title="Project Information" icon={Calendar} />
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        <InfoItem label="Start Date" value={new Date(startDate).toLocaleDateString()} />
                        {endDate && (
                            <InfoItem label="Internal Deadline" value={new Date(endDate).toLocaleDateString()} />
                        )}
                        {overdueDate && (
                            <InfoItem label="Overdue Date" value={new Date(overdueDate).toLocaleDateString()} />
                        )}
                        {deadline && (
                            <InfoItem label="Deadline" value={new Date(deadline).toLocaleDateString()} />
                        )}
                        <InfoItem label="Billing Type" value={billingType} capitalize />
                        {budget && (
                            <InfoItem label="Budget" value={`${currency || ''} ${budget.toLocaleString()}`} />
                        )}
                        {hourlyRate && (
                            <InfoItem label="Hourly Rate" value={`${currency || ''} ${hourlyRate}`} />
                        )}
                        {partnerName && <InfoItem label="Partner" value={partnerName} />}
                    </div>
                </div>
            )}

            {/* Client Info - Super Admin Only */}
            {isSuperAdmin && client && (
                <Link
                    to={`/crm/clients/${client._id}`}
                    className="block p-5 rounded-[1rem] shadow-premium border-0 transition-all hover:shadow-md"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <ProjectTabHeader 
                        title="Attached Client Configuration" 
                        icon={Building2} 
                        rightElement={
                            <span className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium">View CRM Record →</span>
                        }
                    />
                    <div
                        className="px-3.5 py-2.5 rounded-lg mt-4"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {client.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {client.email}
                        </p>
                        {client.phone && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {client.phone}
                            </p>
                        )}
                    </div>
                </Link>
            )}
        </div>
    );
}
