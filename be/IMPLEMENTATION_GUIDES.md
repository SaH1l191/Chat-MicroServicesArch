# 🛠️ Implementation Guides for Key Features

## 1. WebSocket Service for Real-time Communication

### Setup
```bash
cd be
mkdir websocket
cd websocket
pnpm init
pnpm add socket.io express dotenv jsonwebtoken
pnpm add -D @types/socket.io @types/express typescript nodemon concurrently
```

### Basic Structure
```typescript
// src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authMiddleware } from './middleware/auth';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT token
  // Attach user to socket.data.user
  next();
});

io.on('connection', (socket) => {
  const userId = socket.data.user._id;
  
  // Join user's personal room
  socket.join(`user:${userId}`);
  
  // Join chat rooms user is part of
  socket.on('join:chat', (chatId) => {
    socket.join(`chat:${chatId}`);
  });
  
  // Handle typing indicator
  socket.on('typing:start', ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit('typing:start', {
      userId,
      chatId
    });
  });
  
  socket.on('typing:stop', ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit('typing:stop', {
      userId,
      chatId
    });
  });
  
  // Handle online status
  socket.on('disconnect', () => {
    // Mark user as offline
    socket.broadcast.emit('user:offline', { userId });
  });
});

httpServer.listen(3003, () => {
  console.log('WebSocket server running on port 3003');
});
```

---

## 2. Enhanced Message Model

### Updated Chat Model
```typescript
// be/chat/src/models/Message.ts
import mongoose from "mongoose";
import { Types } from "mongoose";

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  LOCATION = 'location',
  VOICE_NOTE = 'voice_note',
  SYSTEM = 'system'
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface IMessage {
  chatId: Types.ObjectId;
  senderId: string;
  type: MessageType;
  content: string; // text content or file URL
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number; // for audio/video
    thumbnail?: string;
    location?: {
      lat: number;
      lng: number;
      address?: string;
    };
  };
  replyTo?: Types.ObjectId; // reference to another message
  reactions?: Array<{
    emoji: string;
    userId: string;
  }>;
  status: MessageStatus;
  editedAt?: Date;
  deletedAt?: Date;
  deletedFor?: string[]; // user IDs who deleted this message
  scheduledFor?: Date;
  expiresAt?: Date; // for self-destructing messages
  createdAt?: Date;
  updatedAt?: Date;
  _id: Types.ObjectId;
}

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    duration: Number,
    thumbnail: String,
    location: {
      lat: Number,
      lng: Number,
      address: String
    }
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    emoji: String,
    userId: String
  }],
  status: {
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.SENT
  },
  editedAt: Date,
  deletedAt: Date,
  deletedFor: [String],
  scheduledFor: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ 'reactions.userId': 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
```

### Updated Chat Model
```typescript
// be/chat/src/models/Chat.ts (updated)
import mongoose from "mongoose";
import { Types } from "mongoose";

export enum ChatType {
  DIRECT = 'direct',
  GROUP = 'group'
}

export interface IChat {
  type: ChatType;
  users: string[];
  name?: string; // for groups
  description?: string; // for groups
  avatar?: string; // for groups
  createdBy?: string; // for groups
  admins?: string[]; // for groups
  isArchived?: boolean;
  isPinned?: boolean;
  pinnedBy?: string;
  mutedBy?: string[]; // user IDs who muted this chat
  lastMessage?: {
    messageId: Types.ObjectId;
    text: string;
    sender: string;
    type: string;
    timestamp: Date;
  };
  unreadCount?: {
    [userId: string]: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
  _id: Types.ObjectId;
}

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(ChatType),
    default: ChatType.DIRECT
  },
  users: [{
    type: String,
    required: true
  }],
  name: String,
  description: String,
  avatar: String,
  createdBy: String,
  admins: [String],
  isArchived: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedBy: String,
  mutedBy: [String],
  lastMessage: {
    messageId: mongoose.Schema.Types.ObjectId,
    text: String,
    sender: String,
    type: String,
    timestamp: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
chatSchema.index({ users: 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ 'users': 1, 'isArchived': 1 });

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
```

---

## 3. Notification Service

### Service Structure
```typescript
// be/notification/src/index.ts
import express from 'express';
import { connectRabbitMq, consumeFromQueue } from './config/rabbitmq';
import { sendPushNotification, sendEmailNotification } from './services/notificationService';

const app = express();
app.use(express.json());

// Consume notification events from RabbitMQ
consumeFromQueue('notifications', async (message) => {
  const { type, userId, data } = JSON.parse(message.content.toString());
  
  switch (type) {
    case 'push':
      await sendPushNotification(userId, data);
      break;
    case 'email':
      await sendEmailNotification(userId, data);
      break;
    case 'in-app':
      // Store in database for in-app notifications
      break;
  }
});

app.listen(3004, () => {
  console.log('Notification service running on port 3004');
  connectRabbitMq();
});
```

### Notification Service
```typescript
// be/notification/src/services/notificationService.ts
import { publishToQueue } from '../config/rabbitmq';

export const createNotification = async (
  userId: string,
  type: 'message' | 'mention' | 'reaction' | 'group_invite',
  data: any
) => {
  // Check user preferences
  const preferences = await getUserNotificationPreferences(userId);
  
  if (preferences[type].push) {
    await publishToQueue('notifications', {
      type: 'push',
      userId,
      data: {
        title: getNotificationTitle(type, data),
        body: getNotificationBody(type, data),
        data: data
      }
    });
  }
  
  if (preferences[type].email) {
    await publishToQueue('notifications', {
      type: 'email',
      userId,
      data: {
        subject: getNotificationTitle(type, data),
        body: getNotificationBody(type, data)
      }
    });
  }
  
  // Always create in-app notification
  await createInAppNotification(userId, type, data);
};
```

---

## 4. Presence Service

### Redis-based Presence
```typescript
// be/presence/src/services/presenceService.ts
import { redisClient } from '../config/redis';

const PRESENCE_TTL = 60; // 60 seconds

export const updatePresence = async (userId: string, status: 'online' | 'away' | 'busy' | 'offline') => {
  const key = `presence:${userId}`;
  await redisClient.set(key, status, { EX: PRESENCE_TTL });
  
  // Publish presence update via WebSocket
  await publishPresenceUpdate(userId, status);
};

export const getPresence = async (userId: string): Promise<string> => {
  const key = `presence:${userId}`;
  const status = await redisClient.get(key);
  return status || 'offline';
};

export const getBulkPresence = async (userIds: string[]): Promise<Record<string, string>> => {
  const keys = userIds.map(id => `presence:${id}`);
  const values = await redisClient.mGet(keys);
  
  const presence: Record<string, string> = {};
  userIds.forEach((userId, index) => {
    presence[userId] = values[index] || 'offline';
  });
  
  return presence;
};

// Heartbeat to keep presence alive
export const heartbeat = async (userId: string) => {
  await updatePresence(userId, 'online');
};
```

---

## 5. Media Service

### File Upload Handler
```typescript
// be/media/src/controller/media.ts
import { Request, Response } from 'express';
import multer from 'multer';
import { uploadToS3, generatePresignedUrl } from '../services/storageService';
import { compressImage, generateThumbnail } from '../services/imageProcessing';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const userId = req.user._id;
    
    // Process based on file type
    let processedFile = file;
    let thumbnail = null;
    
    if (file.mimetype.startsWith('image/')) {
      // Compress image
      processedFile = await compressImage(file);
      thumbnail = await generateThumbnail(file);
    }
    
    // Upload to storage
    const fileUrl = await uploadToS3(processedFile, userId);
    const thumbnailUrl = thumbnail ? await uploadToS3(thumbnail, userId, 'thumbnails') : null;
    
    // Save metadata to database
    const media = await Media.create({
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      thumbnailUrl,
      uploadedAt: new Date()
    });
    
    res.json({
      success: true,
      media: {
        id: media._id,
        url: fileUrl,
        thumbnailUrl,
        type: file.mimetype,
        size: file.size
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
};
```

---

## 6. Message Controller with Advanced Features

```typescript
// be/chat/src/controller/message.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Message, MessageType, MessageStatus } from "../models/Message";
import { Chat } from "../models/Chat";
import { publishToQueue } from "../config/rabbitmq";
import { redisClient } from "../config/redis";

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, content, type = MessageType.TEXT, replyTo, metadata, scheduledFor } = req.body;
    const senderId = req.user._id.toString();
    
    // Check if chat exists and user is part of it
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.users.includes(senderId)) {
      return res.status(403).json({ message: "Chat not found or access denied" });
    }
    
    // If scheduled, store for later
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      await publishToQueue('scheduled-messages', {
        chatId,
        senderId,
        content,
        type,
        scheduledFor
      });
      return res.json({ message: "Message scheduled" });
    }
    
    // Create message
    const message = await Message.create({
      chatId,
      senderId,
      type,
      content,
      replyTo,
      metadata,
      status: MessageStatus.SENT
    });
    
    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        messageId: message._id,
        text: type === MessageType.TEXT ? content : getMessagePreview(type),
        sender: senderId,
        type,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });
    
    // Increment unread count for other users
    chat.users.forEach(userId => {
      if (userId !== senderId) {
        chat.unreadCount = chat.unreadCount || {};
        chat.unreadCount[userId] = (chat.unreadCount[userId] || 0) + 1;
      }
    });
    await chat.save();
    
    // Publish to WebSocket via RabbitMQ
    await publishToQueue('websocket-events', {
      event: 'message:new',
      chatId,
      message: message.toObject()
    });
    
    // Create notifications
    chat.users.forEach(userId => {
      if (userId !== senderId) {
        publishToQueue('notifications', {
          type: 'message',
          userId,
          data: {
            chatId,
            messageId: message._id,
            senderName: req.user.name,
            preview: type === MessageType.TEXT ? content : getMessagePreview(type)
          }
        });
      }
    });
    
    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, messageIds } = req.body;
    const userId = req.user._id.toString();
    
    // Update message status
    await Message.updateMany(
      { _id: { $in: messageIds }, chatId, status: { $ne: MessageStatus.READ } },
      { status: MessageStatus.READ }
    );
    
    // Reset unread count
    const chat = await Chat.findById(chatId);
    if (chat) {
      chat.unreadCount = chat.unreadCount || {};
      chat.unreadCount[userId] = 0;
      await chat.save();
    }
    
    // Notify via WebSocket
    await publishToQueue('websocket-events', {
      event: 'message:read',
      chatId,
      userId,
      messageIds
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

export const addReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, emoji } = req.body;
    const userId = req.user._id.toString();
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    // Remove existing reaction from this user
    message.reactions = message.reactions?.filter(r => r.userId !== userId) || [];
    
    // Add new reaction
    message.reactions.push({ emoji, userId });
    await message.save();
    
    // Notify via WebSocket
    await publishToQueue('websocket-events', {
      event: 'message:reaction',
      messageId,
      emoji,
      userId
    });
    
    res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    res.status(500).json({ error: "Failed to add reaction" });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userId = req.user._id.toString();
    
    // Check access
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.users.includes(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Build query
    const query: any = { chatId };
    if (cursor) {
      query._id = { $lt: cursor };
    }
    
    // Fetch messages
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('replyTo', 'content senderId')
      .lean();
    
    // Cache recent messages
    if (!cursor) {
      await redisClient.setEx(
        `messages:${chatId}`,
        300,
        JSON.stringify(messages.slice(0, 20))
      );
    }
    
    res.json({
      messages: messages.reverse(),
      nextCursor: messages.length === Number(limit) ? messages[messages.length - 1]._id : null
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};
```

---

## 7. Search Service

```typescript
// be/search/src/controller/search.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { Message } from "../../chat/src/models/Message";
import { Chat } from "../../chat/src/models/Chat";
import { User } from "../../user/src/models/User";

export const searchMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { query, chatId, limit = 20 } = req.query;
    const userId = req.user._id.toString();
    
    const searchQuery: any = {
      $text: { $search: query as string },
      deletedAt: { $exists: false }
    };
    
    if (chatId) {
      // Verify user has access to this chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.users.includes(userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      searchQuery.chatId = chatId;
    } else {
      // Search across all user's chats
      const userChats = await Chat.find({ users: userId });
      searchQuery.chatId = { $in: userChats.map(c => c._id) };
    }
    
    const messages = await Message.find(searchQuery)
      .sort({ score: { $meta: "textScore" } })
      .limit(Number(limit))
      .populate('chatId', 'name type')
      .lean();
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;
    const userId = req.user._id.toString();
    
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: userId }
    })
    .limit(20)
    .select('name email')
    .lean();
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
};
```

---

## Quick Implementation Checklist

- [ ] Set up WebSocket service
- [ ] Enhance Message model with new fields
- [ ] Implement message sending with real-time delivery
- [ ] Add typing indicators
- [ ] Add read receipts
- [ ] Implement presence service
- [ ] Set up notification service
- [ ] Add message reactions
- [ ] Implement message search
- [ ] Add media upload service
- [ ] Implement group chats
- [ ] Add chat pinning/archiving
- [ ] Set up monitoring and logging

---

**Note**: These are starter implementations. You'll need to:
1. Add proper error handling
2. Add validation
3. Add tests
4. Configure environment variables
5. Set up proper database connections
6. Add rate limiting
7. Add proper logging

