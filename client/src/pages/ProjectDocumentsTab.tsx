import { useOutletContext } from 'react-router-dom';
import { useLazyGetDocumentUrlQuery, useUploadDocumentMutation, useDeleteDocumentMutation } from '@/features/project';
import type { Project } from '@/features/project';
import { useState } from 'react';

export default function ProjectDocumentsTab() {
    const { project } = useOutletContext<{ project: Project }>();
    const [uploadDocument] = useUploadDocumentMutation();
    const [deleteDocument] = useDeleteDocumentMutation();
    const [getDocumentUrl] = useLazyGetDocumentUrlQuery();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await uploadDocument({
                projectId: project._id,
                file,
                name: file.name,
                type: 'other',
            }).unwrap();
        } catch (error) {
            console.error('Failed to upload document:', error);
        }
    };

    const handleDownload = async (docId: string) => {
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
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            await deleteDocument({
                projectId: project._id,
                docId,
            }).unwrap();
        } catch (error) {
            console.error('Failed to delete document:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Documents</h2>
                <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    Upload Document
                    <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </label>
            </div>

            <div className="bg-white rounded-lg border">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Size</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Uploaded By</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Uploaded At</th>
                            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {project.documents.map((doc) => {
                            const uploader = typeof doc.uploadedBy === 'object' ? doc.uploadedBy : null;
                            return (
                                <tr key={doc._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium">{doc.name}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">
                                            {doc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {(doc.size / 1024).toFixed(1)} KB
                                    </td>
                                    <td className="px-4 py-3 text-sm">{uploader?.name || 'Unknown'}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDownload(doc._id)}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Download
                                            </button>
                                            <button
                                                onClick={() => handleDelete(doc._id)}
                                                className="text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {project.documents.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No documents uploaded. Upload your first document!
                    </div>
                )}
            </div>
        </div>
    );
}
