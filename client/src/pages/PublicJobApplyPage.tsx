import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileText, Loader2, Mail, Phone, User, Briefcase, MapPin, Building2, ChevronLeft, Github } from 'lucide-react';
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
        const normalizedValue = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
        const url = new URL(normalizedValue);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function normalizeOptionalUrl(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) return '';
    return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function getJobLocationLabel(job?: { locationType?: string; location?: string }) {
    if (job?.locationType === 'Remote') {
        return 'Remote';
    }

    if (job?.location?.trim()) {
        return job.location.trim();
    }

    return 'Location not specified';
}

function getEmploymentTypeLabel(employmentType?: string) {
    switch (employmentType) {
        case 'part-time':
            return 'Part-time';
        case 'contract':
            return 'Contract';
        case 'internship':
            return 'Internship';
        case 'full-time':
        default:
            return 'Full-time';
    }
}

export default function PublicJobApplyPage() {
    const { jobId = '' } = useParams();
    const { data, isLoading: jobsLoading } = useGetPublicJobsQuery();
    const [publicApply, { isLoading }] = usePublicApplyMutation();

    const jobs = data?.data.jobs || [];
    const job = useMemo(() => jobs.find((j: any) => j._id === jobId), [jobs, jobId]);
    const jobLocationLabel = useMemo(() => getJobLocationLabel(job), [job]);
    const employmentTypeLabel = useMemo(() => getEmploymentTypeLabel(job?.employmentType), [job?.employmentType]);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [portfolio, setPortfolio] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [github, setGithub] = useState('');
    const [experience, setExperience] = useState('');
    const [location, setLocation] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [resume, setResume] = useState<File | null>(null);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showForm, setShowForm] = useState(false);

    const hasInvalidJob = !jobsLoading && !job;

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!name.trim() || name.trim().length < 2) {
            errors.name = 'Please enter your full name.';
        }

        if (!location.trim()) {
            errors.location = 'Location is required.';
        }

        if (!yearsOfExperience.trim() || isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0) {
            errors.yearsOfExperience = 'Please enter a valid number of years.';
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
            errors.portfolio = 'Please enter a valid portfolio link.';
        }

        if (linkedin && !isValidUrl(linkedin)) {
            errors.linkedin = 'Please enter a valid LinkedIn link.';
        }

        if (github && !isValidUrl(github)) {
            errors.github = 'Please enter a valid GitHub link.';
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
                    portfolio: normalizeOptionalUrl(portfolio),
                    linkedin: normalizeOptionalUrl(linkedin),
                    github: normalizeOptionalUrl(github),
                    experience: experience.trim(),
                    location: location.trim(),
                    yearsOfExperience: Number(yearsOfExperience),
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

    if (jobsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    if (hasInvalidJob) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4" style={{ color: '#B91C1C' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Job Not Found</h2>
                    <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>This position may have been closed or doesn't exist.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            {/* Premium Background Effects */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--color-primary)]/10 blur-[100px] pointer-events-none" />
            
            <style>{`
                @keyframes fadeScaleUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-scale { animation: fadeScaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .glass-card {
                    background: var(--color-bg-surface);
                    border: 1px solid var(--color-border-subtle);
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05);
                }
                .input-premium {
                    background-color: var(--color-bg-app);
                    border: 1px solid var(--color-border-default);
                    transition: all 0.2s ease;
                }
                .input-premium:hover { border-color: var(--color-border-strong); }
                .input-premium:focus {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
                    background-color: var(--color-bg-surface);
                }
            `}</style>

            <div className="relative z-10 px-4 py-12 md:py-20">
            {!showForm ? (
                <div className="max-w-4xl mx-auto animate-fade-scale">
                    <div className="glass-card rounded-[2rem] p-8 md:p-12">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                            {job?.title}
                        </h1>

                        <div className="mt-8 flex flex-wrap items-center gap-3 mb-10 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <Building2 size={16} className="opacity-70" /> {job?.department || 'Department not specified'}
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <MapPin size={16} className="opacity-70" /> {jobLocationLabel}
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border capitalize" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <Briefcase size={16} className="opacity-70" /> {employmentTypeLabel}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>About the Role</h3>
                                <div className="whitespace-pre-line text-base md:text-lg leading-relaxed opacity-90" style={{ color: 'var(--color-text-secondary)' }}>
                                    {job?.description || 'No description provided.'}
                                </div>
                            </div>
                            
                            {job?.requirements && (
                                <div className="pt-6 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                    <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Requirements & Qualifications</h3>
                                    <div className="whitespace-pre-line text-base md:text-lg leading-relaxed opacity-90" style={{ color: 'var(--color-text-secondary)' }}>
                                        {job.requirements}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Ready to make an impact?</p>
                            <button
                                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowForm(true); }}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 text-lg rounded-full text-white font-bold transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95"
                                style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 10px 25px -5px rgba(var(--color-primary-rgb), 0.4)' }}
                            >
                                Apply Now
                            </button>
                        </div>
                    </div>
                </div>
            ) : (

                <div className="max-w-5xl mx-auto animate-fade-scale">
                    <div className="mb-8 relative z-20 flex flex-col items-start gap-4">
                        <button 
                            onClick={() => setShowForm(false)}
                            className="group flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:bg-black/5 dark:hover:bg-white/5"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Job Details
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                                Apply for {job?.title}
                            </h1>
                            <p className="text-base mt-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                Fill out the form below. We review every single application manually.
                            </p>
                        </div>
                    </div>
    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-8 glass-card rounded-[2rem] p-6 md:p-10 z-20">
                            {success ? (
                                <div className="flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-scale">
                                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                                        <CheckCircle2 size={40} className="text-green-600" />
                                    </div>
                                    <h2 className="text-3xl font-extrabold mb-4" style={{ color: 'var(--color-text-primary)' }}>Application Submitted!</h2>
                                    <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
                                        Thank you for applying to the <span className="font-semibold">{job?.title}</span> position at Creative Upaay. We have received your application and will review it shortly.
                                    </p>
                                    <div className="p-4 rounded-xl border w-full max-w-sm" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-subtle)' }}>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                            A confirmation email with further details has been sent to <br/><span className="font-bold">{email}</span>.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="mt-10 inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white transition-all hover:-translate-y-1 hover:shadow-lg"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                        Back to Job Details
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={onSubmit} className="space-y-6">
                                    {(error || hasInvalidJob) && (
                                        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border" style={{ backgroundColor: '#FEE2E2', borderColor: '#FECACA', color: '#B91C1C' }}>
                                            <div className="p-2 bg-red-100 rounded-full shrink-0">
                                                <AlertCircle size={20} />
                                            </div>
                                            <p className="font-semibold text-sm">{hasInvalidJob ? 'This job is unavailable or closed for applications.' : error}</p>
                                        </div>
                                    )}
    
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Full Name *</label>
                                        <div className="relative">
                                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.name ? { borderColor: '#B91C1C' } : {}) }} placeholder="John Doe" />
                                        </div>
                                        {fieldErrors.name && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Email Address *</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.email ? { borderColor: '#B91C1C' } : {}) }} placeholder="john@example.com" />
                                        </div>
                                        {fieldErrors.email ? (
                                            <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.email}</p>
                                        ) : (
                                            <p className="text-[11px] mt-1.5 ml-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>This email will be used as the main communication channel.</p>
                                        )}
                                    </div>
                                </div>
    
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Phone Number *</label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.phone ? { borderColor: '#B91C1C' } : {}) }} placeholder="+91 XXXXX XXXXX" />
                                        </div>
                                        {fieldErrors.phone && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.phone}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Current Location *</label>
                                        <div className="relative">
                                            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.location ? { borderColor: '#B91C1C' } : {}) }} placeholder="City, State" />
                                        </div>
                                        {fieldErrors.location && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.location}</p>}
                                    </div>
                                </div>
    
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Years of Experience *</label>
                                        <div className="relative">
                                            <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input type="number" min="0" step="0.5" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} required className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.yearsOfExperience ? { borderColor: '#B91C1C' } : {}) }} placeholder="e.g. 2.5" />
                                        </div>
                                        {fieldErrors.yearsOfExperience && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.yearsOfExperience}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Portfolio URL</label>
                                        <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className="w-full px-5 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.portfolio ? { borderColor: '#B91C1C' } : {}) }} placeholder="https://" />
                                        {fieldErrors.portfolio && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.portfolio}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>LinkedIn URL</label>
                                        <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="w-full px-5 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.linkedin ? { borderColor: '#B91C1C' } : {}) }} placeholder="https://linkedin.com/in/..." />
                                        {fieldErrors.linkedin && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.linkedin}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>GitHub URL</label>
                                        <div className="relative">
                                            <Github size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                            <input value={github} onChange={(e) => setGithub(e.target.value)} className="w-full pl-12 pr-4 py-3.5 text-sm rounded-xl outline-none input-premium" style={{ ...(fieldErrors.github ? { borderColor: '#B91C1C' } : {}) }} placeholder="https://github.com/..." />
                                        </div>
                                        {fieldErrors.github && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.github}</p>}
                                    </div>
                                </div>
    
                                <div>
                                    <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Relevant Experience</label>
                                    <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={3} className="w-full px-5 py-4 text-sm rounded-xl outline-none resize-none input-premium" placeholder="Briefly highlight your most relevant work..." />
                                </div>
    
                                <div>
                                    <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Cover Letter</label>
                                    <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={4} className="w-full px-5 py-4 text-sm rounded-xl outline-none resize-none input-premium" placeholder="What makes you a great fit for us?" />
                                </div>
    
                                <div>
                                    <label className="block text-sm font-semibold mb-2 ml-1" style={{ color: 'var(--color-text-secondary)' }}>Resume File *</label>
                                    <div className="relative">
                                        <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files?.[0] || null)} required className="w-full pl-12 pr-4 py-3 text-sm rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer input-premium" style={{ ...(fieldErrors.resume ? { borderColor: '#B91C1C' } : {}) }} />
                                    </div>
                                    {fieldErrors.resume && <p className="text-xs mt-1.5 ml-1 font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.resume}</p>}
                                    <p className="text-xs mt-2 ml-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>Supported formats: PDF, DOC, DOCX. Max size: 5MB.</p>
                                </div>
    
                                <div className="pt-4">
                                    <button type="submit" disabled={isSubmitDisabled} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 text-base rounded-full text-white font-bold transition-all hover:-translate-y-0.5" style={{ backgroundColor: 'var(--color-primary)', opacity: isSubmitDisabled ? 0.6 : 1, boxShadow: isSubmitDisabled ? 'none' : '0 8px 20px -6px rgba(var(--color-primary-rgb), 0.5)' }}>
                                        {isLoading && <Loader2 size={18} className="animate-spin" />}
                                        Submit Application
                                    </button>
                                </div>
                            </form>
                            )}
                        </div>
    
                        <div className="lg:col-span-4 sticky top-6 z-20 space-y-6">
                            <div className="glass-card rounded-[2rem] p-8">
                                <div className="w-12 h-12 rounded-2xl mb-5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                    <Briefcase size={24} />
                                </div>
                                <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Applying For</p>
                                <h2 className="text-xl font-extrabold leading-tight mb-4" style={{ color: 'var(--color-text-primary)' }}>{job?.title}</h2>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><Building2 size={16} className="opacity-70" /> {job?.department || 'Department not specified'}</div>
                                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><MapPin size={16} className="opacity-70" /> {jobLocationLabel}</div>
                                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><Briefcase size={16} className="opacity-70" /> {employmentTypeLabel}</div>
                                </div>
                            </div>
                            
                            <div className="glass-card rounded-[2rem] p-8">
                                <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center border" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <CheckCircle2 size={20} style={{ color: 'var(--color-text-primary)' }} />
                                </div>
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Success Tips</h3>
                                <ul className="text-sm space-y-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                    <li className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}></div><span className="leading-relaxed">Provide a highly tailored resume that matches the role.</span></li>
                                    <li className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}></div><span className="leading-relaxed">Attach your best portfolio pieces or links.</span></li>
                                    <li className="flex items-start gap-3"><div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}></div><span className="leading-relaxed">Focus on tangible outcomes and impact driven by you.</span></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
