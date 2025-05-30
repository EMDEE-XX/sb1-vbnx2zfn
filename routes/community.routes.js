import express from 'express';
const router = express.Router();
import { 
  createCommunity,
  getAllCommunities,
  getCommunityById,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  getCommunityPosts,
  searchCommunities
} from '../controllers/community.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Create community
router.post('/', authMiddleware, createCommunity);

// Get all communities
router.get('/', authMiddleware, getAllCommunities);

// Get community by id
router.get('/:id', authMiddleware, getCommunityById);

// Update community
router.put('/:id', authMiddleware, updateCommunity);

// Delete community
router.delete('/:id', authMiddleware, deleteCommunity);

// Join community
router.post('/:id/join', authMiddleware, joinCommunity);

// Leave community
router.post('/:id/leave', authMiddleware, leaveCommunity);

// Get community members
router.get('/:id/members', authMiddleware, getCommunityMembers);

// Get community posts
router.get('/:id/posts', authMiddleware, getCommunityPosts);

// Search communities
router.get('/search/query', authMiddleware, searchCommunities);

export default router;