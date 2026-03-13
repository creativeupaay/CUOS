import { FileText } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import type { Proposal } from '@/features/crm/types/types';
import ProposalPDF from './ProposalPDF';

export default function ProposalPdfDownloadButton({ proposal }: { proposal: Proposal }) {
    return (
        <PDFDownloadLink
            document={<ProposalPDF proposal={proposal} />}
            fileName={`Proposal-${proposal.title.replace(/\s+/g, '-')}.pdf`}
            className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
        >
            {({ loading }) => (
                <>
                    <FileText size={18} />
                    {loading ? 'Generating PDF...' : 'Download PDF'}
                </>
            )}
        </PDFDownloadLink>
    );
}
