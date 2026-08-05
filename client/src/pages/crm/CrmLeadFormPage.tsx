import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Save,
    Loader2,
    AlertCircle,
    X,
} from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { useCreateLeadMutation, useGetLeadByIdQuery, useUpdateLeadMutation } from '@/features/crm';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import CurrencyInput from 'react-currency-input-field';
import SelectCurrency from '@/components/ui/CurrencySelect';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { logger } from '@/utils/logger';

// Schema matching the backend validator
const leadSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    company: z.string().min(1, 'Company name is required'),
    source: z.string().optional(),
    stage: z.enum(['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    estimatedValue: z.any().optional(),
    currency: z.string().default('INR'),
    expectedCloseDate: z.string().optional(),
    tags: z.string().optional(), // We'll parse this to array
    assignedTo: z.string().optional(),
    partnerId: z.string().optional(),
    notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

export default function CrmLeadFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const location = useLocation();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const authUser = useAppSelector((state) => state.auth.user);

    const roleName = authUser?.role
        ? typeof authUser.role === 'object'
            ? (authUser.role as any).name?.toLowerCase()
            : String(authUser.role).toLowerCase()
        : '';
    const isPartnerUser = roleName === 'partner';
    const allowPartnerSelection = !isPartnerUser;

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<LeadFormData>({
        resolver: zodResolver(leadSchema) as any,
        defaultValues: {
            source: '',
            stage: 'new',
            priority: 'medium',
            currency: 'INR',
        },
    });

    // API Hooks
    const [createLead, { isLoading: isCreating }] = useCreateLeadMutation();
    const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();
    const { data: leadData, isLoading: isLoadingLead } = useGetLeadByIdQuery(id!, { skip: !isEditMode });
    const { data: usersData } = useGetUsersQuery(); // For assignment
    const { data: partnersData } = useGetPartnersQuery({ limit: 200 }, { skip: !allowPartnerSelection });

    const users = usersData?.data?.users || [];
    const partners = partnersData?.data?.partners || [];

    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    const fallbackReturnPath = isEditMode && id ? `/crm/leads/${id}` : '/crm/leads';
    const closeTarget = returnTo || fallbackReturnPath;

    useBodyScrollLock(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsDrawerVisible(true), 12);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [closeTarget]);

    // Load data for edit mode
    useEffect(() => {
        if (leadData?.data.lead) {
            const lead = leadData.data.lead;
            const leadPartnerId = typeof lead.partnerId === 'object' ? (lead.partnerId as any)?._id : lead.partnerId;

            reset({
                ...lead,
                tags: lead.tags.join(', '), // Convert array to comma-separated string
                assignedTo: (lead.assignedTo as any)?._id || lead.assignedTo,
                partnerId: leadPartnerId || '',
                expectedCloseDate: lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split('T')[0] : '',
            });
            setSelectedPartnerId(leadPartnerId || '');
        }
    }, [leadData, reset]);

    const handleClose = () => {
        setIsDrawerVisible(false);
        window.setTimeout(() => {
            navigate(closeTarget, { replace: true });
        }, 280);
    };

    const onSubmit: SubmitHandler<LeadFormData> = async (data) => {
        setServerError(null);
        try {
            // Process tags
            const tagsArray = data.tags
                ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [];

            const payload: any = {
                name: data.name,
                company: data.company,
                tags: tagsArray,
                stage: data.stage,
                priority: data.priority,
                currency: data.currency || 'INR',
            };

            // Only include optional fields if they have values
            if (data.email) payload.email = data.email;
            if (data.phone) payload.phone = data.phone;
            if (data.source) payload.source = data.source;
            if (data.estimatedValue) payload.estimatedValue = Number(data.estimatedValue);
            if (data.expectedCloseDate) payload.expectedCloseDate = data.expectedCloseDate;
            if (data.assignedTo) payload.assignedTo = data.assignedTo;
            if (data.notes) payload.notes = data.notes;
            if (allowPartnerSelection) {
                if (selectedPartnerId) {
                    payload.partnerId = selectedPartnerId;
                } else if (isEditMode) {
                    payload.partnerId = null;
                }
            }

            if (isEditMode) {
                await updateLead({ id: id!, data: payload }).unwrap();
            } else {
                await createLead(payload).unwrap();
            }

            navigate(closeTarget, { replace: true });
        } catch (error: any) {
            logger.error('Failed to save lead:', error);
            setServerError(error.data?.message || 'Failed to save lead. Please try again.');
        }
    };

    const isLoading = isCreating || isUpdating;

    return (
        <div className="fixed inset-0 z-[220] flex justify-end overflow-hidden">
            <button
                onClick={handleClose}
                className={`fixed inset-0 bg-slate-950/5 backdrop-blur-0 transition-opacity duration-200 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'}`}
                aria-label="Close lead form"
            />

            <aside
                className={`relative h-full w-full max-w-[860px] bg-white border-l border-gray-200 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-label={isEditMode ? 'Edit lead' : 'Create lead'}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Lead' : 'Create New Lead'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {isEditMode ? 'Update lead information' : 'Add a new potential deal to your pipeline'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {isEditMode && isLoadingLead ? (
                        <div className="flex items-center justify-center h-[50vh] text-gray-500">
                            <Loader2 className="animate-spin mr-2" />
                            Loading lead...
                        </div>
                    ) : (
                        <>
                            {serverError && (
                                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200">
                                    <AlertCircle size={20} />
                                    {serverError}
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
                                {/* Basic Info */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Basic Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Contact Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                {...register('name')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="John Doe"
                                            />
                                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Company <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                {...register('company')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="Acme Inc."
                                            />
                                            {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company.message}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Email
                                            </label>
                                            <input
                                                {...register('email')}
                                                type="email"
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="john@example.com"
                                            />
                                            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Phone
                                            </label>
                                            <input
                                                {...register('phone')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="+1 234 567 890"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Deal Details */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                    <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Deal Details</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Stage
                                            </label>
                                            <select
                                                {...register('stage')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="new">New</option>
                                                <option value="contacted">Contacted</option>
                                                <option value="qualified">Qualified</option>
                                                <option value="proposal-sent">Proposal Sent</option>
                                                <option value="negotiation">Negotiation</option>
                                                <option value="closed">Closed</option>
                                                <option value="pending">Pending</option>
                                                <option value="lead-lost">Lead Lost</option>
                                                <option value="follow-up">Follow Up</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Priority
                                            </label>
                                            <select
                                                {...register('priority')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="critical">Critical</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Estimated Value
                                            </label>
                                            <div className="flex gap-2">
                                                <SelectCurrency
                                                    value={watch('currency')}
                                                    onCurrencySelected={(val: string) => setValue('currency', val as any)}
                                                    className="w-[120px] px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                                />
                                                <div className="relative flex-1">
                                                    <CurrencyInput
                                                        id="estimatedValue"
                                                        name="estimatedValue"
                                                        placeholder="0.00"
                                                        decimalsLimit={2}
                                                        value={watch('estimatedValue')}
                                                        onValueChange={(value) => setValue('estimatedValue', value ? Number(value) : undefined)}
                                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Source
                                            </label>
                                            <input
                                                {...register('source')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="e.g. Website, Referral, LinkedIn, Cold Call..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Expected Close Date
                                            </label>
                                            <input
                                                type="date"
                                                {...register('expectedCloseDate')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Assigned To
                                            </label>
                                            <select
                                                {...register('assignedTo')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="">Select User</option>
                                                {users.map((user: any) => (
                                                    <option key={user._id} value={user._id}>
                                                        {user.name} ({user.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {allowPartnerSelection && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Referred By Partner (Optional)
                                                </label>
                                                <select
                                                    value={selectedPartnerId}
                                                    onChange={(e) => {
                                                        setSelectedPartnerId(e.target.value);
                                                        setValue('partnerId', e.target.value);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
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

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Tags (comma separated)
                                            </label>
                                            <input
                                                {...register('tags')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                placeholder="high-priority, referral, q1-deal"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Notes
                                            </label>
                                            <textarea
                                                {...register('notes')}
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                                                placeholder="Additional details about the lead..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Form Actions */}
                                <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 -mx-6 px-6 py-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={18} />
                                                {isEditMode ? 'Update Lead' : 'Create Lead'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}
