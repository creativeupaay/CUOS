import { Attendance } from '../models/Attendance.model';
import { Employee } from '../models/Employee.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';

export class AttendanceService {
    static async checkIn(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already checked in today
        const existingAttendance = await Attendance.findOne({
            employeeId: employee._id,
            date: today,
        });

        if (existingAttendance) {
            throw new AppError('Already checked in today', 400);
        }

        const attendance = await Attendance.create({
            employeeId: employee._id,
            date: today,
            checkIn: new Date(),
            status: 'present',
            ...data,
        });

        return attendance;
    }

    static async checkOut(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({
            employeeId: employee._id,
            date: today,
        });

        if (!attendance) {
            throw new AppError('No check-in record found for today', 400);
        }
        if (attendance.checkOut) {
            throw new AppError('Already checked out today', 400);
        }

        const checkOutTime = new Date();
        const checkInTime = attendance.checkIn || checkOutTime;

        // Calculate total hours
        const diffInMs = checkOutTime.getTime() - checkInTime.getTime();
        const totalHours = diffInMs / (1000 * 60 * 60);

        attendance.checkOut = checkOutTime;
        attendance.totalHours = Number(totalHours.toFixed(2));
        if (data.notes) {
            attendance.notes = attendance.notes ? `${attendance.notes}\n${data.notes}` : data.notes;
        }

        await attendance.save();
        return attendance;
    }

    static async getMyAttendance(userId: string, startDate?: string, endDate?: string) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const query: any = { employeeId: employee._id };
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        return Attendance.find(query).sort({ date: -1 });
    }

    static async getEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string) {
        const query: any = { employeeId: new Types.ObjectId(employeeId) };
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        return Attendance.find(query).sort({ date: -1 });
    }
}
