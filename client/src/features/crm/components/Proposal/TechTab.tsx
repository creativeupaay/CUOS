import React from 'react';
import type { Proposal } from '../../types/types';

interface TechTabProps {
    formData: Partial<Proposal>;
    onChange: (data: Partial<Proposal>) => void;
}

const TechTab: React.FC<TechTabProps> = ({ formData, onChange }) => {
    const updateTech = (field: string, value: string) => {
        onChange({
            ...formData,
            techStack: { ...formData.techStack, [field]: value } as any
        });
    };

    const updateNFR = (field: string, value: string) => {
        onChange({
            ...formData,
            nfr: { ...formData.nfr, [field]: value } as any
        });
    };

    return (
        <div className="space-y-8">
            {/* 8. Technical Specifications */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">8. Technical Specifications & Architecture</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Intro Line</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            value={formData.techStack?.intro || ''}
                            onChange={(e) => updateTech('intro', e.target.value)}
                        />
                    </div>

                    {[
                        { label: 'Frontend', key: 'frontend', placeholder: 'e.g. React.js with TypeScript' },
                        { label: 'UI Styling', key: 'uiStyling', placeholder: 'e.g. Tailwind CSS' },
                        { label: 'State Management', key: 'stateManagement', placeholder: 'e.g. React Query' },
                        { label: 'Backend', key: 'backend', placeholder: 'e.g. Node.js with Express.js' },
                        { label: 'Database', key: 'database', placeholder: 'e.g. MongoDB' },
                        { label: 'File Storage', key: 'fileStorage', placeholder: 'e.g. AWS S3' },
                        { label: 'Search Engine', key: 'searchEngine', placeholder: 'e.g. AWS OpenSearch' },
                        { label: 'AI/NLP', key: 'aiIntegration', placeholder: 'e.g. OpenAI API' },
                        { label: 'Automation', key: 'automation', placeholder: 'e.g. n8n' },
                        { label: 'Notifications', key: 'notifications', placeholder: 'e.g. Resend' },
                        { label: 'Hosting', key: 'hosting', placeholder: 'e.g. AWS EC2' },
                        { label: 'Security', key: 'security', placeholder: 'e.g. SSL/TLS, JWT' },
                    ].map((field) => (
                        <div key={field.key}>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">{field.label}</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                                placeholder={field.placeholder}
                                value={(formData.techStack as any)?.[field.key] || ''}
                                onChange={(e) => updateTech(field.key, e.target.value)}
                            />
                        </div>
                    ))}

                    {/* Integrations (Array handling simplified to comma string for MVP input, or keep simple) */}
                    {/* For now let's just use JSON stringify/parse or line split if needed, 
                        but standard inputs usually fine. Let's make it a textarea for manual entry */}
                </div>
            </div>

            {/* 9. NFRs */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">9. Non-Functional Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Intro</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            value={formData.nfr?.intro || ''}
                            onChange={(e) => updateNFR('intro', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Performance</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            value={formData.nfr?.performance || ''}
                            onChange={(e) => updateNFR('performance', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Accuracy</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            value={formData.nfr?.accuracy || ''}
                            onChange={(e) => updateNFR('accuracy', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Reliability</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            value={formData.nfr?.reliability || ''}
                            onChange={(e) => updateNFR('reliability', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Security</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={2}
                            value={formData.nfr?.security || ''}
                            onChange={(e) => updateNFR('security', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* 10. Design Requirements */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h3 className="text-lg font-semibold mb-4">10. Design & UX Requirements</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Intro</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            value={formData.designRequirements?.intro || ''}
                            onChange={(e) => onChange({ ...formData, designRequirements: { ...formData.designRequirements, intro: e.target.value } as any })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Description / Points</label>
                        <textarea
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                            rows={4}
                            placeholder="describe UX..."
                            value={formData.designRequirements?.description || ''}
                            onChange={(e) => onChange({ ...formData, designRequirements: { ...formData.designRequirements, description: e.target.value } as any })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TechTab;
