import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    useCreateProjectMutation,
    useUpdateProjectMutation,
    useGetProjectByIdQuery,
} from '@/features/project';
import { useCreateClientMutation, useGetClientsQuery } from '@/features/client/clientApi';
import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, DollarSign, Loader2, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProjectPhase } from '@/features/project/types/types';
import { createPortal } from 'react-dom';
import CurrencyInput from 'react-currency-input-field';
import SelectCurrency from '@/components/ui/CurrencySelect';
import { useAppSelector } from '@/app/hooks';
import ModalPortal from '@/components/ui/ModalPortal';
import { useCreatePartnerMutation, useGetPartnersQuery } from '@/features/partners/partnersApi';

type ProjectFormPageProps = {
    modeOverride?: 'details' | 'phases';
    embedded?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
};

function QuickAddPartnerModal({
    onClose,
    onCreated,
    embedded = false,
}: {
    onClose: () => void;
    onCreated: (partnerId: string) => void;
    embedded?: boolean;
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

    const modalCard = (
        <div
            className="w-full max-w-md rounded-xl border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            onClick={(e) => e.stopPropagation()}
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
    );

    if (embedded && typeof document !== 'undefined') {
        return createPortal(
            <div
                className="fixed top-0 right-0 z-[230] h-full w-full max-w-[860px] flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.24)' }}
                onClick={onClose}
            >
                {modalCard}
            </div>,
            document.body
        );
    }

    return <ModalPortal>{modalCard}</ModalPortal>;
}

function QuickAddClientModal({
    partnerId,
    lockPartner,
    onClose,
    onCreated,
    embedded = false,
}: {
    partnerId?: string;
    lockPartner: boolean;
    onClose: () => void;
    onCreated: (clientId: string, currency?: string) => void;
    embedded?: boolean;
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

    const modalCard = (
        <div
            className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            onClick={(e) => e.stopPropagation()}
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
    );

    if (embedded && typeof document !== 'undefined') {
        return createPortal(
            <div
                className="fixed top-0 right-0 z-[230] h-full w-full max-w-[860px] flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.24)' }}
                onClick={onClose}
            >
                {modalCard}
            </div>,
            document.body
        );
    }

    return <ModalPortal>{modalCard}</ModalPortal>;
}

export default function ProjectFormPage({
    modeOverride,
    embedded = false,
    onClose,
    onSaved,
}: ProjectFormPageProps = {}) {
    const toPaymentCurrency = (value?: string): NonNullable<ProjectPhase['paymentCurrency']> => {
        if (value === 'USD' || value === 'EUR' || value === 'GBP' || value === 'AED') return value;
        return 'INR';
    };

    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const mode = modeOverride ?? searchParams.get('mode'); // 'details' | 'phases' | null
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

    const { data: projectData, isLoading: isProjectLoading } = useGetProjectByIdQuery(id!, { skip: !id, refetchOnMountOrArgChange: 30 });
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
        defaultBankAccount: '',
        phases: [] as Omit<ProjectPhase, '_id'>[],
    });

    const [error, setError] = useState('');
    const phaseRowRefs = useRef<Array<HTMLDivElement | null>>([]);
    const newlyAddedPhaseIndexRef = useRef<number | null>(null);
    const [expandedPaymentSections, setExpandedPaymentSections] = useState<Record<number, boolean>>({});

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
                defaultBankAccount: project.defaultBankAccount || '',
                phases: project.phases ? project.phases.map((p: any) => ({
                    name: p.name,
                    status: p.status,
                    startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : undefined,
                    endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : undefined,
                    hasPayment: p.hasPayment || false,
                    paymentAmount: Number(p.paymentAmount || 0),
                    paymentPercentage: Number(p.paymentPercentage || 0),
                    paymentCurrency: toPaymentCurrency(p.paymentCurrency || project.currency),
                    paymentDueDate: p.paymentDueDate ? new Date(p.paymentDueDate).toISOString().split('T')[0] : undefined,
                    paymentBankAccount: p.paymentBankAccount,
                    gstApplicable: p.gstApplicable !== false,
                    gstRate: Number(p.gstRate || 18),
                    tdsDeducted: Number(p.tdsDeducted || 0),
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
        setForm((prev) => {
            const nextIndex = prev.phases.length;
            newlyAddedPhaseIndexRef.current = nextIndex;
            return {
                ...prev,
                phases: [
                    ...prev.phases,
                    {
                        name: '',
                        status: 'pending',
                        startDate: '',
                        endDate: '',
                        hasPayment: false,
                        paymentAmount: 0,
                        paymentPercentage: 0,
                        paymentCurrency: toPaymentCurrency(prev.currency),
                        gstApplicable: true,
                        gstRate: 18,
                        tdsDeducted: 0,
                    }
                ]
            };
        });
    };

    useEffect(() => {
        const index = newlyAddedPhaseIndexRef.current;
        if (index === null) return;

        const id = window.setTimeout(() => {
            const row = phaseRowRefs.current[index];
            if (!row) return;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstInput = row.querySelector('input');
            if (firstInput instanceof HTMLInputElement) {
                firstInput.focus();
            }
        }, 90);

        newlyAddedPhaseIndexRef.current = null;
        return () => window.clearTimeout(id);
    }, [form.phases.length]);

    const handleRemovePhase = (index: number) => {
        setForm((prev) => {
            const updatedPhases = [...prev.phases];
            updatedPhases.splice(index, 1);
            return { ...prev, phases: updatedPhases };
        });
        setExpandedPaymentSections((prev) => {
            const next: Record<number, boolean> = {};
            Object.entries(prev).forEach(([k, v]) => {
                const key = Number(k);
                if (Number.isNaN(key) || !v) return;
                if (key < index) next[key] = true;
                if (key > index) next[key - 1] = true;
            });
            return next;
        });
    };

    const handlePhaseChange = (index: number, field: keyof ProjectPhase, value: any) => {
        setForm((prev) => {
            const updatedPhases = [...prev.phases];
            updatedPhases[index] = { ...updatedPhases[index], [field]: value } as any;
            return { ...prev, phases: updatedPhases };
        });
    };

    const totalPaymentAllocation = useMemo(
        () => form.phases.reduce((sum, phase) => sum + (phase.hasPayment ? Number(phase.paymentPercentage || 0) : 0), 0),
        [form.phases]
    );
    const paymentAllocationError = totalPaymentAllocation > 100
        ? 'Total payment allocation cannot be more than 100% across all phases.'
        : '';

    const getMaxAllowedPaymentPercentage = (index: number) => {
        const otherAllocated = form.phases.reduce((sum, phase, phaseIndex) => {
            if (phaseIndex === index || !phase.hasPayment) return sum;
            return sum + Number(phase.paymentPercentage || 0);
        }, 0);

        return Math.max(0, 100 - otherAllocated);
    };

    const cleanPhasesForSave = () => form.phases
        .filter((p) => p.name.trim())
        .map((p) => {
            const phase: any = { ...p };

            if (!phase.startDate) delete phase.startDate;
            if (!phase.endDate) delete phase.endDate;
            if (!phase.paymentDueDate) delete phase.paymentDueDate;

            if (!phase.hasPayment) {
                delete phase.paymentAmount;
                delete phase.paymentPercentage;
                delete phase.paymentCurrency;
                delete phase.paymentDueDate;
                delete phase.paymentBankAccount;
                delete phase.gstApplicable;
                delete phase.gstRate;
                delete phase.tdsDeducted;
            } else {
                phase.paymentCurrency = toPaymentCurrency(phase.paymentCurrency || form.currency);
                if (!phase.paymentAmount || Number(phase.paymentAmount) === 0) delete phase.paymentAmount;
                if (!phase.paymentPercentage || Number(phase.paymentPercentage) === 0) delete phase.paymentPercentage;
                if (!phase.tdsDeducted || Number(phase.tdsDeducted) === 0) delete phase.tdsDeducted;
            }

            return phase;
        });

    const isBeforeStartDate = (value?: string) => Boolean(
        value && form.startDate && new Date(`${value}T00:00:00`).getTime() < new Date(`${form.startDate}T00:00:00`).getTime()
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) { setError('Project name is required'); return; }
        if (!form.clientId) { setError('Client is required'); return; }
        if (!form.startDate) { setError('Start date is required'); return; }

        if (isBeforeStartDate(form.endDate) || isBeforeStartDate(form.deadline)) {
            setError('Internal deadline and deadline must be on or after the project start date');
            return;
        }

        for (const phase of form.phases) {
            if (!phase.name.trim()) {
                setError('All phase names must be filled out');
                return;
            }
            if (isBeforeStartDate(phase.endDate) || isBeforeStartDate(phase.paymentDueDate)) {
                setError('Phase due dates must be on or after the project start date');
                return;
            }
        }

        if (totalPaymentAllocation > 100) {
            setError('Total payment allocation cannot be more than 100% across all phases.');
            return;
        }

        const cleanedPhases = cleanPhasesForSave();

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
                defaultBankAccount: form.defaultBankAccount || undefined,
            };
        }

        if (mode === 'phases' || !isEditing) {
            payload = {
                ...payload,
                phases: cleanedPhases.length > 0 ? cleanedPhases : undefined,
            };
        }

        try {
            if (isEditing && id) {
                await updateProject({ id, data: payload }).unwrap();
                if (onSaved) {
                    onSaved();
                } else {
                    navigate(`/projects/${id}`);
                }
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

    const isEditDetailsMode = isEditing && mode !== 'phases';

    return (
        <div
            className={embedded ? 'p-5' : 'px-8 py-6'}
            style={{
                maxWidth: embedded ? 'none' : '800px',
                animation: !embedded && isEditDetailsMode ? 'slideInRight 0.34s cubic-bezier(0.22, 1, 0.36, 1) both' : undefined,
            }}
        >
            {/* Breadcrumb */}
            {!embedded && (
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
            )}

            <h1 className={embedded ? 'text-lg font-semibold mb-7' : 'text-xl font-semibold mb-6'} style={{ color: 'var(--color-text-primary)' }}>
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
                                    min={form.startDate || undefined}
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
                                    min={form.startDate || undefined}
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
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Default Bank Account</label>
                                <select
                                    name="defaultBankAccount"
                                    value={form.defaultBankAccount || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 rounded-lg border text-sm outline-none"
                                    style={inputStyle}
                                >
                                    <option value="">Select Bank Account</option>
                                    <option value="hdfc_gst">HDFC (GST)</option>
                                    <option value="sbi_non_gst">SBI (Non-GST)</option>
                                    <option value="cash">Cash</option>
                                </select>
                            </div>
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

                        {paymentAllocationError && (
                            <p className="mb-3 text-xs font-semibold" style={{ color: '#B91C1C' }}>
                                {paymentAllocationError}
                            </p>
                        )}

                        {form.phases.length > 0 ? (
                            <div className="space-y-4">
                                {form.phases.map((phase, index) => (
                                    <div
                                        key={index}
                                        ref={(el) => {
                                            phaseRowRefs.current[index] = el;
                                        }}
                                        className="p-4 rounded-lg border relative"
                                        style={{
                                            backgroundColor: 'var(--color-bg-subtle)',
                                            borderColor: 'var(--color-border-default)'
                                        }}
                                    >
                                        <div className="absolute top-3 right-3">
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhase(index)}
                                                className="p-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-full border shadow-sm transition-colors cursor-pointer"
                                                style={{ borderColor: 'var(--color-border-default)' }}
                                                title="Remove Phase"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
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
                                                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Due Date</label>
                                                <input
                                                    type="date"
                                                    value={phase.endDate || ''}
                                                    onChange={(e) => handlePhaseChange(index, 'endDate', e.target.value)}
                                                                        min={form.startDate || undefined}
                                                    className="w-full px-3 py-1.5 rounded-lg border text-sm outline-none"
                                                    style={{ ...inputStyle, backgroundColor: 'white' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t mt-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedPaymentSections((prev) => ({ ...prev, [index]: !prev[index] }))}
                                                className="flex items-center justify-between w-full text-xs font-medium py-2"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={14} />
                                                    <span>Payment Tracking</span>
                                                    {phase.hasPayment && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                                            Enabled
                                                        </span>
                                                    )}
                                                </div>
                                                {expandedPaymentSections[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>

                                            {expandedPaymentSections[index] && (
                                                <div className="space-y-3 mt-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={phase.hasPayment || false}
                                                            onChange={(e) => handlePhaseChange(index, 'hasPayment', e.target.checked)}
                                                            className="w-4 h-4 rounded border-gray-300"
                                                        />
                                                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                            This phase has a payment
                                                        </span>
                                                    </label>

                                                    {phase.hasPayment && (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fixed Amount</label>
                                                                    <input
                                                                        type="number"
                                                                        value={phase.paymentAmount ?? ''}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            handlePhaseChange(index, 'paymentAmount', val > 0 ? val : 0);
                                                                        }}
                                                                        placeholder="0"
                                                                        min="0"
                                                                        className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>% of Budget</label>
                                                                    <input
                                                                        type="number"
                                                                        value={phase.paymentPercentage ?? ''}
                                                                        onChange={(e) => {
                                                                            let val = parseFloat(e.target.value);
                                                                            if (isNaN(val) || val < 0) val = 0;
                                                                            const maxAllowed = getMaxAllowedPaymentPercentage(index);
                                                                            if (val > maxAllowed) val = maxAllowed;
                                                                            handlePhaseChange(index, 'paymentPercentage', val);
                                                                            const budget = Number(form.budget || 0);
                                                                            if (budget > 0 && val > 0) {
                                                                                const calculatedAmount = (budget * val) / 100;
                                                                                handlePhaseChange(index, 'paymentAmount', calculatedAmount);
                                                                            } else if (val === 0) {
                                                                                handlePhaseChange(index, 'paymentAmount', 0);
                                                                            }
                                                                        }}
                                                                        placeholder="0"
                                                                        max={getMaxAllowedPaymentPercentage(index)}
                                                                        min="0"
                                                                        step="0.1"
                                                                        className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                    />
                                                                    {Number(phase.paymentPercentage || 0) > 0 && (
                                                                        <div className="mt-1">
                                                                            {Number(form.budget || 0) > 0 ? (
                                                                                <p className="text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>
                                                                                    ≈ {phase.paymentCurrency || form.currency || 'INR'} {((Number(form.budget || 0) * Number(phase.paymentPercentage || 0)) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
                                                                                    <AlertTriangle size={10} />
                                                                                    Set project budget first
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Currency</label>
                                                                    <select
                                                                        value={phase.paymentCurrency || form.currency || 'INR'}
                                                                        onChange={(e) => handlePhaseChange(index, 'paymentCurrency', e.target.value)}
                                                                        className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                    >
                                                                        <option value="INR">INR</option>
                                                                        <option value="USD">USD</option>
                                                                        <option value="EUR">EUR</option>
                                                                        <option value="GBP">GBP</option>
                                                                        <option value="AED">AED</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Payment Due</label>
                                                                    <input
                                                                        type="date"
                                                                        value={phase.paymentDueDate || ''}
                                                                        onChange={(e) => handlePhaseChange(index, 'paymentDueDate', e.target.value)}
                                                                        min={form.startDate || undefined}
                                                                        className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Payment Bank Account</label>
                                                                <select
                                                                    value={phase.paymentBankAccount || form.defaultBankAccount || ''}
                                                                    onChange={(e) => handlePhaseChange(index, 'paymentBankAccount', e.target.value || undefined)}
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                >
                                                                    <option value="">Use default bank account</option>
                                                                    <option value="hdfc_gst">HDFC (GST)</option>
                                                                    <option value="sbi_non_gst">SBI (Non-GST)</option>
                                                                    <option value="cash">Cash</option>
                                                                </select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={phase.gstApplicable !== false}
                                                                        onChange={(e) => handlePhaseChange(index, 'gstApplicable', e.target.checked)}
                                                                        className="w-4 h-4 rounded border-gray-300"
                                                                    />
                                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                        GST Applicable
                                                                    </span>
                                                                </label>

                                                                {phase.gstApplicable !== false && (
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>GST Rate (%)</label>
                                                                            <select
                                                                                value={phase.gstRate || 18}
                                                                                onChange={(e) => handlePhaseChange(index, 'gstRate', parseInt(e.target.value, 10))}
                                                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                            >
                                                                                <option value="0">0%</option>
                                                                                <option value="5">5%</option>
                                                                                <option value="12">12%</option>
                                                                                <option value="18">18%</option>
                                                                                <option value="28">28%</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>TDS Deducted</label>
                                                                            <input
                                                                                type="number"
                                                                                value={phase.tdsDeducted || ''}
                                                                                onChange={(e) => handlePhaseChange(index, 'tdsDeducted', parseFloat(e.target.value) || 0)}
                                                                                placeholder="0"
                                                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
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
                        onClick={() => {
                            if (onClose) {
                                onClose();
                                return;
                            }
                            navigate(isEditing ? `/projects/${id}` : '/projects');
                        }}
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
                    embedded={embedded}
                    onClose={() => setShowPartnerModal(false)}
                    onCreated={handlePartnerCreated}
                />
            )}
            {showClientModal && (
                <QuickAddClientModal
                    embedded={embedded}
                    partnerId={isPartnerUser ? String(userPartnerId || '') : selectedPartnerId || undefined}
                    lockPartner={Boolean(isPartnerUser || selectedPartnerId)}
                    onClose={() => setShowClientModal(false)}
                    onCreated={handleClientCreated}
                />
            )}
        </div>
    );
}
