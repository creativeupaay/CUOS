import { Request, Response, NextFunction } from 'express';
import noteService from '../services/note.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

// GET /projects/:projectId/notes
export const getNotes = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const notes = await noteService.getNotes(req.params.projectId);
        res.status(200).json({
            success: true,
            message: 'Notes retrieved successfully',
            data: notes,
        });
    }
);

// POST /projects/:projectId/notes
export const createNote = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const userId = req.user?.id!;
        const note = await noteService.createNote({
            ...req.body,
            projectId: req.params.projectId,
            createdBy: userId,
        });
        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: note,
        });
    }
);

// PATCH /projects/:projectId/notes/:noteId
export const updateNote = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role as string;
        const note = await noteService.updateNote(
            req.params.noteId,
            userId,
            userRole,
            req.body
        );
        res.status(200).json({
            success: true,
            message: 'Note updated successfully',
            data: note,
        });
    }
);

// DELETE /projects/:projectId/notes/:noteId
export const deleteNote = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role as string;
        await noteService.deleteNote(req.params.noteId, userId, userRole);
        res.status(200).json({
            success: true,
            message: 'Note deleted successfully',
        });
    }
);

// POST /projects/:projectId/notes/upload-image
export const uploadNoteImage = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            return next(new AppError('No image file provided', 400));
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return next(new AppError('Only JPEG, PNG, GIF, and WebP images are allowed', 400));
        }

        const result = await noteService.uploadImage(
            req.params.projectId,
            req.file.buffer,
            req.file.originalname
        );

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            data: result,
        });
    }
);
