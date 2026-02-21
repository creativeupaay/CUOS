import { SalaryStructure, ISalaryStructure } from '../models/SalaryStructure.model';
import { CreateSalaryInput, UpdateSalaryInput } from '../validators/salary.validator';
import AppError from '../../../utils/appError';

class SalaryService {
    async createSalaryStructure(data: CreateSalaryInput, createdBy: string): Promise<ISalaryStructure> {
        // Check if employee already has a salary structure
        const existing = await SalaryStructure.findOne({ employeeId: data.employeeId });
        if (existing) {
            throw new AppError('Salary structure already exists for this employee. Use update instead.', 400);
        }

        const salary = await SalaryStructure.create({
            ...data,
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
        salary.revisionHistory.push({
            basic: salary.basic,
            hra: salary.hra,
            da: salary.da,
            hourlyRate: salary.hourlyRate,
            specialAllowance: salary.specialAllowance,
            effectiveFrom: salary.effectiveFrom,
            revisedBy: revisedBy as any,
        });

        // Apply updates
        if (data.basic !== undefined) salary.basic = data.basic;
        if (data.hra !== undefined) salary.hra = data.hra;
        if (data.da !== undefined) salary.da = data.da;
        if (data.specialAllowance !== undefined) salary.specialAllowance = data.specialAllowance;
        if (data.deductions) {
            salary.deductions = { ...JSON.parse(JSON.stringify(salary.deductions)), ...data.deductions } as any;
        }
        if (data.effectiveFrom) salary.effectiveFrom = new Date(data.effectiveFrom);

        await salary.save();
        return salary;
    }

    async deleteSalaryStructure(id: string): Promise<void> {
        const salary = await SalaryStructure.findByIdAndDelete(id);
        if (!salary) {
            throw new AppError('Salary structure not found', 404);
        }
    }
}

export const salaryService = new SalaryService();
