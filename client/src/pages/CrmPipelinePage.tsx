import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    LayoutDashboard,
    List,
    DollarSign,
    Calendar,
    Loader2,
    AlertCircle,
    GripVertical,
} from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { useGetLeadsQuery, useUpdateLeadMutation } from '@/features/crm';
import type { Lead } from '@/features/crm';

const stages = [
    { id: 'new', label: 'New', color: 'var(--color-info)' },
    { id: 'contacted', label: 'Contacted', color: 'var(--color-warning)' },
    { id: 'qualified', label: 'Qualified', color: 'var(--color-success)' },
    { id: 'proposal-sent', label: 'Proposal', color: '#4338CA' },
    { id: 'negotiation', label: 'Negotiation', color: '#7E22CE' },
    { id: 'closed', label: 'Closed', color: 'var(--color-success-dark, #059669)' },
    { id: 'pending', label: 'Pending', color: '#92400E' },
    { id: 'lead-lost', label: 'Lost', color: 'var(--color-danger)' },
    { id: 'follow-up', label: 'Follow Up', color: '#1D4ED8' },
];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        compactDisplay: 'short',
        maximumFractionDigits: 0,
    }).format(amount);
};

// ============================================
// DRAGGABLE LEAD CARD
// ============================================
function DraggableLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead._id,
        data: { lead },
    });

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group"
        >
            {/* Drag handle + content */}
            <div className="flex items-start gap-2">
                <div
                    {...listeners}
                    {...attributes}
                    className="flex-none mt-0.5 p-0.5 rounded text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={14} />
                </div>
                <div className="flex-1 min-w-0" onClick={onClick}>
                    <div className="cursor-pointer">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{lead.name}</h3>
                        {lead.company && <p className="text-xs text-gray-500 truncate">{lead.company}</p>}
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                            <DollarSign size={12} />
                            <span className="font-medium text-gray-700">
                                {formatCurrency(lead.estimatedValue || 0)}
                            </span>
                        </div>
                        {lead.expectedCloseDate && (
                            <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                <span>
                                    {new Date(lead.expectedCloseDate).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
                                {(lead.assignedTo as any)?.name?.[0] || 'U'}
                            </div>
                        </div>
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{
                                backgroundColor:
                                    lead.priority === 'critical' ? 'var(--color-danger)' :
                                        lead.priority === 'high' ? '#EA580C' :
                                            lead.priority === 'medium' ? 'var(--color-warning)' :
                                                'var(--color-success)',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// OVERLAY CARD (shown while dragging)
// ============================================
function LeadCardOverlay({ lead }: { lead: Lead }) {
    return (
        <div className="bg-white p-3 rounded-lg border-2 border-primary shadow-xl w-72 rotate-2 opacity-90">
            <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{lead.name}</h3>
            {lead.company && <p className="text-xs text-gray-500 truncate">{lead.company}</p>}
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <DollarSign size={12} />
                <span className="font-medium text-gray-700">{formatCurrency(lead.estimatedValue || 0)}</span>
            </div>
        </div>
    );
}

// ============================================
// DROPPABLE COLUMN
// ============================================
function StageColumn({
    stage,
    leads,
    totalValue,
    navigate,
}: {
    stage: { id: string; label: string; color: string };
    leads: Lead[];
    totalValue: number;
    navigate: (path: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: stage.id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col w-72 h-full rounded-xl border transition-colors ${isOver
                    ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20'
                    : 'bg-gray-100/50 border-gray-200'
                }`}
        >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-200 bg-white rounded-t-xl">
                <div className="flex justify-between items-center mb-1">
                    <span
                        className="text-xs font-semibold px-2 py-1 rounded-full uppercase"
                        style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                    >
                        {stage.label}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{leads.length}</span>
                </div>
                <div className="text-xs text-gray-500 font-medium px-1">
                    {formatCurrency(totalValue)}
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {leads.map((lead) => (
                    <DraggableLeadCard
                        key={lead._id}
                        lead={lead}
                        onClick={() => navigate(`/crm/leads/${lead._id}`)}
                    />
                ))}
                {leads.length === 0 && (
                    <div
                        className={`text-center py-8 text-xs border-2 border-dashed rounded-lg ${isOver
                                ? 'text-primary/60 border-primary/30 bg-primary/5'
                                : 'text-gray-400 border-gray-200'
                            }`}
                    >
                        {isOver ? 'Drop here' : 'No deals'}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// MAIN PIPELINE PAGE
// ============================================
export default function CrmPipelinePage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [activeLead, setActiveLead] = useState<Lead | null>(null);

    const { data, isLoading, error } = useGetLeadsQuery({ limit: 200, search });
    const [updateLead] = useUpdateLeadMutation();

    const leads = data?.data.leads || [];

    const columns = stages.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage.id);
        const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
        return { ...stage, leads: stageLeads, totalValue };
    });

    // DnD sensors — activate after 5px movement to allow click-through
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const lead = event.active.data.current?.lead as Lead;
        if (lead) setActiveLead(lead);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveLead(null);

        const { active, over } = event;
        if (!over) return;

        const leadId = active.id as string;
        const newStage = over.id as string;
        const lead = leads.find((l) => l._id === leadId);

        // Don't update if dropping into the same stage
        if (!lead || lead.stage === newStage) return;

        // Don't allow moving locked leads
        if (lead.isLocked) return;

        try {
            await updateLead({
                id: leadId,
                data: { stage: newStage as Lead['stage'] },
            }).unwrap();
        } catch (err) {
            console.error('Failed to update lead stage:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <Loader2 className="animate-spin text-gray-500 mr-2" />
                <span className="text-gray-500">Loading pipeline...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] text-red-500">
                <AlertCircle className="mr-2" />
                Error loading pipeline
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="flex-none px-6 py-4 bg-white border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Deals Pipeline</h1>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search deals..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                            <button
                                onClick={() => navigate('/crm/leads')}
                                className="p-2 rounded hover:bg-white text-gray-500"
                            >
                                <List size={18} />
                            </button>
                            <button className="p-2 rounded bg-white shadow-sm text-primary">
                                <LayoutDashboard size={18} />
                            </button>
                        </div>
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            onClick={() => navigate('/crm/leads/new')}
                        >
                            <Plus size={16} />
                            New Deal
                        </button>
                    </div>
                </div>
            </div>

            {/* Kanban Board with DnD */}
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto p-6 bg-gray-50">
                    <div className="flex h-full gap-4 min-w-max">
                        {columns.map((column) => (
                            <StageColumn
                                key={column.id}
                                stage={column}
                                leads={column.leads}
                                totalValue={column.totalValue}
                                navigate={navigate}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
