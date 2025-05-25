const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new post
 * @route POST /api/posts
 */
exports.createPost = async (req, res) => {
  try {
    const { content, mediaUrl, communityId } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Post content is required'
      });
    }

    // Create post
    const postId = uuidv4();
    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          id: postId,
          content,
          media_url: mediaUrl || null,
          user_id: userId,
          community_id: communityId || null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Create notifications for followers
    const { data: followers } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('user_id', userId);

    if (followers && followers.length > 0) {
      const notifications = followers.map(follower => ({
        id: uuidv4(),
        user_id: follower.follower_id,
        type: 'new_post',
        reference_id: postId,
        sender_id: userId,
        created_at: new Date(),
        is_read: false
      }));

      await supabase.from('notifications').insert(notifications);
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: {
        id: postId,
        content,
        mediaUrl,
        communityId,
        userId,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user feed
 * @route GET /api/posts
 */
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's following list
    const { data: following } = await supabase
      .from('followers')
      .select('user_id')
      .eq('follower_id', userId);

    // Create array of followed user IDs including current user
    const followedIds = following ? following.map(f => f.user_id) : [];
    followedIds.push(userId); // Include user's own posts

    // Get posts from followed users and communities
    let query = supabase
      .from('posts')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture),
        communities:community_id (id, name, icon),
        likes:post_likes (count),
        comments:post_comments (count)
      `)
      .or(`user_id.in.(${followedIds.join(',')})`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // If user is part of communities, include those posts too
    const { data: userCommunities } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId);

    if (userCommunities && userCommunities.length > 0) {
      const communityIds = userCommunities.map(c => c.community_id);
      query = query.or(`community_id.in.(${communityIds.join(',')})`);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Check if current user has liked each post
    const postIds = data.map(post => post.id);
    const { data: userLikes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const likedPostIds = userLikes ? userLikes.map(like => like.post_id) : [];

    // Format the response
    const formattedPosts = data.map(post => ({
      id: post.id,
      content: post.content,
      mediaUrl: post.media_url,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      user: {
        id: post.users.id,
        username: post.users.username,
        fullName: post.users.full_name,
        profilePicture: post.users.profile_picture
      },
      community: post.communities ? {
        id: post.communities.id,
        name: post.communities.name,
        icon: post.communities.icon
      } : null,
      likesCount: post.likes ? post.likes.length : 0,
      commentsCount: post.comments ? post.comments.length : 0,
      isLiked: likedPostIds.includes(post.id)
    }));

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get post by ID
 * @route GET /api/posts/:id
 */
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture),
        communities:community_id (id, name, icon)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user has liked the post
    const { data: userLike } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', id)
      .eq('user_id', userId)
      .single();

    // Get likes count
    const { count: likesCount } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact' })
      .eq('post_id', id);

    // Get comments count
    const { count: commentsCount } = await supabase
      .from('post_comments')
      .select('*', { count: 'exact' })
      .eq('post_id', id);

    const formattedPost = {
      id: data.id,
      content: data.content,
      mediaUrl: data.media_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      user: {
        id: data.users.id,
        username: data.users.username,
        fullName: data.users.full_name,
        profilePicture: data.users.profile_picture
      },
      community: data.communities ? {
        id: data.communities.id,
        name: data.communities.name,
        icon: data.communities.icon
      } : null,
      likesCount,
      commentsCount,
      isLiked: !!userLike
    };

    res.status(200).json({
      success: true,
      post: formattedPost
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update post
 * @route PUT /api/posts/:id
 */
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, mediaUrl } = req.body;
    const userId = req.user.id;

    // Check if post exists and belongs to user
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (existingPost.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    // Update post
    const { data, error } = await supabase
      .from('posts')
      .update({
        content,
        media_url: mediaUrl,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      post: {
        id,
        content,
        mediaUrl,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete post
 * @route DELETE /api/posts/:id
 */
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists and belongs to user
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (existingPost.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    // Delete related data first (likes, comments)
    await supabase.from('post_likes').delete().eq('post_id', id);
    await supabase.from('post_comments').delete().eq('post_id', id);
    await supabase.from('notifications').delete().eq('reference_id', id);

    // Delete post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Like a post
 * @route POST /api/posts/:id/like
 */
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', id)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: 'Post already liked'
      });
    }

    // Create like
    const { error } = await supabase
      .from('post_likes')
      .insert([
        {
          id: uuidv4(),
          post_id: id,
          user_id: userId,
          created_at: new Date()
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Create notification for post owner
    if (userId !== post.user_id) {
      await supabase
        .from('notifications')
        .insert([
          {
            id: uuidv4(),
            user_id: post.user_id,
            type: 'post_like',
            reference_id: id,
            sender_id: userId,
            created_at: new Date(),
            is_read: false
          }
        ]);
    }

    res.status(200).json({
      success: true,
      message: 'Post liked successfully'
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Unlike a post
 * @route POST /api/posts/:id/unlike
 */
exports.unlikePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Delete like
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Delete notification if exists
    if (userId !== post.user_id) {
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'post_like')
        .eq('reference_id', id)
        .eq('sender_id', userId);
    }

    res.status(200).json({
      success: true,
      message: 'Post unliked successfully'
    });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get post likes
 * @route GET /api/posts/:id/likes
 */
exports.getPostLikes = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Get likes with user info
    const { data, error, count } = await supabase
      .from('post_likes')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture)
      `, { count: 'exact' })
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const formattedLikes = data.map(like => ({
      id: like.id,
      createdAt: like.created_at,
      user: {
        id: like.users.id,
        username: like.users.username,
        fullName: like.users.full_name,
        profilePicture: like.users.profile_picture
      }
    }));

    res.status(200).json({
      success: true,
      likes: formattedLikes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get post likes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Comment on a post
 * @route POST /api/posts/:id/comment
 */
exports.commentOnPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Create comment
    const commentId = uuidv4();
    const { data, error } = await supabase
      .from('post_comments')
      .insert([
        {
          id: commentId,
          post_id: id,
          user_id: userId,
          content,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Create notification for post owner
    if (userId !== post.user_id) {
      await supabase
        .from('notifications')
        .insert([
          {
            id: uuidv4(),
            user_id: post.user_id,
            type: 'post_comment',
            reference_id: id,
            sender_id: userId,
            created_at: new Date(),
            is_read: false
          }
        ]);
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        id: commentId,
        content,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Comment on post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get post comments
 * @route GET /api/posts/:id/comments
 */
exports.getPostComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Get comments with user info
    const { data, error, count } = await supabase
      .from('post_comments')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture)
      `, { count: 'exact' })
      .eq('post_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const formattedComments = data.map(comment => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: {
        id: comment.users.id,
        username: comment.users.username,
        fullName: comment.users.full_name,
        profilePicture: comment.users.profile_picture
      }
    }));

    res.status(200).json({
      success: true,
      comments: formattedComments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get post comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Search posts
 * @route GET /api/posts/search/query
 */
exports.searchPosts = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search posts
    const { data, error, count } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture),
        communities:community_id (id, name, icon)
      `, { count: 'exact' })
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const formattedPosts = data.map(post => ({
      id: post.id,
      content: post.content,
      mediaUrl: post.media_url,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      user: {
        id: post.users.id,
        username: post.users.username,
        fullName: post.users.full_name,
        profilePicture: post.users.profile_picture
      },
      community: post.communities ? {
        id: post.communities.id,
        name: post.communities.name,
        icon: post.communities.icon
      } : null
    }));

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};