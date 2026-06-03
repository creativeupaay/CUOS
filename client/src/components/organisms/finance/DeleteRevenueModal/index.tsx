import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useDeleteRevenueMutation, type Revenue } from '@/features/finance';
import ModalPortal from '@/components/ui/ModalPortal';
import { logger } from '@/utils/logger';

export interface DeleteRevenueModalProps {
    isOpen: boolean;
    onClose: () => void;
    revenue: Revenue | null;
}

export const DeleteRevenueModal: React.FC<DeleteRevenueModalProps> = ({ isOpen, onClose, revenue }) => {
    const [deleteRevenue, { isLoading: isDeleting }] = useDeleteRevenueMutation();

    const handleDelete = async () => {
        if (!revenue) return;
        try {
            await deleteRevenue(revenue._id).unwrap();
            onClose();
        } catch (error) {
            logger.error('Failed to delete revenue:', error);
        }
    };

    if (!isOpen || !revenue) return null;

    return (
        <ModalPortal>
            <div className="w-full max-w-md rounded-xl shadow-xl bg-white p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Revenue Entry</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Are you sure you want to delete the revenue entry for <span className="font-semibold text-gray-700">"{revenue.description}"</span>? This action cannot be undone.
                </p>
                <div className="flex justify-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 border border-gray-200 text-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                    >
                        {isDeleting && <Loader2 size={16} className="animate-spin" />}
                        Delete Entry
                    </button>
                </div>
            </div>
        </ModalPortal>
    );
};
