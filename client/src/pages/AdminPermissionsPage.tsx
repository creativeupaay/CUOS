import { useState } from 'react';
import { ShieldCheck, Search, ChevronDown, ChevronRight, Check, Save, User, Info, Plus, X, Trash2, FolderKanban } from 'lucide-react';
import { useGetAdminUsersQuery, useUpdateAdminUserMutation } from '@/features/overall-admin/api/adminApi';
import { useGetProjectsQuery } from '@/features/project';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectSubModules {
    overview: boolean; tasks: boolean; timeLogs: boolean;
    meetings: boolean; credentials: boolean; documents: boolean;
}

interface ProjectPermission { projectId: string; subModules: ProjectSubModules }

interface ModulePermissions {
    projectManagement: { enabled: boolean; projectPermissions: ProjectPermission[] };
    finance: { enabled: boolean; subModules: { dashboard: boolean; expenses: boolean; invoices: boolean; reports: boolean } };
    crm: { enabled: boolean; subModules: { pipeline: boolean; leads: boolean; proposals: boolean; clients: boolean } };
    hrms: { enabled: boolean; subModules: { dashboard: boolean; employees: boolean; attendance: boolean; leaves: boolean; payroll: boolean } };
    overallAdmin: { enabled: boolean; subModules: { users: boolean; permissions: boolean; settings: boolean; auditLogs: boolean } };
}

const defaultSubModules = (): ProjectSubModules => ({
    overview: false, tasks: false, timeLogs: false, meetings: false, credentials: false, documents: false,
});

const defaultPermissions = (): ModulePermissions => ({
    projectManagement: { enabled: false, projectPermissions: [] },
    finance: { enabled: false, subModules: { dashboard: false, expenses: false, invoices: false, reports: false } },
    crm: { enabled: false, subModules: { pipeline: false, leads: false, proposals: false, clients: false } },
    hrms: { enabled: false, subModules: { dashboard: false, employees: false, attendance: false, leaves: false, payroll: false } },
    overallAdmin: { enabled: false, subModules: { users: false, permissions: false, settings: false, auditLogs: false } },
});

function loadPermissions(mp: any): ModulePermissions {
    if (!mp) return defaultPermissions();
    const pps: ProjectPermission[] = (mp.projectManagement?.projectPermissions ?? []).map((p: any) => ({
        projectId: p.projectId,
        subModules: {
            overview: p.subModules?.overview ?? false,
            tasks: p.subModules?.tasks ?? false,
            timeLogs: p.subModules?.timeLogs ?? false,
            meetings: p.subModules?.meetings ?? false,
            credentials: p.subModules?.credentials ?? false,
            documents: p.subModules?.documents ?? false,
        },
    }));
    return {
        projectManagement: { enabled: mp.projectManagement?.enabled ?? false, projectPermissions: pps },
        finance: { enabled: mp.finance?.enabled ?? false, subModules: { dashboard: mp.finance?.subModules?.dashboard ?? false, expenses: mp.finance?.subModules?.expenses ?? false, invoices: mp.finance?.subModules?.invoices ?? false, reports: mp.finance?.subModules?.reports ?? false } },
        crm: { enabled: mp.crm?.enabled ?? false, subModules: { pipeline: mp.crm?.subModules?.pipeline ?? false, leads: mp.crm?.subModules?.leads ?? false, proposals: mp.crm?.subModules?.proposals ?? false, clients: mp.crm?.subModules?.clients ?? false } },
        hrms: { enabled: mp.hrms?.enabled ?? false, subModules: { dashboard: mp.hrms?.subModules?.dashboard ?? false, employees: mp.hrms?.subModules?.employees ?? false, attendance: mp.hrms?.subModules?.attendance ?? false, leaves: mp.hrms?.subModules?.leaves ?? false, payroll: mp.hrms?.subModules?.payroll ?? false } },
        overallAdmin: { enabled: mp.overallAdmin?.enabled ?? false, subModules: { users: mp.overallAdmin?.subModules?.users ?? false, permissions: mp.overallAdmin?.subModules?.permissions ?? false, settings: mp.overallAdmin?.subModules?.settings ?? false, auditLogs: mp.overallAdmin?.subModules?.auditLogs ?? false } },
    };
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function CB({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
    return (
        <label className={`flex items-center gap-2.5 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <span onClick={() => !disabled && onChange(!checked)}
                className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ borderColor: checked && !disabled ? 'var(--color-primary)' : 'var(--color-border-default)', backgroundColor: checked && !disabled ? 'var(--color-primary)' : 'transparent' }}>
                {checked && !disabled && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            {label && <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{label}</span>}
        </label>
    );
}

// ─── Module Section ───────────────────────────────────────────────────────────

function ModuleSection({ title, desc, enabled, onToggle, children }: {
    title: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);
    const cardSty = { borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' };
    return (
        <div className="rounded-xl border overflow-hidden" style={cardSty}>
            <div className="flex items-center gap-4 px-5 py-4" style={{ backgroundColor: enabled ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)' }}>
                <CB checked={enabled} onChange={onToggle} label="" />
                <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
                </div>
                {enabled && children && (
                    <button type="button" onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}
            </div>
            {enabled && open && children && (
                <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>{children}</div>
            )}
        </div>
    );
}

// ─── SubGrid ──────────────────────────────────────────────────────────────────

function SubGrid({ items, values, onChange, note }: {
    items: { key: string; label: string; desc?: string }[];
    values: Record<string, boolean>;
    onChange: (key: string, v: boolean) => void;
    note?: string;
}) {
    return (
        <div>
            {note && <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}><Info size={12} />{note}</p>}
            <div className="grid grid-cols-2 gap-3">
                {items.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start gap-2.5 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>
                        <CB checked={values[key] ?? false} onChange={v => onChange(key, v)} label="" />
                        <div>
                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
                            {desc && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Add Projects Modal ───────────────────────────────────────────────────────

function AddProjectsModal({ existingIds, onAdd, onClose }: {
    existingIds: string[];
    onAdd: (ids: string[]) => void;
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const { data } = useGetProjectsQuery({});
    const allProjects: any[] = (data?.data || []).filter((p: any) => !existingIds.includes(p._id));
    const filtered = allProjects.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));
    const allSelected = filtered.length > 0 && filtered.every((p: any) => selected.includes(p._id));

    const toggle = (id: string) =>
        setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const toggleAll = () =>
        setSelected(allSelected ? [] : filtered.map((p: any) => p._id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl shadow-2xl m-4" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add Projects</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
                </div>
                <div className="px-4 pt-3 pb-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                        <input type="text" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }} />
                    </div>
                    {filtered.length > 0 && (
                        <button onClick={toggleAll} className="text-xs mt-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                            {allSelected ? 'Deselect All' : 'Select All'} ({filtered.length})
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto border-t" style={{ maxHeight: '320px', borderColor: 'var(--color-border-default)' }}>
                    {filtered.length === 0
                        ? <p className="p-5 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>{allProjects.length === 0 ? 'All projects already added' : 'No projects found'}</p>
                        : filtered.map((p: any) => {
                            const checked = selected.includes(p._id);
                            return (
                                <button key={p._id} type="button" onClick={() => toggle(p._id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-b-0 transition-colors"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: checked ? 'var(--color-primary-soft)' : 'transparent' }}>
                                    <CB checked={checked} onChange={() => toggle(p._id)} label="" />
                                    <FolderKanban size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>{p.status}</span>
                                </button>
                            );
                        })}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selected.length} selected</span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border" style={{ borderColor: 'var(--color-border-default)' }}>Cancel</button>
                        <button onClick={() => { onAdd(selected); onClose(); }} disabled={selected.length === 0}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            Add {selected.length > 0 ? `(${selected.length})` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Project Permission Row ───────────────────────────────────────────────────

const PM_SUB_TAB_LABELS = [
    { key: 'overview', label: 'Overview', desc: 'Project summary' },
    { key: 'tasks', label: 'Tasks', desc: 'View & manage tasks' },
    { key: 'timeLogs', label: 'Time Logs', desc: 'Log time' },
    { key: 'meetings', label: 'Meetings', desc: 'Schedule meetings' },
    { key: 'credentials', label: 'Credentials', desc: 'Project credentials' },
    { key: 'documents', label: 'Documents', desc: 'Project files' },
];

function ProjectPermRow({ pp, projectName, onUpdateSubs, onRemove }: {
    pp: ProjectPermission;
    projectName: string;
    onUpdateSubs: (subs: ProjectSubModules) => void;
    onRemove: () => void;
}) {
    const [open, setOpen] = useState(false);
    const enabledCount = Object.values(pp.subModules).filter(Boolean).length;

    return (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                style={{ backgroundColor: 'var(--color-bg-surface)' }}
                onClick={() => setOpen(o => !o)}>
                <FolderKanban size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>{projectName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full mr-1"
                    style={{ backgroundColor: enabledCount > 0 ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)', color: enabledCount > 0 ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
                    {enabledCount}/6 tabs
                </span>
                <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
                    className="p-1 rounded hover:bg-red-50 flex-shrink-0" title="Remove project">
                    <Trash2 size={13} style={{ color: '#EF4444' }} />
                </button>
                <button type="button" className="p-1 rounded flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
            </div>
            {open && (
                <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>VISIBLE TABS FOR THIS PROJECT</p>
                        <button type="button"
                            onClick={() => {
                                const allTrue = Object.values(pp.subModules).every(Boolean);
                                const val = !allTrue;
                                onUpdateSubs({ overview: val, tasks: val, timeLogs: val, meetings: val, credentials: val, documents: val });
                            }}
                            className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                            {Object.values(pp.subModules).every(Boolean) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {PM_SUB_TAB_LABELS.map(({ key, label, desc }) => (
                            <div key={key} className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white" style={{ borderColor: 'var(--color-border-default)' }}>
                                <CB checked={(pp.subModules as any)[key]} onChange={v => onUpdateSubs({ ...pp.subModules, [key]: v })} label="" />
                                <div>
                                    <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── PM Panel ─────────────────────────────────────────────────────────────────

function PMPanel({ perms, onChange }: { perms: ModulePermissions; onChange: (p: ModulePermissions) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);
    const { data } = useGetProjectsQuery({});
    const allProjects: any[] = data?.data || [];
    const projectMap: Record<string, string> = {};
    allProjects.forEach((p: any) => { projectMap[p._id] = p.name; });

    const pps = perms.projectManagement.projectPermissions;
    const existingIds = pps.map(p => p.projectId);

    const updatePPs = (updated: ProjectPermission[]) =>
        onChange({ ...perms, projectManagement: { ...perms.projectManagement, projectPermissions: updated } });

    const handleAdd = (ids: string[]) => {
        const newEntries = ids.map(id => ({ projectId: id, subModules: defaultSubModules() }));
        updatePPs([...pps, ...newEntries]);
    };

    const handleRemove = (id: string) => updatePPs(pps.filter(p => p.projectId !== id));

    const handleUpdateSubs = (id: string, subs: ProjectSubModules) =>
        updatePPs(pps.map(p => p.projectId === id ? { ...p, subModules: subs } : p));

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {pps.length === 0 ? 'No projects added yet.' : `${pps.length} project${pps.length !== 1 ? 's' : ''} with access`}
                </p>
                <button type="button" onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Plus size={14} /> Add Projects
                </button>
            </div>

            {pps.length === 0 ? (
                <div className="rounded-xl border py-8 flex flex-col items-center"
                    style={{ borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}>
                    <FolderKanban size={24} className="mb-2" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Click "Add Projects" to grant access to specific projects</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {pps.map(pp => (
                        <ProjectPermRow key={pp.projectId} pp={pp}
                            projectName={projectMap[pp.projectId] ?? pp.projectId}
                            onUpdateSubs={subs => handleUpdateSubs(pp.projectId, subs)}
                            onRemove={() => handleRemove(pp.projectId)} />
                    ))}
                </div>
            )}

            {showAddModal && (
                <AddProjectsModal existingIds={existingIds} onAdd={handleAdd} onClose={() => setShowAddModal(false)} />
            )}
        </div>
    );
}

// ─── Full Permissions Panel ────────────────────────────────────────────────────

function PermissionsPanel({ perms, onChange }: { perms: ModulePermissions; onChange: (p: ModulePermissions) => void }) {
    const setSub = (mod: 'finance' | 'crm' | 'hrms' | 'overallAdmin', field: string, val: boolean) =>
        onChange({ ...perms, [mod]: { ...perms[mod], subModules: { ...(perms[mod] as any).subModules, [field]: val } } });

    const setEnabled = (mod: keyof ModulePermissions, val: boolean) =>
        onChange({ ...perms, [mod]: { ...(perms[mod] as any), enabled: val } });

    const finSubs = perms.finance.subModules as Record<string, boolean>;
    const crmSubs = perms.crm.subModules as Record<string, boolean>;
    const hrmsSubs = perms.hrms.subModules as Record<string, boolean>;
    const adminSubs = perms.overallAdmin.subModules as Record<string, boolean>;

    return (
        <div className="space-y-3">
            {/* Project Management */}
            <ModuleSection title="Project Management" desc="Assign specific projects and control which tabs are visible"
                enabled={perms.projectManagement.enabled}
                onToggle={v => onChange({ ...perms, projectManagement: { ...perms.projectManagement, enabled: v } })}>
                <PMPanel perms={perms} onChange={onChange} />
            </ModuleSection>

            {/* Finance */}
            <ModuleSection title="Finance" desc="Financial dashboards, expenses, invoices and reports"
                enabled={perms.finance.enabled} onToggle={v => setEnabled('finance', v)}>
                <SubGrid values={finSubs} onChange={(k, v) => setSub('finance', k, v)}
                    items={[
                        { key: 'dashboard', label: 'Dashboard', desc: 'Finance overview' },
                        { key: 'expenses', label: 'Expenses', desc: 'View & record expenses' },
                        { key: 'invoices', label: 'Invoices', desc: 'Manage invoices' },
                        { key: 'reports', label: 'Reports', desc: 'Financial reports' },
                    ]} />
            </ModuleSection>

            {/* CRM */}
            <ModuleSection title="CRM" desc="Customer relationship management"
                enabled={perms.crm.enabled} onToggle={v => setEnabled('crm', v)}>
                <SubGrid values={crmSubs} onChange={(k, v) => setSub('crm', k, v)}
                    items={[
                        { key: 'pipeline', label: 'Pipeline', desc: 'Sales pipeline' },
                        { key: 'leads', label: 'Leads', desc: 'Manage leads' },
                        { key: 'proposals', label: 'Proposals', desc: 'Proposals' },
                        { key: 'clients', label: 'Clients', desc: 'Client records' },
                    ]} />
            </ModuleSection>

            {/* HRMS */}
            <ModuleSection title="HRMS" desc="HR management — employees, attendance, leaves and payroll"
                enabled={perms.hrms.enabled} onToggle={v => setEnabled('hrms', v)}>
                <SubGrid values={hrmsSubs} onChange={(k, v) => setSub('hrms', k, v)}
                    note="Tip: give employees Attendance + Leaves for basic self-service access."
                    items={[
                        { key: 'dashboard', label: 'Dashboard', desc: 'HR overview' },
                        { key: 'employees', label: 'Employees', desc: 'Manage records' },
                        { key: 'attendance', label: 'Attendance', desc: 'Mark attendance' },
                        { key: 'leaves', label: 'Leaves', desc: 'Apply for leaves' },
                        { key: 'payroll', label: 'Payroll', desc: 'View payroll' },
                    ]} />
            </ModuleSection>

            {/* Overall Admin */}
            <ModuleSection title="Overall Admin" desc="Admin controls — users, permissions, settings and logs"
                enabled={perms.overallAdmin.enabled} onToggle={v => setEnabled('overallAdmin', v)}>
                <SubGrid values={adminSubs} onChange={(k, v) => setSub('overallAdmin', k, v)}
                    items={[
                        { key: 'users', label: 'Users', desc: 'Manage accounts' },
                        { key: 'permissions', label: 'Permissions', desc: 'Assign access' },
                        { key: 'settings', label: 'Settings', desc: 'Org settings' },
                        { key: 'auditLogs', label: 'Audit Logs', desc: 'Audit trail' },
                    ]} />
            </ModuleSection>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPermissionsPage() {
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [perms, setPerms] = useState<ModulePermissions>(defaultPermissions());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const { data } = useGetAdminUsersQuery({ search, limit: 100 });
    const [updateUser] = useUpdateAdminUserMutation();
    const getRoleName = (role: any) => role ? (typeof role === 'object' ? role.name : role) : '—';
    const users = (data?.data?.users || []).filter((user: any) => {
        const rName = getRoleName(user.role).toLowerCase();
        return rName !== 'super-admin' && rName !== 'superadmin';
    });

    const handleSelect = (user: any) => {
        setSelectedUser(user);
        setSaved(false);
        setPerms(loadPermissions(user.modulePermissions));
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            await updateUser({ id: selectedUser._id, data: { modulePermissions: perms as any } }).unwrap();
            setSelectedUser({ ...selectedUser, modulePermissions: perms });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: any) { alert(err?.data?.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    const countEnabled = (mp: any) => [mp?.projectManagement?.enabled, mp?.finance?.enabled, mp?.crm?.enabled, mp?.hrms?.enabled, mp?.overallAdmin?.enabled].filter(Boolean).length;
    const inputSty = { borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' };

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                    <ShieldCheck size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Module Permissions</h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Select a user and configure which modules and sub-sections they can access</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left — User list */}
                <div className="lg:col-span-1 sticky top-6">
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Select User</p>
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm outline-none" style={inputSty} />
                            </div>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                            {users.length === 0
                                ? <div className="p-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No users found</div>
                                : users.map((user: any) => {
                                    const isSel = selectedUser?._id === user._id;
                                    const n = countEnabled(user.modulePermissions);
                                    return (
                                        <button key={user._id} onClick={() => handleSelect(user)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0"
                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: isSel ? 'var(--color-primary-soft)' : 'transparent' }}
                                            onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                            onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                                                style={{ backgroundColor: isSel ? 'var(--color-primary)' : '#94A3B8' }}>
                                                {user.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium truncate" style={{ color: isSel ? 'var(--color-primary-dark)' : 'var(--color-text-primary)' }}>{user.name}</div>
                                                <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{getRoleName(user.role)} · {n} module{n !== 1 ? 's' : ''}</div>
                                            </div>
                                            {isSel && <ChevronRight size={16} style={{ color: 'var(--color-primary)' }} />}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </div>

                {/* Right — Permissions */}
                <div className="lg:col-span-2">
                    {!selectedUser ? (
                        <div className="rounded-xl border flex flex-col items-center justify-center py-20"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', borderStyle: 'dashed' }}>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                <User size={26} style={{ color: 'var(--color-text-muted)' }} />
                            </div>
                            <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>No user selected</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Pick a user from the list to configure their access</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-5 p-4 rounded-xl border"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: 'var(--color-primary)' }}>
                                        {selectedUser.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedUser.name}</div>
                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selectedUser.email} · {getRoleName(selectedUser.role)}</div>
                                    </div>
                                </div>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-60 transition-all"
                                    style={{ backgroundColor: saved ? '#16A34A' : 'var(--color-primary)' }}>
                                    {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> Save Permissions</>}
                                </button>
                            </div>
                            <PermissionsPanel perms={perms} onChange={setPerms} />
                            <div className="mt-4 flex justify-end">
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
                                    style={{ backgroundColor: saved ? '#16A34A' : 'var(--color-primary)' }}>
                                    {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> Save Permissions</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
