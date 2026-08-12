/**
 * ClientPortalAccessPage
 *
 * Handles the unique portal URL: /portal/:clientId/:token
 * Exchanges the token for a session cookie and redirects to the portal.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { useExchangePortalTokenMutation } from '@/features/client-portal/clientPortalApi';
import { setPortalClientInfo } from '@/features/client-portal/clientPortalSlice';
import { Loader2, AlertTriangle, Building2 } from 'lucide-react';

export default function ClientPortalAccessPage() {
    const { clientId, token } = useParams<{ clientId: string; token: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [exchangeToken] = useExchangePortalTokenMutation();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId || !token) {
            setError('Invalid access link. Please contact your account manager.');
            return;
        }

        exchangeToken({ clientId, token })
            .unwrap()
            .then((res) => {
                dispatch(setPortalClientInfo(res.data.client));
                navigate('/client-portal/projects', { replace: true });
            })
            .catch((err: any) => {
                setError(
                    err?.data?.message ??
                    'Invalid or revoked access link. Please contact your account manager.'
                );
            });
        // Only run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ backgroundColor: '#F8FAFC' }}
        >
            {/* Brand */}
            <div className="flex items-center gap-2.5 mb-10">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                    <Building2 size={18} className="text-white" />
                </div>
                <span className="text-lg font-bold" style={{ color: '#0F172A' }}>
                    Client Portal
                </span>
            </div>

            <div
                className="w-full max-w-sm rounded-2xl border p-8 text-center shadow-sm"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
                {error ? (
                    <>
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                            style={{ backgroundColor: '#FEF2F2' }}
                        >
                            <AlertTriangle size={22} style={{ color: '#DC2626' }} />
                        </div>
                        
                        <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                            {error}
                        </p>
                    </>
                ) : (
                    <>
                        <Loader2
                            size={32}
                            className="animate-spin mx-auto mb-4"
                            style={{ color: '#6366F1' }}
                        />
                        <p className="text-sm font-medium" style={{ color: '#475569' }}>
                            Verifying your access link…
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
