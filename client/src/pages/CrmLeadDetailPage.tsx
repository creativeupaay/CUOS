import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    Mail,
    Building,
    Clock,
    CheckCircle,
    FileText,
    User,
    MessageSquare,
    Loader2,
    AlertCircle,
    MoreVertical,
    Send,
    UserCircle,
    Lock,
} from 'lucide-react';
import {
    useGetLeadByIdQuery,
    useAddLeadActivityMutation,
    useCloseLeadDealMutation,
    useUpdateLeadMutation,
    useGetProposalsQuery,
} from '@/features/crm';
import type { Lead } from '@/features/crm';

const stageColors: Record<string, { bg: string; text: string }> = {
    new: { bg: 'var(--color-info-soft)', text: 'var(--color-info)' },
    contacted: { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)' },
    qualified: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    'proposal-sent': { bg: '#E0E7FF', text: '#4338CA' },
    negotiation: { bg: '#F3E8FF', text: '#7E22CE' },
    closed: { bg: 'var(--color-success)', text: '#FFFFFF' },
    pending: { bg: '#FEF3C7', text: '#92400E' },
    'lead-lost': { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
    'follow-up': { bg: '#DBEAFE', text: '#1D4ED8' },
};

export default function CrmLeadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activityType, setActivityType] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
    const [activityDesc, setActivityDesc] = useState('');

    const { data: leadData, isLoading: leadLoading, error: leadError } = useGetLeadByIdQuery(id!);
    const { data: proposalsData } = useGetProposalsQuery({ leadId: id }, { skip: !id });

    const [addActivity, { isLoading: isAddingActivity }] = useAddLeadActivityMutation();
    const [closeDeal, { isLoading: isClosingDeal }] = useCloseLeadDealMutation();
    const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();

    const lead = leadData?.data.lead;
    const proposals = proposalsData?.data.proposals || [];

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activityDesc.trim()) return;

        try {
            await addActivity({
                leadId: id!,
                data: {
                    type: activityType,
                    description: activityDesc,
                    date: new Date().toISOString(),
                },
            }).unwrap();
            setActivityDesc('');
        } catch (error) {
            console.error('Failed to add activity:', error);
        }
    };

    const handleCloseDeal = async () => {
        if (!window.confirm('Are you sure you want to close this deal? A client record will be created automatically.')) return;

        try {
            const result = await closeDeal(id!).unwrap();
            navigate(`/crm/clients/${result.data.client._id}`);
        } catch (error) {
            console.error('Failed to close deal:', error);
            alert('Failed to close deal. Please try again.');
        }
    };

    const handleStageChange = async (newStage: string) => {
        if (!lead || lead.isLocked) return;
        try {
            await updateLead({ id: id!, data: { stage: newStage as Lead['stage'] } }).unwrap();
        } catch (error) {
            console.error('Failed to update stage:', error);
        }
    };

    const formatCurrency = (amount?: number, currency = 'INR') => {
        if (amount === undefined) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (leadLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <Loader2 className="animate-spin text-gray-500 mr-2" />
                Loading lead details...
            </div>
        );
    }

    if (leadError || !lead) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] text-red-500">
                <AlertCircle className="mr-2" />
                Error loading lead details
            </div>
        );
    }

    const activityIcons = {
        note: MessageSquare,
        call: Phone,
        email: Mail,
        meeting: User,
    };

    return (
        <div className="max-w-[1600px] mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-500" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
                            {lead.isLocked ? (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                                    <Lock size={12} />
                                    {lead.stage} (Locked)
                                </span>
                            ) : (
                                <div className="relative group">
                                    <select
                                        value={lead.stage}
                                        onChange={(e) => handleStageChange(e.target.value)}
                                        disabled={isUpdating}
                                        className="appearance-none cursor-pointer pl-3 pr-8 py-1 rounded-full text-xs font-semibold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/20"
                                        style={{
                                            backgroundColor: stageColors[lead.stage]?.bg,
                                            color: stageColors[lead.stage]?.text,
                                        }}
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
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <MoreVertical size={12} style={{ color: stageColors[lead.stage]?.text }} />
                                    </div>
                                </div>
                            )}
                            {lead.convertedClientId && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                    Converted
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {lead.company && (
                                <span className="flex items-center gap-1.5">
                                    <Building size={14} />
                                    {lead.company}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Clock size={14} />
                                Created {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!lead.isLocked && !lead.convertedClientId && (
                        <button
                            onClick={handleCloseDeal}
                            disabled={isClosingDeal}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {isClosingDeal ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            Close Deal
                        </button>
                    )}
                    {lead.isLocked && (
                        <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
                            <Lock size={16} />
                            Lead Closed
                        </span>
                    )}
                    <button
                        onClick={() => navigate(`/crm/leads/${id}/edit`)}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                        title="Edit Lead"
                    >
                        <FileText size={20} />
                    </button>
                    <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Details */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Contact Info Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="text-gray-400 mt-1" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Email</p>
                                    <a href={`mailto:${lead.email}`} className="text-sm text-blue-600 hover:underline">
                                        {lead.email}
                                    </a>
                                </div>
                            </div>
                            {lead.phone && (
                                <div className="flex items-start gap-3">
                                    <Phone className="text-gray-400 mt-1" size={18} />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Phone</p>
                                        <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 hover:underline">
                                            {lead.phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3">
                                <UserCircle className="text-gray-400 mt-1" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Assigned To</p>
                                    <p className="text-sm text-gray-600">{(lead.assignedTo as any)?.name || 'Unassigned'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Deal Info Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h2 className="text-lg font-semibold mb-4">Deal Details</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Value</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">
                                        {formatCurrency(lead.estimatedValue, lead.currency)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Priority</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    lead.priority === 'critical' ? 'var(--color-danger)' :
                                                        lead.priority === 'high' ? '#EA580C' :
                                                            lead.priority === 'medium' ? 'var(--color-warning)' :
                                                                'var(--color-success)',
                                            }}
                                        />
                                        <span className="text-sm font-medium capitalize">{lead.priority}</span>
                                    </div>
                                </div>
                            </div>

                            {lead.source && (
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Source</p>
                                    <p className="text-sm text-gray-700 mt-1 capitalize">{lead.source}</p>
                                </div>
                            )}

                            {lead.expectedCloseDate && (
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Expected Close</p>
                                    <p className="text-sm text-gray-700 mt-1">
                                        {new Date(lead.expectedCloseDate).toLocaleDateString()}
                                    </p>
                                </div>
                            )}

                            {lead.tags.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Tags</p>
                                    <div className="flex flex-wrap gap-2">
                                        {lead.tags.map((tag) => (
                                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Activity & Proposals */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Add Activity */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex gap-2 mb-3 border-b border-gray-100 pb-2">
                            {(['note', 'call', 'email', 'meeting'] as const).map((type) => {
                                const Icon = activityIcons[type];
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setActivityType(type)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${activityType === type
                                            ? 'bg-gray-100 text-gray-900 font-medium'
                                            : 'text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon size={14} />
                                        <span className="capitalize">{type}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <form onSubmit={handleAddActivity}>
                            <textarea
                                value={activityDesc}
                                onChange={(e) => setActivityDesc(e.target.value)}
                                placeholder={`Add a ${activityType}...`}
                                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    type="submit"
                                    disabled={!activityDesc.trim() || isAddingActivity}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    {isAddingActivity ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Log Activity
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Tabs / Sections */}
                    <div className="space-y-6">
                        {/* Proposals Section */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h3 className="font-semibold text-gray-900">Proposals</h3>
                                <Link
                                    to={`/crm/proposals/new?leadId=${lead._id}`}
                                    className="text-sm text-primary hover:underline font-medium"
                                >
                                    + Create Proposal
                                </Link>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {proposals.length > 0 ? (
                                    proposals.map((proposal) => (
                                        <div key={proposal._id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                            <div>
                                                <h4 className="font-medium text-gray-900">{proposal.title}</h4>
                                                <p className="text-sm text-gray-500">
                                                    {formatCurrency(proposal.total, proposal.currency)} • {new Date(proposal.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                                ${proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                                    proposal.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'}`}>
                                                {proposal.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-gray-500 text-sm">
                                        No proposals created yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Activity Timeline */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 mb-6">Activity Timeline</h3>
                            <div className="space-y-6">
                                {lead.activities && lead.activities.length > 0 ? (
                                    [...lead.activities].reverse().map((activity) => {
                                        const Icon = activityIcons[activity.type] || MessageSquare;
                                        return (
                                            <div key={activity._id} className="flex gap-4 relative">
                                                {/* Line */}
                                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-gray-100 last:hidden" />

                                                <div className={`flex-none w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-white
                                                    ${activity.type === 'call' ? 'border-blue-100 text-blue-600' :
                                                        activity.type === 'meeting' ? 'border-purple-100 text-purple-600' :
                                                            activity.type === 'email' ? 'border-yellow-100 text-yellow-600' :
                                                                'border-gray-100 text-gray-600'}`}
                                                >
                                                    <Icon size={18} />
                                                </div>
                                                <div className="flex-1 pt-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-medium text-gray-900 capitalize">{activity.type}</p>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(activity.date).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{activity.description}</p>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                                                            {(activity.createdBy as any)?.name?.[0] || 'U'}
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {(activity.createdBy as any)?.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-gray-500 py-4">No activities logged yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
