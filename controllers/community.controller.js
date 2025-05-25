const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a community
 * @route POST /api/communities
 */
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Community name is required'
      });
    }

    // Create community
    const communityId = uuidv4();
    const { data, error } = await supabase
      .from('communities')
      .insert([
        {
          id: communityId,
          name,
          description,
          icon: icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          creator_id: userId,
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

    // Add creator as a member with admin role
    await supabase
      .from('community_members')
      .insert([
        {
          id: uuidv4(),
          community_id: communityId,
          user_id: userId,
          role: 'admin',
          created_at: new Date()
        }
      ]);

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      community: {
        id: communityId,
        name,
        description,
        icon: icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get all communities
 * @route GET /api/communities
 */
exports.getAllCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get communities with member count
    const { data, error, count } = await supabase
      .from('communities')
      .select(`
        *,
        users:creator_id (id, username, full_name, profile_picture),
        members:community_members (count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Format response
    const communities = data.map(community => ({
      id: community.id,
      name: community.name,
      description: community.description,
      icon: community.icon,
      creator: community.users ? {
        id: community.users.id,
        username: community.users.username,
        fullName: community.users.full_name,
        profilePicture: community.users.profile_picture
      } : null,
      membersCount: community.members ? community.members.length : 0,
      createdAt: community.created_at
    }));

    res.status(200).json({
      success: true,
      communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get community by ID
 * @route GET /api/communities/:id
 */
exports.getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get community with creator info
    const { data, error } = await supabase
      .from('communities')
      .select(`
        *,
        users:creator_id (id, username, full_name, profile_picture)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Get member count
    const { count: membersCount } = await supabase
      .from('community_members')
      .select('*', { count: 'exact' })
      .eq('community_id', id);

    // Check if user is a member
    const { data: membership } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', id)
      .eq('user_id', userId)
      .single();

    // Format response
    const community = {
      id: data.id,
      name: data.name,
      description: data.description,
      icon: data.icon,
      creator: data.users ? {
        id: data.users.id,
        username: data.users.username,
        fullName: data.users.full_name,
        profilePicture: data.users.profile_picture
      } : null,
      membersCount,
      isMember: !!membership,
      role: membership ? membership.role : null,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    res.status(200).json({
      success: true,
      community
    });
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update community
 * @route PUT /api/communities/:id
 */
exports.updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;
    const userId = req.user.id;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is creator or admin
    if (community.creator_id !== userId) {
      const { data: membership } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', id)
        .eq('user_id', userId)
        .single();

      if (!membership || membership.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this community'
        });
      }
    }

    // Update community
    const { data, error } = await supabase
      .from('communities')
      .update({
        name,
        description,
        icon,
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
      message: 'Community updated successfully',
      community: {
        id,
        name,
        description,
        icon,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete community
 * @route DELETE /api/communities/:id
 */
exports.deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is creator
    if (community.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the community creator can delete it'
      });
    }

    // Delete community members first
    await supabase
      .from('community_members')
      .delete()
      .eq('community_id', id);

    // Delete community posts
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('community_id', id);

    if (posts && posts.length > 0) {
      // Delete post likes, comments, etc.
      const postIds = posts.map(post => post.id);
      
      await supabase.from('post_likes').delete().in('post_id', postIds);
      await supabase.from('post_comments').delete().in('post_id', postIds);
      await supabase.from('notifications').delete().in('reference_id', postIds);
      
      // Delete the posts
      await supabase.from('posts').delete().eq('community_id', id);
    }

    // Delete community
    const { error } = await supabase
      .from('communities')
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
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Delete community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Join community
 * @route POST /api/communities/:id/join
 */
exports.joinCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if already a member
    const { data: existingMembership } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', id)
      .eq('user_id', userId)
      .single();

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this community'
      });
    }

    // Join community
    const { error } = await supabase
      .from('community_members')
      .insert([
        {
          id: uuidv4(),
          community_id: id,
          user_id: userId,
          role: 'member',
          created_at: new Date()
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Notify community creator
    if (community.creator_id !== userId) {
      await supabase
        .from('notifications')
        .insert([
          {
            id: uuidv4(),
            user_id: community.creator_id,
            type: 'community_join',
            reference_id: id,
            sender_id: userId,
            created_at: new Date(),
            is_read: false
          }
        ]);
    }

    res.status(200).json({
      success: true,
      message: 'Joined community successfully'
    });
  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Leave community
 * @route POST /api/communities/:id/leave
 */
exports.leaveCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is creator
    if (community.creator_id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Community creator cannot leave the community. Transfer ownership or delete the community instead.'
      });
    }

    // Check if a member
    const { data: membership } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Not a member of this community'
      });
    }

    // Leave community
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Left community successfully'
    });
  } catch (error) {
    console.error('Leave community error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get community members
 * @route GET /api/communities/:id/members
 */
exports.getCommunityMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Get members
    const { data, error, count } = await supabase
      .from('community_members')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture, bio)
      `, { count: 'exact' })
      .eq('community_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Format response
    const members = data.map(member => ({
      id: member.users.id,
      username: member.users.username,
      fullName: member.users.full_name,
      profilePicture: member.users.profile_picture,
      bio: member.users.bio,
      role: member.role,
      joinedAt: member.created_at
    }));

    res.status(200).json({
      success: true,
      members,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get community members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get community posts
 * @route GET /api/communities/:id/posts
 */
exports.getCommunityPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Check if community exists
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();

    if (communityError || !community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Get posts
    const { data, error, count } = await supabase
      .from('posts')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture),
        likes:post_likes (count),
        comments:post_comments (count)
      `, { count: 'exact' })
      .eq('community_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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

    // Format response
    const posts = data.map(post => ({
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
      likesCount: post.likes ? post.likes.length : 0,
      commentsCount: post.comments ? post.comments.length : 0,
      isLiked: likedPostIds.includes(post.id)
    }));

    res.status(200).json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get community posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Search communities
 * @route GET /api/communities/search/query
 */
exports.searchCommunities = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search communities
    const { data, error, count } = await supabase
      .from('communities')
      .select(`
        *,
        users:creator_id (id, username, full_name, profile_picture),
        members:community_members (count)
      `, { count: 'exact' })
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Format response
    const communities = data.map(community => ({
      id: community.id,
      name: community.name,
      description: community.description,
      icon: community.icon,
      creator: community.users ? {
        id: community.users.id,
        username: community.users.username,
        fullName: community.users.full_name,
        profilePicture: community.users.profile_picture
      } : null,
      membersCount: community.members ? community.members.length : 0,
      createdAt: community.created_at
    }));

    res.status(200).json({
      success: true,
      communities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Search communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};