import { useOutletContext } from 'react-router-dom';
import type { Project } from '@/features/project';

export default function ProjectOverviewTab() {
    const { project } = useOutletContext<{ project: Project }>();

    return (
        <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-xl font-semibold mb-4">Project Information</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-600">Start Date</label>
                        <p className="font-medium">
                            {new Date(project.startDate).toLocaleDateString()}
                        </p>
                    </div>
                    {project.endDate && (
                        <div>
                            <label className="text-sm text-gray-600">End Date</label>
                            <p className="font-medium">
                                {new Date(project.endDate).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                    {project.deadline && (
                        <div>
                            <label className="text-sm text-gray-600">Deadline</label>
                            <p className="font-medium">
                                {new Date(project.deadline).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                    {project.budget && (
                        <div>
                            <label className="text-sm text-gray-600">Budget</label>
                            <p className="font-medium">
                                {project.currency} {project.budget.toLocaleString()}
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="text-sm text-gray-600">Billing Type</label>
                        <p className="font-medium capitalize">{project.billingType}</p>
                    </div>
                    {project.hourlyRate && (
                        <div>
                            <label className="text-sm text-gray-600">Hourly Rate</label>
                            <p className="font-medium">
                                {project.currency} {project.hourlyRate}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Team Members */}
            <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-xl font-semibold mb-4">Team Members</h2>
                <div className="space-y-3">
                    {project.assignees.map((assignee) => {
                        const user = typeof assignee.userId === 'object' ? assignee.userId : null;
                        return (
                            <div
                                key={typeof assignee.userId === 'string' ? assignee.userId : assignee.userId._id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded"
                            >
                                <div>
                                    <p className="font-medium">{user?.name || 'Unknown'}</p>
                                    <p className="text-sm text-gray-600">{user?.email || ''}</p>
                                </div>
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm capitalize">
                                    {assignee.role}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Client Info */}
            {typeof project.clientId === 'object' && (
                <div className="bg-white p-6 rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Client</h2>
                    <div>
                        <p className="font-medium">{project.clientId.name}</p>
                        <p className="text-sm text-gray-600">{project.clientId.email}</p>
                        {project.clientId.phone && (
                            <p className="text-sm text-gray-600">{project.clientId.phone}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
