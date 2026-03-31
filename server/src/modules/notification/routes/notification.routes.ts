import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/notifications - Get notifications with optional filters
router.get('/', notificationController.getNotifications);

// GET /api/v1/notifications/unread-count - Get unread count only
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /api/v1/notifications/read - Mark specific notifications as read
router.patch('/read', notificationController.markAsRead);

// PATCH /api/v1/notifications/read-all - Mark all as read
router.patch('/read-all', notificationController.markAllAsRead);

// DELETE /api/v1/notifications/clear-all - Clear all notifications
router.delete('/clear-all', notificationController.clearAllNotifications);

// DELETE /api/v1/notifications/:id - Delete single notification
router.delete('/:id', notificationController.deleteNotification);

export default router;
