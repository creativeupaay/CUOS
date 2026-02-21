import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ArrowLeft,
    Save,
    Loader2,
    AlertCircle,
    Layout,
    Target,
    Cpu,
    Calendar,
    DollarSign,
    Plus,
    Trash2,
    FileText
} from 'lucide-react';
import {
    useCreateProposalMutation,
    useGetLeadsQuery,
    useGetProposalByIdQuery,
    useUpdateProposalMutation,
} from '@/features/crm';
import type { Proposal } from '@/features/crm/types/types';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ProposalPDF from '../features/crm/components/Proposal/ProposalPDF';

// Tab Components
import OverviewTab from '../features/crm/components/Proposal/OverviewTab';
import ScopeTab from '../features/crm/components/Proposal/ScopeTab';
import TechTab from '../features/crm/components/Proposal/TechTab';
import ExecutionTab from '../features/crm/components/Proposal/ExecutionTab';
import BudgetTab from '../features/crm/components/Proposal/BudgetTab';

// Schema - We can use a looser schema for portions or the full one. 
// For now, let's keep the base required fields tight and others optional/flexible as defined in validator.
// We'll trust the backend validation for the complex nested structures or add Zod there if needed.
const baseProposalSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    leadId: z.string().min(1, 'Lead is required'),
    validUntil: z.string().optional(),
    // We allow items to be empty if using BudgetV2, but for now let's keep it as is or optional
    items: z.array(z.any()).optional(),
    tax: z.coerce.number().min(0).default(0),
    currency: z.string().default('INR'),
    status: z.string().default('draft'),
});

export default function CrmProposalFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'scope' | 'tech' | 'execution' | 'budget'>('overview');

    // Fetch leads
    const { data: leadsData, isLoading: isLoadingLeads } = useGetLeadsQuery({ limit: 100 });
    const leads = leadsData?.data.leads || [];

    // Fetch proposal
    const { data: proposalData, isLoading: isLoadingProposal } = useGetProposalByIdQuery(id!, { skip: !isEditMode });

    const [createProposal, { isLoading: isCreating }] = useCreateProposalMutation();
    const [updateProposal, { isLoading: isUpdating }] = useUpdateProposalMutation();

    const form = useForm<Partial<Proposal>>({
        resolver: zodResolver(baseProposalSchema) as any,
        defaultValues: {
            currency: 'INR',
            tax: 0,
            items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
            status: 'draft',
            // Initialize empty sections to avoid undefined errors in tabs
            overview: {},
            businessChallenge: { painPoints: [] },
            targetAudience: {},
            goals: {},
            scopeOfWork: { phases: [] },
            features: { phases: [] },
            userFlow: { steps: [] },
            techStack: { integrations: [] },
            nfr: {},
            designRequirements: {},
            deliverables: { phases: [] },
            successMetrics: { business: [], user: [], technical: [] },
            dependencies: { assumptions: [], constraints: [], clientRequirements: [] },
            timeline: { phases: [] },
            team: { resources: [] },
            budgetV2: { includeExclude: [], thirdPartyCosts: [], paymentSchedule: [] },
            futureScope: { items: [] },
            risks: { items: [] },
            terms: { clauses: [] },
            nextSteps: [],
        },
    });

    const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = form;

    const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
        control,
        name: 'items',
    });

    const formData = watch();

    // Calculate totals for the Legacy Items (still useful for quick quotes)
    const items = formData.items || [];
    const taxRate = formData.tax || 0;
    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    // Sync total to form data if needed, or just let backend handle it.
    // We'll update it visually.

    useEffect(() => {
        if (proposalData?.data.proposal) {
            const p = proposalData.data.proposal;
            // Spread to ensure all nested fields are populated
            reset({
                ...p,
                validUntil: p.validUntil ? new Date(p.validUntil).toISOString().split('T')[0] : '',
                leadId: (p.leadId as any)?._id || p.leadId,
            });
        }
    }, [proposalData, reset]);

    const handleChildChange = (newData: Partial<Proposal>) => {
        // Merge new data into form state
        // This is a bit heavy-handed, but ensures sync. 
        // Optimized way: pass specific handlers. simpler way:
        Object.keys(newData).forEach((key) => {
            setValue(key as keyof Proposal, newData[key as keyof Proposal], { shouldDirty: true });
        });
    };

    const onSubmit: SubmitHandler<Partial<Proposal>> = async (data) => {
        setServerError(null);
        try {
            const payload = {
                ...data,
                items: data.items?.map((item: any) => ({
                    ...item,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    total: Number(item.quantity) * Number(item.unitPrice)
                })),
                tax: Number(data.tax),
                subtotal, // Client calculation
                total,    // Client calculation
            };

            if (isEditMode) {
                await updateProposal({ id: id!, data: payload }).unwrap();
            } else {
                await createProposal(payload as any).unwrap();
            }
            navigate('/crm/proposals');
        } catch (error: any) {
            console.error('Failed to save:', error);
            setServerError(error.data?.message || 'Failed to save proposal.');
        }
    };

    const isLoading = isEditMode ? isLoadingProposal : false;
    const isSaving = isCreating || isUpdating;

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Layout },
        { id: 'scope', label: 'Scope', icon: Target },
        { id: 'tech', label: 'Tech', icon: Cpu },
        { id: 'execution', label: 'Execution', icon: Calendar },
        { id: 'budget', label: 'Budget/Terms', icon: DollarSign },
    ];

    return (
        <div className="max-w-6xl mx-auto p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit Proposal' : 'New Proposal'}</h1>
                        <p className="text-sm text-gray-500">Create a comprehensive business proposal</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    {isEditMode && proposalData?.data.proposal && (
                        <PDFDownloadLink
                            document={<ProposalPDF proposal={proposalData.data.proposal} />}
                            fileName={`Proposal-${proposalData.data.proposal.title.replace(/\s+/g, '-')}.pdf`}
                            className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                        >
                            {({ loading }) => (
                                <>
                                    <FileText size={18} />
                                    {loading ? 'Generating PDF...' : 'Download PDF'}
                                </>
                            )}
                        </PDFDownloadLink>
                    )}
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Proposal
                    </button>
                </div>
            </div>

            {serverError && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                    <AlertCircle size={20} />
                    {serverError}
                </div>
            )}

            <form className="space-y-6">
                {/* 1. Core Details (Always Visible) */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proposal Title *</label>
                        <input
                            {...register('title')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="e.g. E-Commerce Platform Revamp"
                        />
                        {errors.title && <p className="text-xs text-red-500 mt-1">{String(errors.title.message)}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                        <select
                            {...register('leadId')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white"
                            disabled={isLoadingLeads}
                        >
                            <option value="">Select Lead...</option>
                            {leads.map((lead) => (
                                <option key={lead._id} value={lead._id}>{lead.name} {lead.company ? `(${lead.company})` : ''}</option>
                            ))}
                        </select>
                        {errors.leadId && <p className="text-xs text-red-500 mt-1">{String(errors.leadId.message)}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                        <input
                            type="date"
                            {...register('validUntil')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200"
                        />
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-gray-200 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? 'border-primary text-primary font-medium'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    {activeTab === 'overview' && (
                        <OverviewTab formData={formData} onChange={handleChildChange} />
                    )}
                    {activeTab === 'scope' && (
                        <ScopeTab formData={formData} onChange={handleChildChange} />
                    )}
                    {activeTab === 'tech' && (
                        <TechTab formData={formData} onChange={handleChildChange} />
                    )}
                    {activeTab === 'execution' && (
                        <ExecutionTab formData={formData} onChange={handleChildChange} />
                    )}
                    {activeTab === 'budget' && (
                        <div className="space-y-8">
                            <BudgetTab formData={formData} onChange={handleChildChange} />

                            {/* Legacy Items Editor (Optional, can be hidden if using only BudgetV2, but keeping primarily for standard/legacy support) */}
                            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Line Items & Calculation</h3>
                                    <button
                                        type="button"
                                        onClick={() => appendItem({ description: '', quantity: 1, unitPrice: 0, total: 0 })}
                                        className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
                                    >
                                        <Plus size={16} /> Add Line Item
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {itemFields.map((field, index) => (
                                        <div key={field.id} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <input
                                                    {...register(`items.${index}.description`)}
                                                    className="w-full px-3 py-2 rounded border border-gray-200"
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                                                    className="w-full px-3 py-2 rounded border border-gray-200"
                                                    placeholder="Qty"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                                                    className="w-full px-3 py-2 rounded border border-gray-200"
                                                    placeholder="Price"
                                                />
                                            </div>
                                            <div className="pt-2 text-right w-32 font-medium">
                                                {((watch(`items.${index}.quantity`) || 0) * (watch(`items.${index}.unitPrice`) || 0)).toLocaleString()}
                                            </div>
                                            <button type="button" onClick={() => removeItem(index)} className="text-red-400 pt-2"><Trash2 size={18} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-col items-end gap-2 text-sm text-gray-700">
                                    <div className="flex justify-between w-64">
                                        <span>Subtotal:</span>
                                        <span>{formData.currency} {subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between w-64 items-center">
                                        <span>Tax (%):</span>
                                        <input
                                            type="number"
                                            {...register('tax', { valueAsNumber: true })}
                                            className="w-16 px-2 py-1 border rounded text-right"
                                        />
                                    </div>
                                    <div className="flex justify-between w-64 text-lg font-bold border-t pt-2">
                                        <span>Total:</span>
                                        <span>{formData.currency} {total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
