import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetPartnerOnboardingByTokenQuery, useSubmitPartnerOnboardingMutation } from '@/features/partners/partnersApi';
import { Loader2, Building2, User, Globe, MapPin, Lock, CheckCircle, AlertCircle, Upload, X } from 'lucide-react';

export default function PartnerOnboardingPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const { data, isLoading, error } = useGetPartnerOnboardingByTokenQuery(token || '', {
        skip: !token,
    });

    const [submitOnboarding, { isLoading: isSubmitting }] = useSubmitPartnerOnboardingMutation();

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        photo: '',
        companyName: '',
        companyLogo: '',
        contactPersonName: '',
        contactPersonPhone: '',
        websiteLink: '',
        address: {
            street: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
        },
        password: '',
        confirmPassword: '',
    });

    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState<{ loginUrl: string; companyName: string } | null>(null);
    const [currentStep, setCurrentStep] = useState(1);

    useEffect(() => {
        if (data?.data) {
            setFormData((prev) => ({
                ...prev,
                name: data.data.name || '',
            }));
        }
    }, [data]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name.startsWith('address.')) {
            const addressField = name.replace('address.', '');
            setFormData((prev) => ({
                ...prev,
                address: {
                    ...prev.address,
                    [addressField]: value,
                },
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'logo') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setFormError('Please select an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setFormError('Image size should be less than 2MB');
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            if (type === 'photo') {
                setFormData((prev) => ({ ...prev, photo: base64String }));
                setPhotoPreview(base64String);
            } else {
                setFormData((prev) => ({ ...prev, companyLogo: base64String }));
                setLogoPreview(base64String);
            }
        };
        reader.readAsDataURL(file);
    };

    const removeFile = (type: 'photo' | 'logo') => {
        if (type === 'photo') {
            setFormData((prev) => ({ ...prev, photo: '' }));
            setPhotoPreview(null);
        } else {
            setFormData((prev) => ({ ...prev, companyLogo: '' }));
            setLogoPreview(null);
        }
    };

    const validateStep = (step: number): boolean => {
        setFormError('');

        if (step === 1) {
            if (!formData.name.trim()) {
                setFormError('Name is required');
                return false;
            }
            if (!formData.phone.trim()) {
                setFormError('Phone number is required');
                return false;
            }
        } else if (step === 2) {
            if (!formData.companyName.trim()) {
                setFormError('Company name is required');
                return false;
            }
            if (!formData.contactPersonName.trim()) {
                setFormError('Contact person name is required');
                return false;
            }
            if (!formData.contactPersonPhone.trim()) {
                setFormError('Contact person phone is required');
                return false;
            }
        } else if (step === 3) {
            if (!formData.password || formData.password.length < 8) {
                setFormError('Password must be at least 8 characters');
                return false;
            }
            if (formData.password !== formData.confirmPassword) {
                setFormError('Passwords do not match');
                return false;
            }
        }

        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep(3)) return;

        try {
            const result = await submitOnboarding({
                token: token!,
                data: formData,
            }).unwrap();

            setSuccess({
                loginUrl: result.data.loginUrl,
                companyName: result.data.companyName,
            });
        } catch (err: any) {
            setFormError(err?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || !data?.data) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-red-100">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
                    <p className="text-gray-600">
                        This registration link is invalid or has expired. Please contact your administrator to get a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-green-100">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome aboard!</h1>
                    <p className="text-gray-600 mb-6">
                        Your account for <strong className="text-indigo-600">{success.companyName}</strong> has been set up successfully.
                    </p>
                    <button
                        onClick={() => navigate(success.loginUrl.replace(window.location.origin, ''))}
                        className="w-full py-3 px-4 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                    >
                        Go to Login Portal →
                    </button>
                </div>
            </div>
        );
    }

    const steps = [
        { number: 1, title: 'Personal Info', icon: <User size={18} /> },
        { number: 2, title: 'Company Details', icon: <Building2 size={18} /> },
        { number: 3, title: 'Security', icon: <Lock size={18} /> },
    ];

    return (
        <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                    >
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">Partner Registration</h1>
                    <p className="text-gray-600">
                        Welcome <strong className="text-indigo-600">{data.data.email}</strong>! Complete your profile to get started.
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 -z-10">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                            />
                        </div>

                        {steps.map((step) => (
                            <div key={step.number} className="flex flex-col items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                                        currentStep >= step.number
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg scale-110'
                                            : 'bg-white text-gray-400 border-2 border-gray-300'
                                    }`}
                                >
                                    {currentStep > step.number ? <CheckCircle size={18} /> : step.icon}
                                </div>
                                <p className={`text-xs font-medium mt-2 ${currentStep >= step.number ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {step.title}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    {formError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Step 1: Personal Information */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <User size={20} className="text-indigo-600" />
                                    Personal Information
                                </h3>

                                {/* Photo Upload */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Photo</label>
                                    {photoPreview ? (
                                        <div className="relative inline-block">
                                            <img
                                                src={photoPreview}
                                                alt="Preview"
                                                className="w-32 h-32 rounded-xl object-cover border-2 border-indigo-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFile('photo')}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 cursor-pointer transition-all bg-gray-50 hover:bg-indigo-50">
                                            <Upload size={24} className="text-gray-400 mb-1" />
                                            <span className="text-xs text-gray-500">Upload Photo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(e, 'photo')}
                                            />
                                        </label>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Max 2MB • JPG, PNG, GIF</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="+91 9876543210"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Company Details */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Building2 size={20} className="text-indigo-600" />
                                    Company Information
                                </h3>

                                {/* Logo Upload */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                                    {logoPreview ? (
                                        <div className="relative inline-block">
                                            <img
                                                src={logoPreview}
                                                alt="Logo Preview"
                                                className="w-32 h-32 rounded-xl object-contain border-2 border-indigo-200 bg-white p-2"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFile('logo')}
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 cursor-pointer transition-all bg-gray-50 hover:bg-indigo-50">
                                            <Upload size={24} className="text-gray-400 mb-1" />
                                            <span className="text-xs text-gray-500">Upload Logo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(e, 'logo')}
                                            />
                                        </label>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Max 2MB • JPG, PNG, SVG</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="Your Company Pvt Ltd"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person *</label>
                                        <input
                                            type="text"
                                            name="contactPersonName"
                                            value={formData.contactPersonName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="Contact person name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Phone *</label>
                                        <input
                                            type="tel"
                                            name="contactPersonPhone"
                                            value={formData.contactPersonPhone}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="+91 9876543210"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Website (optional)</label>
                                        <div className="relative">
                                            <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="url"
                                                name="websiteLink"
                                                value={formData.websiteLink}
                                                onChange={handleChange}
                                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                placeholder="https://yourcompany.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Address (Optional) */}
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <MapPin size={16} className="text-gray-500" />
                                        Address (Optional)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <input
                                                type="text"
                                                name="address.street"
                                                value={formData.address.street}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                                                placeholder="Street address"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            name="address.city"
                                            value={formData.address.city}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                                            placeholder="City"
                                        />
                                        <input
                                            type="text"
                                            name="address.state"
                                            value={formData.address.state}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                                            placeholder="State"
                                        />
                                        <input
                                            type="text"
                                            name="address.country"
                                            value={formData.address.country}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                                            placeholder="Country"
                                        />
                                        <input
                                            type="text"
                                            name="address.postalCode"
                                            value={formData.address.postalCode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm"
                                            placeholder="Postal code"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Password */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Lock size={20} className="text-indigo-600" />
                                    Set Your Password
                                </h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Create a secure password to access your partner portal. Use at least 8 characters.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="Min. 8 characters"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="Confirm password"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                onClick={() => setCurrentStep((prev) => prev - 1)}
                                className="px-6 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                            >
                                ← Back
                            </button>
                        )}
                        {currentStep < 3 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="ml-auto px-6 py-3 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="ml-auto px-8 py-3 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        Complete Registration
                                        <CheckCircle size={18} />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
