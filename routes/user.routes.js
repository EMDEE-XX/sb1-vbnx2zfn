import express from 'express';
const router = express.Router();
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  searchUsers
} from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Get user profile
router.get('/profile/:id', authMiddleware, getUserProfile);

// Update user profile
router.put('/profile', authMiddleware, updateUserProfile);

// Upload profile picture
router.post('/profile-picture', authMiddleware, uploadProfilePicture);

// Follow user
router.post('/follow/:id', authMiddleware, followUser);

// Unfollow user
router.post('/unfollow/:id', authMiddleware, unfollowUser);

// Get user followers
router.get('/followers/:id', authMiddleware, getUserFollowers);

// Get user following
router.get('/following/:id', authMiddleware, getUserFollowing);

// Search users
router.get('/search', authMiddleware, searchUsers);

export default router;