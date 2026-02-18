import { useOutletContext, Link } from 'react-router-dom';
import type { Project } from '@/features/project';
import { Calendar, Users, Building2, Pencil } from 'lucide-react';

export default function ProjectOverviewTab() {
    const { project } = useOutletContext<{ project: Project }>();

    return (
        <div className="space-y-5">
            {/* Quick Actions */}
            <div className="flex justify-end">
                <Link
                    to={`/projects/${project._id}/edit`}
                    className="flex items-center gap-1.5 px-3.5 text-xs font-medium rounded-lg border transition-colors"
                    style={{
                        height: '32px',
                        borderColor: 'var(--color-border-default)',
                        color: 'var(--color-text-secondary)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <Pencil size={13} />
                    Edit Project
                </Link>
            </div>

            {/* Project Info */}
            <div
                className="p-5 rounded-lg border"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <Calendar size={15} style={{ color: 'var(--color-text-muted)' }} />
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Project Information
                    </h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoItem label="Start Date" value={new Date(project.startDate).toLocaleDateString()} />
                    {project.endDate && (
                        <InfoItem label="End Date" value={new Date(project.endDate).toLocaleDateString()} />
                    )}
                    {project.deadline && (
                        <InfoItem label="Deadline" value={new Date(project.deadline).toLocaleDateString()} />
                    )}
                    <InfoItem label="Billing Type" value={project.billingType} capitalize />
                    {project.budget && (
                        <InfoItem label="Budget" value={`${project.currency} ${project.budget.toLocaleString()}`} />
                    )}
                    {project.hourlyRate && (
                        <InfoItem label="Hourly Rate" value={`${project.currency} ${project.hourlyRate}`} />
                    )}
                </div>
            </div>

            {/* Team Members */}
            <div
                className="p-5 rounded-lg border"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <Users size={15} style={{ color: 'var(--color-text-muted)' }} />
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Team Members
                    </h2>
                    <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        {project.assignees.length}
                    </span>
                </div>
                <div className="space-y-2">
                    {project.assignees.map((assignee) => {
                        const user = typeof assignee.userId === 'object' ? assignee.userId : null;
                        return (
                            <div
                                key={typeof assignee.userId === 'string' ? assignee.userId : assignee.userId._id}
                                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg"
                                style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                            >
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {user?.name || 'Unknown'}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {user?.email || ''}
                                    </p>
                                </div>
                                <span
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                                    style={{
                                        backgroundColor: 'var(--color-info-soft)',
                                        color: 'var(--color-info)',
                                    }}
                                >
                                    {assignee.role}
                                </span>
                            </div>
                        );
                    })}
                    {project.assignees.length === 0 && (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                            No team members assigned
                        </p>
                    )}
                </div>
            </div>

            {/* Client Info */}
            {typeof project.clientId === 'object' && (
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 size={15} style={{ color: 'var(--color-text-muted)' }} />
                        <h2
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Client
                        </h2>
                    </div>
                    <div
                        className="px-3.5 py-2.5 rounded-lg"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {project.clientId.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {project.clientId.email}
                        </p>
                        {project.clientId.phone && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {project.clientId.phone}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
    return (
        <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <p
                className={`text-sm font-medium ${capitalize ? 'capitalize' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
            >
                {value}
            </p>
        </div>
    );
}
