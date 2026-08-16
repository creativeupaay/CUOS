import { useState, useEffect, type KeyboardEvent } from 'react';
import { Settings, Save, Building2 } from 'lucide-react';
import {
    useGetOrgSettingsQuery,
    useUpdateOrgSettingsMutation,
} from '@/features/overall-admin/api/adminApi';
import { dedupeDepartments } from '@/utils/department';

const DEFAULT_ABOUT_COMPANY_TEXT =
    'Creative Upaay is a tech and design partner that works closely with Startups and Enterprises to build AI based digital products and systems. Our work goes beyond just design or development, we focus on creating practical, scalable solutions that teams actually use. We work across 10+ Industries, for their Custom web solution development, automation workflows, and AI based tools. A lot of our projects involve understanding messy real-world processes and turning them into structured digital experiences.\n\nSo far, we have worked with 85+ brands globally and delivered 350+ projects.\n\nWe look for people who take ownership, think in systems, and care about solving real problems, not just completing tasks. Our Team culture is simple: low ego, high responsibility, honest communication, and a strong focus on doing quality work that actually makes an impact.';

export default function AdminSettingsPage() {
    const { data, isLoading } = useGetOrgSettingsQuery();
    const [updateSettings] = useUpdateOrgSettingsMutation();
    const [saving, setSaving] = useState('');
    const [success, setSuccess] = useState('');

    const settings = data?.data;

    // Local state for each section
    const [company, setCompany] = useState({
        companyName: '',
        companyEmail: '',
        companyPhone: '',
    });
    const [address, setAddress] = useState({
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
    });
    const [departments, setDepartments] = useState<string[]>([]);
    const [departmentInput, setDepartmentInput] = useState('');
    const [hiringContent, setHiringContent] = useState({
        showAboutCompany: true,
        aboutCompanyText: DEFAULT_ABOUT_COMPANY_TEXT,
    });

    useEffect(() => {
        if (settings) {
            setCompany({
                companyName: settings.companyName || '',
                companyEmail: settings.companyEmail || '',
                companyPhone: settings.companyPhone || '',
            });
            const addr = settings.address || {};
            setAddress({ street: addr.street || '', city: addr.city || '', state: addr.state || '', country: addr.country || '', zipCode: addr.zipCode || '' });
            setDepartments(dedupeDepartments(Array.isArray(settings.departments) ? settings.departments : []));
            setHiringContent({
                showAboutCompany:
                    settings.hiring?.publicJobPage?.showAboutCompany ?? true,
                aboutCompanyText:
                    settings.hiring?.publicJobPage?.aboutCompanyText || DEFAULT_ABOUT_COMPANY_TEXT,
            });
        }
    }, [settings]);

    const handleSaveSection = async (section: string, data: any) => {
        setSaving(section);
        setSuccess('');
        try {
            await updateSettings(data).unwrap();
            setSuccess(section);
            setTimeout(() => setSuccess(''), 2000);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save settings');
        } finally {
            setSaving('');
        }
    };

    const addDepartment = () => {
        const nextDepartment = departmentInput.trim();
        if (!nextDepartment) return;

        const exists = departments.some(
            (department) => department.toLowerCase() === nextDepartment.toLowerCase()
        );
        if (exists) {
            setDepartmentInput('');
            return;
        }

        setDepartments((prev) => dedupeDepartments([...prev, nextDepartment]));
        setDepartmentInput('');
    };

    const removeDepartment = (departmentToRemove: string) => {
        if (!window.confirm(`Are you sure you want to remove the department "${departmentToRemove}"?`)) return;
        setDepartments((prev) =>
            prev.filter((department) => department !== departmentToRemove)
        );
    };

    const handleBoldShortcut = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
        e.preventDefault();

        const textarea = e.currentTarget;

        const currentValue = textarea.value;
        const start = textarea.selectionStart ?? currentValue.length;
        const end = textarea.selectionEnd ?? currentValue.length;
        const selectedText = currentValue.slice(start, end);
        const wrappedText = selectedText ? `**${selectedText}**` : '****';
        const nextValue = `${currentValue.slice(0, start)}${wrappedText}${currentValue.slice(end)}`;

        setHiringContent((prev) => ({ ...prev, aboutCompanyText: nextValue }));

        window.requestAnimationFrame(() => {
            const nextStart = start + 2;
            const nextEnd = selectedText ? end + 2 : start + 2;
            textarea.focus();
            textarea.setSelectionRange(nextStart, nextEnd);
        });
    };

    const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
        <div className="flex items-center gap-2 mb-4">
            <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        </div>
    );

    const SaveButton = ({ section, onClick }: { section: string; onClick: () => void }) => (
        <button
            onClick={onClick}
            disabled={saving === section}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white mt-4 disabled:opacity-50"
            style={{ backgroundColor: success === section ? '#10B981' : 'var(--color-primary)' }}
        >
            <Save size={16} />
            {saving === section ? 'Saving...' : success === section ? 'Saved!' : 'Save'}
        </button>
    );

    if (isLoading) {
        return (
            <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-gray-200 rounded w-48" />
                    <div className="h-64 bg-gray-200 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                    <Settings size={22} />
                </div>
                <div>
                    
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Configure your organization details and policies</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Company Info */}
                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Building2 size={20} />} title="Company Information" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Company Name</label>
                            <input type="text" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Email</label>
                            <input type="email" value={company.companyEmail} onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Phone</label>
                            <input type="text" value={company.companyPhone} onChange={(e) => setCompany({ ...company, companyPhone: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>City</label>
                            <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>State</label>
                            <input type="text" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Country</label>
                            <input type="text" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                    </div>
                    <SaveButton section="company" onClick={() => handleSaveSection('company', { ...company, address })} />
                </div>

                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Building2 size={20} />} title="Departments" />
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        These departments are reused across admin users, HRMS, and hiring job postings.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {departments.map((department) => (
                            <span
                                key={department}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border"
                                style={{
                                    backgroundColor: 'var(--color-bg-subtle)',
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-primary)',
                                }}
                            >
                                {department}
                                <button
                                    type="button"
                                    onClick={() => removeDepartment(department)}
                                    className="text-xs"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Remove
                                </button>
                            </span>
                        ))}
                        {departments.length === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No departments added yet.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={departmentInput}
                            onChange={(e) => setDepartmentInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addDepartment();
                                }
                            }}
                            placeholder="Add department name"
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                        />
                        <button
                            type="button"
                            onClick={addDepartment}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            Add
                        </button>
                    </div>
                    <SaveButton section="departments" onClick={() => handleSaveSection('departments', { departments: dedupeDepartments(departments) })} />
                </div>

                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Building2 size={20} />} title="Hiring Page Content" />
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                        About the Company is centrally controlled here and auto-applies to all public job pages.
                    </p>
                    <label className="flex items-center gap-3 mb-4 text-sm cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                        <input
                            type="checkbox"
                            checked={hiringContent.showAboutCompany}
                            onChange={(e) =>
                                setHiringContent((prev) => ({
                                    ...prev,
                                    showAboutCompany: e.target.checked,
                                }))
                            }
                            className="rounded"
                        />
                        Show About the Company section on public job pages
                    </label>

                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                            About the Company Text
                        </label>
                        <textarea
                            value={hiringContent.aboutCompanyText}
                            onChange={(e) =>
                                setHiringContent((prev) => ({
                                    ...prev,
                                    aboutCompanyText: e.target.value,
                                }))
                            }
                            onKeyDown={handleBoldShortcut}
                            rows={8}
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                        />
                    </div>

                    <SaveButton
                        section="hiringContent"
                        onClick={() =>
                            handleSaveSection('hiringContent', {
                                hiring: {
                                    publicJobPage: {
                                        showAboutCompany: hiringContent.showAboutCompany,
                                        aboutCompanyText: hiringContent.aboutCompanyText,
                                    },
                                },
                            })
                        }
                    />
                </div>

            </div>
        </div>
    );
}

