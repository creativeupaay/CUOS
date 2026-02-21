import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Proposal } from '../../types/types';

interface BudgetTabProps {
    formData: Partial<Proposal>;
    onChange: (data: Partial<Proposal>) => void;
}

const BudgetTab: React.FC<BudgetTabProps> = ({ formData, onChange }) => {
    // Helper to generic update
    const updateSection = (section: keyof Proposal, field: string, value: any) => {
        onChange({
            ...formData,
            [section]: { ...(formData[section] as any), [field]: value }
        });
    };

    // --- Budget V2 ---
    const addMilestone = () => {
        const schedule = formData.budgetV2?.paymentSchedule || [];
        updateSection('budgetV2', 'paymentSchedule', [...schedule, { milestone: '', percentage: 0, amount: 0 }]);
    };
    const updateMilestone = (index: number, field: string, value: any) => {
        const schedule = [...(formData.budgetV2?.paymentSchedule || [])];
        schedule[index] = { ...schedule[index], [field]: value };
        updateSection('budgetV2', 'paymentSchedule', schedule);
    };
    const removeMilestone = (index: number) => {
        const schedule = formData.budgetV2?.paymentSchedule || [];
        updateSection('budgetV2', 'paymentSchedule', schedule.filter((_, i) => i !== index));
    };

    // --- Terms ---
    const addTerm = () => {
        const items = formData.terms?.clauses || [];
        updateSection('terms', 'clauses', [...items, '']);
    };
    const updateTerm = (index: number, value: string) => {
        const items = [...(formData.terms?.clauses || [])];
        items[index] = value;
        updateSection('terms', 'clauses', items);
    };
    const removeTerm = (index: number) => {
        const items = formData.terms?.clauses || [];
        updateSection('terms', 'clauses', items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-8">
            {/* 16. Budget & Payment */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">16. Budget & Payment Breakdown</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Intro</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                        value={formData.budgetV2?.intro || ''}
                        onChange={(e) => updateSection('budgetV2', 'intro', e.target.value)}
                    />
                </div>

                <div className="mb-6">
                    <h4 className="text-sm font-medium text-neutral-700 mb-2">Detailed Line Items (Auto-Calc)</h4>
                    {/* Reusing the simple items editor here or just referencing it */}
                    {/* Since this is a new tab, we should probably allow editing the 'items' array here too, 
                        or assume it was filled in a previous step? 
                        Let's assume the main form handled 'items'. We can just show Summary here. */}
                    <div className="p-3 bg-neutral-50 rounded text-sm text-neutral-600">
                        Total from Line Items: {formData.currency} {formData.total}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-bold text-neutral-700">Payment Schedule / Milestones</label>
                    {formData.budgetV2?.paymentSchedule?.map((ms, index) => (
                        <div key={index} className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Milestone"
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={ms.milestone}
                                onChange={(e) => updateMilestone(index, 'milestone', e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="%"
                                className="w-16 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={ms.percentage}
                                onChange={(e) => updateMilestone(index, 'percentage', parseFloat(e.target.value) || 0)}
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                className="w-32 px-3 py-2 border border-neutral-300 rounded-lg"
                                value={ms.amount}
                                onChange={(e) => updateMilestone(index, 'amount', parseFloat(e.target.value) || 0)}
                            />
                            <button onClick={() => removeMilestone(index)} className="text-red-500"><Trash2 size={18} /></button>
                        </div>
                    ))}
                    <button onClick={addMilestone} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Milestone
                    </button>
                </div>
            </div>

            {/* 18. Terms */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">18. Terms & Conditions</h3>
                <div className="space-y-2">
                    {formData.terms?.clauses?.map((term, index) => (
                        <div key={index} className="flex gap-2 items-start">
                            <span className="text-sm font-bold text-neutral-400 pt-2">{index + 1}.</span>
                            <textarea
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                                rows={2}
                                value={term}
                                onChange={(e) => updateTerm(index, e.target.value)}
                            />
                            <button onClick={() => removeTerm(index)} className="text-red-500 pt-2"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    <button onClick={addTerm} className="text-sm text-primary flex items-center gap-1">
                        <Plus size={16} /> Add Clause
                    </button>
                </div>
            </div>

            {/* 19. Conclusion */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">19. Conclusion</h3>
                <textarea
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    rows={4}
                    placeholder="Confident closing statement..."
                    value={formData.conclusion || ''}
                    onChange={(e) => onChange({ ...formData, conclusion: e.target.value })}
                />
            </div>

            {/* 20. Next Steps */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">20. Next Steps</h3>
                <textarea
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    rows={3}
                    placeholder="One per line..."
                    value={formData.nextSteps?.join('\n') || ''}
                    onChange={(e) => onChange({ ...formData, nextSteps: e.target.value.split('\n') })}
                />
            </div>
        </div>
    );
};

export default BudgetTab;
