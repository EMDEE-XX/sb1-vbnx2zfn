import express from 'express';
const router = express.Router();
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markMessageAsRead,
  deleteMessage
} from '../controllers/message.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Get conversations
router.get('/conversations', authMiddleware, getConversations);

// Get conversation messages
router.get('/conversations/:id', authMiddleware, getConversationMessages);

// Send message
router.post('/send', authMiddleware, sendMessage);

// Mark message as read
router.put('/:id/read', authMiddleware, markMessageAsRead);

// Delete message
router.delete('/:id', authMiddleware, deleteMessage);

export default router;