const express = require('express');
const router = express.Router();
const communityController = require('../controllers/community.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Create community
router.post('/', authMiddleware, communityController.createCommunity);

// Get all communities
router.get('/', authMiddleware, communityController.getAllCommunities);

// Get community by id
router.get('/:id', authMiddleware, communityController.getCommunityById);

// Update community
router.put('/:id', authMiddleware, communityController.updateCommunity);

// Delete community
router.delete('/:id', authMiddleware, communityController.deleteCommunity);

// Join community
router.post('/:id/join', authMiddleware, communityController.joinCommunity);

// Leave community
router.post('/:id/leave', authMiddleware, communityController.leaveCommunity);

// Get community members
router.get('/:id/members', authMiddleware, communityController.getCommunityMembers);

// Get community posts
router.get('/:id/posts', authMiddleware, communityController.getCommunityPosts);

// Search communities
router.get('/search/query', authMiddleware, communityController.searchCommunities);

module.exports = router;