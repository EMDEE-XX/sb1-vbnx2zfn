const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Get all notifications
router.get('/', authMiddleware, notificationController.getNotifications);

// Mark notification as read
router.put('/:id/read', authMiddleware, notificationController.markNotificationAsRead);

// Mark all notifications as read
router.put('/read-all', authMiddleware, notificationController.markAllNotificationsAsRead);

// Delete notification
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

module.exports = router;