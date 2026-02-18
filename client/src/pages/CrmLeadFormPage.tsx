import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ArrowLeft,
    Save,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { useCreateLeadMutation, useGetLeadByIdQuery, useUpdateLeadMutation } from '@/features/crm';
import { useGetUsersQuery } from '@/features/auth/authApi';

// Schema matching the backend validator
const leadSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
    company: z.string().optional(),
    source: z.enum(['website', 'referral', 'cold-call', 'social-media', 'event', 'other']),
    stage: z.enum(['new', 'contacted', 'qualified', 'proposal-sent', 'negotiation', 'closed', 'pending', 'lead-lost', 'follow-up']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    estimatedValue: z.number().min(0).optional(),
    currency: z.string().default('INR'),
    expectedCloseDate: z.string().optional(),
    tags: z.string().optional(), // We'll parse this to array
    assignedTo: z.string().optional(),
    notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

export default function CrmLeadFormPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<LeadFormData>({
        resolver: zodResolver(leadSchema) as any,
        defaultValues: {
            source: 'other',
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

    const users = usersData?.data?.users || [];

    // Load data for edit mode
    useEffect(() => {
        if (leadData?.data.lead) {
            const lead = leadData.data.lead;
            reset({
                ...lead,
                tags: lead.tags.join(', '), // Convert array to comma-separated string
                assignedTo: (lead.assignedTo as any)?._id || lead.assignedTo,
                expectedCloseDate: lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toISOString().split('T')[0] : '',
            });
        }
    }, [leadData, reset]);

    const onSubmit: SubmitHandler<LeadFormData> = async (data) => {
        setServerError(null);
        try {
            // Process tags
            const tagsArray = data.tags
                ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [];

            const payload = {
                ...data,
                tags: tagsArray,
                estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : undefined,
            };

            if (isEditMode) {
                await updateLead({ id: id!, data: payload }).unwrap();
            } else {
                await createLead(payload).unwrap();
            }

            navigate('/crm/leads');
        } catch (error: any) {
            console.error('Failed to save lead:', error);
            setServerError(error.data?.message || 'Failed to save lead. Please try again.');
        }
    };

    if (isEditMode && isLoadingLead) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <Loader2 className="animate-spin text-gray-500 mr-2" />
                Loading lead...
            </div>
        );
    }

    const isLoading = isCreating || isUpdating;

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    to="/crm/leads"
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-500" />
                </Link>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Edit Lead' : 'Create New Lead'}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {isEditMode ? 'Update lead information' : 'Add a new potential deal to your pipeline'}
                    </p>
                </div>
            </div>

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
                                Company
                            </label>
                            <input
                                {...register('company')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Acme Inc."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email <span className="text-red-500">*</span>
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
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                <input
                                    type="number"
                                    {...register('estimatedValue', { valueAsNumber: true })}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Source
                            </label>
                            <select
                                {...register('source')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="website">Website</option>
                                <option value="referral">Referral</option>
                                <option value="cold-call">Cold Call</option>
                                <option value="social-media">Social Media</option>
                                <option value="event">Event</option>
                                <option value="other">Other</option>
                            </select>
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
                <div className="flex justify-end gap-3 pt-4 pb-8">
                    <button
                        type="button"
                        onClick={() => navigate('/crm/leads')}
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
        </div>
    );
}
