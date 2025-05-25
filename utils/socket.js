/**
 * Socket.io implementation for real-time features
 */
module.exports = (io) => {
  // Store online users
  const onlineUsers = new Map();

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

    // Handle private messages
    socket.on('message:send', async (data) => {
      const { recipientId, content } = data;
      const senderId = socket.userId;
      
      if (!senderId || !recipientId || !content) {
        return socket.emit('error', { message: 'Invalid message data' });
      }
      
      try {
        // Generate message object
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
        
        // Always send back to sender for confirmation
        socket.emit('message:sent', message);
        
      } catch (error) {
        console.error('Message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { recipientId } = data;
      const senderId = socket.userId;
      
      if (!senderId || !recipientId) return;
      
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user:typing', { userId: senderId });
      }
    });

    // Handle stopped typing
    socket.on('typing:stop', (data) => {
      const { recipientId } = data;
      const senderId = socket.userId;
      
      if (!senderId || !recipientId) return;
      
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user:stopped-typing', { userId: senderId });
      }
    });

    // Handle notifications
    socket.on('notification:read', (notificationId) => {
      // This would be handled by the notification controller,
      // but we can broadcast the read status to other user sessions
      if (socket.userId) {
        socket.to(`user:${socket.userId}`).emit('notification:marked-read', notificationId);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        // Remove from online users
        onlineUsers.delete(socket.userId);
        
        // Broadcast user's offline status
        socket.broadcast.emit('user:status', { userId: socket.userId, status: 'offline' });
        
        console.log(`User disconnected: ${socket.userId}`);
      }
    });
  });

  // Function to send notification to a specific user
  io.sendNotification = (userId, notification) => {
    io.to(`user:${userId}`).emit('notification:new', notification);
  };

  // Function to broadcast to all connected clients
  io.broadcastAnnouncement = (message) => {
    io.emit('announcement', { message, timestamp: new Date() });
  };

  return io;
};