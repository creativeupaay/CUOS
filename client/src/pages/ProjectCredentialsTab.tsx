import { useParams } from 'react-router-dom';
import { useGetCredentialsQuery } from '@/features/project';

export default function ProjectCredentialsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const { data, isLoading } = useGetCredentialsQuery({ projectId: projectId! });
    const credentials = data?.data || [];

    if (isLoading) {
        return <div>Loading credentials...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Credentials</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Add Credential
                </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                    🔒 <strong>Security Notice:</strong> Credentials are encrypted at rest. Only authorized team members can view sensitive information.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {credentials.map((credential) => (
                    <div
                        key={credential._id}
                        className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-semibold">{credential.name}</h3>
                                <p className="text-sm text-gray-600 capitalize">{credential.type}</p>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {credential.accessUsers.length} users
                            </span>
                        </div>

                        {credential.description && (
                            <p className="text-sm text-gray-600 mb-3">{credential.description}</p>
                        )}

                        <button className="text-sm text-blue-600 hover:underline">
                            View Details
                        </button>
                    </div>
                ))}

                {credentials.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-gray-500">
                        No credentials stored. Add your first credential!
                    </div>
                )}
            </div>
        </div>
    );
}
