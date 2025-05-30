import express from 'express';
const router = express.Router();
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../controllers/notification.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Get all notifications
router.get('/', authMiddleware, getNotifications);

// Mark notification as read
router.put('/:id/read', authMiddleware, markNotificationAsRead);

// Mark all notifications as read
router.put('/read-all', authMiddleware, markAllNotificationsAsRead);

// Delete notification
router.delete('/:id', authMiddleware, deleteNotification);

export default router;