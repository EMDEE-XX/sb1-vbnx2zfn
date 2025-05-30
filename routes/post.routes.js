import express from 'express';
const router = express.Router();
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostLikes,
  commentOnPost,
  getPostComments,
  searchPosts
} from '../controllers/post.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

// Create post
router.post('/', authMiddleware, createPost);

// Get all posts (feed)
router.get('/', authMiddleware, getFeed);

// Get post by id
router.get('/:id', authMiddleware, getPostById);

// Update post
router.put('/:id', authMiddleware, updatePost);

// Delete post
router.delete('/:id', authMiddleware, deletePost);

// Like post
router.post('/:id/like', authMiddleware, likePost);

// Unlike post
router.post('/:id/unlike', authMiddleware, unlikePost);

// Get post likes
router.get('/:id/likes', authMiddleware, getPostLikes);

// Comment on post
router.post('/:id/comment', authMiddleware, commentOnPost);

// Get post comments
router.get('/:id/comments', authMiddleware, getPostComments);

// Search posts
router.get('/search/query', authMiddleware, searchPosts);

export default router;