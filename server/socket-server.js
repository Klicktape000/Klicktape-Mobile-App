require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO with React Native compatibility
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, specify your app's domain
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Start with polling for React Native
  allowEIO3: true, // Allow Engine.IO v3 clients
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Store active users and their rooms
const activeUsers = new Map();
const userRooms = new Map();

// Initialize Supabase client with service role for database updates
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

io.on('connection', (socket) => {
  logger.socket.connection(`🔗 New connection: ${socket.id}`);

  // Handle user joining
  socket.on('join_user', (userData) => {
    logger.socket.connection(`👤 User joining: ${userData.userId} (${userData.username})`);
    
    // Store user info
    activeUsers.set(socket.id, {
      userId: userData.userId,
      username: userData.username,
      socketId: socket.id,
      chatId: null
    });
    
    userRooms.set(userData.userId, socket.id);
    logger.socket.connection(`✅ User ${userData.userId} registered with socket ${socket.id}`);
  });

  // Handle joining chat room
  socket.on('join_chat', (chatData) => {
    const user = activeUsers.get(socket.id);
    if (!user) {
      logger.socket.connection(`⚠️ User not found for socket ${socket.id} trying to join chat`);
      return;
    }

    logger.socket.connection(`🏠 User ${user.userId} joining chat room: ${chatData.chatId}`);
    
    // Leave previous room if any
    if (user.chatId) {
      socket.leave(user.chatId);
      logger.socket.connection(`🚪 User ${user.userId} left previous room: ${user.chatId}`);
    }
    
    // Join new room
    socket.join(chatData.chatId);
    user.chatId = chatData.chatId;
    
    logger.socket.connection(`✅ User ${user.userId} joined room: ${chatData.chatId}`);
    
    // Notify others in the room that user is online
    socket.to(chatData.chatId).emit('user_status', { userId: user.userId, online: true });
    logger.socket.broadcast(`📡 Online status broadcasted for user ${user.userId} in room ${chatData.chatId}`);
  });

  // Handle leaving a chat room
  socket.on('leave_chat', ({ chatId }) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.leave(chatId);
      console.log(`🚪 User ${user.userId} left chat ${chatId}`);
      
      // Notify others that user left
      socket.to(chatId).emit('user_status', { userId: user.userId, online: false });
    }
  });

  // Handle new messages
  socket.on('new_message', async (message) => {
    logger.socket.message(`💬 New message from ${message.sender_id}: ${message.content?.substring(0, 50)}...`);

    try {
      const user = activeUsers.get(socket.id);
      if (!user) {
        logger.socket.message(`⚠️ User not found for socket ${socket.id} sending message`);
        return;
      }

      // Broadcast message to all users in the chat room
      socket.to(user.chatId).emit('message_received', message);
      logger.socket.broadcast(`📡 Message broadcasted to room ${user.chatId}`);

      // Only save to database if it's not a temporary/socket-only message
      if (!message.id?.startsWith('temp_') && !message.id?.startsWith('socket_')) {
        // Auto-mark as delivered after broadcast
        const { error } = await supabase
          .from('messages')
          .update({ 
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (error) {
          logger.db.error('❌ Failed to mark message as delivered:', error);
        } else {
          logger.db.success(`✅ Message ${message.id} automatically marked as delivered`);

          // Broadcast delivery status to all users in chat
          io.to(user.chatId).emit('message_status_update', {
            messageId: message.id,
            status: 'delivered',
            isRead: false
          });
          logger.socket.broadcast(`📡 Delivered status broadcasted for message ${message.id}`);
        }
      } else {
        logger.socket.message(`⚠️ Skipping database update for temporary/socket message: ${message.id}`);
      }
    } catch (dbError) {
      logger.db.error('❌ Database error marking as delivered:', dbError);
    }
  });

  // Handle typing status
  socket.on('typing_status', (data) => {
    logger.socket.typing(`⌨️ Typing status from ${data.userId}: ${data.isTyping}`);
    
    // Broadcast typing status to others in the chat room
    socket.to(data.chatId).emit('typing_update', data);
  });

  // Handle emoji reactions
  socket.on('add_reaction', async (data) => {
    logger.socket.reaction(`😀 Reaction from ${data.userId}: ${data.emoji} on message ${data.messageId}`);

    try {
      // First check if user already has this exact reaction
      const { data: existingReaction, error: checkError } = await supabase
        .from("message_reactions")
        .select("id, emoji")
        .eq("message_id", data.messageId)
        .eq("user_id", data.userId)
        .single();

      // Handle check error (ignore "no rows found" error)
      if (checkError && checkError.code !== 'PGRST116') {
        logger.db.error('❌ Error checking existing reaction:', checkError);
        throw checkError;
      }

      let reactionResult = null;

      if (existingReaction && existingReaction.emoji === data.emoji) {
        // Same emoji - remove the reaction (toggle off)
        const { error: deleteError } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (deleteError) throw deleteError;

        logger.db.success("✅ Reaction removed successfully");
        reactionResult = { action: 'removed', emoji: data.emoji };
      } else {
        // Different emoji or no existing reaction - upsert
        const { data: upsertedReaction, error: upsertError } = await supabase
          .from("message_reactions")
          .upsert({
            message_id: data.messageId,
            user_id: data.userId,
            emoji: data.emoji,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'message_id,user_id',
            ignoreDuplicates: false
          })
          .select('emoji')
          .single();

        if (upsertError) {
          logger.db.error('❌ Upsert error:', upsertError);
          throw upsertError;
        }

        logger.db.success("✅ Reaction upserted successfully:", upsertedReaction?.emoji);
        reactionResult = {
          action: existingReaction ? 'updated' : 'added',
          emoji: data.emoji,
          oldEmoji: existingReaction?.emoji
        };
      }

      // Find the chat room and broadcast reaction update
      const user = activeUsers.get(socket.id);
      if (user && reactionResult) {
        const reactionUpdate = {
          messageId: data.messageId,
          userId: data.userId,
          emoji: data.emoji,
          action: reactionResult.action,
          oldEmoji: reactionResult.oldEmoji
        };

        io.to(user.chatId).emit('reaction_update', reactionUpdate);
        logger.socket.broadcast(`📡 Reaction update broadcasted to room ${user.chatId}:`, reactionUpdate);
      }
    } catch (dbError) {
      logger.db.error('❌ Database error handling reaction:', dbError);
    }
  });

  // Handle message status updates (delivered/read)
  socket.on('message_status', async (data) => {
    logger.socket.status(`📊 Message status update: ${data.messageId} -> ${data.status}`);

    try {
      // First check current message status to avoid unnecessary updates
      const { data: currentMessage, error: fetchError } = await supabase
        .from('messages')
        .select('status, is_read')
        .eq('id', data.messageId)
        .single();

      if (fetchError) {
        logger.db.error('❌ Failed to fetch current message status:', fetchError);
        return;
      }

      // Check if update is actually needed
      const isAlreadyRead = currentMessage.is_read === true && data.status === 'read';
      const isAlreadyDelivered = currentMessage.status === 'delivered' && data.status === 'delivered';

      if (isAlreadyRead || isAlreadyDelivered) {
        logger.socket.status(`⚠️ Message ${data.messageId} already has status ${data.status}, skipping update`);
        return; // Don't update or broadcast if already in target state
      }

      // Update message status in database
      const updateData = {
        status: data.status,
        ...(data.status === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(data.status === 'read' && {
          is_read: true,
          read_at: new Date().toISOString()
        })
      };

      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', data.messageId);

      if (error) {
        logger.db.error('❌ Failed to update message status in database:', error);
      } else {
        logger.db.success(`✅ Message ${data.messageId} status updated to ${data.status} in database`);

        // Only broadcast if database update was successful
        const user = activeUsers.get(socket.id);
        if (user) {
          socket.to(user.chatId).emit('message_status_update', data);
          logger.socket.broadcast(`📡 Status update broadcasted to room ${user.chatId}`);
        }
      }
    } catch (dbError) {
      logger.db.error('❌ Database update error:', dbError);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', (reason) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      logger.socket.connection(`❌ User ${user.userId} disconnected: ${reason}`);
      
      // Notify others that user went offline
      if (user.chatId) {
        socket.to(user.chatId).emit('user_status', { userId: user.userId, online: false });
      }
      
      // Clean up
      activeUsers.delete(socket.id);
      userRooms.delete(user.userId);
    } else {
      logger.socket.connection(`❌ Unknown user disconnected: ${socket.id}`);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    logger.error(`🔥 Socket error for ${socket.id}:`, error);
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Klicktape Socket.IO Server', 
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/active-users'],
    websocket: 'available'
  });
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeConnections: io.engine.clientsCount,
    activeUsers: activeUsers.size
  });
});

// Get active users endpoint
app.get('/active-users', (req, res) => {
  const users = Array.from(activeUsers.values());
  res.json({ activeUsers: users });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  logger.server.startup(`🚀 Socket.IO server running on port ${PORT}`);
  logger.server.startup(`📡 WebSocket endpoint: ws://0.0.0.0:${PORT}`);
  logger.server.startup(`🌐 Health check: http://localhost:${PORT}/health`);
  logger.server.startup(`🌐 Android emulator: http://10.0.2.2:${PORT}/health`);
  logger.server.startup(`🌐 Network access (old): http://192.168.52.201:${PORT}/health`);
  logger.server.startup(`🌐 Network access (new): http://192.168.38.201:${PORT}/health`);
  
  // Get and display actual network interfaces
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  logger.server.startup('\n📡 Available network interfaces:');
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    const interfaces = networkInterfaces[interfaceName];
    interfaces.forEach(networkInterface => {
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
        logger.server.startup(`   ${interfaceName}: http://${networkInterface.address}:${PORT}/health`);
      }
    });
  });
  logger.server.startup('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.server.shutdown('🔄 SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.server.shutdown('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.server.shutdown('🔄 SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.server.shutdown('✅ Server closed');
    process.exit(0);
  });
});
