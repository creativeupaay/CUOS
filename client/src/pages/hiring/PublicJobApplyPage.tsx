import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
    AlertCircle,
    Briefcase,
    Building2,
    CheckCircle2,
    ChevronLeft,
    FileText,
    Github,
    Loader2,
    Mail,
    MapPin,
    Paperclip,
    Phone,
    User,
} from 'lucide-react';
import {
    useGetPublicJobsQuery,
    usePublicApplyMutation,
    type Job,
    type ApplicationCustomFieldDefinition,
    type ApplicationStandardFieldSetting,
    type StandardApplicationFieldId,
} from '@/features/hiring';

const MAX_RESUME_SIZE_MB = 5;
const MAX_APPLICATION_ATTACHMENT_SIZE_MB = 25;
const DEFAULT_ABOUT_COMPANY_TEXT =
    'Creative Upaay is a tech and design partner that works closely with Startups and Enterprises to build AI based digital products and systems. Our work goes beyond just design or development, we focus on creating practical, scalable solutions that teams actually use. We work across 10+ Industries, for their Custom web solution development, automation workflows, and AI based tools. A lot of our projects involve understanding messy real-world processes and turning them into structured digital experiences.\n\nSo far, we have worked with 85+ brands globally and delivered 350+ projects.\n\nWe look for people who take ownership, think in systems, and care about solving real problems, not just completing tasks. Our Team culture is simple: low ego, high responsibility, honest communication, and a strong focus on doing quality work that actually makes an impact.';
const ALLOWED_RESUME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const STANDARD_FIELD_META: Record<
    StandardApplicationFieldId,
    { label: string; placeholder: string; type: 'text' | 'url' | 'textarea'; icon?: ReactNode }
> = {
    portfolio: {
        label: 'Portfolio URL',
        placeholder: 'https://your-portfolio.com',
        type: 'url',
    },
    github: {
        label: 'GitHub URL',
        placeholder: 'https://github.com/username',
        type: 'url',
        icon: <Github size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />,
    },
    linkedin: {
        label: 'LinkedIn URL',
        placeholder: 'https://linkedin.com/in/...',
        type: 'url',
    },
    experience: {
        label: 'Relevant Experience',
        placeholder: 'Briefly highlight your most relevant work...',
        type: 'textarea',
    },
    coverLetter: {
        label: 'Cover Letter',
        placeholder: 'What makes you a great fit for this role?',
        type: 'textarea',
    },
    figmaUrl: {
        label: 'Figma URL',
        placeholder: 'https://figma.com/file/...',
        type: 'url',
    },
};

const JOB_CONTENT_MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: ReactNode }) => <p className="mb-3 last:mb-0">{children}</p>,
    strong: ({ children }: { children?: ReactNode }) => <strong className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
    li: ({ children }: { children?: ReactNode }) => <li className="mb-1">{children}</li>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--color-primary)' }}
        >
            {children}
        </a>
    ),
};

function isValidUrl(value: string): boolean {
    if (!value.trim()) return true;
    try {
        const normalizedValue = /^https?:\/\//i.test(value.trim())
            ? value.trim()
            : `https://${value.trim()}`;
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

function renderStandardInput(
    fieldId: StandardApplicationFieldId,
    value: string,
    setValue: (value: string) => void,
    overrideMeta?: Partial<{ label: string; placeholder: string; helpText: string }>,
    required?: boolean,
    error?: string
) {
    const meta = {
        ...STANDARD_FIELD_META[fieldId],
        label: overrideMeta?.label || STANDARD_FIELD_META[fieldId].label,
        placeholder: overrideMeta?.placeholder || STANDARD_FIELD_META[fieldId].placeholder,
    };
    if (!meta) return null;

    if (meta.type === 'textarea') {
        return (
            <div key={fieldId}>
                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {meta.label}
                    {required ? ' *' : ''}
                </label>
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={fieldId === 'coverLetter' ? 4 : 3}
                    className="input-premium w-full resize-none rounded-xl px-5 py-4 text-sm outline-none"
                    placeholder={meta.placeholder}
                    style={error ? { borderColor: '#B91C1C' } : undefined}
                />
                {overrideMeta?.helpText && !error && (
                    <p className="ml-1 mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{overrideMeta.helpText}</p>
                )}
                {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
            </div>
        );
    }

    if (fieldId === 'github') {
        return (
            <div key={fieldId}>
                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {meta.label}
                    {required ? ' *' : ''}
                </label>
                <div className="relative">
                    {meta.icon}
                    <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none"
                        placeholder={meta.placeholder}
                        style={error ? { borderColor: '#B91C1C' } : undefined}
                    />
                </div>
                {overrideMeta?.helpText && !error && (
                    <p className="ml-1 mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{overrideMeta.helpText}</p>
                )}
                {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
            </div>
        );
    }

    return (
        <div key={fieldId}>
            <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {meta.label}
                {required ? ' *' : ''}
            </label>
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="input-premium w-full rounded-xl px-5 py-3.5 text-sm outline-none"
                placeholder={meta.placeholder}
                style={error ? { borderColor: '#B91C1C' } : undefined}
            />
            {overrideMeta?.helpText && !error && (
                <p className="ml-1 mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{overrideMeta.helpText}</p>
            )}
            {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
        </div>
    );
}

function renderCustomField(
    field: ApplicationCustomFieldDefinition,
    value: string,
    file: File | null,
    setValue: (value: string) => void,
    setFile: (file: File | null) => void,
    required?: boolean,
    error?: string
) {
    const sharedLabel = (
        <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {field.label}
            {required ? ' *' : ''}
        </label>
    );

    if (field.type === 'attachment') {
        return (
            <div key={field.key}>
                {sharedLabel}
                <label
                    className="group block cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5"
                    style={{
                        backgroundColor: 'var(--color-bg-app)',
                        borderColor: error ? '#B91C1C' : 'var(--color-border-default)',
                        boxShadow: error ? '0 0 0 1px rgba(185, 28, 28, 0.08)' : 'none',
                    }}
                >
                    <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="sr-only"
                    />
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors"
                            style={{
                                backgroundColor: file
                                    ? 'rgba(34, 197, 94, 0.12)'
                                    : 'rgba(var(--color-primary-rgb), 0.12)',
                                color: file ? '#15803D' : 'var(--color-primary)',
                            }}
                        >
                            <Paperclip size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {file ? file.name : `Upload ${field.label}`}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {file
                                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB selected`
                                    : `Choose a document, image, or supporting file up to ${MAX_APPLICATION_ATTACHMENT_SIZE_MB}MB.`}
                            </p>
                        </div>
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border-default)',
                            }}
                        >
                            {file ? 'Change' : 'Browse'}
                        </span>
                    </div>
                </label>
                {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
            </div>
        );
    }

    if (field.type === 'note') {
        return (
            <div key={field.key}>
                {sharedLabel}
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={4}
                    className="input-premium w-full resize-none rounded-xl px-5 py-4 text-sm outline-none"
                    placeholder={field.placeholder || field.label}
                    style={error ? { borderColor: '#B91C1C' } : undefined}
                />
                {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
            </div>
        );
    }

    const inputType =
        field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';

    return (
        <div key={field.key}>
            {sharedLabel}
            <input
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="input-premium w-full rounded-xl px-5 py-3.5 text-sm outline-none"
                placeholder={field.placeholder || field.label}
                style={error ? { borderColor: '#B91C1C' } : undefined}
            />
            {error && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{error}</p>}
        </div>
    );
}

export default function PublicJobApplyPage() {
    const { jobId = '' } = useParams();
    const { data, isLoading: jobsLoading } = useGetPublicJobsQuery();
    const [publicApply, { isLoading }] = usePublicApplyMutation();

    const jobs = useMemo(() => data?.data.jobs || [], [data?.data.jobs]);
    const job = useMemo(() => jobs.find((jobItem: Job) => jobItem._id === jobId), [jobs, jobId]);
    const jobLocationLabel = useMemo(() => getJobLocationLabel(job), [job]);
    const employmentTypeLabel = useMemo(
        () => getEmploymentTypeLabel(job?.employmentType),
        [job?.employmentType]
    );

    const selectedStandardFields = useMemo(() => (job?.applicationForm?.selectedStandardFields || []) as StandardApplicationFieldId[], [job?.applicationForm?.selectedStandardFields]);
    const standardFieldSettings = useMemo(() => (job?.applicationForm?.standardFieldSettings || []) as ApplicationStandardFieldSetting[], [job?.applicationForm?.standardFieldSettings]);
    const customFields = useMemo(() => (job?.applicationForm?.customFields || []) as ApplicationCustomFieldDefinition[], [job?.applicationForm?.customFields]);
    const requiredStandardFields = useMemo(
        () =>
            new Set(
                standardFieldSettings
                    .filter((field) => field.required && selectedStandardFields.includes(field.key))
                    .map((field) => field.key)
            ),
        [standardFieldSettings, selectedStandardFields]
    );
    const requiredCustomFields = useMemo(
        () => new Set(customFields.filter((field) => field.required).map((field) => field.key)),
        [customFields]
    );

    // Split standard fields into regular fields and bottom fields (experience, coverLetter)
    const bottomFieldIds = ['experience', 'coverLetter'] as const;
    const regularStandardFields = selectedStandardFields.filter(
        (fieldId) => !bottomFieldIds.includes(fieldId as typeof bottomFieldIds[number])
    );
    const bottomStandardFields = selectedStandardFields.filter(
        (fieldId) => bottomFieldIds.includes(fieldId as typeof bottomFieldIds[number])
    );

    const standardFieldMetaById = useMemo(
        () =>
            standardFieldSettings.reduce<Record<string, ApplicationStandardFieldSetting>>(
                (acc, field) => {
                    acc[field.key] = field;
                    return acc;
                },
                {}
            ),
        [standardFieldSettings]
    );

    const pageSections = job?.applicationForm?.pageSections || {
        showAboutCompany: true,
        showAboutRole: true,
        showRequirements: true,
        showWhatYouGet: true,
        aboutCompany: DEFAULT_ABOUT_COMPANY_TEXT,
        whatYouGet: '',
    };

    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState('');
    const [resume, setResume] = useState<File | null>(null);

    const [standardValues, setStandardValues] = useState<Record<StandardApplicationFieldId, string>>({
        portfolio: '',
        github: '',
        linkedin: '',
        experience: '',
        coverLetter: '',
        figmaUrl: '',
    });
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
    const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File | null>>({});

    const hasInvalidJob = !jobsLoading && !job;

    const validateForm = () => {
        const nextErrors: Record<string, string> = {};

        if (!name.trim() || name.trim().length < 2) {
            nextErrors.name = 'Please enter your full name.';
        }
        if (!email.trim()) {
            nextErrors.email = 'Email is required.';
        }

        const normalizedPhone = phone.replace(/\s+/g, '');
        if (!normalizedPhone) {
            nextErrors.phone = 'Phone number is required.';
        } else if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
            nextErrors.phone = 'Enter a valid phone number (10-15 digits).';
        }

        if (!location.trim()) {
            nextErrors.location = 'Location is required.';
        }

        if (!yearsOfExperience.trim() || Number.isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0) {
            nextErrors.yearsOfExperience = 'Please enter a valid number of years.';
        }

        const urlFields: StandardApplicationFieldId[] = ['portfolio', 'github', 'linkedin', 'figmaUrl'];
        urlFields.forEach((fieldId) => {
            if (selectedStandardFields.includes(fieldId) && !isValidUrl(standardValues[fieldId] || '')) {
                nextErrors[fieldId] = `Please enter a valid ${STANDARD_FIELD_META[fieldId].label}.`;
            }
        });

        const requiredStandardFieldMessages: Record<StandardApplicationFieldId, string> = {
            portfolio: 'Portfolio URL is required for this job.',
            github: 'GitHub URL is required for this job.',
            linkedin: 'LinkedIn URL is required for this job.',
            experience: 'Relevant Experience is required for this job.',
            coverLetter: 'Cover Letter is required for this job.',
            figmaUrl: 'Figma URL is required for this job.',
        };
        (Object.keys(requiredStandardFieldMessages) as StandardApplicationFieldId[]).forEach((fieldId) => {
            if (!requiredStandardFields.has(fieldId)) return;
            if (!String(standardValues[fieldId] || '').trim()) {
                nextErrors[fieldId] = requiredStandardFieldMessages[fieldId];
            }
        });

        customFields.forEach((field) => {
            const value = customFieldValues[field.key] || '';
            const file = customFieldFiles[field.key];

            if (requiredCustomFields.has(field.key)) {
                if (field.type === 'attachment' && !file) {
                    nextErrors[`custom.${field.key}`] = `${field.label} is required.`;
                    return;
                }
                if (field.type !== 'attachment' && !String(value).trim()) {
                    nextErrors[`custom.${field.key}`] = `${field.label} is required.`;
                    return;
                }
            }

            if (field.type === 'url' && value && !isValidUrl(value)) {
                nextErrors[`custom.${field.key}`] = `Please enter a valid ${field.label}.`;
            }
            if (field.type === 'number' && value && Number.isNaN(Number(value))) {
                nextErrors[`custom.${field.key}`] = `${field.label} must be a valid number.`;
            }
            if (
                field.type === 'attachment' &&
                file &&
                file.size > MAX_APPLICATION_ATTACHMENT_SIZE_MB * 1024 * 1024
            ) {
                nextErrors[`custom.${field.key}`] = `${field.label} must be under ${MAX_APPLICATION_ATTACHMENT_SIZE_MB}MB.`;
            }
        });

        if (!resume) {
            nextErrors.resume = 'Resume is required.';
        } else {
            const sizeMb = resume.size / (1024 * 1024);
            if (sizeMb > MAX_RESUME_SIZE_MB) {
                nextErrors.resume = `Resume must be under ${MAX_RESUME_SIZE_MB}MB.`;
            }
            if (!ALLOWED_RESUME_TYPES.includes(resume.type)) {
                nextErrors.resume = 'Only PDF, DOC, and DOCX files are supported.';
            }
        }

        setFieldErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const onSubmit = async (e: FormEvent) => {
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

        const normalizedCustomFieldValues = customFields.reduce<Record<string, string>>((acc, field) => {
            const rawValue = (customFieldValues[field.key] || '').trim();
            if (!rawValue) return acc;
            acc[field.key] = field.type === 'url' ? normalizeOptionalUrl(rawValue) : rawValue;
            return acc;
        }, {});

        const normalizedCustomFiles = Object.entries(customFieldFiles).reduce<Record<string, File>>(
            (acc, [key, file]) => {
                if (file) acc[key] = file;
                return acc;
            },
            {}
        );

        try {
            await publicApply({
                jobId,
                data: {
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    location: location.trim(),
                    yearsOfExperience: Number(yearsOfExperience),
                    portfolio: normalizeOptionalUrl(standardValues.portfolio),
                    linkedin: normalizeOptionalUrl(standardValues.linkedin),
                    github: normalizeOptionalUrl(standardValues.github),
                    experience: standardValues.experience.trim(),
                    coverLetter: standardValues.coverLetter.trim(),
                    figmaUrl: normalizeOptionalUrl(standardValues.figmaUrl),
                    customFieldValues: normalizedCustomFieldValues,
                    customFieldFiles: normalizedCustomFiles,
                    resume: resume as File,
                },
            }).unwrap();

            setSuccess(true);
            setFieldErrors({});
        } catch (err) {
            setError((err as { data?: { message?: string } })?.data?.message || 'Failed to submit application');
        }
    };

    const isSubmitDisabled = isLoading || hasInvalidJob || success;

    if (jobsLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    if (hasInvalidJob) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4" style={{ color: '#B91C1C' }} />
                    <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Job Not Found</h2>
                    <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>This position may have been closed or does not exist.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent" />
            <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[var(--color-primary)]/10 blur-[100px]" />

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
                .form-panel {
                    background:
                        linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.06) 0%, rgba(255,255,255,0) 24%),
                        var(--color-bg-surface);
                    border: 1px solid var(--color-border-subtle);
                    box-shadow: 0 18px 45px -18px rgba(15, 23, 42, 0.18);
                }
                .section-divider {
                    border-top: 1px dashed var(--color-border-default);
                    padding-top: 1.5rem;
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
                    <div className="mx-auto max-w-4xl animate-fade-scale">
                        <div className="glass-card rounded-[2rem] p-8 md:p-12">
                            <div className="mb-5">
                                <img
                                    src="/company-logo.png"
                                    alt="Company Logo"
                                    className="h-12 w-auto object-contain"
                                />
                            </div>
                            <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl" style={{ color: 'var(--color-text-primary)' }}>
                                {job?.title}
                            </h1>

                            <div className="mb-10 mt-8 flex flex-wrap items-center gap-3 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                <div className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <Building2 size={16} className="opacity-70" /> {job?.department || 'Department not specified'}
                                </div>
                                <div className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <MapPin size={16} className="opacity-70" /> {jobLocationLabel}
                                </div>
                                <div className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 capitalize" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <Briefcase size={16} className="opacity-70" /> {employmentTypeLabel}
                                </div>
                            </div>

                            <div className="space-y-8">
                                {pageSections.showAboutCompany && (
                                    <div>
                                        <h3 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                            About the Company
                                        </h3>
                                        <div className="text-base leading-relaxed md:text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                                            <ReactMarkdown components={JOB_CONTENT_MARKDOWN_COMPONENTS}>
                                                {pageSections.aboutCompany || DEFAULT_ABOUT_COMPANY_TEXT}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {pageSections.showAboutRole && (
                                    <div className="border-t pt-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <h3 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                            About the Role
                                        </h3>
                                        <div className="text-base leading-relaxed md:text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                                            <ReactMarkdown components={JOB_CONTENT_MARKDOWN_COMPONENTS}>
                                                {job?.description || 'No description provided.'}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {pageSections.showRequirements && job?.requirements && (
                                    <div className="border-t pt-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <h3 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Requirements & Qualifications</h3>
                                        <div className="text-base leading-relaxed md:text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                                            <ReactMarkdown components={JOB_CONTENT_MARKDOWN_COMPONENTS}>
                                                {job.requirements}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {pageSections.showWhatYouGet && pageSections.whatYouGet?.trim() && (
                                    <div className="border-t pt-6" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <h3 className="mb-4 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                            What you get
                                        </h3>
                                        <div className="text-base leading-relaxed md:text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                                            <ReactMarkdown components={JOB_CONTENT_MARKDOWN_COMPONENTS}>
                                                {pageSections.whatYouGet}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t pt-8 sm:flex-row" style={{ borderColor: 'var(--color-border-subtle)' }}>
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                    Ready to apply?
                                </p>
                                <button
                                    onClick={() => {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                        setShowForm(true);
                                    }}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-10 py-4 text-lg font-bold text-white transition-all hover:-translate-y-1 hover:shadow-xl sm:w-auto"
                                    style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 10px 25px -5px rgba(var(--color-primary-rgb), 0.4)' }}
                                >
                                    Apply Now
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto max-w-5xl animate-fade-scale">
                        <div className="relative z-20 mb-8 flex flex-col items-start gap-4">
                            <button
                                onClick={() => setShowForm(false)}
                                className="group flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:bg-black/5"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                                Back to Job Details
                            </button>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: 'var(--color-text-primary)' }}>
                                    Apply for {job?.title}
                                </h1>
                                <p className="mt-2 text-base font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                    Fill out the form below. We review every application manually.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                            <div className="form-panel z-20 rounded-[2rem] p-6 md:p-10 lg:col-span-8">
                                {success ? (
                                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-scale">
                                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                                            <CheckCircle2 size={40} className="text-green-600" />
                                        </div>
                                        <h2 className="mb-4 text-3xl font-extrabold" style={{ color: 'var(--color-text-primary)' }}>Application Submitted!</h2>
                                        <p className="mb-8 max-w-md text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                                            Thank you for applying to the <span className="font-semibold">{job?.title}</span> position. We have received your application and will review it shortly.
                                        </p>
                                        <div className="w-full max-w-sm rounded-xl border p-4" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-subtle)' }}>
                                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                                A confirmation email has been sent to <br />
                                                <span className="font-bold">{email}</span>.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={onSubmit} className="space-y-6">
                                        {error && (
                                            <div className="flex items-center gap-3 rounded-2xl border px-5 py-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FECACA', color: '#B91C1C' }}>
                                                <div className="shrink-0 rounded-full bg-red-100 p-2">
                                                    <AlertCircle size={20} />
                                                </div>
                                                <p className="text-sm font-semibold">{error}</p>
                                            </div>
                                        )}

                                        <div
                                            className="rounded-2xl border px-5 py-4"
                                            style={{
                                                backgroundColor: 'rgba(var(--color-primary-rgb), 0.06)',
                                                borderColor: 'rgba(var(--color-primary-rgb), 0.18)',
                                            }}
                                        >
                                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                Candidate Details
                                            </p>
                                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                Start with the essentials so we can reach you quickly and review your profile smoothly.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                            <div>
                                                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Full Name *</label>
                                                <div className="relative">
                                                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                                    <input value={name} onChange={(e) => setName(e.target.value)} required className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none" style={fieldErrors.name ? { borderColor: '#B91C1C' } : undefined} placeholder="John Doe" />
                                                </div>
                                                {fieldErrors.name && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.name}</p>}
                                            </div>

                                            <div>
                                                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Email Address *</label>
                                                <div className="relative">
                                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none" style={fieldErrors.email ? { borderColor: '#B91C1C' } : undefined} placeholder="john@example.com" />
                                                </div>
                                                {fieldErrors.email && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.email}</p>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                            <div>
                                                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Phone Number *</label>
                                                <div className="relative">
                                                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                                    <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none" style={fieldErrors.phone ? { borderColor: '#B91C1C' } : undefined} placeholder="+91 XXXXX XXXXX" />
                                                </div>
                                                {fieldErrors.phone && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.phone}</p>}
                                            </div>

                                            <div>
                                                <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Current Location *</label>
                                                <div className="relative">
                                                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                                    <input value={location} onChange={(e) => setLocation(e.target.value)} required className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none" style={fieldErrors.location ? { borderColor: '#B91C1C' } : undefined} placeholder="City, State" />
                                                </div>
                                                {fieldErrors.location && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.location}</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Years of Experience *</label>
                                            <div className="relative">
                                                <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                                <input type="number" min="0" step="0.5" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} required className="input-premium w-full rounded-xl py-3.5 pl-12 pr-4 text-sm outline-none" style={fieldErrors.yearsOfExperience ? { borderColor: '#B91C1C' } : undefined} placeholder="e.g. 2.5" />
                                            </div>
                                            {fieldErrors.yearsOfExperience && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.yearsOfExperience}</p>}
                                        </div>

                                        {(regularStandardFields.length > 0 || customFields.length > 0) && (
                                            <div className="section-divider space-y-6">
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        Additional Information
                                                    </p>
                                                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        Share the links and role-specific details that make your application stronger.
                                                    </p>
                                                </div>

                                        {regularStandardFields.map((fieldId) => {
                                            return renderStandardInput(
                                                fieldId,
                                                standardValues[fieldId],
                                                (value) =>
                                                    setStandardValues((prev) => ({ ...prev, [fieldId]: value })),
                                                standardFieldMetaById[fieldId],
                                                requiredStandardFields.has(fieldId),
                                                fieldErrors[fieldId]
                                            );
                                        })}

                                                {customFields.map((field) =>
                                                    renderCustomField(
                                                        field,
                                                        customFieldValues[field.key] || '',
                                                        customFieldFiles[field.key] || null,
                                                        (value) =>
                                                            setCustomFieldValues((prev) => ({
                                                                ...prev,
                                                                [field.key]: value,
                                                            })),
                                                        (file) =>
                                                            setCustomFieldFiles((prev) => ({
                                                                ...prev,
                                                                [field.key]: file,
                                                            })),
                                                        requiredCustomFields.has(field.key),
                                                        fieldErrors[`custom.${field.key}`]
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {bottomStandardFields.length > 0 && (
                                            <div className="section-divider space-y-6">
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        Experience & Cover Letter
                                                    </p>
                                                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        Tell us about your relevant experience and why you're interested in this role.
                                                    </p>
                                                </div>

                                                {bottomStandardFields.map((fieldId) => {
                                                    return renderStandardInput(
                                                        fieldId,
                                                        standardValues[fieldId],
                                                        (value) =>
                                                            setStandardValues((prev) => ({ ...prev, [fieldId]: value })),
                                                        standardFieldMetaById[fieldId],
                                                        requiredStandardFields.has(fieldId),
                                                        fieldErrors[fieldId]
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="section-divider">
                                            <div className="mb-3">
                                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                    Resume Upload
                                                </p>
                                                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    Upload a clear and updated resume in PDF or Word format.
                                                </p>
                                            </div>
                                            <label className="mb-2 ml-1 block text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Resume File *</label>
                                            <label
                                                className="group block cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5"
                                                style={{
                                                    backgroundColor: 'var(--color-bg-app)',
                                                    borderColor: fieldErrors.resume ? '#B91C1C' : 'var(--color-border-default)',
                                                }}
                                            >
                                                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files?.[0] || null)} required className="sr-only" />
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                                                        style={{
                                                            backgroundColor: resume
                                                                ? 'rgba(34, 197, 94, 0.12)'
                                                                : 'rgba(var(--color-primary-rgb), 0.12)',
                                                            color: resume ? '#15803D' : 'var(--color-primary)',
                                                        }}
                                                    >
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                            {resume ? resume.name : 'Choose Resume File'}
                                                        </p>
                                                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                            {resume
                                                                ? `${(resume.size / (1024 * 1024)).toFixed(2)} MB selected`
                                                                : 'PDF, DOC, or DOCX only. Maximum 5MB.'}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className="rounded-full px-3 py-1 text-xs font-semibold"
                                                        style={{
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                            color: 'var(--color-text-secondary)',
                                                            border: '1px solid var(--color-border-default)',
                                                        }}
                                                    >
                                                        {resume ? 'Change' : 'Browse'}
                                                    </span>
                                                </div>
                                            </label>
                                            {fieldErrors.resume && <p className="ml-1 mt-1.5 text-xs font-semibold" style={{ color: '#B91C1C' }}>{fieldErrors.resume}</p>}
                                            <p className="ml-1 mt-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                                Supported formats: PDF, DOC, DOCX. Max size: 5MB.
                                            </p>
                                        </div>

                                        <div className="pt-4">
                                            <button type="submit" disabled={isSubmitDisabled} className="inline-flex w-full items-center justify-center gap-2 rounded-full px-10 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 sm:w-auto" style={{ backgroundColor: 'var(--color-primary)', opacity: isSubmitDisabled ? 0.6 : 1, boxShadow: isSubmitDisabled ? 'none' : '0 8px 20px -6px rgba(var(--color-primary-rgb), 0.5)' }}>
                                                {isLoading && <Loader2 size={18} className="animate-spin" />}
                                                Submit Application
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            <div className="z-20 space-y-6 lg:col-span-4 lg:sticky lg:top-6">
                                <div className="glass-card rounded-[2rem] p-8">
                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                        <Briefcase size={24} />
                                    </div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Applying For</p>
                                    <h2 className="mb-4 text-xl font-extrabold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{job?.title}</h2>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><Building2 size={16} className="opacity-70" /> {job?.department || 'Department not specified'}</div>
                                        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><MapPin size={16} className="opacity-70" /> {jobLocationLabel}</div>
                                        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}><Briefcase size={16} className="opacity-70" /> {employmentTypeLabel}</div>
                                    </div>
                                </div>

                                <div className="glass-card rounded-[2rem] p-8">
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                        <CheckCircle2 size={20} style={{ color: 'var(--color-text-primary)' }} />
                                    </div>
                                    <h3 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Application Tips</h3>
                                    <ul className="space-y-4 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                        <li>Keep your resume aligned with this role.</li>
                                        <li>Add links only where they strengthen your application.</li>
                                        <li>Use the custom questions to show role-specific proof, not generic text.</li>
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
