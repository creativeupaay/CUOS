import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetPartnerBySlugQuery } from '@/features/partners/partnersApi';
import { usePartnerLoginMutation } from '@/features/auth/authApi';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/features/auth/slices/authSlice';
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function PersonalizedPartnerLoginPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const { data: partnerData, isLoading: isLoadingPartner, error: partnerError } = useGetPartnerBySlugQuery(slug || '', {
        skip: !slug,
    });

    const [partnerLogin, { isLoading: isLoggingIn }] = usePartnerLoginMutation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const partner = partnerData?.data;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter your email and password');
            return;
        }

        try {
            const result = await partnerLogin({
                email,
                password,
                slug: slug!,
            }).unwrap();

            // Set credentials in Redux store
            dispatch(setCredentials({ user: result.data.user }));

            // Redirect to dashboard
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(err?.data?.message || 'Invalid email or password');
        }
    };

    if (isLoadingPartner) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (partnerError || !partner) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-red-100">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal Not Found</h1>
                    <p className="text-gray-600">
                        This partner portal doesn't exist or has been disabled. Please check the URL or contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    const firstName = partner.contactPerson?.split(' ')[0] || 'Partner';
    const hasLogo = !!partner.companyLogo;

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Gradient Background */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                    }}
                />

                {/* Pattern Overlay */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center items-center text-center px-12 w-full">
                    {/* Logo or Company Name */}
                    <div className="mb-8">
                        {hasLogo ? (
                            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
                                <img
                                    src={partner.companyLogo}
                                    alt={partner.companyName || 'Company Logo'}
                                    className="h-20 max-w-[240px] object-contain mx-auto"
                                />
                            </div>
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl mx-auto">
                                <span className="text-4xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    {partner.companyName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'P'}
                                </span>
                            </div>
                        )}
                    </div>

                    {partner.companyName && (
                        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                            {partner.companyName}
                        </h1>
                    )}

                    <p className="text-xl text-white/90 font-medium mb-8 drop-shadow">
                        Partner Portal
                    </p>

                    {/* Features */}
                    <div className="grid gap-4 w-full max-w-md">
                        {[
                            'Manage your clients',
                            'Track project progress',
                            'Collaborate with team',
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-white"
                            >
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                                <span className="text-sm font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        {hasLogo ? (
                            <div className="bg-white rounded-2xl p-6 shadow-lg inline-block">
                                <img
                                    src={partner.companyLogo}
                                    alt={partner.companyName || 'Company Logo'}
                                    className="h-12 max-w-[180px] object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                            >
                                <span className="text-2xl font-bold text-white">
                                    {partner.companyName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'P'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-10 border border-gray-100">
                        {/* Welcome Text */}
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                Welcome back, {firstName}! 👋
                            </h2>
                            <p className="text-gray-600">Sign in to access your partner portal</p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-gray-900 placeholder:text-gray-400"
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-gray-900 placeholder:text-gray-400"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full py-3.5 px-4 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                            >
                                {isLoggingIn ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                                <span>Don't have an account?Contact Administrator</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Note */}
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Having trouble? Contact your administrator for support.
                    </p>
                </div>
            </div>
        </div>
    );
}
