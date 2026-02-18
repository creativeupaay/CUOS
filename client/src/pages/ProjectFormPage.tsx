import { useNavigate, useParams } from 'react-router-dom';
import {
    useCreateProjectMutation,
    useUpdateProjectMutation,
    useGetProjectByIdQuery,
} from '@/features/project';
import { useGetClientsQuery } from '@/features/client/clientApi';
import { useState, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProjectFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const { data: projectData, isLoading: isProjectLoading } = useGetProjectByIdQuery(id!, { skip: !id });
    const project = projectData?.data;

    const { data: clientsData } = useGetClientsQuery();
    const clients = (clientsData as any)?.data?.clients || clientsData?.data || [];

    const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
    const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();

    const isSaving = isCreating || isUpdating;

    const [form, setForm] = useState({
        name: '',
        description: '',
        status: 'planning' as string,
        priority: 'medium' as string,
        clientId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        deadline: '',
        budget: '',
        currency: 'INR',
        billingType: 'fixed' as string,
        hourlyRate: '',
    });

    const [error, setError] = useState('');

    useEffect(() => {
        if (project && isEditing) {
            setForm({
                name: project.name || '',
                description: project.description || '',
                status: project.status || 'planning',
                priority: project.priority || 'medium',
                clientId: typeof project.clientId === 'object' ? project.clientId._id : project.clientId || '',
                startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
                endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
                deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
                budget: project.budget?.toString() || '',
                currency: project.currency || 'INR',
                billingType: project.billingType || 'fixed',
                hourlyRate: project.hourlyRate?.toString() || '',
            });
        }
    }, [project, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) { setError('Project name is required'); return; }
        if (!form.clientId) { setError('Client is required'); return; }
        if (!form.startDate) { setError('Start date is required'); return; }

        const payload: any = {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            status: form.status,
            priority: form.priority,
            clientId: form.clientId,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            deadline: form.deadline || undefined,
            budget: form.budget ? Number(form.budget) : undefined,
            currency: form.currency,
            billingType: form.billingType,
            hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        };

        try {
            if (isEditing && id) {
                await updateProject({ id, data: payload }).unwrap();
                navigate(`/projects/${id}`);
            } else {
                const result = await createProject(payload).unwrap();
                navigate(`/projects/${result.data?._id || ''}`);
            }
        } catch (err: any) {
            setError(err?.data?.message || 'Failed to save project');
        }
    };

    if (isEditing && isProjectLoading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading project...
                </div>
            </div>
        );
    }

    // Input style helper
    const inputStyle = {
        height: '36px',
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    const labelStyle = { color: 'var(--color-text-secondary)' };

    return (
        <div className="px-8 py-6" style={{ maxWidth: '800px' }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                <Link
                    to="/projects"
                    className="transition-colors hover:underline"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    Projects
                </Link>
                <ChevronRight size={12} />
                <span style={{ color: 'var(--color-text-primary)' }}>
                    {isEditing ? 'Edit Project' : 'New Project'}
                </span>
            </div>

            <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                {isEditing ? 'Edit Project' : 'Create New Project'}
            </h1>

            {error && (
                <div
                    className="mb-4 px-4 py-2.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
                >
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Basic Information
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Name *</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                                placeholder="Project name"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Description</label>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                                placeholder="Brief project description"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Client *</label>
                                <select
                                    name="clientId"
                                    value={form.clientId}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={inputStyle}
                                >
                                    <option value="">Select a client</option>
                                    {clients.map((client: any) => (
                                        <option key={client._id} value={client._id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Status</label>
                                <select
                                    name="status"
                                    value={form.status}
                                    onChange={handleChange}
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={inputStyle}
                                >
                                    <option value="planning">Planning</option>
                                    <option value="active">Active</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Priority</label>
                            <select
                                name="priority"
                                value={form.priority}
                                onChange={handleChange}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Dates */}
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Dates
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Start Date *</label>
                            <input
                                type="date"
                                name="startDate"
                                value={form.startDate}
                                onChange={handleChange}
                                required
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>End Date</label>
                            <input
                                type="date"
                                name="endDate"
                                value={form.endDate}
                                onChange={handleChange}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Deadline</label>
                            <input
                                type="date"
                                name="deadline"
                                value={form.deadline}
                                onChange={handleChange}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                {/* Budget & Billing */}
                <div
                    className="p-5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Budget & Billing
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Budget</label>
                            <input
                                type="number"
                                name="budget"
                                value={form.budget}
                                onChange={handleChange}
                                min={0}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Currency</label>
                            <select
                                name="currency"
                                value={form.currency}
                                onChange={handleChange}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            >
                                <option value="INR">INR</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Billing Type</label>
                            <select
                                name="billingType"
                                value={form.billingType}
                                onChange={handleChange}
                                className="w-full px-3 rounded-lg border text-sm outline-none"
                                style={inputStyle}
                            >
                                <option value="fixed">Fixed</option>
                                <option value="hourly">Hourly</option>
                                <option value="milestone">Milestone</option>
                            </select>
                        </div>
                        {form.billingType === 'hourly' && (
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Hourly Rate</label>
                                <input
                                    type="number"
                                    name="hourlyRate"
                                    value={form.hourlyRate}
                                    onChange={handleChange}
                                    min={0}
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={inputStyle}
                                    placeholder="0"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{
                            height: '40px',
                            backgroundColor: 'var(--color-primary)',
                        }}
                        onMouseEnter={e => { if (!isSaving) e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >
                        {isSaving && <Loader2 size={15} className="animate-spin" />}
                        {isEditing ? 'Update Project' : 'Create Project'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/projects')}
                        className="px-5 text-sm font-medium rounded-lg border transition-colors"
                        style={{
                            height: '40px',
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
