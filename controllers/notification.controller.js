const supabase = require('../config/supabase');

/**
 * Get user notifications
 * @route GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get notifications
    const { data, error, count } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:sender_id (id, username, full_name, profile_picture)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Process notifications
    const notifications = [];
    for (const notification of data) {
      let details = {
        id: notification.id,
        type: notification.type,
        isRead: notification.is_read,
        createdAt: notification.created_at,
        sender: notification.sender ? {
          id: notification.sender.id,
          username: notification.sender.username,
          fullName: notification.sender.full_name,
          profilePicture: notification.sender.profile_picture
        } : null
      };
      
      // Get reference data based on notification type
      switch (notification.type) {
        case 'post_like':
        case 'post_comment':
          // Get post details
          const { data: postData } = await supabase
            .from('posts')
            .select('id, content')
            .eq('id', notification.reference_id)
            .single();
            
          if (postData) {
            details.reference = {
              id: postData.id,
              type: 'post',
              preview: postData.content.substring(0, 50) + (postData.content.length > 50 ? '...' : '')
            };
          }
          break;
          
        case 'new_follower':
          // Reference is already the sender
          details.reference = {
            id: notification.reference_id,
            type: 'user'
          };
          break;
          
        case 'community_join':
          // Get community details
          const { data: communityData } = await supabase
            .from('communities')
            .select('id, name')
            .eq('id', notification.reference_id)
            .single();
            
          if (communityData) {
            details.reference = {
              id: communityData.id,
              type: 'community',
              name: communityData.name
            };
          }
          break;
      }
      
      notifications.push(details);
    }

    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Mark notification as read
 * @route PUT /api/notifications/:id/read
 */
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification exists and belongs to user
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (notificationError || !notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Mark as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/read-all
 */
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    // Mark all as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification exists and belongs to user
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (notificationError || !notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Delete notification
    const { error } = await supabase
      .from('notifications')
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
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};