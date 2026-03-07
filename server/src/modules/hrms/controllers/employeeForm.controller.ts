import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { employeeService } from '../services/employee.service';

// ── Get Form Info (public) ───────────────────────────────────────────
// Returns minimal employee info needed to render the form + form status.
export const getFormInfo = asyncHandler(async (req: Request, res: Response) => {
    const employee = await employeeService.getEmployeeByFormToken(req.params.token);

    res.json({
        status: 'success',
        data: {
            employeeId: employee.employeeId,
            name: (employee.userId as any)?.name,
            designation: employee.designation,
            department: employee.department,
            formSubmitted: employee.formSubmitted,
        },
    });
});

// ── Submit Onboarding Form (public) ──────────────────────────────────
export const submitForm = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const employee = await employeeService.submitOnboardingForm(
        req.params.token,
        req.body,
        {
            profilePhoto: files?.profilePhoto?.[0],
            identityDocument: files?.identityDocument?.[0],
        }
    );

    res.json({
        status: 'success',
        message: 'Form submitted successfully. Thank you!',
        data: {
            employeeId: employee.employeeId,
            formSubmitted: employee.formSubmitted,
        },
    });
});
