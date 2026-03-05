import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '@/features/auth/authApi';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/slices/authSlice';
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';



export default function LoginPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [login, { isLoading }] = useLoginMutation();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const result = await login(formData).unwrap();
            dispatch(setCredentials({ user: result.data.user }));
            navigate('/dashboard');
        } catch (err: unknown) {
            const apiErr = err as { data?: { message?: string } };
            setError(apiErr.data?.message || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* ── Left Brand Panel ──────────────────────────────────── */}
            <div
                className="hidden lg:flex flex-col justify-between p-12 flex-1"
                style={{
                    background: 'linear-gradient(145deg, #064E3B 0%, #065F46 45%, #0369a1 100%)',
                }}
            >
                {/* Top brand row */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                        style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
                    >
                        CU
                    </div>
                    <div>
                        <div className="font-bold text-white text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>CUOS</div>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Creative Upaay</div>
                    </div>
                </div>

                {/* Centred brand hero */}
                <div className="flex flex-col items-center text-center">
                    {/* Large logo mark */}
                    <div
                        className="w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-4xl mb-8"
                        style={{
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: 'white',
                            fontFamily: 'Outfit, sans-serif',
                            letterSpacing: '-0.04em',
                        }}
                    >
                        CU
                    </div>

                    <h1
                        className="text-3xl font-bold text-white mb-3"
                        style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}
                    >
                        Creative Upaay<br />Operating System
                    </h1>

                    {/* Subtle divider */}
                    <div
                        className="w-12 h-0.5 rounded-full my-5"
                        style={{ background: 'rgba(255,255,255,0.25)' }}
                    />

                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '300px' }}>
                        One unified workspace for{' '}
                        <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>EveryOne</span>
                    </p>
                </div>

                {/* Bottom watermark */}
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    © {new Date().getFullYear()} Creative Upaay. All rights reserved.
                </p>
            </div>

            {/* ── Right Form Panel ──────────────────────────────────── */}
            <div
                className="flex flex-col items-center justify-center flex-1 px-6 py-12"
                style={{ backgroundColor: '#FAFBFA', minWidth: 0 }}
            >
                {/* Mobile logo */}
                <div className="flex items-center gap-2 mb-10 lg:hidden">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        CU
                    </div>
                    <span className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>CUOS</span>
                </div>

                <div style={{ width: '100%', maxWidth: '420px' }}>
                    <div className="mb-8">
                        <h2
                            className="text-2xl font-bold mb-1.5"
                            style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                        >
                            Welcome back
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Sign in to your CUOS workspace
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="you@creativeupaay.com"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium mb-1.5"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    className="input"
                                    style={{ paddingRight: '44px' }}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                                style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
                            >
                                <AlertCircle size={15} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn btn-primary text-base"
                            style={{ height: '46px', borderRadius: '12px', fontSize: '15px' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={17} className="animate-spin" />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={17} />
                                    Sign in
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer note */}
                    <p
                        className="mt-8 text-center text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Contact your administrator if you don't have an account.
                    </p>
                </div>
            </div>
        </div>
    );
}
