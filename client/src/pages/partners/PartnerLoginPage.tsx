import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePartnerLoginMutation } from '@/features/auth/authApi';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/slices/authSlice';
import { Eye, EyeOff, AlertCircle, Loader2, Lock } from 'lucide-react';

export default function PartnerLoginPage() {
    const navigate = useNavigate();
    const { slug } = useParams<{ slug: string }>();
    const dispatch = useAppDispatch();
    const [login, { isLoading }] = usePartnerLoginMutation();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const result = await login({ ...formData, slug: slug || '' }).unwrap();
            dispatch(setCredentials({ user: result.data.user }));
            navigate('/dashboard');
        } catch (err: unknown) {
            const apiErr = err as { data?: { message?: string } };
            setError(apiErr.data?.message || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="w-full max-w-md">
                {/* Logo/Icon */}
                <div className="flex flex-col items-center mb-10">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                        }}
                    >
                        <Lock size={32} className="text-white" strokeWidth={2} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Partner Portal</h1>
                    <p className="text-sm text-gray-500 mt-1">Sign in to access your account</p>
                </div>

                {/* Login Card */}
                <div
                    className="rounded-2xl shadow-xl p-8"
                    style={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                    }}
                >
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-semibold mb-2 text-gray-700"
                            >
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="your@email.com"
                                style={{ fontSize: '15px' }}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-semibold mb-2 text-gray-700"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-gray-900 placeholder-gray-400"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                    style={{ fontSize: '15px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div
                                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                                style={{
                                    backgroundColor: '#FEF2F2',
                                    border: '1px solid #FEE2E2',
                                    color: '#DC2626',
                                }}
                            >
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                            style={{
                                background: isLoading
                                    ? 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)'
                                    : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                                fontSize: '15px',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <span>Sign In</span>
                            )}
                        </button>
                    </form>

                    {/* Footer Note */}
                    <p className="mt-6 text-center text-xs text-gray-500">
                        Contact your administrator if you need assistance.
                    </p>
                </div>

                {/* Bottom Copyright */}
                <p className="mt-8 text-center text-xs text-gray-400">
                    © {new Date().getFullYear()} All rights reserved.
                </p>
            </div>
        </div>
    );
}
