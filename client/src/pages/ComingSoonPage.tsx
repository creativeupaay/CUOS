import { Link, useLocation } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

export default function ComingSoonPage() {
    const location = useLocation();

    // Extract module name from path
    const moduleName = location.pathname.split('/')[1] || 'Module';
    const displayName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    return (
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
            <div className="text-center px-4">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{
                        backgroundColor: 'var(--color-warning-soft)',
                        color: '#92400E',
                    }}
                >
                    <Construction size={28} />
                </div>

                <h1
                    className="text-xl font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {displayName} — Coming Soon
                </h1>

                <p
                    className="text-sm mb-6 max-w-sm mx-auto"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    This module is currently under development and will be available in an upcoming phase.
                </p>

                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-4 text-sm font-medium rounded-lg border transition-colors"
                    style={{
                        height: '40px',
                        lineHeight: '40px',
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                    }}
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
