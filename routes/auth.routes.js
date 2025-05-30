import express from 'express';
const router = express.Router();
import { register, login, getCurrentUser, updatePassword, logout } from '../controllers/auth.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Register a new user
router.post('/register', register);

// Login user
router.post('/login', login);

// Get current user
router.get('/me', authMiddleware, getCurrentUser);

// Update password
router.put('/password', authMiddleware, updatePassword);

// Logout
router.post('/logout', authMiddleware, logout);

export default router;