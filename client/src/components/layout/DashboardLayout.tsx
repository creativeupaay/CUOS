import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

/**
 * DashboardLayout
 *
 * Wraps all authenticated pages with:
 * - Fixed left sidebar (260px)
 * - Scrollable main content area
 */
export default function DashboardLayout() {
    return (
        <div className="min-h-screen bg-app-premium text-[color:var(--color-text-primary)]">
            <Sidebar />
            <main
                className="min-h-screen"
                style={{
                    marginLeft: 'var(--sidebar-width)',
                    padding: '28px 32px',
                }}
            >
                <Outlet />
            </main>
        </div>
    );
}
