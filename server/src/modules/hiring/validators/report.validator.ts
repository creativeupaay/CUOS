import { z } from 'zod';

export const hiringReportSummarySchema = z.object({
    query: z.object({
        lastDays: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .refine((value) => value >= 1 && value <= 365, 'lastDays must be between 1 and 365')
            .optional(),
    }),
});

export type HiringReportSummaryInput = z.infer<typeof hiringReportSummarySchema>['query'];
