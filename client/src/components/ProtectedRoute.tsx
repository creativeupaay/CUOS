import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
    const { isAuthenticated, user, isInitialized } = useAppSelector((state) => state.auth);

    const partnerSlug = (() => {
        if (typeof window === 'undefined') return null;
        return window.sessionStorage.getItem('partnerPortalSlug');
    })();

    if (!isInitialized) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to={partnerSlug ? `/partner/${partnerSlug}/login` : '/login'} replace />;
    }

    // Check role if specified
    if (roles && user) {
        const userRole = typeof user.role === 'string' ? user.role : user.role.name;
        if (!roles.includes(userRole)) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <>{children}</>;
}
