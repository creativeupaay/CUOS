import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Save } from 'lucide-react';
import { useChangePasswordMutation } from '@/features/auth/authApi';

export default function MyProfileChangePasswordPage() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [changePassword, { isLoading }] = useChangePasswordMutation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        if (!oldPassword || !newPassword) {
            setErrorMessage('Please fill both old and new password.');
            return;
        }

        try {
            const res = await changePassword({ oldPassword, newPassword }).unwrap();
            setSuccessMessage(res?.message || 'Password changed successfully.');
            setOldPassword('');
            setNewPassword('');
        } catch (err: any) {
            setErrorMessage(err?.data?.message || 'Failed to change password');
        }
    };

    const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border pr-10';
    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '700px' }}>
            <div
                className="rounded-xl border p-6"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                <div className="flex items-center gap-2 mb-5">
                    <KeyRound size={18} style={{ color: 'var(--color-primary)' }} />
                    
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Old Password
                        </label>
                        <div className="relative">
                            <input
                                type={showOldPassword ? 'text' : 'password'}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className={inputCls}
                                style={inputStyle}
                                placeholder="Enter your old password"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowOldPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md cursor-pointer"
                                style={{ color: 'var(--color-text-muted)' }}
                                aria-label={showOldPassword ? 'Hide old password' : 'Show old password'}
                            >
                                {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={inputCls}
                                style={inputStyle}
                                placeholder="Enter your new password"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md cursor-pointer"
                                style={{ color: 'var(--color-text-muted)' }}
                                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                            >
                                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Must be at least 8 characters and include uppercase, lowercase, and a number.
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                            {errorMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                            {successMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Update Password
                    </button>
                </form>
            </div>
        </div>
    );
}
