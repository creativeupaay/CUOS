import { Employee } from '../models/Employee.model';

/**
 * Automatically generates the next Employee ID based on the joining date.
 * Format: EID{YYYY}{Group}{Count}
 * - YYYY: Year of joining, e.g., 2025
 * - Group: Starts at 04, increments every 99 employees
 * - Count: Loops from 01 to 99
 */
export async function generateNextEmployeeId(joiningDate: Date): Promise<string> {
    const d = new Date(joiningDate);
    const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const pattern = new RegExp(`^EID${year}\\d{4}$`);
    
    // Find the latest mathematically highest employee ID for this year
    const latestEmp = await Employee.findOne({ employeeId: pattern })
        .sort({ employeeId: -1 })
        .select('employeeId')
        .lean();

    let nextIndex = 0;
    if (latestEmp && latestEmp.employeeId) {
        const idStr = latestEmp.employeeId; // e.g., EID20250499
        const groupStr = idStr.substring(7, 9);
        const countStr = idStr.substring(9, 11);
        
        const group = parseInt(groupStr, 10);
        const count = parseInt(countStr, 10);
        
        if (!isNaN(group) && !isNaN(count)) {
            // Reconstruct abstract 0-based index from the group and count
            nextIndex = ((group - 4) * 99) + (count - 1) + 1;
        }
    }
    
    const nextCount = (nextIndex % 99) + 1; // 1 to 99
    const nextGroup = 4 + Math.floor(nextIndex / 99); // 4, 5, 6...
    
    return `EID${year}${nextGroup.toString().padStart(2, '0')}${nextCount.toString().padStart(2, '0')}`;
}
