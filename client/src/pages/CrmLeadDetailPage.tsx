import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    Mail,
    Building,
    Clock,
    CheckCircle,
    Pencil,
    User,
    MessageSquare,
    Loader2,
    AlertCircle,
    MoreVertical,
    Send,
    UserCircle,
    Lock,
    Trash2,
    Upload,
    ExternalLink,
    FileText,
    Link2,
} from 'lucide-react';
import {
    useGetLeadByIdQuery,
    useAddLeadActivityMutation,
    useCloseLeadDealMutation,
    useUpdateLeadMutation,
    useDeleteLeadMutation,
    useGetProposalsQuery,
    useUploadLeadDocumentsMutation,
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
    const location = useLocation();

    const [activityType, setActivityType] = useState<'note' | 'call' | 'email' | 'meeting'>('note');
    const [activityDesc, setActivityDesc] = useState('');
    const [activeTab, setActiveTab] = useState<'lead-info' | 'documents' | 'links' | 'activity'>('lead-info');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const [linkName, setLinkName] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
    const [editingDocumentName, setEditingDocumentName] = useState('');
    const [confirmingDocumentId, setConfirmingDocumentId] = useState<string | null>(null);
    const [confirmingLinkIndex, setConfirmingLinkIndex] = useState<number | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { data: leadData, isLoading: leadLoading, error: leadError } = useGetLeadByIdQuery(id!);
    const { data: proposalsData } = useGetProposalsQuery({ leadId: id }, { skip: !id });

    const [addActivity, { isLoading: isAddingActivity }] = useAddLeadActivityMutation();
    const [closeDeal, { isLoading: isClosingDeal }] = useCloseLeadDealMutation();
    const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();
    const [deleteLead, { isLoading: isDeletingLead }] = useDeleteLeadMutation();
    const [uploadLeadDocuments, { isLoading: isUploadingDocument }] = useUploadLeadDocumentsMutation();

    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    const backTarget = returnTo || '/crm/leads';

    const lead = leadData?.data.lead;
    const proposals = proposalsData?.data.proposals || [];

    const getUserId = (value: any): string | undefined => {
        if (!value) return undefined;
        if (typeof value === 'string') return value;
        return value._id;
    };

    const splitFileName = (name: string) => {
        const lastDotIndex = name.lastIndexOf('.');
        if (lastDotIndex <= 0) {
            return { base: name, extension: '' };
        }
        return {
            base: name.slice(0, lastDotIndex),
            extension: name.slice(lastDotIndex),
        };
    };

    const toDocumentPayload = (doc: any) => ({
        name: doc.name,
        url: doc.url,
        cloudinaryId: doc.cloudinaryId,
        size: doc.size,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        uploadedBy: getUserId(doc.uploadedBy),
    });

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
        if (!window.confirm('Are you sure you want to close this deal? You will be taken to the Create Client form with details pre-filled.')) return;

        try {
            await closeDeal(id!).unwrap();
            navigate(`/crm/clients/new?fromLead=${id}`);
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

    const handleDeleteLead = async () => {
        try {
            await deleteLead(id!).unwrap();
            navigate('/crm/leads');
        } catch (error) {
            console.error('Failed to delete lead:', error);
        }
    };

    const handleUploadDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!id || files.length === 0) return;

        try {
            await uploadLeadDocuments({ leadId: id, files }).unwrap();
        } catch (error) {
            console.error('Failed to upload documents:', error);
            alert('Failed to upload documents. Please try again.');
        } finally {
            e.target.value = '';
        }
    };

    const handleStartRenameDocument = (documentId: string, currentName: string) => {
        const { base } = splitFileName(currentName);
        setEditingDocumentId(documentId);
        setEditingDocumentName(base);
    };

    const handleCancelRenameDocument = () => {
        setEditingDocumentId(null);
        setEditingDocumentName('');
    };

    const handleSaveRenameDocument = async (documentId: string) => {
        if (!id || !lead) return;

        const currentDocument = (lead.documents || []).find((doc) => doc._id === documentId);
        if (!currentDocument) return;

        const trimmedBaseName = editingDocumentName.trim();
        if (!trimmedBaseName) {
            alert('Document name cannot be empty.');
            return;
        }

        const { extension } = splitFileName(currentDocument.name);
        const renamedFileName = `${trimmedBaseName}${extension}`;

        const renamedDocuments = (lead.documents || [])
            .map((doc) => (doc._id === documentId ? { ...doc, name: renamedFileName } : doc))
            .map(toDocumentPayload);

        try {
            await updateLead({ id, data: { documents: renamedDocuments } }).unwrap();
            handleCancelRenameDocument();
        } catch (error) {
            console.error('Failed to rename document:', error);
            alert('Failed to rename document. Please try again.');
        }
    };

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !lead || !linkName.trim() || !linkUrl.trim()) return;

        try {
            new URL(linkUrl.trim());
        } catch {
            alert('Please enter a valid URL.');
            return;
        }

        const updatedLinks = [
            ...(lead.links || []),
            {
                name: linkName.trim(),
                url: linkUrl.trim(),
                addedAt: new Date().toISOString(),
            },
        ];

        try {
            await updateLead({ id, data: { links: updatedLinks } }).unwrap();
            setLinkName('');
            setLinkUrl('');
        } catch (error) {
            console.error('Failed to add link:', error);
            alert('Failed to save link. Please try again.');
        }
    };

    const handleRequestDeleteDocument = (documentId: string) => {
        setConfirmingLinkIndex(null);
        setConfirmingDocumentId((prev) => (prev === documentId ? null : documentId));
    };

    const handleRequestDeleteLink = (index: number) => {
        setConfirmingDocumentId(null);
        setConfirmingLinkIndex((prev) => (prev === index ? null : index));
    };

    const handleDeleteDocument = async (documentId: string) => {
        if (!id || !lead) return;

        const filteredDocuments = (lead.documents || [])
            .filter((doc) => doc._id !== documentId)
            .map(toDocumentPayload);

        try {
            await updateLead({ id, data: { documents: filteredDocuments } }).unwrap();
            setConfirmingDocumentId(null);
        } catch (error) {
            console.error('Failed to delete document:', error);
            alert('Failed to delete document. Please try again.');
        }
    };

    const handleDeleteLink = async (linkIndex: number) => {
        if (!id || !lead) return;

        const updatedLinks = (lead.links || []).filter((_, i) => i !== linkIndex);
        try {
            await updateLead({ id, data: { links: updatedLinks } }).unwrap();
            setConfirmingLinkIndex(null);
        } catch (error) {
            console.error('Failed to delete link:', error);
            alert('Failed to delete link. Please try again.');
        }
    };

    const sortedDocuments = [...(lead?.documents || [])]
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const sortedLinks = [...(lead?.links || [])]
        .map((item, index) => ({ item, index }))
        .sort((a, b) => new Date(b.item.addedAt || 0).getTime() - new Date(a.item.addedAt || 0).getTime());

    useEffect(() => {
        setConfirmingDocumentId(null);
        setConfirmingLinkIndex(null);
    }, [activeTab]);

    useEffect(() => {
        if (editingDocumentId && editingDocumentId === confirmingDocumentId) {
            setConfirmingDocumentId(null);
        }
    }, [editingDocumentId, confirmingDocumentId]);

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
        <>
            <div className="max-w-[1600px] mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(backTarget)}
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
                            onClick={() => navigate(`/crm/leads/${id}/edit`, { state: { backgroundLocation: location, returnTo: location.pathname } })}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center gap-2 px-3 text-sm"
                            title="Edit Lead"
                        >
                            <Pencil size={16} />
                            Edit
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                                title="More options"
                            >
                                <MoreVertical size={20} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
                                    <button
                                        onClick={() => {
                                            setShowMenu(false);
                                            setShowDeleteConfirm(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={15} />
                                        Delete Lead
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mb-6 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('lead-info')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'lead-info'
                                ? 'text-primary border-primary'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Lead Info
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'documents'
                                ? 'text-primary border-primary'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Documents
                        </button>
                        <button
                            onClick={() => setActiveTab('links')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'links'
                                ? 'text-primary border-primary'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Links
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === 'activity'
                                ? 'text-primary border-primary'
                                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Activity
                        </button>
                    </div>
                </div>

                {activeTab === 'lead-info' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-6">
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

                        <div className="lg:col-span-2">
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
                        </div>
                    </div>
                ) : activeTab === 'documents' ? (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-white via-slate-50/70 to-blue-50/50 rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-2">
                                        <FileText size={12} />
                                        Documents
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">Lead Documents</h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Upload one or more files, rename document names, and keep all references organized.
                                    </p>
                                </div>
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleUploadDocuments}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingDocument}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                                    >
                                        {isUploadingDocument ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        Upload Documents
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-3">Tip: Hold Cmd/Ctrl to select multiple files before uploading.</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
                            {sortedDocuments.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {sortedDocuments.map((doc) => (
                                        <div key={doc._id} className="p-4 md:p-5">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                                                    <FileText size={16} />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    {editingDocumentId === doc._id ? (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={editingDocumentName}
                                                                    onChange={(e) => setEditingDocumentName(e.target.value)}
                                                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                    placeholder="Document name"
                                                                />
                                                                <span className="text-xs text-slate-500 shrink-0">{splitFileName(doc.name).extension || 'no ext'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveRenameDocument(doc._id)}
                                                                    disabled={isUpdating}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
                                                                >
                                                                    Save Name
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelRenameDocument}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm font-semibold text-slate-900 break-all">{doc.name}</p>
                                                            <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                                                <span>{doc.mimeType || 'file'}</span>
                                                                <span>•</span>
                                                                <span>{Math.max(1, Math.round((doc.size || 0) / 1024))} KB</span>
                                                                <span>•</span>
                                                                <span>{new Date(doc.uploadedAt).toLocaleString()}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="shrink-0 relative">
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                                                        >
                                                            <ExternalLink size={12} />
                                                            Open
                                                        </a>
                                                        {editingDocumentId !== doc._id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartRenameDocument(doc._id, doc.name)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                                                            >
                                                                <Pencil size={12} />
                                                                Rename
                                                            </button>
                                                        )}
                                                        {editingDocumentId !== doc._id && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRequestDeleteDocument(doc._id)}
                                                                disabled={isUpdating}
                                                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                            >
                                                                <Trash2 size={12} />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>

                                                    {confirmingDocumentId === doc._id && (
                                                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-red-100 rounded-xl shadow-lg p-3 z-20">
                                                            <p className="text-xs text-slate-700">Delete this document?</p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">This action cannot be undone.</p>
                                                            <div className="mt-2 flex justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmingDocumentId(null)}
                                                                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteDocument(doc._id)}
                                                                    disabled={isUpdating}
                                                                    className="px-2.5 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                                                                >
                                                                    {isUpdating ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-sm text-slate-500">
                                    No documents uploaded yet.
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'links' ? (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/50 rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium mb-2">
                                <Link2 size={12} />
                                Links
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Reference Links</h3>
                            <p className="text-sm text-slate-600 mt-1 mb-4">
                                Save useful links like PRDs, Figma, spreadsheets, and drive folders.
                            </p>
                            <form onSubmit={handleAddLink} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                <input
                                    type="text"
                                    placeholder="Name (e.g. PRD Link)"
                                    value={linkName}
                                    onChange={(e) => setLinkName(e.target.value)}
                                    className="md:col-span-4 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    className="md:col-span-6 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                    type="submit"
                                    disabled={!linkName.trim() || !linkUrl.trim() || isUpdating}
                                    className="md:col-span-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    Add Link
                                </button>
                            </form>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
                            {sortedLinks.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {sortedLinks.map(({ item, index }) => (
                                        <div key={`${item.name}-${item.url}-${index}`} className="p-4 md:p-5">
                                            <div className="flex items-start gap-3">
                                                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Link2 size={13} />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-900 break-all">{item.name}</p>
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-blue-600 hover:underline break-all mt-1 inline-block"
                                                    >
                                                        {item.url}
                                                    </a>
                                                    <p className="text-[11px] text-slate-500 mt-1">
                                                        Added {item.addedAt ? new Date(item.addedAt).toLocaleString() : '—'}
                                                    </p>
                                                </div>

                                                <div className="shrink-0 relative">
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                                                        >
                                                            <ExternalLink size={12} />
                                                            Visit
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRequestDeleteLink(index)}
                                                            disabled={isUpdating}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            <Trash2 size={12} />
                                                            Delete
                                                        </button>
                                                    </div>

                                                    {confirmingLinkIndex === index && (
                                                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-red-100 rounded-xl shadow-lg p-3 z-20">
                                                            <p className="text-xs text-slate-700">Delete this link?</p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">This action cannot be undone.</p>
                                                            <div className="mt-2 flex justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmingLinkIndex(null)}
                                                                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteLink(index)}
                                                                    disabled={isUpdating}
                                                                    className="px-2.5 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                                                                >
                                                                    {isUpdating ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-sm text-slate-500">
                                    No links added yet.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
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

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 mb-6">Activity Timeline</h3>
                            <div className="space-y-6">
                                {lead.activities && lead.activities.length > 0 ? (
                                    [...lead.activities].reverse().map((activity) => {
                                        const Icon = activityIcons[activity.type] || MessageSquare;
                                        return (
                                            <div key={activity._id} className="flex gap-4 relative">
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
                )}
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-base font-semibold mb-2 text-gray-900">Delete Lead</h3>
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to permanently delete <strong>{lead.name}</strong>? All activities and meetings will be lost. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteLead}
                                disabled={isDeletingLead}
                                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeletingLead ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete Lead
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
