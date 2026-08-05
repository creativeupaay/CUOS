import { SalaryStructure, ISalaryStructure } from '../models/SalaryStructure.model';
import { CreateSalaryInput, UpdateSalaryInput } from '../validators/salary.validator';
import AppError from '../../../utils/appError';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';

class SalaryService {
    async createSalaryStructure(data: CreateSalaryInput, createdBy: string): Promise<ISalaryStructure> {
        // Check if employee already has a salary structure
        const existing = await SalaryStructure.findOne({ employeeId: data.employeeId });
        if (existing) {
            throw new AppError('Salary structure already exists for this employee. Use update instead.', 400);
        }

        const salary = await SalaryStructure.create({
            ...data,
            hra: 0,
            da: 0,
            payoutAccountKey: data.payoutAccountKey || 'hdfc_gst',
            salaryType: data.salaryType || 'yearly',
            compensationType: data.compensationType || 'salary',
            annualAmount: data.annualAmount || 0,
            monthlySchedule: data.monthlySchedule || [],
            additionalCompensations: data.additionalCompensations?.map(c => ({ ...c, redeemableOn: new Date(c.redeemableOn) })) || [],
            isDraft: data.isDraft || false,
        });

        return salary;
    }

    async getSalaryByEmployeeId(employeeId: string): Promise<ISalaryStructure | null> {
        return SalaryStructure.findOne({ employeeId })
            .populate('employeeId');
    }

    async getSalaryById(id: string): Promise<ISalaryStructure> {
        const salary = await SalaryStructure.findById(id)
            .populate('employeeId');

        if (!salary) {
            throw new AppError('Salary structure not found', 404);
        }

        return salary;
    }

    async getAllSalaries(filters: { page?: number; limit?: number }) {
        const { page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const [salaries, total] = await Promise.all([
            SalaryStructure.find()
                .populate({
                    path: 'employeeId',
                    populate: { path: 'userId', select: 'name email' },
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            SalaryStructure.countDocuments(),
        ]);

        return {
            salaries,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async updateSalaryStructure(
        id: string,
        data: UpdateSalaryInput,
        revisedBy: string
    ): Promise<ISalaryStructure> {
        const salary = await SalaryStructure.findById(id);
        if (!salary) {
            throw new AppError('Salary structure not found', 404);
        }

        // Push current values to revision history before updating
        if (!salary.isDraft) {
            salary.revisionHistory.push({
                basic: salary.basic,
                payoutAccountKey: salary.payoutAccountKey,
                hra: salary.hra,
                da: salary.da,
                hourlyRate: salary.hourlyRate,
                specialAllowance: salary.specialAllowance,
                effectiveFrom: salary.effectiveFrom,
                revisedBy: revisedBy as any,
            });
        }

        // Apply updates
        if (data.basic !== undefined) salary.basic = data.basic;
        if (data.specialAllowance !== undefined) salary.specialAllowance = data.specialAllowance;
        if (data.payoutAccountKey !== undefined) salary.payoutAccountKey = data.payoutAccountKey;
        if (data.salaryType !== undefined) salary.salaryType = data.salaryType;
        if (data.compensationType !== undefined) salary.compensationType = data.compensationType;
        if (data.annualAmount !== undefined) salary.annualAmount = data.annualAmount;
        if (data.isDraft !== undefined) salary.isDraft = data.isDraft;
        if (data.monthlySchedule !== undefined) salary.monthlySchedule = data.monthlySchedule;
        if (data.additionalCompensations !== undefined) {
            salary.additionalCompensations = data.additionalCompensations.map(c => ({
                ...c,
                redeemableOn: new Date(c.redeemableOn)
            })) as any;
        }
        if (data.firstSalaryDate) salary.firstSalaryDate = new Date(data.firstSalaryDate);
        if (data.hra !== undefined) salary.hra = 0;
        if (data.da !== undefined) salary.da = 0;
        if (data.deductions) {
            salary.deductions = { ...JSON.parse(JSON.stringify(salary.deductions)), ...data.deductions } as any;
        }
        if (data.effectiveFrom) salary.effectiveFrom = new Date(data.effectiveFrom);

        salary.hra = 0;
        salary.da = 0;

        await salary.save();
        return salary;
    }

    async deleteSalaryStructure(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const salary = await SalaryStructure.findById(id);
        if (!salary) {
            throw new AppError('Salary structure not found', 404);
        }

        await DeletedRecordService.archiveDocument(salary, {
            archiveBatchId: options.archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Salary structure delete requested',
            operation: 'delete',
            session: options.session,
            metadata: {
                ...options.metadata,
                salaryStructureId: salary._id.toString(),
                employeeId: salary.employeeId.toString(),
            },
        });

        await salary.deleteOne(options.session ? { session: options.session } : undefined);
    }
}

export const salaryService = new SalaryService();
