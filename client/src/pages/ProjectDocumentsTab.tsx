import { useOutletContext } from 'react-router-dom';
import {
    useLazyGetDocumentUrlQuery,
    useUploadDocumentMutation,
    useDeleteDocumentMutation,
} from '@/features/project';
import type { Project } from '@/features/project';
import { FileText, Download, Trash2, Upload, Loader2, Eye } from 'lucide-react';
import { useState } from 'react';

export default function ProjectDocumentsTab() {
    const { project } = useOutletContext<{ project: Project }>();
    const [uploadDocument, { isLoading: isUploading }] = useUploadDocumentMutation();
    const [deleteDocument] = useDeleteDocumentMutation();
    const [getDocumentUrl] = useLazyGetDocumentUrlQuery();
    const [uploadType, setUploadType] = useState('other');

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await uploadDocument({
                projectId: project._id,
                file,
                name: file.name,
                type: uploadType as any,
            }).unwrap();
        } catch (error) {
            console.error('Failed to upload document:', error);
        }

        // Reset the input
        e.target.value = '';
    };

    const handleDownload = async (docId: string) => {
        try {
            const result = await getDocumentUrl({
                projectId: project._id,
                docId,
            }).unwrap();

            if (result.data?.url) {
                const a = document.createElement('a');
                a.href = result.data.url;
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Failed to get document URL:', error);
        }
    };

    const handleView = async (docId: string) => {
        try {
            const result = await getDocumentUrl({
                projectId: project._id,
                docId,
            }).unwrap();

            if (result.data?.url) {
                window.open(result.data.url, '_blank');
            }
        } catch (error) {
            console.error('Failed to get document URL:', error);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm('Delete this document?')) return;

        try {
            await deleteDocument({
                projectId: project._id,
                docId,
            }).unwrap();
        } catch (error) {
            console.error('Failed to delete document:', error);
        }
    };

    const typeLabels: Record<string, string> = {
        contract: 'Contract',
        proposal: 'Proposal',
        invoice: 'Invoice',
        other: 'Other',
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Documents
                    <span
                        className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        {project.documents.length}
                    </span>
                </h2>

                <div className="flex items-center gap-2">
                    <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value)}
                        className="px-2 rounded-lg border text-xs outline-none"
                        style={{
                            height: '36px',
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        <option value="contract">Contract</option>
                        <option value="proposal">Proposal</option>
                        <option value="invoice">Invoice</option>
                        <option value="other">Other</option>
                    </select>

                    <label
                        className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer"
                        style={{
                            height: '36px',
                            backgroundColor: 'var(--color-primary)',
                            lineHeight: '36px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                    >
                        {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                        Upload
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isUploading}
                        />
                    </label>
                </div>
            </div>

            {/* Documents Table */}
            <div
                className="rounded-lg border overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <table className="w-full">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Type</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Size</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Uploaded By</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Date</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-default)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {project.documents.map((doc) => {
                            const uploader = typeof doc.uploadedBy === 'object' ? doc.uploadedBy : null;
                            return (
                                <tr
                                    key={doc._id}
                                    style={{ borderBottom: '1px solid var(--color-border-default)' }}
                                >
                                    <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {doc.name}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span
                                            className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                                            style={{
                                                backgroundColor: 'var(--color-bg-subtle)',
                                                color: 'var(--color-text-secondary)',
                                            }}
                                        >
                                            {typeLabels[doc.type] || doc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {(doc.size / 1024).toFixed(1)} KB
                                    </td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                                        {uploader?.name || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleView(doc._id)}
                                                className="p-1 transition-colors group relative"
                                                style={{ color: 'var(--color-primary)' }}
                                                title="View"
                                            >
                                                <Eye size={14} className="opacity-80 group-hover:opacity-100" />
                                            </button>
                                            <button
                                                onClick={() => handleDownload(doc._id)}
                                                className="p-1 transition-colors group relative"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                                title="Download"
                                            >
                                                <Download size={14} className="opacity-80 group-hover:opacity-100" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(doc._id)}
                                                className="p-1 transition-colors group relative"
                                                style={{ color: 'var(--color-danger)' }}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} className="opacity-80 group-hover:opacity-100" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {project.documents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <FileText size={20} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No documents uploaded</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Upload your first document</p>
                    </div>
                )}
            </div>
        </div>
    );
}
