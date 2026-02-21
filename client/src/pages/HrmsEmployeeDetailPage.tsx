import { useParams, useNavigate } from 'react-router-dom';
import { useGetEmployeeQuery, useGetSalaryByEmployeeQuery, useCreateSalaryMutation, useUpdateSalaryMutation } from '@/features/hrms/hrmsApi';
import { ArrowLeft, Edit, User, Briefcase, DollarSign, Shield, CheckCircle2, Plus, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function HrmsEmployeeDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading } = useGetEmployeeQuery(id!);
    const { data: salaryData } = useGetSalaryByEmployeeQuery(id!);

    const employee = data?.data?.employee;
    const salary = salaryData?.data?.salary;

    const [createSalary, { isLoading: isCreatingSalary }] = useCreateSalaryMutation();
    const [updateSalary, { isLoading: isUpdatingSalary }] = useUpdateSalaryMutation();

    const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
    const [salaryForm, setSalaryForm] = useState({
        basic: 0,
        hra: 0,
        da: 0,
        specialAllowance: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (salary && isSalaryModalOpen) {
            setSalaryForm({
                basic: salary.basic || 0,
                hra: salary.hra || 0,
                da: salary.da || 0,
                specialAllowance: salary.specialAllowance || 0,
                effectiveFrom: salary.effectiveFrom ? salary.effectiveFrom.split('T')[0] : new Date().toISOString().split('T')[0],
            });
        }
    }, [salary, isSalaryModalOpen]);

    const handleSaveSalary = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (salary) {
                await updateSalary({ id: salary._id, data: salaryForm }).unwrap();
            } else {
                await createSalary({ employeeId: id!, ...salaryForm, currency: 'INR' }).unwrap();
            }
            setIsSalaryModalOpen(false);
        } catch (err: any) {
            alert(err?.data?.message || err?.message || 'Failed to save salary');
        }
    };

    if (isLoading) {
        return <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;
    }

    if (!employee) {
        return <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Employee not found</div>;
    }

    const completedChecklist = employee.onboarding?.checklist?.filter((c) => c.completed).length || 0;
    const totalChecklist = employee.onboarding?.checklist?.length || 0;

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/hrms/employees')} className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-border-default)' }}>
                        <ArrowLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {(employee.userId as any)?.name}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {employee.employeeId} · {employee.designation}
                        </p>
                    </div>
                </div>
                <button onClick={() => navigate(`/hrms/employees/${id}/edit`)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                    <Edit size={16} /> Edit
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* Profile Card */}
                <div className="col-span-2 space-y-4">
                    <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <User size={18} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Employee Details</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                            {[
                                ['Email', (employee.userId as any)?.email],
                                ['Department', employee.department],
                                ['Employment Type', employee.employmentType],
                                ['Status', employee.status],
                                ['Joining Date', new Date(employee.joiningDate).toLocaleDateString()],
                                ['Probation End', employee.probationEndDate ? new Date(employee.probationEndDate).toLocaleDateString() : '—'],
                                ['Working Days/Week', employee.workSchedule?.workingDaysPerWeek],
                                ['Hours/Day', employee.workSchedule?.hoursPerDay],
                                ['Phone', employee.personalInfo?.phone || '—'],
                                ['Gender', employee.personalInfo?.gender || '—'],
                            ].map(([label, value]) => (
                                <div key={label as string}>
                                    <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</dt>
                                    <dd className="text-sm mt-0.5 capitalize" style={{ color: 'var(--color-text-primary)' }}>{value}</dd>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Salary Card */}
                    <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
                                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Salary Structure</h2>
                            </div>
                            <button onClick={() => setIsSalaryModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                {salary ? <><Edit size={14} /> Edit Salary</> : <><Plus size={14} /> Add Salary</>}
                            </button>
                        </div>
                        {salary ? (
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                {[
                                    ['Basic', `₹${salary.basic.toLocaleString()}`],
                                    ['HRA', `₹${salary.hra.toLocaleString()}`],
                                    ['DA', `₹${salary.da.toLocaleString()}`],
                                    ['Special Allowance', `₹${salary.specialAllowance.toLocaleString()}`],
                                    ['Gross', `₹${(salary.basic + salary.hra + salary.da + salary.specialAllowance).toLocaleString()}`],
                                    ['Effective From', new Date(salary.effectiveFrom).toLocaleDateString()],
                                ].map(([label, value]) => (
                                    <div key={label as string}>
                                        <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</dt>
                                        <dd className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{value}</dd>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No salary structure defined yet.</p>
                        )}
                    </div>
                </div>

                {/* Sidebar — Onboarding + Quick Stats */}
                <div className="space-y-4">
                    <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Shield size={18} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Onboarding</h2>
                        </div>
                        <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: 'var(--color-text-muted)' }}>{completedChecklist}/{totalChecklist} completed</span>
                                <span className="capitalize font-medium" style={{
                                    color: employee.onboarding.status === 'completed' ? 'var(--color-success)' : 'var(--color-primary)',
                                }}>
                                    {employee.onboarding.status}
                                </span>
                            </div>
                            <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                <div className="h-2 rounded-full transition-all" style={{
                                    width: totalChecklist > 0 ? `${(completedChecklist / totalChecklist) * 100}%` : '0%',
                                    backgroundColor: 'var(--color-primary)',
                                }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            {employee.onboarding?.checklist?.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 size={14} style={{ color: item.completed ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                                    <span style={{ color: item.completed ? 'var(--color-text-primary)' : 'var(--color-text-muted)', textDecoration: item.completed ? 'line-through' : 'none' }}>
                                        {item.item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bank Details */}
                    <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase size={18} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Bank Details</h2>
                        </div>
                        {[
                            ['Bank', employee.bankDetails?.bankName || '—'],
                            ['Account', employee.bankDetails?.accountNumber ? '••••' + employee.bankDetails.accountNumber.slice(-4) : '—'],
                            ['IFSC', employee.bankDetails?.ifscCode || '—'],
                            ['PAN', employee.bankDetails?.panNumber ? '••••' + employee.bankDetails.panNumber.slice(-4) : '—'],
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex justify-between py-1.5">
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Salary Modal */}
            {isSalaryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-md rounded-xl border p-6 shadow-xl" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {salary ? 'Edit Salary Structure' : 'Add Salary Structure'}
                            </h2>
                            <button onClick={() => setIsSalaryModalOpen(false)} className="p-1 rounded-md hover:bg-gray-100 cursor-pointer">
                                <X size={20} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSalary} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Basic (₹) *</label>
                                    <input type="number" required min="0" value={salaryForm.basic}
                                        onChange={(e) => setSalaryForm({ ...salaryForm, basic: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>HRA (₹) *</label>
                                    <input type="number" required min="0" value={salaryForm.hra}
                                        onChange={(e) => setSalaryForm({ ...salaryForm, hra: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>DA (₹)</label>
                                    <input type="number" min="0" value={salaryForm.da}
                                        onChange={(e) => setSalaryForm({ ...salaryForm, da: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Special Allowance (₹)</label>
                                    <input type="number" min="0" value={salaryForm.specialAllowance}
                                        onChange={(e) => setSalaryForm({ ...salaryForm, specialAllowance: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Effective From *</label>
                                <input type="date" required value={salaryForm.effectiveFrom}
                                    onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="submit" disabled={isCreatingSalary || isUpdatingSalary}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {(isCreatingSalary || isUpdatingSalary) ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                                    Save Salary
                                </button>
                                <button type="button" onClick={() => setIsSalaryModalOpen(false)}
                                    className="px-4 py-2.5 text-sm font-medium rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
