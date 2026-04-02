import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    useCreateProjectMutation,
    useUpdateProjectMutation,
    useGetProjectByIdQuery,
} from '@/features/project';
import { useCreateClientMutation, useGetClientsQuery } from '@/features/client/clientApi';
import { useState, useEffect } from 'react';
import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProjectPhase } from '@/features/project/types/types';
import CurrencyInput from 'react-currency-input-field';
import SelectCurrency from '@/components/ui/CurrencySelect';
import { useAppSelector } from '@/app/hooks';
import ModalPortal from '@/components/ui/ModalPortal';
import { useCreatePartnerMutation, useGetPartnersQuery } from '@/features/partners/partnersApi';

function QuickAddPartnerModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (partnerId: string) => void;
}) {
    const [createPartner, { isLoading }] = useCreatePartnerMutation();
    const [form, setForm] = useState({ name: '', email: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await createPartner(form).unwrap();
            onCreated(result.data.partner._id);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to create partner');
        }
    };

    return (
        <ModalPortal>
            <div
                className="w-full max-w-md rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Add New Partner</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Partner Name *</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            required
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Email *</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                            required
                            className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isLoading ? 'Creating...' : 'Add Partner'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
}

function QuickAddClientModal({
    partnerId,
    lockPartner,
    onClose,
    onCreated,
}: {
    partnerId?: string;
    lockPartner: boolean;
    onClose: () => void;
    onCreated: (clientId: string, currency?: string) => void;
}) {
    const [createClient, { isLoading }] = useCreateClientMutation();
    const [form, setForm] = useState({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        currency: 'INR',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await createClient({
                name: form.name,
                companyName: form.companyName || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                billingDetails: { currency: form.currency },
                partnerId: partnerId || undefined,
            }).unwrap();
            onCreated(result.data.client._id, result.data.client.billingDetails?.currency || form.currency);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to create client');
        }
    };

    return (
        <ModalPortal>
            <div
                className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Add New Client</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Client Name *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                required
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Company Name</label>
                            <input
                                value={form.companyName}
                                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Phone</label>
                            <input
                                value={form.phone}
                                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Currency</label>
                        <SelectCurrency
                            value={form.currency}
                            onCurrencySelected={(val: string) => setForm((prev) => ({ ...prev, currency: val }))}
                            className="w-full px-3 rounded-lg border text-sm outline-none bg-white cursor-pointer"
                            style={{ height: '36px', borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    {lockPartner && partnerId && (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            This client will be linked to the currently selected partner.
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isLoading ? 'Creating...' : 'Add Client'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
}

export default function ProjectFormPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 'details' | 'phases' | null
    const isEditing = Boolean(id);
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? String((user.role as any).name || '')
            : String(user.role)
        : '';
    const isPartnerUser = roleName.toLowerCase() === 'partner';
    const isAdminUser = ['super-admin', 'super_admin', 'admin'].includes(roleName.toLowerCase());
    const userPartnerId = typeof user?.partnerId === 'object' ? (user.partnerId as any)?._id : user?.partnerId;

    const { data: projectData, isLoading: isProjectLoading } = useGetProjectByIdQuery(id!, { skip: !id });
    const project = projectData?.data;
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [showClientModal, setShowClientModal] = useState(false);

    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const { data: clientsData, refetch: refetchClients } = useGetClientsQuery({
        partnerId: isPartnerUser ? String(userPartnerId || '') : selectedPartnerId || undefined,
        limit: 200,
    });
    const { data: partnersData, refetch: refetchPartners } = useGetPartnersQuery({ limit: 200 }, { skip: !isAdminUser });
    const partners = partnersData?.data?.partners || [];
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
        phases: [] as Omit<ProjectPhase, '_id'>[],
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
                phases: project.phases ? project.phases.map((p: any) => ({
                    name: p.name,
                    status: p.status,
                    startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : undefined,
                    endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : undefined,
                })) : [],
            });
            const existingPartnerId =
                typeof project.partnerId === 'object' ? (project.partnerId as any)?._id : project.partnerId;
            if (existingPartnerId) {
                setSelectedPartnerId(String(existingPartnerId));
            }
        }
    }, [project, isEditing]);

    useEffect(() => {
        if (isPartnerUser && userPartnerId) {
            setSelectedPartnerId(String(userPartnerId));
        }
    }, [isPartnerUser, userPartnerId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleAddPhase = () => {
        setForm({
            ...form,
            phases: [
                ...form.phases,
                { name: '', status: 'pending', startDate: '', endDate: '' }
            ]
        });
    };

    const handleRemovePhase = (index: number) => {
        const updatedPhases = [...form.phases];
        updatedPhases.splice(index, 1);
        setForm({ ...form, phases: updatedPhases });
    };

    const handlePhaseChange = (index: number, field: keyof ProjectPhase, value: string) => {
        const updatedPhases = [...form.phases];
        updatedPhases[index] = { ...updatedPhases[index], [field]: value } as any;
        setForm({ ...form, phases: updatedPhases });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) { setError('Project name is required'); return; }
        if (!form.clientId) { setError('Client is required'); return; }
        if (!form.startDate) { setError('Start date is required'); return; }

        for (const phase of form.phases) {
            if (!phase.name.trim()) {
                setError('All phase names must be filled out');
                return;
            }
        }

        let payload: any = {};

        if (mode === 'details' || !isEditing) {
            payload = {
                ...payload,
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                status: form.status,
                priority: form.priority,
                clientId: form.clientId,
                partnerId: isPartnerUser ? String(userPartnerId || '') : selectedPartnerId || undefined,
                startDate: form.startDate,
                endDate: form.endDate || undefined,
                deadline: form.deadline || undefined,
                budget: form.budget ? Number(form.budget) : undefined,
                currency: form.currency,
                billingType: form.billingType,
                hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
            };
        }

        if (mode === 'phases' || !isEditing) {
            payload = {
                ...payload,
                phases: form.phases.length > 0 ? form.phases : undefined,
            };
        }

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

    const handlePartnerCreated = async (partnerId: string) => {
        await refetchPartners();
        setSelectedPartnerId(partnerId);
        setForm((prev) => ({ ...prev, clientId: '' }));
        setShowPartnerModal(false);
    };

    const handleClientCreated = async (clientId: string, currency?: string) => {
        await refetchClients();
        setForm((prev) => ({
            ...prev,
            clientId,
            currency: currency || prev.currency,
        }));
        setShowClientModal(false);
    };

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
                {isEditing && project && (
                    <>
                        <ChevronRight size={12} />
                        <Link
                            to={`/projects/${id}`}
                            className="transition-colors hover:underline"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {project.name}
                        </Link>
                    </>
                )}
                <ChevronRight size={12} />
                <span style={{ color: 'var(--color-text-primary)' }}>
                    {isEditing ? 'Edit Project' : 'New Project'}
                </span>
            </div>

            <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                {isEditing ? (mode === 'phases' ? 'Edit Project Phases' : 'Edit Project Details') : 'Create New Project'}
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
                {(mode === 'details' || !isEditing) && (
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
                                {isAdminUser && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-medium" style={labelStyle}>Partner</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowPartnerModal(true)}
                                                className="text-xs font-medium cursor-pointer"
                                                style={{ color: 'var(--color-primary)' }}
                                            >
                                                + Add New Partner
                                            </button>
                                        </div>
                                        <select
                                            value={selectedPartnerId}
                                            onChange={(e) => {
                                                setSelectedPartnerId(e.target.value);
                                                setForm((prev) => ({ ...prev, clientId: '' }));
                                            }}
                                            className="w-full px-3 rounded-lg border text-sm outline-none"
                                            style={inputStyle}
                                        >
                                            <option value="">No Partner</option>
                                            {partners.map((partner: any) => (
                                                <option key={partner._id} value={partner._id}>
                                                    {partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-medium" style={labelStyle}>Client *</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowClientModal(true)}
                                            className="text-xs font-medium cursor-pointer"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            + Add New Client
                                        </button>
                                    </div>
                                    <select
                                        name="clientId"
                                        value={form.clientId}
                                        onChange={(e) => {
                                            const selectedClientId = e.target.value;
                                            const selectedClient = clients.find((c: any) => c._id === selectedClientId);

                                            setForm({
                                                ...form,
                                                clientId: selectedClientId,
                                                // Auto-fetch currency, default to INR if not set
                                                currency: selectedClient?.billingDetails?.currency || 'INR'
                                            });
                                        }}
                                        required
                                        className="w-full px-3 rounded-lg border text-sm outline-none"
                                        style={inputStyle}
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map((client: any) => (
                                            <option key={client._id} value={client._id}>
                                                {client.name} {client.companyName ? `(${client.companyName})` : ''}
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
                )}

                {/* Dates */}
                {(mode === 'details' || !isEditing) && (
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
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Internal Deadline</label>
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
                )}

                {/* Budget & Billing */}
                {(mode === 'details' || !isEditing) && (
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
                                <CurrencyInput
                                    id="budget"
                                    name="budget"
                                    placeholder="0.00"
                                    decimalsLimit={2}
                                    value={form.budget}
                                    onValueChange={(value) => setForm({ ...form, budget: value || '' })}
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Currency</label>
                                <SelectCurrency
                                    value={form.currency}
                                    onCurrencySelected={(val: string) => setForm({ ...form, currency: val })}
                                    className="w-full px-3 rounded-lg border text-sm outline-none bg-white cursor-pointer"
                                    style={inputStyle}
                                />
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
                                    <CurrencyInput
                                        id="hourlyRate"
                                        name="hourlyRate"
                                        placeholder="0.00"
                                        decimalsLimit={2}
                                        value={form.hourlyRate}
                                        onValueChange={(value) => setForm({ ...form, hourlyRate: value || '' })}
                                        className="w-full px-3 rounded-lg border text-sm outline-none"
                                        style={inputStyle}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Project Phases */}
                {(mode === 'phases' || !isEditing) && (
                    <div
                        className="p-5 rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Project Phases
                            </h2>
                            <button
                                type="button"
                                onClick={handleAddPhase}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                <Plus size={14} /> Add Phase
                            </button>
                        </div>

                        {form.phases.length > 0 ? (
                            <div className="space-y-4">
                                {form.phases.map((phase, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-lg border relative grid grid-cols-2 lg:grid-cols-4 gap-4"
                                        style={{
                                            backgroundColor: 'var(--color-bg-subtle)',
                                            borderColor: 'var(--color-border-default)'
                                        }}
                                    >
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Phase Name *</label>
                                            <input
                                                value={phase.name}
                                                onChange={(e) => handlePhaseChange(index, 'name', e.target.value)}
                                                required
                                                className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                                placeholder="e.g. Design"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Status</label>
                                            <select
                                                value={phase.status}
                                                onChange={(e) => handlePhaseChange(index, 'status', e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Start Date</label>
                                            <input
                                                type="date"
                                                value={phase.startDate || ''}
                                                onChange={(e) => handlePhaseChange(index, 'startDate', e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>End Date</label>
                                            <input
                                                type="date"
                                                value={phase.endDate || ''}
                                                onChange={(e) => handlePhaseChange(index, 'endDate', e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                                                style={{ ...inputStyle, backgroundColor: 'white' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhase(index)}
                                                className="absolute top-0 -right-2 p-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-full border shadow-sm transition-colors cursor-pointer z-10"
                                                style={{ transform: 'translate(50%, -50%)', borderColor: 'var(--color-border-default)' }}
                                                title="Remove Phase"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="text-center py-6 px-4 rounded-lg border border-dashed"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-subtle)'
                                }}
                            >
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                    No phases created yet.
                                </p>
                            </div>
                        )}
                    </div>
                )}

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
                        onClick={() => navigate(isEditing ? `/projects/${id}` : '/projects')}
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

            {showPartnerModal && (
                <QuickAddPartnerModal
                    onClose={() => setShowPartnerModal(false)}
                    onCreated={handlePartnerCreated}
                />
            )}
            {showClientModal && (
                <QuickAddClientModal
                    partnerId={isPartnerUser ? String(userPartnerId || '') : selectedPartnerId || undefined}
                    lockPartner={Boolean(isPartnerUser || selectedPartnerId)}
                    onClose={() => setShowClientModal(false)}
                    onCreated={handleClientCreated}
                />
            )}
        </div>
    );
}
