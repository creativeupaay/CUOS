import { useState, useEffect } from 'react';
import { X, DollarSign, Plus, Trash, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { 
    Employee, 
    SalaryStructure, 
    SalaryPayoutAccountKey,
    MonthlyEntry,
    AdditionalCompensation
} from '../../../../features/hrms/types/types';
import type { CreateSalaryRequest } from '../../../../features/hrms/types/apiTypes';

interface AddSalaryStructureModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee;
    existingSalary?: SalaryStructure | null;
    onSave: (data: Partial<CreateSalaryRequest> & { isDraft: boolean }, isDraft: boolean) => Promise<void>;
    isSaving: boolean;
}

const PAYOUT_ACCOUNT_OPTIONS = [
    { label: 'HDFC (GST)', value: 'hdfc_gst' },
    { label: 'SBI (Non-GST)', value: 'sbi_non_gst' },
    { label: 'Cash', value: 'cash' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getFinancialYear = (date: Date) => {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();
    if (month < 3) { // Jan-Mar belong to previous year's FY
        return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
};

const ensureFYMonths = (fy: string, currentSchedule: MonthlyEntry[]) => {
    const [startYearStr, endYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr);
    const endYear = parseInt(endYearStr);

    const expectedMonths = [
        { month: 4, year: startYear },
        { month: 5, year: startYear },
        { month: 6, year: startYear },
        { month: 7, year: startYear },
        { month: 8, year: startYear },
        { month: 9, year: startYear },
        { month: 10, year: startYear },
        { month: 11, year: startYear },
        { month: 12, year: startYear },
        { month: 1, year: endYear },
        { month: 2, year: endYear },
        { month: 3, year: endYear }
    ];

    const newSchedule = [...currentSchedule];

    expectedMonths.forEach(em => {
        const exists = newSchedule.find(s => s.month === em.month && s.year === em.year);
        if (!exists) {
            const pd = new Date(Date.UTC(em.year, em.month, 1));
            newSchedule.push({
                month: em.month,
                year: em.year,
                amount: 0,
                paymentDate: pd.toISOString().split('T')[0]
            });
        }
    });

    // Sort chronologically
    newSchedule.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    return newSchedule;
};

export default function AddSalaryStructureModal({
    isOpen,
    onClose,
    employee,
    existingSalary,
    onSave,
    isSaving
}: AddSalaryStructureModalProps) {
    const [tab, setTab] = useState<'yearly' | 'monthly'>('yearly');
    
    // Common
    const [compensationType, setCompensationType] = useState<'salary' | 'stipend' | 'contract'>('salary');
    const [payoutAccountKey, setPayoutAccountKey] = useState<SalaryPayoutAccountKey>('hdfc_gst');
    
    // Yearly
    const [annualAmount, setAnnualAmount] = useState<number>(0);
    const [effectiveFrom, setEffectiveFrom] = useState<string>('');
    const [firstSalaryDate, setFirstSalaryDate] = useState<string>('');
    
    // Monthly
    const [monthlySchedule, setMonthlySchedule] = useState<MonthlyEntry[]>([]);
    const [selectedFY, setSelectedFY] = useState<string>('');
    
    // Additional Compensation
    const [additionalCompensations, setAdditionalCompensations] = useState<AdditionalCompensation[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        if (existingSalary) {
            setTab(existingSalary.salaryType || 'yearly');
            setCompensationType(existingSalary.compensationType || 'salary');
            setPayoutAccountKey(existingSalary.payoutAccountKey || 'hdfc_gst');
            setAnnualAmount(existingSalary.annualAmount || 0);
            setEffectiveFrom(existingSalary.effectiveFrom ? existingSalary.effectiveFrom.split('T')[0] : '');
            setFirstSalaryDate(existingSalary.firstSalaryDate ? existingSalary.firstSalaryDate.split('T')[0] : '');
            
            const schedule = existingSalary.monthlySchedule || [];
            
            const fyDate = existingSalary.effectiveFrom ? new Date(existingSalary.effectiveFrom) : new Date();
            const fy = getFinancialYear(fyDate);
            setSelectedFY(fy);
            
            setMonthlySchedule(ensureFYMonths(fy, schedule));
            setAdditionalCompensations(existingSalary.additionalCompensations || []);
        } else {
            // Defaults
            setTab('yearly');
            setCompensationType('salary');
            setPayoutAccountKey('hdfc_gst');
            setAnnualAmount(0);
            
            const today = new Date();
            const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            setEffectiveFrom(todayUtc.toISOString().split('T')[0]);
            
            let firstPaidDate = new Date();
            if (employee.probationEndDate) {
                firstPaidDate = new Date(employee.probationEndDate);
            }
            const firstPaidYear = firstPaidDate.getFullYear();
            const firstPaidMonth = firstPaidDate.getMonth();
            const firstSalaryDateUtc = new Date(Date.UTC(firstPaidYear, firstPaidMonth + 1, 1));
            setFirstSalaryDate(firstSalaryDateUtc.toISOString().split('T')[0]);

            const currentFY = getFinancialYear(today);
            setSelectedFY(currentFY);
            setMonthlySchedule(ensureFYMonths(currentFY, []));
            setAdditionalCompensations([]);
        }
    }, [isOpen, existingSalary, employee]);

    if (!isOpen) return null;

    const handleSave = (isDraft: boolean) => {
        const data = {
            salaryType: tab,
            compensationType,
            payoutAccountKey,
            annualAmount: tab === 'yearly' ? annualAmount : 0,
            effectiveFrom: tab === 'yearly' ? effectiveFrom : undefined,
            firstSalaryDate: tab === 'yearly' ? firstSalaryDate : undefined,
            monthlySchedule: tab === 'monthly' ? monthlySchedule : [],
            additionalCompensations,
            isDraft,
            basic: 0,
            specialAllowance: 0
        };
        onSave(data, isDraft);
    };

    const addBonus = () => {
        const today = new Date();
        const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        setAdditionalCompensations([...additionalCompensations, {
            name: '',
            amount: 0,
            redeemableOn: todayUtc.toISOString().split('T')[0],
            isVariable: true
        }]);
    };

    const updateBonus = (index: number, field: keyof AdditionalCompensation, value: string | number | boolean) => {
        const newComps = [...additionalCompensations];
        newComps[index] = { ...newComps[index], [field]: value };
        setAdditionalCompensations(newComps);
    };

    const removeBonus = (index: number) => {
        setAdditionalCompensations(additionalCompensations.filter((_, i) => i !== index));
    };

    const updateMonthly = (month: number, year: number, field: keyof MonthlyEntry, value: string | number) => {
        const newSched = [...monthlySchedule];
        const index = newSched.findIndex(e => e.month === month && e.year === year);
        if (index > -1) {
            newSched[index] = { ...newSched[index], [field]: value };
            setMonthlySchedule(newSched);
        }
    };

    const getIsBeforeJoining = (month: number, year: number) => {
        if (!employee?.joiningDate) return false;
        const jd = new Date(employee.joiningDate);
        const joinYear = jd.getFullYear();
        const joinMonth = jd.getMonth() + 1; // 1-12
        if (year < joinYear) return true;
        if (year === joinYear && month < joinMonth) return true;
        return false;
    };

    // Calculate Summary and Display
    const getMonthsForFY = (fy: string) => {
        if (!fy) return [];
        const [startYearStr, endYearStr] = fy.split('-');
        const startYear = parseInt(startYearStr);
        const endYear = parseInt(endYearStr);

        return monthlySchedule.filter(entry => 
            (entry.year === startYear && entry.month >= 4) || 
            (entry.year === endYear && entry.month <= 3)
        );
    };

    const displayedMonths = getMonthsForFY(selectedFY);

    const fixedTotal = tab === 'yearly' 
        ? annualAmount 
        : displayedMonths.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const getVariableForFY = (fy: string) => {
        if (!fy) return [];
        const [startYearStr, endYearStr] = fy.split('-');
        const startYear = parseInt(startYearStr);
        const endYear = parseInt(endYearStr);
        const fyStartDate = new Date(Date.UTC(startYear, 3, 1)); // Apr 1
        const fyEndDate = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)); // Mar 31

        return additionalCompensations.filter(comp => {
            if (!comp.redeemableOn) return false;
            const rd = new Date(comp.redeemableOn);
            return rd >= fyStartDate && rd <= fyEndDate;
        });
    };

    const variableTotal = getVariableForFY(selectedFY).reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const ctcTotal = fixedTotal + variableTotal;

    // FY Dropdown Options
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth();
    const baseYear = currentMonthIndex < 3 ? currentYear - 1 : currentYear;
    const fyOptions = [
        `${baseYear - 1}-${baseYear}`,
        `${baseYear}-${baseYear + 1}`,
        `${baseYear + 1}-${baseYear + 2}`,
        `${baseYear + 2}-${baseYear + 3}`
    ];

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-xl flex flex-col md:flex-row overflow-hidden my-8"
                 style={{ maxHeight: 'calc(100vh - 4rem)' }}>
                
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-y-auto border-r border-gray-200">
                    <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {existingSalary ? 'Edit Salary Structure' : 'Add Salary Structure'}
                        </h2>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Common Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Compensation Type</label>
                                <select 
                                    value={compensationType}
                                    onChange={(e) => setCompensationType(e.target.value as 'salary' | 'stipend' | 'contract')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                >
                                    <option value="salary">Salary</option>
                                    <option value="stipend">Stipend</option>
                                    <option value="contract">On Contract</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payout Account</label>
                                <select 
                                    value={payoutAccountKey}
                                    onChange={(e) => setPayoutAccountKey(e.target.value as SalaryPayoutAccountKey)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                >
                                    {PAYOUT_ACCOUNT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200">
                            <button
                                type="button"
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'yearly' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                onClick={() => setTab('yearly')}
                            >
                                Fixed Yearly CTC
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'monthly' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                onClick={() => setTab('monthly')}
                            >
                                Monthly Basis
                            </button>
                        </div>

                        {/* Tab Content */}
                        {tab === 'yearly' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fixed Annual Amount (₹)</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={annualAmount}
                                        onChange={(e) => setAnnualAmount(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Effective From</label>
                                        <input 
                                            type="date" 
                                            value={effectiveFrom}
                                            onChange={(e) => setEffectiveFrom(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">First Salary Paid On</label>
                                        <input 
                                            type="date" 
                                            value={firstSalaryDate}
                                            onChange={(e) => setFirstSalaryDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Calculated after probation</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-gray-800">Monthly Schedule</h3>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-medium text-gray-600">Financial Year:</label>
                                        <select
                                            value={selectedFY}
                                            onChange={(e) => {
                                                const newFY = e.target.value;
                                                setSelectedFY(newFY);
                                                setMonthlySchedule(prev => ensureFYMonths(newFY, prev));
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
                                        >
                                            {fyOptions.map(opt => (
                                                <option key={opt} value={opt}>FY {opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3">Month</th>
                                                <th className="px-4 py-3">Amount (₹)</th>
                                                <th className="px-4 py-3">Payment Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayedMonths.map((entry) => {
                                                const rowKey = `${entry.year}-${entry.month}`;
                                                const isBeforeJoin = getIsBeforeJoining(entry.month, entry.year);
                                                return (
                                                    <tr key={rowKey} className={`border-t border-gray-200 ${isBeforeJoin ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                                                        <td className="px-4 py-2 font-medium text-gray-900">
                                                            {MONTHS[entry.month - 1]} {entry.year}
                                                            {isBeforeJoin && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Pre-Joining</span>}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                disabled={isBeforeJoin}
                                                                value={entry.amount}
                                                                onChange={(e) => updateMonthly(entry.month, entry.year, 'amount', Number(e.target.value))}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input 
                                                                type="date" 
                                                                disabled={isBeforeJoin}
                                                                value={entry.paymentDate}
                                                                onChange={(e) => updateMonthly(entry.month, entry.year, 'paymentDate', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <hr className="border-gray-200" />

                        {/* Additive Compensation */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-gray-800">Additive Compensation (Bonuses, etc.)</h3>
                                <button 
                                    type="button" 
                                    onClick={addBonus}
                                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1.5 rounded"
                                >
                                    <Plus size={14} /> Add Bonus
                                </button>
                            </div>
                            
                            {additionalCompensations.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No additional compensation added.</p>
                            ) : (
                                <div className="space-y-3">
                                    {additionalCompensations.map((comp, idx) => (
                                        <div key={idx} className="flex gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-600 mb-1">Name</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. Diwali Bonus"
                                                    value={comp.name}
                                                    onChange={(e) => updateBonus(idx, 'name', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="w-1/4">
                                                <label className="block text-xs text-gray-600 mb-1">Amount (₹)</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={comp.amount}
                                                    onChange={(e) => updateBonus(idx, 'amount', Number(e.target.value))}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="w-1/4">
                                                <label className="block text-xs text-gray-600 mb-1">Redeemable Date</label>
                                                <input 
                                                    type="date" 
                                                    value={comp.redeemableOn}
                                                    onChange={(e) => updateBonus(idx, 'redeemableOn', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeBonus(idx)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Summary */}
                <div className="w-full md:w-80 bg-gray-50 flex flex-col">
                    <div className="p-6 flex-1 border-b border-gray-200">
                        <div className="mb-6 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Compensation Summary</h3>
                            {tab === 'monthly' && selectedFY && (
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">FY {selectedFY}</span>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Fixed Total</span>
                                <span className="text-sm font-medium text-gray-900">₹{fixedTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Variable Total</span>
                                <span className="text-sm font-medium text-gray-900">₹{variableTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="pt-4 mt-4 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-900">Total CTC</span>
                                    <span className="text-lg font-bold text-green-600">₹{ctcTotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            {tab === 'monthly' && (
                                <p className="text-xs text-gray-500 mt-2 italic text-center">
                                    Values represent the selected financial year only.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-white flex flex-col gap-3">
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSave(true)}
                            className="w-full py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Save as Draft
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSave(false)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                            Save & Activate Salary
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    
    return null;
}
