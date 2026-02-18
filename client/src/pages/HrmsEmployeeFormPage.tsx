import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation, useGetEmployeeQuery, useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { ArrowLeft, Save, Loader2, UserPlus } from 'lucide-react';

const DEPARTMENTS = ['engineering', 'design', 'marketing', 'finance', 'hr', 'admin'];
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'intern'];

const DEFAULT_ONBOARDING_CHECKLIST = [
    'Welcome orientation completed',
    'IT setup (laptop, email, accounts)',
    'HR documentation submitted',
    'Team introduction done',
    'First week goals assigned',
    'Probation terms explained',
];

export default function HrmsEmployeeFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const { data: existingData } = useGetEmployeeQuery(id!, { skip: !isEdit });
    const { data: usersData } = useGetUsersQuery();
    const { data: employeesData } = useGetEmployeesQuery({ limit: 100 });
    const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
    const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();

    const users = usersData?.data?.users || usersData?.data || [];
    const existingEmployees = employeesData?.data?.employees || [];
    // Users that don't already have an employee record
    const availableUsers = Array.isArray(users)
        ? users.filter((u: any) => !existingEmployees.some((e: any) => (e.userId?._id || e.userId) === u._id))
        : [];

    const [form, setForm] = useState({
        userId: '',
        employeeId: '',
        designation: '',
        department: 'engineering',
        employmentType: 'full-time',
        joiningDate: new Date().toISOString().split('T')[0],
        probationEndDate: '',
        status: 'active',
        reportingTo: '',
        workSchedule: { workingDaysPerWeek: 5, hoursPerDay: 8 },
        personalInfo: { phone: '', gender: '' as string, dob: '' },
        bankDetails: { bankName: '', accountNumber: '', ifscCode: '', panNumber: '' },
    });

    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (existingData?.data?.employee) {
            const emp = existingData.data.employee;
            setForm({
                userId: (emp.userId as any)?._id || '',
                employeeId: emp.employeeId,
                designation: emp.designation,
                department: emp.department,
                employmentType: emp.employmentType,
                joiningDate: emp.joiningDate?.split('T')[0] || '',
                probationEndDate: emp.probationEndDate?.split('T')[0] || '',
                status: emp.status,
                reportingTo: (emp.reportingTo as any)?._id || '',
                workSchedule: emp.workSchedule || { workingDaysPerWeek: 5, hoursPerDay: 8 },
                personalInfo: {
                    phone: emp.personalInfo?.phone || '',
                    gender: emp.personalInfo?.gender || '',
                    dob: emp.personalInfo?.dob?.split('T')[0] || '',
                },
                bankDetails: {
                    bankName: emp.bankDetails?.bankName || '',
                    accountNumber: emp.bankDetails?.accountNumber || '',
                    ifscCode: emp.bankDetails?.ifscCode || '',
                    panNumber: emp.bankDetails?.panNumber || '',
                },
            });
        }
    }, [existingData]);

    // Clean the payload — remove empty strings for optional ObjectId / date fields
    const cleanPayload = (data: any) => {
        const cleaned = { ...data };
        if (!cleaned.reportingTo) delete cleaned.reportingTo;
        if (!cleaned.probationEndDate) delete cleaned.probationEndDate;

        // Clean personalInfo
        if (cleaned.personalInfo) {
            const pi = { ...cleaned.personalInfo };
            if (!pi.phone) delete pi.phone;
            if (!pi.gender) delete pi.gender;
            if (!pi.dob) delete pi.dob;
            cleaned.personalInfo = Object.keys(pi).length > 0 ? pi : undefined;
        }

        // Clean bankDetails
        if (cleaned.bankDetails) {
            const bd = { ...cleaned.bankDetails };
            if (!bd.bankName) delete bd.bankName;
            if (!bd.accountNumber) delete bd.accountNumber;
            if (!bd.ifscCode) delete bd.ifscCode;
            if (!bd.panNumber) delete bd.panNumber;
            cleaned.bankDetails = Object.keys(bd).length > 0 ? bd : undefined;
        }

        return cleaned;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isEdit) {
                const { userId, employeeId, ...updateData } = form;
                await updateEmployee({ id: id!, data: cleanPayload(updateData) }).unwrap();
            } else {
                const payload = cleanPayload({
                    ...form,
                    onboarding: {
                        status: 'not-started',
                        checklist: DEFAULT_ONBOARDING_CHECKLIST.map((item) => ({ item, completed: false })),
                    },
                });
                await createEmployee(payload).unwrap();
            }
            navigate('/hrms/employees');
        } catch (err: any) {
            const msg = err?.data?.message || err?.message || 'Failed to save employee. Please check the form and try again.';
            setErrorMsg(msg);
            console.error('Failed to save employee:', err);
        }
    };

    const isSaving = isCreating || isUpdating;

    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '860px' }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/hrms/employees')} className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)' }}>
                    <ArrowLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <div className="flex items-center gap-2">
                    <UserPlus size={22} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {isEdit ? 'Edit Employee' : 'Add Employee'}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {isEdit ? 'Update employee information' : 'Create a new employee profile'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
                    ⚠️ {errorMsg}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="rounded-lg border p-6 mb-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Basic Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {!isEdit && (
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Select User *</label>
                                <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer" style={inputStyle}>
                                    <option value="">— Choose a user —</option>
                                    {availableUsers.map((u: any) => (
                                        <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                                {availableUsers.length === 0 && (
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        All users already have employee records, or no users found.
                                    </p>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Employee ID *</label>
                            <input type="text" required value={form.employeeId} disabled={isEdit}
                                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} placeholder="e.g. CU-0042" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Designation *</label>
                            <input type="text" required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} placeholder="e.g. Sr. Developer" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Department *</label>
                            <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer" style={inputStyle}>
                                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Employment Type</label>
                            <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer" style={inputStyle}>
                                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Joining Date *</label>
                            <input type="date" required value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Probation End Date</label>
                            <input type="date" value={form.probationEndDate} onChange={(e) => setForm({ ...form, probationEndDate: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Reports To</label>
                            <select value={form.reportingTo} onChange={(e) => setForm({ ...form, reportingTo: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer" style={inputStyle}>
                                <option value="">— None —</option>
                                {existingEmployees.map((emp: any) => (
                                    <option key={emp._id} value={emp._id}>
                                        {emp.userId?.name || emp.employeeId} — {emp.designation}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Work Schedule */}
                <div className="rounded-lg border p-6 mb-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Work Schedule</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Working Days / Week</label>
                            <input type="number" min={1} max={7} value={form.workSchedule.workingDaysPerWeek}
                                onChange={(e) => setForm({ ...form, workSchedule: { ...form.workSchedule, workingDaysPerWeek: parseInt(e.target.value) || 5 } })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Hours / Day</label>
                            <input type="number" min={1} max={24} value={form.workSchedule.hoursPerDay}
                                onChange={(e) => setForm({ ...form, workSchedule: { ...form.workSchedule, hoursPerDay: parseInt(e.target.value) || 8 } })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Personal Info */}
                <div className="rounded-lg border p-6 mb-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personal Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Phone</label>
                            <input type="text" value={form.personalInfo.phone} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, phone: e.target.value } })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} placeholder="+91 9876543210" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Gender</label>
                            <select value={form.personalInfo.gender} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, gender: e.target.value } })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer" style={inputStyle}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date of Birth</label>
                            <input type="date" value={form.personalInfo.dob} onChange={(e) => setForm({ ...form, personalInfo: { ...form.personalInfo, dob: e.target.value } })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Bank Details */}
                <div className="rounded-lg border p-6 mb-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bank Details</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {([
                            ['bankName', 'Bank Name'],
                            ['accountNumber', 'Account Number'],
                            ['ifscCode', 'IFSC Code'],
                            ['panNumber', 'PAN Number'],
                        ] as const).map(([field, label]) => (
                            <div key={field}>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    {label}
                                </label>
                                <input type="text" value={(form.bankDetails as any)[field]}
                                    onChange={(e) => setForm({ ...form, bankDetails: { ...form.bankDetails, [field]: e.target.value } })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pb-8">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
                    </button>
                    <button type="button" onClick={() => navigate('/hrms/employees')}
                        className="px-6 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
