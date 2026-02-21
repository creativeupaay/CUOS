import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Proposal } from '../../types/types';

interface ExecutionTabProps {
    formData: Partial<Proposal>;
    onChange: (data: Partial<Proposal>) => void;
}

const ExecutionTab: React.FC<ExecutionTabProps> = ({ formData, onChange }) => {
    // Helper to generic update
    const updateSection = (section: keyof Proposal, field: string, value: any) => {
        onChange({
            ...formData,
            [section]: { ...(formData[section] as any), [field]: value }
        });
    };

    // --- Timeline ---
    const addTimelinePhase = () => {
        const phases = formData.timeline?.phases || [];
        updateSection('timeline', 'phases', [...phases, { title: '', duration: '', objective: '', activities: [] }]);
    };
    const updateTimelinePhase = (index: number, field: string, value: any) => {
        const phases = [...(formData.timeline?.phases || [])];
        phases[index] = { ...phases[index], [field]: value };
        updateSection('timeline', 'phases', phases);
    };
    const removeTimelinePhase = (index: number) => {
        const phases = formData.timeline?.phases || [];
        updateSection('timeline', 'phases', phases.filter((_, i) => i !== index));
    };

    // --- Team ---
    const addResource = () => {
        const resources = formData.team?.resources || [];
        updateSection('team', 'resources', [...resources, { role: '', count: 1, duration: '' }]);
    };
    const updateResource = (index: number, field: string, value: any) => {
        const resources = [...(formData.team?.resources || [])];
        resources[index] = { ...resources[index], [field]: value };
        updateSection('team', 'resources', resources);
    };
    const removeResource = (index: number) => {
        const resources = formData.team?.resources || [];
        updateSection('team', 'resources', resources.filter((_, i) => i !== index));
    };

    // --- Risks ---
    const addRisk = () => {
        const items = formData.risks?.items || [];
        updateSection('risks', 'items', [...items, { risk: '', mitigation: '' }]);
    };
    const updateRisk = (index: number, field: string, value: any) => {
        const items = [...(formData.risks?.items || [])];
        items[index] = { ...items[index], [field]: value };
        updateSection('risks', 'items', items);
    };
    const removeRisk = (index: number) => {
        const items = formData.risks?.items || [];
        updateSection('risks', 'items', items.filter((_, i) => i !== index));
    };


    return (
        <div className="space-y-8">
            {/* 14. Timelines */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">14. Timelines & Release Plan</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Intro</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                        value={formData.timeline?.intro || ''}
                        onChange={(e) => updateSection('timeline', 'intro', e.target.value)}
                    />
                </div>
                <div className="space-y-4">
                    {formData.timeline?.phases?.map((phase, index) => (
                        <div key={index} className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 mr-4 grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Phase Title"
                                        className="col-span-2 font-medium border-b border-neutral-300 w-full mb-1 bg-transparent"
                                        value={phase.title}
                                        onChange={(e) => updateTimelinePhase(index, 'title', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Duration (e.g. Weeks 1-2)"
                                        className="text-sm px-2 py-1 border border-neutral-300 rounded"
                                        value={phase.duration}
                                        onChange={(e) => updateTimelinePhase(index, 'duration', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Objective"
                                        className="text-sm px-2 py-1 border border-neutral-300 rounded"
                                        value={phase.objective}
                                        onChange={(e) => updateTimelinePhase(index, 'objective', e.target.value)}
                                    />
                                </div>
                                <button onClick={() => removeTimelinePhase(index)} className="text-red-500"><Trash2 size={16} /></button>
                            </div>
                            {/* Activities could be a simple textarea for now or dynamic list. Let's use textarea for MVP speed */}
                            <textarea
                                placeholder="Key Activities (one per line)"
                                className="w-full text-sm border border-neutral-300 rounded p-2"
                                rows={3}
                                value={phase.activities?.join('\n') || ''}
                                onChange={(e) => updateTimelinePhase(index, 'activities', e.target.value.split('\n'))}
                            />
                        </div>
                    ))}
                    <button onClick={addTimelinePhase} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Timeline Phase
                    </button>

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Release Plan</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            value={formData.timeline?.releasePlan || ''}
                            onChange={(e) => updateSection('timeline', 'releasePlan', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* 15. Team Allocation */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">15. Team/Resource Allocation</h3>
                <div className="space-y-4">
                    {formData.team?.resources?.map((res, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Role"
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={res.role}
                                onChange={(e) => updateResource(index, 'role', e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="Count"
                                className="w-20 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={res.count}
                                onChange={(e) => updateResource(index, 'count', parseInt(e.target.value) || 0)}
                            />
                            <input
                                type="text"
                                placeholder="Duration"
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={res.duration}
                                onChange={(e) => updateResource(index, 'duration', e.target.value)}
                            />
                            <button onClick={() => removeResource(index)} className="text-red-500"><Trash2 size={18} /></button>
                        </div>
                    ))}
                    <button onClick={addResource} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Resource
                    </button>
                </div>
            </div>

            {/* 17. Risks */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">17. Risks & Mitigation</h3>
                <div className="space-y-4">
                    {formData.risks?.items?.map((item, index) => (
                        <div key={index} className="flex gap-4 items-start border-b border-neutral-100 pb-2">
                            <div className="flex-1 space-y-2">
                                <input
                                    type="text"
                                    placeholder="Risk"
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                    value={item.risk}
                                    onChange={(e) => updateRisk(index, 'risk', e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-green-600">MITIGATION:</span>
                                    <input
                                        type="text"
                                        placeholder="Mitigation Strategy"
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                        value={item.mitigation}
                                        onChange={(e) => updateRisk(index, 'mitigation', e.target.value)}
                                    />
                                </div>
                            </div>
                            <button onClick={() => removeRisk(index)} className="text-red-500 mt-2"><Trash2 size={18} /></button>
                        </div>
                    ))}
                    <button onClick={addRisk} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Risk
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExecutionTab;
