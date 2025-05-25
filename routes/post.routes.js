const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Create post
router.post('/', authMiddleware, postController.createPost);

// Get all posts (feed)
router.get('/', authMiddleware, postController.getFeed);

// Get post by id
router.get('/:id', authMiddleware, postController.getPostById);

// Update post
router.put('/:id', authMiddleware, postController.updatePost);

// Delete post
router.delete('/:id', authMiddleware, postController.deletePost);

// Like post
router.post('/:id/like', authMiddleware, postController.likePost);

// Unlike post
router.post('/:id/unlike', authMiddleware, postController.unlikePost);

// Get post likes
router.get('/:id/likes', authMiddleware, postController.getPostLikes);

// Comment on post
router.post('/:id/comment', authMiddleware, postController.commentOnPost);

// Get post comments
router.get('/:id/comments', authMiddleware, postController.getPostComments);

// Search posts
router.get('/search/query', authMiddleware, postController.searchPosts);

module.exports = router;