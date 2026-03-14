import path from 'path';
import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';
import {
    sendHiringApplicationReceivedEmail,
    sendHiringOfferEmail,
    sendHiringRejectionEmail,
} from '../../../services/email.service';
import { Application, IApplication } from '../models/Application.model';
import { Offer, IOffer } from '../models/Offer.model';
import type { ApplicationStatus } from '../models/Application.model';
import { Job } from '../models/Job.model';
import type {
    ApplicationDecisionInput,
    CreatePublicApplicationInput,
    ListApplicationsInput,
    UpdateApplicationInput,
} from '../validators/application.validator';

export class ApplicationService {
    async createPublicApplication(
        jobId: string,
        data: CreatePublicApplicationInput,
        resumeFile: Express.Multer.File
    ): Promise<IApplication> {
        const job = await Job.findById(jobId).select('title isHiring');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        if (!job.isHiring) {
            throw new AppError('This job is currently not accepting applications', 400);
        }

        const ext = path.extname(resumeFile.originalname) || '.pdf';
        const uploadResult = await uploadDocument(
            resumeFile.buffer,
            `hiring/jobs/${jobId}/applications`,
            `resume-${Date.now()}${ext}`,
            true
        );

        const application = await Application.create({
            jobId,
            ...data,
            resumeUrl: uploadResult.url,
            resumeCloudinaryId: uploadResult.cloudinaryId,
            status: 'new',
            tags: [],
        });

        await sendHiringApplicationReceivedEmail({
            to: data.email,
            candidateName: data.name,
            jobTitle: String((job as any).title || 'the role'),
        });

        return application;
    }

    async getApplications(filters: ListApplicationsInput): Promise<{
        applications: IApplication[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { jobId, status, tags, search, page = 1, limit = 50 } = filters;

        const query: any = {};
        if (jobId) query.jobId = jobId;
        if (status) query.status = status;
        if (tags) {
            const tagList = tags
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
            if (tagList.length > 0) query.tags = { $in: tagList };
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [applications, total] = await Promise.all([
            Application.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('jobId', 'title department location employmentType'),
            Application.countDocuments(query),
        ]);

        return {
            applications,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getApplicationById(id: string): Promise<IApplication> {
        const application = await Application.findById(id).populate(
            'jobId',
            'title department location employmentType isHiring'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }
        return application;
    }

    async updateApplication(id: string, data: UpdateApplicationInput): Promise<IApplication> {
        const payload: any = { ...data };
        if (payload.tags) {
            payload.tags = payload.tags
                .map((tag: string) => tag.trim().toLowerCase())
                .filter(Boolean);
        }

        const application = await Application.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        }).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        return application;
    }

    async updateStatus(id: string, status: ApplicationStatus): Promise<IApplication> {
        const application = await Application.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if (status === 'rejected') {
            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';
            await sendHiringRejectionEmail({
                to: application.email,
                candidateName: application.name,
                jobTitle: String(jobTitle),
            });
        }

        return application;
    }

    async addTag(id: string, tag: string): Promise<IApplication> {
        const application = await Application.findByIdAndUpdate(
            id,
            { $addToSet: { tags: tag.trim().toLowerCase() } },
            { new: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        return application;
    }

    async removeTag(id: string, tag: string): Promise<IApplication> {
        const application = await Application.findByIdAndUpdate(
            id,
            { $pull: { tags: tag.trim().toLowerCase() } },
            { new: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        return application;
    }

    async makeFinalDecision(
        id: string,
        data: ApplicationDecisionInput,
        offerLetterFile?: Express.Multer.File
    ): Promise<{ application: IApplication; offer: IOffer | null }> {
        const application = await Application.findById(id).populate(
            'jobId',
            'title department location employmentType'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if (data.decision === 'rejected') {
            application.status = 'rejected';
            await application.save();

            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';

            await sendHiringRejectionEmail({
                to: application.email,
                candidateName: application.name,
                jobTitle: String(jobTitle),
            });

            return {
                application,
                offer: null,
            };
        }

        const salary = String(data.salary || '').trim();
        const position = String(data.position || '').trim();

        if (!salary) {
            throw new AppError('Salary is required for accepted decision', 400);
        }
        if (!position) {
            throw new AppError('Position is required for accepted decision', 400);
        }
        if (!offerLetterFile) {
            throw new AppError('Offer letter PDF is required for accepted decision', 400);
        }

        if (offerLetterFile.mimetype !== 'application/pdf') {
            throw new AppError('Offer letter must be a PDF file', 400);
        }

        const offerUpload = await uploadDocument(
            offerLetterFile.buffer,
            `hiring/offers/${application._id}`,
            `offer-letter-${Date.now()}.pdf`,
            true
        );

        const offer = await Offer.findOneAndUpdate(
            { applicationId: application._id },
            {
                applicationId: application._id,
                salary,
                position,
                offerLetterUrl: offerUpload.url,
                offerLetterCloudinaryId: offerUpload.cloudinaryId,
                status: 'sent',
            },
            { upsert: true, new: true, runValidators: true }
        );

        application.status = 'offered';
        await application.save();

        await sendHiringOfferEmail({
            to: application.email,
            candidateName: application.name,
            position,
            salary,
            offerLetterUrl: offer.offerLetterUrl,
        });

        return {
            application,
            offer,
        };
    }
}
