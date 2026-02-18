import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '@/features/auth/authApi';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/slices/authSlice';
import { LogIn, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [login, { isLoading }] = useLoginMutation();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const result = await login(formData).unwrap();

            dispatch(
                setCredentials({
                    user: result.data.user,
                })
            );

            navigate('/dashboard');
        } catch (err: unknown) {
            const apiErr = err as { data?: { message?: string } };
            setError(apiErr.data?.message || 'Login failed. Please try again.');
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4"
            style={{ backgroundColor: 'var(--color-bg-app)' }}
        >
            <div
                className="w-full rounded-xl border p-8"
                style={{
                    maxWidth: '400px',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        CU
                    </div>
                    <h1
                        className="text-xl font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Sign in to CUOS
                    </h1>
                    <p
                        className="text-sm mt-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Creative Upaay Operating System
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 rounded-lg border text-sm outline-none transition-colors"
                            style={{
                                height: '40px',
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-primary)',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-default)')}
                            placeholder="admin@creativeupaay.com"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-3 rounded-lg border text-sm outline-none transition-colors"
                            style={{
                                height: '40px',
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-primary)',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                            onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-default)')}
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                            style={{
                                backgroundColor: 'var(--color-danger-soft)',
                                color: 'var(--color-danger)',
                            }}
                        >
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        style={{
                            height: '40px',
                            backgroundColor: isLoading ? 'var(--color-primary)' : 'var(--color-primary)',
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        }}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <LogIn size={16} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div
                    className="mt-6 pt-4 text-center text-xs border-t"
                    style={{
                        color: 'var(--color-text-muted)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <p>Default credentials</p>
                    <p className="font-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        admin@creativeupaay.com / Admin@123
                    </p>
                </div>
            </div>
        </div>
    );
}
