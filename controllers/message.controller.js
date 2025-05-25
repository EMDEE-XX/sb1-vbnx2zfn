const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Get user conversations
 * @route GET /api/messages/conversations
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all conversations where user is sender or recipient
    const { data, error } = await supabase.rpc('get_conversations', { user_id: userId });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Get user details for each conversation
    const conversations = [];
    for (const conv of data) {
      const otherUserId = conv.sender_id === userId ? conv.recipient_id : conv.sender_id;
      
      // Get other user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, full_name, profile_picture')
        .eq('id', otherUserId)
        .single();
      
      if (!userError && userData) {
        conversations.push({
          id: conv.id,
          user: {
            id: userData.id,
            username: userData.username,
            fullName: userData.full_name,
            profilePicture: userData.profile_picture
          },
          lastMessage: {
            content: conv.content,
            timestamp: conv.created_at,
            isRead: conv.is_read,
            sentByMe: conv.sender_id === userId
          },
          unreadCount: conv.unread_count
        });
      }
    }

    res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get messages in a conversation
 * @route GET /api/messages/conversations/:id
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Check if other user exists
    const { data: otherUser, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, profile_picture')
      .eq('id', otherUserId)
      .single();

    if (userError || !otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get messages between users
    const { data, error, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Mark unread messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', userId)
      .eq('is_read', false);

    // Format response
    const messages = data.map(message => ({
      id: message.id,
      content: message.content,
      sentByMe: message.sender_id === userId,
      timestamp: message.created_at,
      isRead: message.is_read
    })).reverse(); // Reverse to get chronological order

    res.status(200).json({
      success: true,
      conversation: {
        user: {
          id: otherUser.id,
          username: otherUser.username,
          fullName: otherUser.full_name,
          profilePicture: otherUser.profile_picture
        },
        messages
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Send a message
 * @route POST /api/messages/send
 */
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID and content are required'
      });
    }

    // Check if recipient exists
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('id', recipientId)
      .single();

    if (recipientError || !recipientData) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create message
    const messageId = uuidv4();
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          id: messageId,
          sender_id: senderId,
          recipient_id: recipientId,
          content,
          is_read: false,
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

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.sendNotification(recipientId, {
        type: 'new_message',
        senderId,
        content
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageId
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Mark message as read
 * @route PUT /api/messages/:id/read
 */
exports.markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if message exists and user is recipient
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (messageError || !message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.recipient_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark this message as read'
      });
    }

    // Mark as read
    const { error } = await supabase
      .from('messages')
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
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete message
 * @route DELETE /api/messages/:id
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if message exists and user is sender or recipient
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (messageError || !message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.sender_id !== userId && message.recipient_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    // Delete message
    const { error } = await supabase
      .from('messages')
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
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};