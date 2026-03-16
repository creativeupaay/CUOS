import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Loader2, Mail, Phone, User } from 'lucide-react';
import { useGetPublicJobsQuery, usePublicApplyMutation } from '@/features/hiring/hiringApi';

const MAX_RESUME_SIZE_MB = 5;
const ALLOWED_RESUME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function isValidUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export default function PublicJobApplyPage() {
    const { jobId = '' } = useParams();
    const { data, isLoading: jobsLoading } = useGetPublicJobsQuery();
    const [publicApply, { isLoading }] = usePublicApplyMutation();

    const jobs = data?.data.jobs || [];
    const job = useMemo(() => jobs.find((j: any) => j._id === jobId), [jobs, jobId]);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [portfolio, setPortfolio] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [experience, setExperience] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [resume, setResume] = useState<File | null>(null);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const hasInvalidJob = !jobsLoading && !job;

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!name.trim() || name.trim().length < 2) {
            errors.name = 'Please enter your full name.';
        }

        if (!email.trim()) {
            errors.email = 'Email is required.';
        }

        const normalizedPhone = phone.replace(/\s+/g, '');
        if (!normalizedPhone) {
            errors.phone = 'Phone number is required.';
        } else if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
            errors.phone = 'Enter a valid phone number (10-15 digits).';
        }

        if (!isValidUrl(portfolio)) {
            errors.portfolio = 'Portfolio URL must start with http:// or https://';
        }

        if (!isValidUrl(linkedin)) {
            errors.linkedin = 'LinkedIn URL must start with http:// or https://';
        }

        if (!resume) {
            errors.resume = 'Resume is required.';
        } else {
            const sizeMb = resume.size / (1024 * 1024);
            if (sizeMb > MAX_RESUME_SIZE_MB) {
                errors.resume = `Resume must be under ${MAX_RESUME_SIZE_MB}MB.`;
            }
            if (!ALLOWED_RESUME_TYPES.includes(resume.type)) {
                errors.resume = 'Only PDF, DOC, and DOCX files are supported.';
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (hasInvalidJob) {
            setError('This job is unavailable or no longer accepting applications.');
            return;
        }

        if (!validateForm()) {
            setError('Please fix the highlighted fields and try again.');
            return;
        }

        try {
            await publicApply({
                jobId,
                data: {
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    portfolio: portfolio.trim(),
                    linkedin: linkedin.trim(),
                    experience: experience.trim(),
                    coverLetter: coverLetter.trim(),
                    resume: resume as File,
                },
            }).unwrap();
            setSuccess(true);
            setFieldErrors({});
        } catch (err: any) {
            setError(err?.data?.message || 'Failed to submit application');
        }
    };

    const isSubmitDisabled = isLoading || hasInvalidJob || success;

    return (
        <div className="min-h-screen px-4 py-10" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Apply for {job?.title || 'Open Position'}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Complete your application carefully. Our hiring team reviews every submission.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div
                        className="lg:col-span-2 p-6 rounded-xl border"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <form onSubmit={onSubmit} className="space-y-4">
                            {success && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                                    <CheckCircle2 size={16} />
                                    Application submitted successfully. Please check your email.
                                </div>
                            )}
                            {(error || hasInvalidJob) && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                                    <AlertCircle size={16} />
                                    {hasInvalidJob ? 'This job is unavailable or closed for applications.' : error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            placeholder="Your full name"
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
                                            style={{ borderColor: fieldErrors.name ? '#B91C1C' : 'var(--color-border-default)' }}
                                        />
                                    </div>
                                    {fieldErrors.name && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                        <input
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            type="email"
                                            required
                                            placeholder="you@example.com"
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
                                            style={{ borderColor: fieldErrors.email ? '#B91C1C' : 'var(--color-border-default)' }}
                                        />
                                    </div>
                                    {fieldErrors.email && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.email}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Phone
                                </label>
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                        placeholder="+91XXXXXXXXXX"
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
                                        style={{ borderColor: fieldErrors.phone ? '#B91C1C' : 'var(--color-border-default)' }}
                                    />
                                </div>
                                {fieldErrors.phone && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.phone}</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Portfolio URL (optional)
                                    </label>
                                    <input
                                        value={portfolio}
                                        onChange={(e) => setPortfolio(e.target.value)}
                                        placeholder="https://yourportfolio.com"
                                        className="w-full px-3 py-2 text-sm rounded-lg border"
                                        style={{ borderColor: fieldErrors.portfolio ? '#B91C1C' : 'var(--color-border-default)' }}
                                    />
                                    {fieldErrors.portfolio && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.portfolio}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        LinkedIn URL (optional)
                                    </label>
                                    <input
                                        value={linkedin}
                                        onChange={(e) => setLinkedin(e.target.value)}
                                        placeholder="https://linkedin.com/in/username"
                                        className="w-full px-3 py-2 text-sm rounded-lg border"
                                        style={{ borderColor: fieldErrors.linkedin ? '#B91C1C' : 'var(--color-border-default)' }}
                                    />
                                    {fieldErrors.linkedin && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.linkedin}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Experience (optional)
                                </label>
                                <textarea
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    rows={3}
                                    placeholder="Briefly describe your relevant experience"
                                    className="w-full px-3 py-2 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Cover Letter (optional)
                                </label>
                                <textarea
                                    value={coverLetter}
                                    onChange={(e) => setCoverLetter(e.target.value)}
                                    rows={4}
                                    placeholder="Tell us why you are a great fit for this role"
                                    className="w-full px-3 py-2 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Resume (PDF/DOC/DOCX, max 5MB)
                                </label>
                                <div className="relative">
                                    <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setResume(e.target.files?.[0] || null)}
                                        required
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
                                        style={{ borderColor: fieldErrors.resume ? '#B91C1C' : 'var(--color-border-default)' }}
                                    />
                                </div>
                                {fieldErrors.resume && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{fieldErrors.resume}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitDisabled}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg text-white font-medium"
                                style={{ backgroundColor: 'var(--color-primary)', opacity: isSubmitDisabled ? 0.6 : 1 }}
                            >
                                {isLoading && <Loader2 size={14} className="animate-spin" />}
                                {success ? 'Application Submitted' : 'Submit Application'}
                            </button>
                        </form>
                    </div>

                    <div
                        className="p-5 rounded-xl border h-fit"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <p className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Role Snapshot
                        </p>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {job?.title || 'Open Position'}
                        </h2>
                        <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {job?.department || 'Department not specified'}
                            {job?.location ? ` • ${job.location}` : ''}
                        </p>
                        <p className="text-sm mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                            {job?.description || 'Fill the form and our team will review your profile.'}
                        </p>

                        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Tips to improve selection chances:
                            </p>
                            <ul className="mt-2 text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                                <li>Use a role-specific resume with recent projects.</li>
                                <li>Add portfolio and LinkedIn links when available.</li>
                                <li>Highlight outcomes, not only responsibilities.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
