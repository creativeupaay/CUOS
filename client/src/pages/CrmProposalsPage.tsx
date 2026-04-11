import { Link } from 'react-router-dom';
import { Construction, Sparkles } from 'lucide-react';

export default function CrmProposalsPage() {
    return (
        <div className="px-8 py-8 max-w-[1200px] mx-auto">
            <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-10 shadow-sm">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-white">
                        <Construction size={28} className="text-amber-600" />
                    </div>
                    <h1 className="mt-5 text-3xl font-bold text-neutral-900">Proposal Generator Coming Soon</h1>
                    <p className="mt-3 text-neutral-600">
                        This module is being rebuilt based on upcoming requirements. The existing proposal workflow has been paused for now.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/80 px-4 py-2 text-sm font-medium text-amber-800">
                        <Sparkles size={16} />
                        New experience currently under development
                    </div>
                </div>
                <div className="mt-8 flex items-center justify-center gap-3">
                    <Link
                        to="/crm/leads"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                    >
                        Back to Leads
                    </Link>
                    <Link
                        to="/crm/pipeline"
                        className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                    >
                        Open Pipeline
                    </Link>
                </div>
            </div>
        </div>
    );
}
