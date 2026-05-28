import { Announcement, IAnnouncement } from '../models/Announcement.model';
import AppError from '../../../utils/appError';
import { notificationService } from '../../notification/services/notification.service';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';

class AnnouncementService {
    async createAnnouncement(
        data: { content: string },
        publishedBy: string
    ): Promise<IAnnouncement> {
        const content = String(data.content || '').trim();
        if (!content) {
            throw new AppError('Announcement content is required', 400);
        }

        const announcement = await Announcement.create({
            content,
            publishedBy,
        });

        await announcement.populate('publishedBy', 'name email');

        await notificationService.notifyInternalUsers({
            type: 'company_announcement',
            title: 'New Company Announcement',
            message:
                content.length > 140 ? `${content.slice(0, 137)}...` : content,
            link: '/announcements',
            metadata: {
                announcementId: announcement._id.toString(),
            },
        });

        return announcement;
    }

    async getAnnouncements(): Promise<IAnnouncement[]> {
        return Announcement.find()
            .populate('publishedBy', 'name email')
            .sort({ createdAt: -1 });
    }

    async deleteAnnouncement(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const announcement = await Announcement.findById(id);
        if (!announcement) {
            throw new AppError('Announcement not found', 404);
        }

        await DeletedRecordService.archiveDocument(announcement, {
            archiveBatchId: options.archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Announcement delete requested',
            operation: 'delete',
            session: options.session,
            metadata: {
                ...options.metadata,
                announcementId: announcement._id.toString(),
            },
        });

        await announcement.deleteOne(options.session ? { session: options.session } : undefined);
    }
}

export const announcementService = new AnnouncementService();
