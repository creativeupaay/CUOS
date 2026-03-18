import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { JobTemplate } from '../models/JobTemplate.model';
import { CreateJobTemplateInput, UpdateJobTemplateInput } from '../validators/job.validator';

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateJobTemplateInput;

    const template = await JobTemplate.create({
        ...input,
        createdBy: (req.user as any)?.id,
    });

    res.status(201).json({
        status: 'success',
        data: { template },
    });
});

export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const templates = await JobTemplate.find()
        .sort('-createdAt')
        .populate('createdBy', 'name email');

    res.status(200).json({
        status: 'success',
        results: templates.length,
        data: { templates },
    });
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await JobTemplate.findById(req.params.id)
        .populate('createdBy', 'name email');

    if (!template) {
        throw new AppError('Template not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { template },
    });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdateJobTemplateInput;

    const template = await JobTemplate.findByIdAndUpdate(
        req.params.id,
        { $set: input },
        { new: true, runValidators: true }
    );

    if (!template) {
        throw new AppError('Template not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { template },
    });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = await JobTemplate.findByIdAndDelete(req.params.id);

    if (!template) {
        throw new AppError('Template not found', 404);
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
});
