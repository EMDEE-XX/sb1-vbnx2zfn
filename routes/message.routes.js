const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Get conversations
router.get('/conversations', authMiddleware, messageController.getConversations);

// Get conversation messages
router.get('/conversations/:id', authMiddleware, messageController.getConversationMessages);

// Send message
router.post('/send', authMiddleware, messageController.sendMessage);

// Mark message as read
router.put('/:id/read', authMiddleware, messageController.markMessageAsRead);

// Delete message
router.delete('/:id', authMiddleware, messageController.deleteMessage);

module.exports = router;