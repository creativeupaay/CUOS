import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, User } from 'lucide-react';
import {
    useGetPartnerOnboardingByTokenQuery,
    useSubmitPartnerOnboardingMutation,
} from '@/features/partners/partnersApi';

export default function PartnerRegistrationPage() {
    const { token } = useParams<{ token: string }>();

    const { data, isLoading, isError, error } = useGetPartnerOnboardingByTokenQuery(token || '', {
        skip: !token,
    });

    const [submitPartnerOnboarding, { isLoading: isSubmitting }] = useSubmitPartnerOnboardingMutation();

    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [form, setForm] = useState({
        name: '', // Added to match payload
        phone: '',
        photo: '', // Added to match payload
        companyName: '',
        companyLogo: '', // Added to match payload
        contactPersonName: '', // Renamed from contactPerson
        contactPersonPhone: '', // Added to match payload
        websiteLink: '', // Added to match payload
        address: {
            street: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
        },
        password: '', // Added to match payload
        confirmPassword: '', // Added to match payload
    });

    const registration = data?.data;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setSubmitError('');

        try {
            await submitPartnerOnboarding({ token, data: { ...form, name: registration?.name || '' } }).unwrap();
            setSubmitted(true);
        } catch (err: any) {
            setSubmitError(err?.data?.message || 'Failed to submit registration form');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin" size={28} style={{ color: '#06B6D4' }} />
            </div>
        );
    }

    if (isError || !registration) {
        const message = (error as any)?.data?.message || 'Invalid or expired registration link';
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md text-center">
                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} style={{ color: '#DC2626' }} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Registration Link Invalid</h1>
                    <p className="text-sm text-gray-600">{message}</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="max-w-lg text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 size={34} style={{ color: '#16A34A' }} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">Registration Complete</h1>
                    <p className="text-gray-600 mb-6">
                        Thanks {registration.name}. Your partner profile has been submitted successfully.
                        You can now login to CUOS.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-semibold"
                        style={{ backgroundColor: '#0891B2' }}
                    >
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center mx-auto mb-4">
                        <User size={24} style={{ color: '#0E7490' }} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Partner Registration</h1>
                    <p className="text-sm text-gray-600 mt-1">Complete your details to activate your partner account.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input value={registration.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input value={registration.email} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Company Name</label>
                            <input
                                value={form.companyName}
                                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Contact Person</label>
                            <input
                                value={form.contactPersonName}
                                onChange={(e) => setForm((prev) => ({ ...prev, contactPersonName: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Phone</label>
                            <input
                                value={form.phone}
                                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Address</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                placeholder="Street"
                                value={form.address.street}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                                placeholder="City"
                                value={form.address.city}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                                placeholder="State"
                                value={form.address.state}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, state: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                                placeholder="Country"
                                value={form.address.country}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, country: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <input
                                placeholder="Postal Code"
                                value={form.address.postalCode}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>

                    {submitError && (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {submitError}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full md:w-auto px-6 py-3 rounded-lg text-white font-semibold disabled:opacity-60"
                        style={{ backgroundColor: '#0891B2' }}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                    </button>
                </form>
            </div>
        </div>
    );
}
