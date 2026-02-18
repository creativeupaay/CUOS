import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
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
