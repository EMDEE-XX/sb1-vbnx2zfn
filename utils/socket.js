import { Server } from 'socket.io';

/**
 * Socket.io implementation for real-time features
 */
const initializeSocket = (io) => {
  // Store online users
  const onlineUsers = new Map();

  // Store active typing users
  const typingUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User authentication
    socket.on('authenticate', (userId) => {
      if (userId) {
        // Add user to online users
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        
        // Join user's room for private notifications
        socket.join(`user:${userId}`);
        
        // Broadcast user's online status
        socket.broadcast.emit('user:status', { userId, status: 'online' });
        
        // Send the user a list of other online users
        const onlineUserIds = Array.from(onlineUsers.keys()).filter(id => id !== userId);
        socket.emit('online:users', onlineUserIds);
        
        console.log(`User authenticated: ${userId}`);
      }
    });

    // Handle private messages with read receipts
    socket.on('message:send', async (data) => {
      const { recipientId, content } = data;
      const senderId = socket.userId;
      
      if (!senderId || !recipientId || !content) {
        return socket.emit('error', { message: 'Invalid message data' });
      }
      
      try {
        const message = {
          id: Date.now().toString(),
          senderId,
          recipientId,
          content,
          timestamp: new Date(),
          isRead: false
        };
        
        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('message:new', message);
        }
        
        // Send back to sender for confirmation
        socket.emit('message:sent', message);
        
      } catch (error) {
        console.error('Message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message read receipts
    socket.on('message:read', (messageId) => {
      const userId = socket.userId;
      if (!userId || !messageId) return;

      // Notify message sender that the message was read
      socket.broadcast.emit('message:read', { messageId, readBy: userId });
    });

    // Handle typing indicator with debounce
    socket.on('typing:start', (data) => {
      const { recipientId } = data;
      const senderId = socket.userId;
      
      if (!senderId || !recipientId) return;
      
      // Clear existing timeout
      if (typingUsers.has(senderId)) {
        clearTimeout(typingUsers.get(senderId));
      }
      
      // Set new timeout
      const timeout = setTimeout(() => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('user:stopped-typing', { userId: senderId });
        }
        typingUsers.delete(senderId);
      }, 3000);
      
      typingUsers.set(senderId, timeout);
      
      // Send typing indicator
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user:typing', { userId: senderId });
      }
    });

    // Handle notifications with real-time updates
    socket.on('notification:read', (notificationId) => {
      if (socket.userId) {
        // Broadcast read status to other user sessions
        socket.to(`user:${socket.userId}`).emit('notification:marked-read', notificationId);
      }
    });

    // Handle user presence
    socket.on('presence:update', (status) => {
      if (socket.userId) {
        socket.broadcast.emit('user:presence', {
          userId: socket.userId,
          status,
          lastSeen: new Date()
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        // Clear typing timeout
        if (typingUsers.has(socket.userId)) {
          clearTimeout(typingUsers.get(socket.userId));
          typingUsers.delete(socket.userId);
        }
        
        // Remove from online users
        onlineUsers.delete(socket.userId);
        
        // Broadcast offline status with last seen
        socket.broadcast.emit('user:status', {
          userId: socket.userId,
          status: 'offline',
          lastSeen: new Date()
        });
        
        console.log(`User disconnected: ${socket.userId}`);
      }
    });
  });

  // Helper functions for external use
  io.sendNotification = (userId, notification) => {
    io.to(`user:${userId}`).emit('notification:new', notification);
  };

  io.broadcastAnnouncement = (message) => {
    io.emit('announcement', { message, timestamp: new Date() });
  };

  return io;
};

export default initializeSocket;