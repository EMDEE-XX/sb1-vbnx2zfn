const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Get user profile
router.get('/profile/:id', authMiddleware, userController.getUserProfile);

// Update user profile
router.put('/profile', authMiddleware, userController.updateUserProfile);

// Upload profile picture
router.post('/profile-picture', authMiddleware, userController.uploadProfilePicture);

// Follow user
router.post('/follow/:id', authMiddleware, userController.followUser);

// Unfollow user
router.post('/unfollow/:id', authMiddleware, userController.unfollowUser);

// Get user followers
router.get('/followers/:id', authMiddleware, userController.getUserFollowers);

// Get user following
router.get('/following/:id', authMiddleware, userController.getUserFollowing);

// Search users
router.get('/search', authMiddleware, userController.searchUsers);

module.exports = router;