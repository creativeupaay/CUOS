import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Proposal } from '../../types/types';

interface ScopeTabProps {
    formData: Partial<Proposal>;
    onChange: (data: Partial<Proposal>) => void;
}

const ScopeTab: React.FC<ScopeTabProps> = ({ formData, onChange }) => {
    // Helper to generic update
    const updateSection = (section: keyof Proposal, field: string, value: any) => {
        onChange({
            ...formData,
            [section]: { ...(formData[section] as any), [field]: value }
        });
    };

    // --- Scope Phases Helpers ---
    const addScopePhase = () => {
        const phases = formData.scopeOfWork?.phases || [];
        updateSection('scopeOfWork', 'phases', [...phases, { title: '', summary: '', points: [] }]);
    };
    const updateScopePhase = (index: number, field: string, value: any) => {
        const phases = [...(formData.scopeOfWork?.phases || [])];
        phases[index] = { ...phases[index], [field]: value };
        updateSection('scopeOfWork', 'phases', phases);
    };
    const removeScopePhase = (index: number) => {
        const phases = formData.scopeOfWork?.phases || [];
        updateSection('scopeOfWork', 'phases', phases.filter((_, i) => i !== index));
    };
    // Points inside Scope Phase
    const addScopePoint = (phaseIndex: number) => {
        const phases = [...(formData.scopeOfWork?.phases || [])];
        phases[phaseIndex].points = [...(phases[phaseIndex].points || []), ''];
        updateSection('scopeOfWork', 'phases', phases);
    };
    const updateScopePoint = (phaseIndex: number, pointIndex: number, value: string) => {
        const phases = [...(formData.scopeOfWork?.phases || [])];
        phases[phaseIndex].points[pointIndex] = value;
        updateSection('scopeOfWork', 'phases', phases);
    };
    const removeScopePoint = (phaseIndex: number, pointIndex: number) => {
        const phases = [...(formData.scopeOfWork?.phases || [])];
        phases[phaseIndex].points = phases[phaseIndex].points.filter((_, i) => i !== pointIndex);
        updateSection('scopeOfWork', 'phases', phases);
    };


    // --- Features Helpers ---
    const addFeaturePhase = () => {
        const phases = formData.features?.phases || [];
        updateSection('features', 'phases', [...phases, { title: '', description: '', features: [] }]);
    };
    const updateFeaturePhase = (index: number, field: string, value: any) => {
        const phases = [...(formData.features?.phases || [])];
        phases[index] = { ...phases[index], [field]: value };
        updateSection('features', 'phases', phases);
    };
    const removeFeaturePhase = (index: number) => {
        const phases = formData.features?.phases || [];
        updateSection('features', 'phases', phases.filter((_, i) => i !== index));
    };
    // Item inside Feature Phase
    const addFeatureItem = (phaseIndex: number) => {
        const phases = [...(formData.features?.phases || [])];
        phases[phaseIndex].features = [...(phases[phaseIndex].features || []), { name: '', description: '' }];
        updateSection('features', 'phases', phases);
    };
    const updateFeatureItem = (phaseIndex: number, itemIndex: number, field: string, value: string) => {
        const phases = [...(formData.features?.phases || [])];
        phases[phaseIndex].features[itemIndex] = { ...phases[phaseIndex].features[itemIndex], [field]: value };
        updateSection('features', 'phases', phases);
    };
    const removeFeatureItem = (phaseIndex: number, itemIndex: number) => {
        const phases = [...(formData.features?.phases || [])];
        phases[phaseIndex].features = phases[phaseIndex].features.filter((_, i) => i !== itemIndex);
        updateSection('features', 'phases', phases);
    };

    return (
        <div className="space-y-8">
            {/* 5. Scope of Work */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">5. Scope of Work & Phased Execution</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Intro Line</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                        value={formData.scopeOfWork?.intro || ''}
                        onChange={(e) => updateSection('scopeOfWork', 'intro', e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    {formData.scopeOfWork?.phases?.map((phase, pIndex) => (
                        <div key={pIndex} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 mr-2">
                                    <input
                                        type="text"
                                        placeholder="Phase Title (e.g. Phase 1: Core Platform)"
                                        className="w-full font-medium bg-transparent border-b border-neutral-300 focus:border-primary focus:outline-none mb-2"
                                        value={phase.title}
                                        onChange={(e) => updateScopePhase(pIndex, 'title', e.target.value)}
                                    />
                                    <textarea
                                        placeholder="Phase Summary"
                                        className="w-full text-sm bg-white border border-neutral-300 rounded p-2"
                                        rows={2}
                                        value={phase.summary}
                                        onChange={(e) => updateScopePhase(pIndex, 'summary', e.target.value)}
                                    />
                                </div>
                                <button onClick={() => removeScopePhase(pIndex)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                            </div>

                            <div className="ml-4 mt-2">
                                <label className="text-xs font-semibold uppercase text-neutral-500">Execution Points</label>
                                {phase.points?.map((point, ptIndex) => (
                                    <div key={ptIndex} className="flex gap-2 mt-1">
                                        <input
                                            type="text"
                                            className="flex-1 px-2 py-1 text-sm border border-neutral-300 rounded"
                                            value={point}
                                            onChange={(e) => updateScopePoint(pIndex, ptIndex, e.target.value)}
                                        />
                                        <button onClick={() => removeScopePoint(pIndex, ptIndex)} className="text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addScopePoint(pIndex)} className="text-xs text-primary mt-2 flex items-center gap-1">
                                    <Plus size={12} /> Add Point
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addScopePhase} className="text-sm text-primary font-medium flex items-center gap-1 border border-primary px-3 py-2 rounded-lg hover:bg-primary-50 w-full justify-center">
                        <Plus size={16} /> Add New Phase
                    </button>
                </div>
            </div>

            {/* 6. Product Features */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">6. Product Features & Functionality</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Intro Line</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                        value={formData.features?.intro || ''}
                        onChange={(e) => updateSection('features', 'intro', e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    {formData.features?.phases?.map((phase, pIndex) => (
                        <div key={pIndex} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 mr-2">
                                    <input
                                        type="text"
                                        placeholder="Section Title (e.g. Core Features or Phase 1)"
                                        className="w-full font-medium bg-transparent border-b border-neutral-300 focus:border-primary focus:outline-none mb-2"
                                        value={phase.title}
                                        onChange={(e) => updateFeaturePhase(pIndex, 'title', e.target.value)}
                                    />
                                    <textarea
                                        placeholder="Section Description"
                                        className="w-full text-sm bg-white border border-neutral-300 rounded p-2"
                                        rows={1}
                                        value={phase.description}
                                        onChange={(e) => updateFeaturePhase(pIndex, 'description', e.target.value)}
                                    />
                                </div>
                                <button onClick={() => removeFeaturePhase(pIndex)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                            </div>

                            <div className="ml-4 mt-2 space-y-2">
                                {phase.features?.map((feat, fIndex) => (
                                    <div key={fIndex} className="flex gap-2 items-start border-l-2 border-primary-100 pl-2">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Feature Name"
                                                className="w-full px-2 py-1 text-sm font-medium border border-neutral-200 rounded mb-1"
                                                value={feat.name}
                                                onChange={(e) => updateFeatureItem(pIndex, fIndex, 'name', e.target.value)}
                                            />
                                            <textarea
                                                placeholder="Feature Description"
                                                className="w-full px-2 py-1 text-sm border border-neutral-200 rounded"
                                                rows={2}
                                                value={feat.description}
                                                onChange={(e) => updateFeatureItem(pIndex, fIndex, 'description', e.target.value)}
                                            />
                                        </div>
                                        <button onClick={() => removeFeatureItem(pIndex, fIndex)} className="text-red-400 mt-1"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addFeatureItem(pIndex)} className="text-xs text-primary mt-2 flex items-center gap-1">
                                    <Plus size={12} /> Add Feature
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addFeaturePhase} className="text-sm text-primary font-medium flex items-center gap-1 border border-primary px-3 py-2 rounded-lg hover:bg-primary-50 w-full justify-center">
                        <Plus size={16} /> Add Feature Section
                    </button>
                </div>
            </div>

            {/* 7. Use Cases & User Flow */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">7. Use Case & User Flow</h3>
                {/* Simplified for brevity - just steps */}
                <div className="space-y-2">
                    {formData.userFlow?.steps?.map((step, index) => (
                        <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    placeholder="Step Title (e.g. Email Arrival)"
                                    className="px-3 py-2 border border-neutral-300 rounded-lg"
                                    value={step.title}
                                    onChange={(e) => {
                                        const newSteps = [...(formData.userFlow?.steps || [])];
                                        newSteps[index] = { ...newSteps[index], title: e.target.value };
                                        updateSection('userFlow', 'steps', newSteps);
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Description"
                                    className="md:col-span-2 px-3 py-2 border border-neutral-300 rounded-lg"
                                    value={step.description}
                                    onChange={(e) => {
                                        const newSteps = [...(formData.userFlow?.steps || [])];
                                        newSteps[index] = { ...newSteps[index], description: e.target.value };
                                        updateSection('userFlow', 'steps', newSteps);
                                    }}
                                />
                            </div>
                            <button onClick={() => {
                                const newSteps = formData.userFlow?.steps?.filter((_, i) => i !== index);
                                updateSection('userFlow', 'steps', newSteps);
                            }} className="p-2 text-red-500"><Trash2 size={18} /></button>
                        </div>
                    ))}
                    <button onClick={() => updateSection('userFlow', 'steps', [...(formData.userFlow?.steps || []), { title: '', description: '' }])} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Step
                    </button>
                </div>
            </div>

            {/* 11. Key Deliverables (Moved here as it connects to Scope) */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">11. Key Deliverables</h3>
                <div className="space-y-4">
                    {formData.deliverables?.phases?.map((phase, pIndex) => (
                        <div key={pIndex} className="bg-neutral-50 p-4 rounded-lg">
                            <div className="flex justify-between mb-2">
                                <input
                                    type="text"
                                    placeholder="Phase Name (e.g. Phase 1 Deliverables)"
                                    className="font-medium bg-transparent border-b border-neutral-300 w-full mr-2"
                                    value={phase.name}
                                    onChange={(e) => {
                                        const newPhases = [...(formData.deliverables?.phases || [])];
                                        newPhases[pIndex].name = e.target.value;
                                        updateSection('deliverables', 'phases', newPhases);
                                    }}
                                />
                                <button onClick={() => {
                                    const newPhases = formData.deliverables?.phases?.filter((_, i) => i !== pIndex);
                                    updateSection('deliverables', 'phases', newPhases);
                                }} className="text-red-500"><Trash2 size={16} /></button>
                            </div>
                            <div className="space-y-1 ml-4">
                                {phase.items?.map((item, iIndex) => (
                                    <div key={iIndex} className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm"
                                            value={item}
                                            onChange={(e) => {
                                                const newPhases = [...(formData.deliverables?.phases || [])];
                                                newPhases[pIndex].items[iIndex] = e.target.value;
                                                updateSection('deliverables', 'phases', newPhases);
                                            }}
                                        />
                                        <button onClick={() => {
                                            const newPhases = [...(formData.deliverables?.phases || [])];
                                            newPhases[pIndex].items = newPhases[pIndex].items.filter((_, i) => i !== iIndex);
                                            updateSection('deliverables', 'phases', newPhases);
                                        }} className="text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const newPhases = [...(formData.deliverables?.phases || [])];
                                    newPhases[pIndex].items = [...(newPhases[pIndex].items || []), ''];
                                    updateSection('deliverables', 'phases', newPhases);
                                }} className="text-xs text-primary mt-1 flex items-center gap-1">
                                    <Plus size={12} /> Add Item
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => updateSection('deliverables', 'phases', [...(formData.deliverables?.phases || []), { name: '', items: [] }])} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Deliverable Phase
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScopeTab;
