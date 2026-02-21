import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Proposal } from '../../types/types';

interface OverviewTabProps {
    formData: Partial<Proposal>;
    onChange: (data: Partial<Proposal>) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ formData, onChange }) => {
    const handleOverviewChange = (field: string, value: string) => {
        onChange({
            ...formData,
            overview: { ...formData.overview, [field]: value } as any
        });
    };

    const handleChallengeChange = (field: string, value: string) => {
        onChange({
            ...formData,
            businessChallenge: { ...formData.businessChallenge, [field]: value } as any
        });
    };

    const addPainPoint = () => {
        const currentPoints = formData.businessChallenge?.painPoints || [];
        onChange({
            ...formData,
            businessChallenge: {
                ...formData.businessChallenge,
                painPoints: [...currentPoints, { title: '', description: '' }]
            } as any
        });
    };

    const removePainPoint = (index: number) => {
        const currentPoints = formData.businessChallenge?.painPoints || [];
        onChange({
            ...formData,
            businessChallenge: {
                ...formData.businessChallenge,
                painPoints: currentPoints.filter((_, i) => i !== index)
            } as any
        });
    };

    const updatePainPoint = (index: number, field: string, value: string) => {
        const currentPoints = [...(formData.businessChallenge?.painPoints || [])];
        currentPoints[index] = { ...currentPoints[index], [field]: value };
        onChange({
            ...formData,
            businessChallenge: {
                ...formData.businessChallenge,
                painPoints: currentPoints
            } as any
        });
    };

    return (
        <div className="space-y-8">
            {/* 1. Project Overview */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">1. Project Overview</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Project</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                            placeholder="What is the project?"
                            value={formData.overview?.project || ''}
                            onChange={(e) => handleOverviewChange('project', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Purpose</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                            placeholder="Why is it being done?"
                            value={formData.overview?.purpose || ''}
                            onChange={(e) => handleOverviewChange('purpose', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Outcome</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                            placeholder="What value does it bring?"
                            value={formData.overview?.outcome || ''}
                            onChange={(e) => handleOverviewChange('outcome', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* 2. Business Opportunity & Problem Statement */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">2. Business Opportunity & Problem Statement</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">The Challenge</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={3}
                            placeholder="Summarize the client's core challenge..."
                            value={formData.businessChallenge?.challenge || ''}
                            onChange={(e) => handleChallengeChange('challenge', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Key Pain Points</label>
                        {formData.businessChallenge?.painPoints?.map((point, index) => (
                            <div key={index} className="flex gap-2 mb-3 items-start">
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Pain Point Title"
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                        value={point.title}
                                        onChange={(e) => updatePainPoint(index, 'title', e.target.value)}
                                    />
                                    <textarea
                                        placeholder="Description"
                                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                        rows={2}
                                        value={point.description}
                                        onChange={(e) => updatePainPoint(index, 'description', e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removePainPoint(index)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-1"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addPainPoint}
                            className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                        >
                            <Plus size={16} /> Add Pain Point
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Target Audience */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">3. Target Audience</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Primary Users</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                            value={formData.targetAudience?.primary || ''}
                            onChange={(e) => onChange({ ...formData, targetAudience: { ...formData.targetAudience, primary: e.target.value } as any })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Secondary Users</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            rows={2}
                            value={formData.targetAudience?.secondary || ''}
                            onChange={(e) => onChange({ ...formData, targetAudience: { ...formData.targetAudience, secondary: e.target.value } as any })}
                        />
                    </div>
                </div>
            </div>

            {/* 4. Goals & Objectives */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">4. Goals & Objectives</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Primary Business Goal</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            placeholder="Revenue, efficiency, market growth..."
                            value={formData.goals?.business || ''}
                            onChange={(e) => onChange({ ...formData, goals: { ...formData.goals, business: e.target.value } as any })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Operational Goal</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            placeholder="Workflow optimization, time savings..."
                            value={formData.goals?.operational || ''}
                            onChange={(e) => onChange({ ...formData, goals: { ...formData.goals, operational: e.target.value } as any })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Technical Goal</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            placeholder="Security, scalability, performance..."
                            value={formData.goals?.technical || ''}
                            onChange={(e) => onChange({ ...formData, goals: { ...formData.goals, technical: e.target.value } as any })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
