import { useParams, useNavigate } from 'react-router-dom';
import { useGetEmployeeQuery, useGetSalaryByEmployeeQuery } from '@/features/hrms/hrmsApi';
import { ArrowLeft, Edit, User, Briefcase, DollarSign, Shield, CheckCircle2 } from 'lucide-react';

export default function HrmsEmployeeDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading } = useGetEmployeeQuery(id!);
    const { data: salaryData } = useGetSalaryByEmployeeQuery(id!);

    const employee = data?.data?.employee;
    const salary = salaryData?.data?.salary;

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
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Salary Structure</h2>
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
        </div>
    );
}
