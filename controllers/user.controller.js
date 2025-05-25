const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Get user profile
 * @route GET /api/users/profile/:id
 */
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if current user follows this user
    const { data: followData } = await supabase
      .from('followers')
      .select('*')
      .eq('user_id', id)
      .eq('follower_id', currentUserId)
      .single();

    // Get followers count
    const { count: followersCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact' })
      .eq('user_id', id);

    // Get following count
    const { count: followingCount } = await supabase
      .from('followers')
      .select('*', { count: 'exact' })
      .eq('follower_id', id);

    // Get posts count
    const { count: postsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('user_id', id);

    // Get user communities
    const { data: communities } = await supabase
      .from('community_members')
      .select(`
        *,
        communities:community_id (id, name, icon, description)
      `)
      .eq('user_id', id);

    const userCommunities = communities ? communities.map(item => ({
      id: item.communities.id,
      name: item.communities.name,
      icon: item.communities.icon,
      description: item.communities.description
    })) : [];

    const profile = {
      id: userData.id,
      username: userData.username,
      fullName: userData.full_name,
      profilePicture: userData.profile_picture,
      bio: userData.bio,
      createdAt: userData.created_at,
      isFollowing: !!followData,
      stats: {
        followers: followersCount,
        following: followingCount,
        posts: postsCount
      },
      communities: userCommunities
    };

    res.status(200).json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 */
exports.updateUserProfile = async (req, res) => {
  try {
    const { fullName, bio, profilePicture } = req.body;
    const userId = req.user.id;

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        bio,
        profile_picture: profilePicture,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: data[0].id,
        username: data[0].username,
        fullName: data[0].full_name,
        profilePicture: data[0].profile_picture,
        bio: data[0].bio
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Upload profile picture
 * @route POST /api/users/profile-picture
 */
exports.uploadProfilePicture = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const userId = req.user.id;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    // Update user profile picture
    const { data, error } = await supabase
      .from('users')
      .update({
        profile_picture: imageUrl,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: imageUrl
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Follow user
 * @route POST /api/users/follow/:id
 */
exports.followUser = async (req, res) => {
  try {
    const { id } = req.params;
    const followerId = req.user.id;

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('followers')
      .select('*')
      .eq('user_id', id)
      .eq('follower_id', followerId)
      .single();

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Create follow
    const { error } = await supabase
      .from('followers')
      .insert([
        {
          id: uuidv4(),
          user_id: id,
          follower_id: followerId,
          created_at: new Date()
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Create notification
    await supabase
      .from('notifications')
      .insert([
        {
          id: uuidv4(),
          user_id: id,
          type: 'new_follower',
          reference_id: followerId,
          sender_id: followerId,
          created_at: new Date(),
          is_read: false
        }
      ]);

    res.status(200).json({
      success: true,
      message: 'User followed successfully'
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Unfollow user
 * @route POST /api/users/unfollow/:id
 */
exports.unfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const followerId = req.user.id;

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete follow
    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('user_id', id)
      .eq('follower_id', followerId);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Delete notification
    await supabase
      .from('notifications')
      .delete()
      .eq('type', 'new_follower')
      .eq('reference_id', followerId)
      .eq('user_id', id);

    res.status(200).json({
      success: true,
      message: 'User unfollowed successfully'
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user followers
 * @route GET /api/users/followers/:id
 */
exports.getUserFollowers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get followers
    const { data, error, count } = await supabase
      .from('followers')
      .select(`
        *,
        users:follower_id (id, username, full_name, profile_picture, bio)
      `, { count: 'exact' })
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const followers = data.map(follower => ({
      id: follower.users.id,
      username: follower.users.username,
      fullName: follower.users.full_name,
      profilePicture: follower.users.profile_picture,
      bio: follower.users.bio,
      followedAt: follower.created_at
    }));

    res.status(200).json({
      success: true,
      followers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get user followers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user following
 * @route GET /api/users/following/:id
 */
exports.getUserFollowing = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get following
    const { data, error, count } = await supabase
      .from('followers')
      .select(`
        *,
        users:user_id (id, username, full_name, profile_picture, bio)
      `, { count: 'exact' })
      .eq('follower_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const following = data.map(follow => ({
      id: follow.users.id,
      username: follow.users.username,
      fullName: follow.users.full_name,
      profilePicture: follow.users.profile_picture,
      bio: follow.users.bio,
      followedAt: follow.created_at
    }));

    res.status(200).json({
      success: true,
      following,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get user following error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Search users
 * @route GET /api/users/search
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Search users
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .order('username')
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const users = data.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      profilePicture: user.profile_picture,
      bio: user.bio
    }));

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};