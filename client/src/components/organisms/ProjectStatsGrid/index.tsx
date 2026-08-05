import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, ProjectPhase } from '@/features/project';
import { useUpdateProjectMutation, useMarkPhasePaymentReceivedMutation } from '@/features/project';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { Target, Pencil, CheckCircle2, Circle, Clock, DollarSign, AlertTriangle, ChevronDown, ChevronUp, Copy, Plus, Trash2, Loader2, X, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PhasePaymentDialog from '@/components/PhasePaymentDialog';
import ManualFxRateModal, { type ManualFxRateRequirement } from '@/components/ManualFxRateModal';
import { logger } from '@/utils/logger';

export type ExtendedProjectPhase = ProjectPhase & {
    __v?: number;
    id?: string;
};

export interface ProjectStatsGridProps {
    project: Project;
    isSuperAdmin?: boolean;
    canViewPaymentDetails?: boolean;
}

export function ProjectStatsGrid({ project, isSuperAdmin, canViewPaymentDetails }: ProjectStatsGridProps) {
    const phases = project.phases || [];
    const totalPhases = phases.length;
    const completedPhases = phases.filter(p => p.status === 'completed').length;
    const progressPercentage = totalPhases === 0 ? 0 : Math.round((completedPhases / totalPhases) * 100);
    const showPaymentDetails = Boolean(canViewPaymentDetails);

    const [showPhasePanel, setShowPhasePanel] = useState(false);
    const [localPhases, setLocalPhases] = useState<ExtendedProjectPhase[]>([]);
    const [manualFxRequirements, setManualFxRequirements] = useState<ManualFxRateRequirement[]>([]);
    const [expandedPaymentSections, setExpandedPaymentSections] = useState<Record<string, boolean>>({});
    const [paymentDialogPhase, setPaymentDialogPhase] = useState<(ProjectPhase & { _id: string }) | null>(null);
    const [updateProject, { isLoading: isSavingPhases }] = useUpdateProjectMutation();
    const [markPhasePaymentReceived] = useMarkPhasePaymentReceivedMutation();
    const newlyAddedLocalPhaseIdRef = useRef<string | null>(null);

    const totalPaymentAllocation = useMemo(
        () => localPhases.reduce((sum, phase) => sum + (phase.hasPayment ? Number(phase.paymentPercentage || 0) : 0), 0),
        [localPhases]
    );
    const paymentAllocationError = totalPaymentAllocation > 100
        ? 'Total payment allocation cannot be more than 100% across all phases.'
        : '';

    const getMaxAllowedPaymentPercentage = (index: number) => {
        const otherAllocated = localPhases.reduce((sum, phase, phaseIndex) => {
            if (phaseIndex === index || !phase.hasPayment) return sum;
            return sum + Number(phase.paymentPercentage || 0);
        }, 0);

        return Math.max(0, 100 - otherAllocated);
    };

    useBodyScrollLock(showPhasePanel);

    useEffect(() => {
        if (showPhasePanel) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocalPhases((project.phases || []).map((p: ProjectPhase) => ({ 
                ...p, 
                id: p._id || crypto.randomUUID() 
            } as ExtendedProjectPhase)));
        }
    }, [showPhasePanel, project.phases]);

    const addPhase = () =>
        setLocalPhases(prev => {
            
            const newId = crypto.randomUUID();
            newlyAddedLocalPhaseIdRef.current = newId;
            return [...prev, {
                id: newId,
                name: '',
                status: 'pending' as const,
                endDate: '',
                hasPayment: false,
                paymentAmount: 0,
                paymentPercentage: 0,
                paymentCurrency: (project.currency as ProjectPhase['paymentCurrency']) || 'INR',
                paymentBankAccount: project.defaultBankAccount,
                gstApplicable: true,
                isGstInclusive: false,
                gstRate: 18,
                tdsDeducted: 0,
            }];
        });

    useEffect(() => {
        const addedId = newlyAddedLocalPhaseIdRef.current;
        if (addedId === null || !showPhasePanel) return;

        const id = window.setTimeout(() => {
            const row = document.getElementById('phase-row-' + addedId);
            if (!row) return;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const firstInput = row.querySelector('input');
            if (firstInput instanceof HTMLInputElement) {
                firstInput.focus();
            }
        }, 90);

        newlyAddedLocalPhaseIdRef.current = null;
        return () => window.clearTimeout(id);
    }, [localPhases.length, showPhasePanel]);

    const updatePhaseField = (idx: number, field: keyof ExtendedProjectPhase, value: unknown) =>
        setLocalPhases(prev => prev.map((p, i) => {
            if (i !== idx) return p;
            const next = { ...p, [field]: value as never };
            if (['paymentCurrency', 'paymentDueDate', 'endDate'].includes(String(field))) {
                delete next.paymentExchangeRate;
                delete next.paymentExchangeRateDate;
                delete next.paymentExpectedAmountINR;
                delete next.paymentFxRateSource;
                delete next.paymentFxRequestedDate;
                delete next.paymentFxFallbackUsed;
            }
            if (field === 'hasPayment' && value) {
                if (!p.paymentDueDate && p.endDate) {
                    next.paymentDueDate = p.endDate;
                }
                if (project.isGstInclusive) {
                    next.isGstInclusive = true;
                    next.gstApplicable = false;
                }
            }
            if (field === 'endDate' && p.hasPayment && (!p.paymentDueDate || p.paymentDueDate === p.endDate)) {
                next.paymentDueDate = value ? String(value) : undefined;
            }
            return next;
        }));

    const removePhase = (idx: number) =>
        setLocalPhases(prev => prev.filter((_, i) => i !== idx));

    const createDuplicatePhase = (phase: ExtendedProjectPhase): ExtendedProjectPhase => ({
        id: crypto.randomUUID(),
        name: `${phase.name || 'Phase'} Copy`,
        status: 'pending',
        startDate: phase.startDate,
        endDate: phase.endDate,
        hasPayment: phase.hasPayment || false,
        paymentAmount: phase.paymentAmount,
        paymentPercentage: phase.paymentPercentage,
        paymentCurrency: phase.paymentCurrency || (project.currency as ProjectPhase['paymentCurrency']) || 'INR',
        paymentDueDate: phase.paymentDueDate || phase.endDate,
        paymentBankAccount: phase.paymentBankAccount || project.defaultBankAccount,
        gstApplicable: phase.gstApplicable !== false,
        isGstInclusive: phase.isGstInclusive !== false,
        gstRate: phase.gstRate || 18,
        tdsDeducted: phase.tdsDeducted || 0,
    });

    const duplicatePhase = (idx: number) => {
        const sourcePhase = localPhases[idx];
        if (!sourcePhase) return;
        const newPhase = createDuplicatePhase(sourcePhase);
        newlyAddedLocalPhaseIdRef.current = newPhase.id!;
        setLocalPhases(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, newPhase);
            return next;
        });
        if (sourcePhase.hasPayment) {
            setExpandedPaymentSections(prev => ({
                ...prev,
                [newPhase.id!]: true
            }));
        }
    };

    const cleanLocalPhasesForSave = (phaseList: ExtendedProjectPhase[]) => phaseList
        .map((phaseItem: ExtendedProjectPhase) => {
            const phase = { ...phaseItem };
            delete phase.__v;

            // Clean up empty dates
            if (!phase.endDate) delete phase.endDate;
            if (!phase.startDate) delete phase.startDate;
            if (!phase.paymentDueDate) delete phase.paymentDueDate;

            // Clean up payment fields if hasPayment is false
            if (!phase.hasPayment) {
                delete phase.paymentAmount;
                delete phase.paymentPercentage;
                delete phase.paymentCurrency;
                delete phase.paymentDueDate;
                delete phase.paymentBankAccount;
                delete phase.paymentExpectedAmountINR;
                delete phase.paymentExchangeRate;
                delete phase.paymentExchangeRateDate;
                delete phase.paymentFxRateSource;
                delete phase.paymentFxRequestedDate;
                delete phase.paymentFxFallbackUsed;
                delete phase.gstApplicable;
                delete phase.isGstInclusive;
                delete phase.gstRate;
                delete phase.tdsDeducted;
            } else {
                // Ensure numeric values are proper numbers or undefined
                if (!phase.paymentAmount || phase.paymentAmount === 0) delete phase.paymentAmount;
                if (!phase.paymentPercentage || phase.paymentPercentage === 0) delete phase.paymentPercentage;
                if (!phase.tdsDeducted || phase.tdsDeducted === 0) delete phase.tdsDeducted;
                if (phase.gstApplicable === false) {
                    delete phase.isGstInclusive;
                    delete phase.gstRate;
                }
            }

            return phase;
        });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setLocalPhases((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const savePhases = async () => {
        try {
            if (totalPaymentAllocation > 100) {
                return;
            }

            const cleaned = cleanLocalPhasesForSave(localPhases);
            await updateProject({ id: String(project._id), data: { phases: cleaned } }).unwrap();
            setShowPhasePanel(false);
        } catch (e: any) {
            const code = e?.data?.error?.code;
            const requirements = e?.data?.error?.details?.requirements;
            if (code === 'FX_RATE_REQUIRED' && Array.isArray(requirements)) {
                setManualFxRequirements(requirements);
                return;
            }
            logger.error('Failed to save phases:', e);
        }
    };

    const handleManualFxSubmit = async (rates: Record<number, number>) => {
        const requirementsByIndex = new Map(manualFxRequirements.map((item) => [item.phaseIndex, item]));
        const phasesWithManualRates = localPhases.map((phase, index) => {
            const rate = rates[index];
            const requirement = requirementsByIndex.get(index);
            if (!rate || !requirement) return phase;
            return {
                ...phase,
                paymentExchangeRate: rate,
                paymentExchangeRateDate: requirement.date,
                paymentFxRequestedDate: requirement.date,
                paymentFxRateSource: 'manual' as const,
                paymentFxFallbackUsed: false,
                paymentExpectedAmountINR: undefined,
            };
        });

        setLocalPhases(phasesWithManualRates);
        setManualFxRequirements([]);

        try {
            const cleaned = cleanLocalPhasesForSave(phasesWithManualRates);
            await updateProject({ id: String(project._id), data: { phases: cleaned } }).unwrap();
            setShowPhasePanel(false);
        } catch (e: any) {
            const code = e?.data?.error?.code;
            const requirements = e?.data?.error?.details?.requirements;
            if (code === 'FX_RATE_REQUIRED' && Array.isArray(requirements)) {
                setManualFxRequirements(requirements);
                return;
            }
            logger.error('Failed to save phases with manual FX rates:', e);
        }
    };

    const getPhaseIcon = (status: ProjectPhase['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />;
            case 'in-progress':
                return <Clock size={16} style={{ color: 'var(--color-warning)' }} />;
            default:
                return <Circle size={16} style={{ color: 'var(--color-text-muted)' }} />;
        }
    };

    const handleMarkPaymentReceived = async (data: {
        phaseId: string;
        receivedAmount: number;
        bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
        receivedDate: string;
        notes?: string;
        manualExchangeRate?: number;
        markAsFullyPaid?: boolean;
        adjustPhaseValue?: boolean;
    }) => {
        try {
            // Mark payment as received
            await markPhasePaymentReceived({
                projectId: String(project._id),
                ...data,
            }).unwrap();

            // Close the payment dialog
            setPaymentDialogPhase(null);
        } catch (error) {
            logger.error('Failed to mark payment received or complete phase:', error);
            throw error;
        }
    };

    const handleTogglePhaseCompletion = async (phaseIndex: number, currentStatus: ProjectPhase['status']) => {
        const currentPhase = project.phases?.[phaseIndex] as ExtendedProjectPhase | undefined;
        const paymentAlreadyReceived =
            currentPhase?.paymentStatus === 'received'
            || Number(currentPhase?.paymentReceivedAmount || 0) > 0
            || Boolean(currentPhase?.revenueId)
            || Boolean(currentPhase?.bankTransactionId);

        // If marking as completed and phase has payment tracking, ask about payment
        if (currentStatus !== 'completed' && currentPhase?.hasPayment && !paymentAlreadyReceived) {
            const confirmed = confirm(
                `Phase "${currentPhase.name}" is being marked as completed.\n\n` +
                `Has the payment for this phase been received?\n\n` +
                `• Click OK if payment is received (you'll enter payment details next)\n` +
                `• Click Cancel to complete phase without marking payment as received`
            );

            if (confirmed) {
                // Show payment dialog first, then complete the phase
                setPaymentDialogPhase({ ...currentPhase!, _id: currentPhase!._id || `temp-${phaseIndex}` });
                return;
            }
        }

        try {
            const updatedPhases: ExtendedProjectPhase[] = ((project.phases || []) as ExtendedProjectPhase[]).map((p, i) => {
                if (i === phaseIndex) {
                    // Toggle between completed and in-progress
                    return {
                        ...p,
                        status: currentStatus === 'completed' ? ('in-progress' as const) : ('completed' as const),
                        completedAt: currentStatus === 'completed' ? undefined : new Date().toISOString(),
                    };
                }
                // If marking current phase as complete, auto-start next phase
                if (currentStatus !== 'completed' && i === phaseIndex + 1 && p.status === 'pending') {
                    return { ...p, status: 'in-progress' as const };
                }
                return p;
            });

            // Clean phases before sending (remove backend-only fields)
            const cleanedPhases = updatedPhases.map((phase: ExtendedProjectPhase) => {
                const rest = { ...phase };
                delete rest._id;
                delete rest.__v;
                delete rest.revenueId;
                delete rest.bankTransactionId;
                return rest;
            });

            await updateProject({ id: String(project._id), data: { phases: cleanedPhases } }).unwrap();
        } catch (error) {
            logger.error('Failed to update phase status:', error);
        }
    };

    return (
        <div className="p-5 rounded-[1rem] shadow-premium border-0" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Target size={15} style={{ color: 'var(--color-text-muted)' }} />
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Phase Progress</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {progressPercentage}% Completed
                    </div>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowPhasePanel(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50 bg-white"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                        >
                            <Pencil size={12} />
                            Edit Phases
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden mb-6" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--color-primary)' }}
                />
            </div>

            {/* Phases Grid */}
            {totalPhases > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {phases.map((rawPhase, index) => {
                        const phase = rawPhase as ExtendedProjectPhase;
                        const hasPayment = phase.hasPayment;
                        const paymentStatus = phase.paymentStatus;
                        const isPaymentFullyReceived = paymentStatus === 'received';
                        const canMarkPaymentReceived = Boolean(
                            showPaymentDetails
                            && hasPayment
                            && phase._id
                            && !isPaymentFullyReceived
                        );

                        return (
                            <div
                                key={phase._id || index}
                                className="flex items-start gap-3 p-3 rounded-lg border"
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                {/* Completion Checkbox/Ticker */}
                                {isSuperAdmin ? (
                                    <button
                                        onClick={() => handleTogglePhaseCompletion(index, phase.status)}
                                        className="flex-shrink-0 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                                        style={{ outline: 'none' }}
                                        title={phase.status === 'completed' ? 'Mark as in-progress' : 'Mark as completed'}
                                    >
                                        {getPhaseIcon(phase.status)}
                                    </button>
                                ) : (
                                    <div className="flex-shrink-0">
                                        {getPhaseIcon(phase.status)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{phase.name}</p>
                                        {showPaymentDetails && hasPayment && (
                                            <DollarSign size={12} style={{ color: isPaymentFullyReceived ? 'var(--color-success)' : 'var(--color-warning)' }} />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="capitalize">{phase.status.replace('-', ' ')}</span>
                                        {phase.endDate && (
                                            <>
                                                <span style={{ color: 'var(--color-border-default)' }}>•</span>
                                                <span>Due {new Date(phase.endDate).toLocaleDateString()}</span>
                                            </>
                                        )}
                                    </div>
                                    {showPaymentDetails && hasPayment && (
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: isPaymentFullyReceived
                                                        ? 'var(--color-success-bg)'
                                                        : paymentStatus === 'partial'
                                                            ? 'var(--color-warning-bg)'
                                                            : 'var(--color-bg-subtle)',
                                                    color: isPaymentFullyReceived
                                                        ? 'var(--color-success)'
                                                        : paymentStatus === 'partial'
                                                            ? 'var(--color-warning)'
                                                            : 'var(--color-text-muted)',
                                                }}
                                            >
                                                Payment: {isPaymentFullyReceived ? 'received' : (paymentStatus || 'pending')}
                                            </span>
                                            {canMarkPaymentReceived && (
                                                <button
                                                    onClick={() => setPaymentDialogPhase({ ...phase, _id: phase._id as string })}
                                                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-colors"
                                                    style={{
                                                        backgroundColor: 'var(--color-success-bg)',
                                                        color: 'var(--color-success)',
                                                    }}
                                                >
                                                    <DollarSign size={10} />
                                                    Mark Received
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="text-center py-6 px-4 rounded-lg border border-dashed"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No phases defined</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {isSuperAdmin ? 'Click "Edit Phases" to add tracking phases.' : 'No phases have been added yet.'}
                    </p>
                </div>
            )}

            {/* Phase editor side panel */}
            {showPhasePanel && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[200]"
                        style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
                        onClick={() => setShowPhasePanel(false)}
                    />
                    <div
                        className="fixed top-0 right-0 h-full z-[201] flex flex-col"
                        style={{
                            width: 'min(580px, 100vw)',
                            backgroundColor: 'var(--color-bg-surface)',
                            borderLeft: '1px solid var(--color-border-default)',
                            boxShadow: '-16px 0 48px rgba(0,0,0,0.13)',
                            animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-center gap-2">
                                <Target size={16} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Phases</h2>
                            </div>
                            <button onClick={() => setShowPhasePanel(false)} className="p-1.5 rounded transition-colors hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Hint */}
                        <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Define the milestones or stages of the project. Phases with empty names are ignored on save.
                            </p>
                            {paymentAllocationError && (
                                <p className="mt-2 text-xs font-semibold" style={{ color: '#B91C1C' }}>
                                    {paymentAllocationError}
                                </p>
                            )}
                        </div>

                        {/* Scrollable phase rows */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {localPhases.length === 0 && (
                                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                                    No phases yet — click “Add Phase” below.
                                </p>
                            )}

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={localPhases.map(p => p.id!)} strategy={verticalListSortingStrategy}>
                                    {localPhases.map((phase, idx) => (
                                        <SortablePhaseRow
                                            key={phase.id}
                                            phase={phase}
                                            idx={idx}
                                            project={project}
                                            expandedPaymentSections={expandedPaymentSections}
                                            setExpandedPaymentSections={setExpandedPaymentSections}
                                            updatePhaseField={updatePhaseField}
                                            duplicatePhase={duplicatePhase}
                                            removePhase={removePhase}
                                            getMaxAllowedPaymentPercentage={getMaxAllowedPaymentPercentage}
                                            setPaymentDialogPhase={setPaymentDialogPhase}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
        
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3.5 border-t shrink-0 flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <button
                                onClick={addPhase}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                <Plus size={13} /> Add Phase
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowPhasePanel(false)}
                                    disabled={isSavingPhases}
                                    className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={savePhases}
                                    disabled={isSavingPhases || totalPaymentAllocation > 100}
                                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                    {isSavingPhases ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                    {isSavingPhases ? 'Saving…' : 'Save Phases'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Phase Payment Dialog */}
            {showPaymentDetails && paymentDialogPhase && (
                <PhasePaymentDialog
                    phase={paymentDialogPhase}
                    projectCurrency={project.currency}
                    projectBudget={project.budget}
                    defaultBankAccount={project.defaultBankAccount}
                    onClose={() => setPaymentDialogPhase(null)}
                    onConfirm={handleMarkPaymentReceived}
                />
            )}
            {manualFxRequirements.length > 0 && (
                <ManualFxRateModal
                    requirements={manualFxRequirements}
                    isSaving={isSavingPhases}
                    onClose={() => setManualFxRequirements([])}
                    onSubmit={handleManualFxSubmit}
                />
            )}
        </div>
    );
}



interface SortablePhaseRowProps {
    phase: ExtendedProjectPhase;
    idx: number;
    project: Project;
    expandedPaymentSections: Record<string, boolean>;
    setExpandedPaymentSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    updatePhaseField: (idx: number, field: keyof ExtendedProjectPhase, value: unknown) => void;
    duplicatePhase: (idx: number) => void;
    removePhase: (idx: number) => void;
    getMaxAllowedPaymentPercentage: (idx: number) => number;
    setPaymentDialogPhase: React.Dispatch<React.SetStateAction<(ProjectPhase & { _id: string }) | null>>;
}

function SortablePhaseRow({
    phase,
    idx,
    project,
    expandedPaymentSections,
    setExpandedPaymentSections,
    updatePhaseField,
    duplicatePhase,
    removePhase,
    getMaxAllowedPaymentPercentage,
    setPaymentDialogPhase
}: SortablePhaseRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: phase.id! });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        borderColor: 'var(--color-border-default)', 
        backgroundColor: 'var(--color-bg-subtle)'
    };

    return (
        <div
            id={`phase-row-${phase.id}`}
            ref={setNodeRef}
            style={style}
            className="p-4 rounded-xl border space-y-3 bg-white"
        >
            <div className="flex items-start gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 mt-1 rounded cursor-grab active:cursor-grabbing hover:bg-black/5"
                    style={{color: 'var(--color-text-secondary)'}}
                >
                    <GripVertical size={16} />
                </button>
                <div className="flex-1 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>Phase {idx + 1}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => duplicatePhase(idx)} className="p-1 rounded transition-colors hover:bg-blue-500/10" style={{ color: 'var(--color-primary)' }} title="Duplicate phase">
                                                <Copy size={13} />
                                            </button>
                                            <button onClick={() => removePhase(idx)} className="p-1 rounded transition-colors hover:bg-red-500/10" style={{ color: 'var(--color-danger)' }} title="Remove phase">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Phase Name *</label>
                                            <input
                                                value={phase.name}
                                                onChange={e => updatePhaseField(idx, 'name', e.target.value)}
                                                placeholder="e.g. Design, Development, Testing…"
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
                                            <select
                                                value={phase.status}
                                                onChange={e => updatePhaseField(idx, 'status', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Due Date</label>
                                            <input
                                                type="date"
                                                value={phase.endDate ? new Date(phase.endDate).toISOString().split('T')[0] : ''}
                                                onChange={e => updatePhaseField(idx, 'endDate', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Payment Tracking Section */}
                                    <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <div
                                            className="flex items-center justify-between w-full text-xs font-medium py-2"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={phase.hasPayment || false}
                                                    onChange={e => updatePhaseField(idx, 'hasPayment', e.target.checked)}
                                                    className="w-4 h-4 rounded border-gray-300"
                                                />
                                                <DollarSign size={14} />
                                                <span>Payment Tracking</span>
                                                {phase.hasPayment && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                                                        Enabled
                                                    </span>
                                                )}
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedPaymentSections(prev => ({ ...prev, [phase.id!]: !prev[phase.id!] }))}
                                                className="p-1 rounded transition-colors hover:bg-black/5"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                                title={expandedPaymentSections[phase.id!] ? 'Hide payment details' : 'Show payment details'}
                                            >
                                                {expandedPaymentSections[phase.id!] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>

                                        {expandedPaymentSections[phase.id!] && (
                                            <div className="space-y-3 mt-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                {phase.hasPayment && (
                                                    <>
                                                        {/* Payment Amount & Percentage */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Fixed Amount</label>
                                                                <input
                                                                    type="number"
                                                                    value={phase.paymentAmount || ''}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value);
                                                                        updatePhaseField(idx, 'paymentAmount', val > 0 ? val : 0);
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
                                                                    value={phase.paymentPercentage || ''}
                                                                    onChange={e => {
                                                                        let val = parseFloat(e.target.value);
                                                                        if (isNaN(val) || val < 0) val = 0;
                                                                        const maxAllowed = getMaxAllowedPaymentPercentage(idx);
                                                                        if (val > maxAllowed) val = maxAllowed;
                                                                        updatePhaseField(idx, 'paymentPercentage', val);
                                                                        // Auto-populate fixed amount from percentage
                                                                        if (project.budget && project.budget > 0 && val > 0) {
                                                                            const calculatedAmount = (project.budget * val) / 100;
                                                                            updatePhaseField(idx, 'paymentAmount', calculatedAmount);
                                                                        } else if (val === 0) {
                                                                            // Clear fixed amount if percentage is 0
                                                                            updatePhaseField(idx, 'paymentAmount', 0);
                                                                        }
                                                                    }}
                                                                    placeholder="0"
                                                                    max={getMaxAllowedPaymentPercentage(idx)}
                                                                    min="0"
                                                                    step="0.1"
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                />
                                                                {/* Show calculated amount or budget warning */}
                                                                {(phase.paymentPercentage || 0) > 0 && (
                                                                    <div className="mt-1">
                                                                        {project.budget && project.budget > 0 ? (
                                                                            <p className="text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>
                                                                                ≈ {phase.paymentCurrency || project.currency || 'INR'} {((project.budget * (phase.paymentPercentage || 0)) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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

                                                        {/* Currency & Payment Due Date */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Currency</label>
                                                                <select
                                                                    value={phase.paymentCurrency || project.currency || 'INR'}
                                                                    onChange={e => updatePhaseField(idx, 'paymentCurrency', e.target.value)}
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
                                                                    value={phase.paymentDueDate ? new Date(phase.paymentDueDate).toISOString().split('T')[0] : ''}
                                                                    onChange={e => updatePhaseField(idx, 'paymentDueDate', e.target.value)}
                                                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Payment Bank Account */}
                                                        <div>
                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Payment Bank Account</label>
                                                            <select
                                                                value={phase.paymentBankAccount || project.defaultBankAccount || ''}
                                                                onChange={e => updatePhaseField(idx, 'paymentBankAccount', e.target.value || undefined)}
                                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                            >
                                                                <option value="">Use default bank account</option>
                                                                <option value="hdfc_gst">HDFC Bank (GST)</option>
                                                                <option value="sbi_non_gst">SBI Bank (Non-GST)</option>
                                                                <option value="indian_bank">Indian Bank</option>
                                                                <option value="cash">Cash / UPI</option>
                                                            </select>
                                                        </div>

                                                        {/* GST & TDS */}
                                                        <div className="space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={phase.gstApplicable !== false}
                                                                    onChange={e => {
                                                                        updatePhaseField(idx, 'gstApplicable', e.target.checked);
                                                                        if (e.target.checked) updatePhaseField(idx, 'isGstInclusive', false);
                                                                    }}
                                                                    className="w-4 h-4 rounded border-gray-300"
                                                                />
                                                                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    GST Applicable
                                                                </span>
                                                            </label>

                                                            {phase.gstApplicable !== false && (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>GST Calculation Method</label>
                                                                        <div className="flex gap-4 p-2 rounded-lg border bg-opacity-50" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`isGstInclusive-${idx}`}
                                                                                    checked={phase.isGstInclusive !== false}
                                                                                    onChange={() => updatePhaseField(idx, 'isGstInclusive', true)}
                                                                                    className="w-3.5 h-3.5"
                                                                                />
                                                                                <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>Inclusive (GST inside amount)</span>
                                                                            </label>
                                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`isGstInclusive-${idx}`}
                                                                                    checked={phase.isGstInclusive === false}
                                                                                    onChange={() => updatePhaseField(idx, 'isGstInclusive', false)}
                                                                                    className="w-3.5 h-3.5"
                                                                                />
                                                                                <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>Exclusive (GST added on top)</span>
                                                                            </label>
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>GST Rate (%)</label>
                                                                            <select
                                                                                value={phase.gstRate || 18}
                                                                                onChange={e => updatePhaseField(idx, 'gstRate', parseInt(e.target.value))}
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
                                                                                onChange={e => updatePhaseField(idx, 'tdsDeducted', parseFloat(e.target.value) || 0)}
                                                                                placeholder="0"
                                                                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="space-y-1 pt-2">
                                                                {phase.gstApplicable === false ? (
                                                                    <>
                                                                        <div className="flex justify-between items-center px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                                            <span>Base Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {Number(phase.paymentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center px-3 py-2 rounded text-xs font-bold mt-1" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}>
                                                                            <span>Total Billing Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {Number(phase.paymentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </>
                                                                ) : phase.isGstInclusive !== false ? (
                                                                    <>
                                                                        <div className="flex justify-between items-center px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                                            <span>Base Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {(Number(phase.paymentAmount || 0) / (1 + (phase.gstRate || 18) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                                            <span>GST ({(phase.gstRate || 18)}%) — inclusive:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {(Number(phase.paymentAmount || 0) - (Number(phase.paymentAmount || 0) / (1 + (phase.gstRate || 18) / 100))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center px-3 py-2 rounded text-xs font-bold mt-1" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}>
                                                                            <span>Total Billing Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {Number(phase.paymentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex justify-between items-center px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                                            <span>Base Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {Number(phase.paymentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                                            <span>GST ({(phase.gstRate || 18)}%) — added on top:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {(Number(phase.paymentAmount || 0) * ((phase.gstRate || 18) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center px-3 py-2 rounded text-xs font-bold mt-1" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}>
                                                                            <span>Total Billing Amount:</span>
                                                                            <span>{phase.paymentCurrency || project.currency || 'INR'} {(Number(phase.paymentAmount || 0) + (Number(phase.paymentAmount || 0) * ((phase.gstRate || 18) / 100))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Mark Payment Received Button */}
                                                        {phase._id && phase.paymentStatus !== 'received' && (
                                                            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPaymentDialogPhase({ ...phase, _id: phase._id || `temp-${idx}` });
                                                                    }}
                                                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:bg-green-50"
                                                                    style={{
                                                                        borderColor: 'var(--color-success)',
                                                                        color: 'var(--color-success)',
                                                                        backgroundColor: 'var(--color-success-bg)'
                                                                    }}
                                                                >
                                                                    <DollarSign size={12} />
                                                                    Mark Payment Received
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                </div>
            </div>
        </div>
    );
}
