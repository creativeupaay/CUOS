import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useGetPublicJobsQuery, usePublicApplyMutation } from '@/features/hiring/hiringApi';

export default function PublicJobApplyPage() {
    const { jobId = '' } = useParams();
    const { data } = useGetPublicJobsQuery();
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
    const [error, setError] = useState('');

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!resume) {
            setError('Resume is required');
            return;
        }

        try {
            await publicApply({
                jobId,
                data: {
                    name,
                    email,
                    phone,
                    portfolio,
                    linkedin,
                    experience,
                    coverLetter,
                    resume,
                },
            }).unwrap();
            setSuccess(true);
        } catch (err: any) {
            setError(err?.data?.message || 'Failed to submit application');
        }
    };

    return (
        <div className="min-h-screen px-4 py-10" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Apply for {job?.title || 'Job Role'}</h1>
                <p className="text-sm mt-1 mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                    Fill in your details and upload your resume to submit your application.
                </p>

                <form onSubmit={onSubmit} className="p-6 rounded-xl border space-y-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    {success && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                            <CheckCircle2 size={16} />
                            Application submitted successfully. Please check your email.
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full Name" className="px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" className="px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                    </div>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Phone" className="w-full px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                    <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="Portfolio URL (optional)" className="w-full px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                    <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn URL (optional)" className="w-full px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                    <input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Experience (optional)" className="w-full px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />
                    <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={4} placeholder="Cover letter (optional)" className="w-full px-3 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }} />

                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Resume (PDF/DOC/DOCX)</label>
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => setResume(e.target.files?.[0] || null)}
                            required
                            className="w-full text-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isLoading && <Loader2 size={14} className="animate-spin" />}
                        Submit Application
                    </button>
                </form>
            </div>
        </div>
    );
}
