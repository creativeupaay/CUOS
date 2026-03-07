import { Router } from 'express';
import multer from 'multer';
import * as employeeFormController from '../controllers/employeeForm.controller';

// Memory storage — buffers passed straight to Cloudinary / local disk
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, WEBP images and PDF documents are allowed'));
        }
    },
});

const router = Router();

// Public routes — NO authentication middleware

/**
 * GET /employee-form/:token
 * Returns form status + employee basic info for the public form page.
 */
router.get('/:token', employeeFormController.getFormInfo);

/**
 * POST /employee-form/:token/submit
 * Accepts multipart/form-data with optional profilePhoto and identityDocument file fields.
 */
router.post(
    '/:token/submit',
    upload.fields([
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'identityDocument', maxCount: 1 },
    ]),
    employeeFormController.submitForm
);

export default router;
