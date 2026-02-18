import { useState, useEffect } from 'react';
import { Settings, Save, Building2, Clock, DollarSign, Shield, Lock } from 'lucide-react';
import {
    useGetOrgSettingsQuery,
    useUpdateOrgSettingsMutation,
} from '@/features/overall-admin/api/adminApi';

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
    const [workingHours, setWorkingHours] = useState({
        startTime: '09:00',
        endTime: '18:00',
        daysPerWeek: 5,
        hoursPerDay: 8,
    });
    const [taxSettings, setTaxSettings] = useState({
        gstEnabled: true,
        gstRate: 18,
        tdsEnabled: true,
        tdsRate: 10,
    });
    const [featureToggles, setFeatureToggles] = useState({
        projectManagement: true,
        finance: false,
        crm: true,
        hrms: true,
        leads: true,
    });
    const [passwordPolicy, setPasswordPolicy] = useState({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
    });
    const [sessionExpiry, setSessionExpiry] = useState(15);

    useEffect(() => {
        if (settings) {
            setCompany({
                companyName: settings.companyName || '',
                companyEmail: settings.companyEmail || '',
                companyPhone: settings.companyPhone || '',
            });
            const addr = settings.address || {};
            setAddress({ street: addr.street || '', city: addr.city || '', state: addr.state || '', country: addr.country || '', zipCode: addr.zipCode || '' });
            setWorkingHours(settings.workingHours || { startTime: '09:00', endTime: '18:00', daysPerWeek: 5, hoursPerDay: 8 });
            setTaxSettings(settings.taxSettings || { gstEnabled: true, gstRate: 18, tdsEnabled: true, tdsRate: 10 });
            setFeatureToggles(settings.featureToggles || { projectManagement: true, finance: false, crm: true, hrms: true, leads: true });
            setPasswordPolicy(settings.passwordPolicy || { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: false });
            setSessionExpiry(settings.sessionExpiryMinutes || 15);
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
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Organization Settings</h1>
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

                {/* Working Hours */}
                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Clock size={20} />} title="Working Hours" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Start Time</label>
                            <input type="time" value={workingHours.startTime} onChange={(e) => setWorkingHours({ ...workingHours, startTime: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>End Time</label>
                            <input type="time" value={workingHours.endTime} onChange={(e) => setWorkingHours({ ...workingHours, endTime: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Days/Week</label>
                            <input type="number" min={1} max={7} value={workingHours.daysPerWeek} onChange={(e) => setWorkingHours({ ...workingHours, daysPerWeek: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Hours/Day</label>
                            <input type="number" min={1} max={24} value={workingHours.hoursPerDay} onChange={(e) => setWorkingHours({ ...workingHours, hoursPerDay: parseInt(e.target.value) || 8 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                    </div>
                    <SaveButton section="working" onClick={() => handleSaveSection('working', { workingHours })} />
                </div>

                {/* Tax Settings */}
                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<DollarSign size={20} />} title="Tax & Currency" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={taxSettings.gstEnabled} onChange={(e) => setTaxSettings({ ...taxSettings, gstEnabled: e.target.checked })} className="rounded" />
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Enable GST</label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>GST Rate (%)</label>
                            <input type="number" value={taxSettings.gstRate} onChange={(e) => setTaxSettings({ ...taxSettings, gstRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={taxSettings.tdsEnabled} onChange={(e) => setTaxSettings({ ...taxSettings, tdsEnabled: e.target.checked })} className="rounded" />
                            <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Enable TDS</label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>TDS Rate (%)</label>
                            <input type="number" value={taxSettings.tdsRate} onChange={(e) => setTaxSettings({ ...taxSettings, tdsRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                    </div>
                    <SaveButton section="tax" onClick={() => handleSaveSection('tax', { taxSettings })} />
                </div>

                {/* Feature Toggles */}
                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Shield size={20} />} title="Feature Toggles" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(featureToggles).map(([feature, enabled]) => (
                            <label key={feature} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--color-border-default)', backgroundColor: enabled ? '#F0FDF4' : 'var(--color-bg-subtle)' }}>
                                <input type="checkbox" checked={enabled} onChange={(e) => setFeatureToggles({ ...featureToggles, [feature]: e.target.checked })} className="rounded" />
                                <span className="text-sm font-medium capitalize" style={{ color: 'var(--color-text-primary)' }}>
                                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                            </label>
                        ))}
                    </div>
                    <SaveButton section="features" onClick={() => handleSaveSection('features', { featureToggles })} />
                </div>

                {/* Password Policy */}
                <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <SectionHeader icon={<Lock size={20} />} title="Password & Session Policy" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Min Password Length</label>
                            <input type="number" min={6} max={32} value={passwordPolicy.minLength} onChange={(e) => setPasswordPolicy({ ...passwordPolicy, minLength: parseInt(e.target.value) || 8 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Session Expiry (minutes)</label>
                            <input type="number" min={5} max={1440} value={sessionExpiry} onChange={(e) => setSessionExpiry(parseInt(e.target.value) || 15)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {['requireUppercase', 'requireLowercase', 'requireNumbers', 'requireSpecialChars'].map((key) => (
                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={(passwordPolicy as any)[key]} onChange={(e) => setPasswordPolicy({ ...passwordPolicy, [key]: e.target.checked })} className="rounded" />
                                <span style={{ color: 'var(--color-text-primary)' }}>{key.replace('require', 'Require ').replace(/([A-Z])/g, ' $1').trim()}</span>
                            </label>
                        ))}
                    </div>
                    <SaveButton section="password" onClick={() => handleSaveSection('password', { passwordPolicy, sessionExpiryMinutes: sessionExpiry })} />
                </div>
            </div>
        </div>
    );
}
