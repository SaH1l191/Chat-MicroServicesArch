# Chat Microservices Architecture - High Level Design

## Overview
This document explains how a real-time chat system works in a microservices architecture using **WebSocket**, **Redis**, **RabbitMQ**, and **MongoDB**.

---

## 🏗️ Architecture Components

### 1. **MongoDB (Database)**
- **Purpose**: Persistent storage for chats, messages, groups, and user data
- **Stores**: 
  - Chat conversations (1-on-1 and group)
  - All messages (with full history)
  - Group metadata
  - User relationships

### 2. **Redis (Cache & Pub/Sub)**
- **Purpose**: 
  - Fast caching for frequently accessed data
  - Real-time message broadcasting via Pub/Sub
  - Session management
  - Online/offline status
- **Key Patterns**:
  - `chat:{chatId}:messages` - Recent messages cache
  - `user:{userId}:online` - User online status
  - `chat:{chatId}:typing` - Typing indicators
  - Pub/Sub channels for real-time delivery

### 3. **RabbitMQ (Message Queue)**
- **Purpose**: Asynchronous task processing
- **Queues**:
  - `message-persist` - Save messages to DB
  - `notification-send` - Push notifications
  - `message-index` - Search indexing
  - `analytics` - Message analytics

### 4. **WebSocket (Real-time Communication)**
- **Purpose**: Bidirectional communication between client and server
- **Handles**: 
  - Message delivery
  - Typing indicators
  - Online/offline status
  - Read receipts

---

## 📊 Data Models

### Chat Types

#### 1. **Direct Chat (1-on-1)**
```typescript
{
  _id: ObjectId,
  type: 'direct',
  users: ['userId1', 'userId2'],
  latestMessage: {
    text: "Hey!",
    sender: "userId1",
    timestamp: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. **Group Chat**
```typescript
{
  _id: ObjectId,
  type: 'group',
  name: "Project Team",
  description: "Team discussion",
  admin: 'userId1',
  members: [
    { userId: 'userId1', role: 'admin', joinedAt: Date },
    { userId: 'userId2', role: 'member', joinedAt: Date }
  ],
  avatar: "url",
  settings: {
    isPublic: false,
    allowInvites: true
  },
  latestMessage: {...},
  createdAt: Date
}
```

#### 3. **Message**
```typescript
{
  _id: ObjectId,
  chatId: ObjectId,
  senderId: 'userId1',
  type: 'text' | 'image' | 'file',
  content: "Hello!",
  status: 'sent' | 'delivered' | 'read',
  readBy: [{ userId: 'userId2', readAt: Date }],
  createdAt: Date
}
```

---

## 🔄 Complete Workflow: Sending a Message

### Step-by-Step Flow

```
User A sends message "Hello" to User B
│
├─ 1. Frontend → WebSocket Server
│   └─ WebSocket receives message event
│
├─ 2. WebSocket Server → Redis Pub/Sub
│   └─ Immediately publish to channel: chat:{chatId}
│   └─ All connected clients in this chat receive instantly
│
├─ 3. WebSocket Server → RabbitMQ
│   └─ Publish to "message-persist" queue
│   └─ Message: { chatId, senderId, content, timestamp }
│
├─ 4. Worker Service (Consumer) → MongoDB
│   └─ Consumes from "message-persist" queue
│   └─ Saves message to Messages collection
│   └─ Updates Chat.latestMessage
│
├─ 5. Worker Service → RabbitMQ
│   └─ Publish to "notification-send" queue (if user offline)
│   └─ Publish to "message-index" queue (for search)
│
└─ 6. Notification Service → Push Notification
   └─ Sends push notification to User B's device
```

---

## 💻 Example Code Implementation

### 1. WebSocket Server (Chat Service)

```typescript
// src/websocket/server.ts
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { publishToQueue } from './config/rabbitmq';
import { verifyToken } from './middleware/auth';

const redisClient = createClient();
const redisSubscriber = createClient();

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Redis Pub/Sub for message broadcasting
redisSubscriber.subscribe('chat:messages');
redisSubscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
  // Broadcast to all clients in the chat room
  io.to(`chat:${data.chatId}`).emit('new-message', data);
});

// WebSocket Connection Handler
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = await verifyToken(token);
    socket.data.userId = user._id;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  
  // Mark user as online in Redis
  redisClient.set(`user:${userId}:online`, 'true', { EX: 300 });
  
  // Join user's personal room
  socket.join(`user:${userId}`);
  
  // Join all user's chat rooms
  socket.on('join-chats', async (chatIds: string[]) => {
    chatIds.forEach(chatId => {
      socket.join(`chat:${chatId}`);
    });
  });
  
  // Handle new message
  socket.on('send-message', async (data: {
    chatId: string;
    content: string;
    type: string;
  }) => {
    const message = {
      chatId: data.chatId,
      senderId: userId,
      content: data.content,
      type: data.type,
      timestamp: new Date(),
      status: 'sent'
    };
    
    // 1. Immediately broadcast via Redis Pub/Sub (fast path)
    await redisClient.publish(
      'chat:messages',
      JSON.stringify(message)
    );
    
    // 2. Queue for persistence (async)
    await publishToQueue('message-persist', message);
    
    // 3. Update typing status
    socket.to(`chat:${data.chatId}`).emit('user-typing', {
      userId,
      isTyping: false
    });
  });
  
  // Handle typing indicator
  socket.on('typing', (data: { chatId: string; isTyping: boolean }) => {
    socket.to(`chat:${data.chatId}`).emit('user-typing', {
      userId,
      isTyping: data.isTyping
    });
  });
  
  // Handle read receipt
  socket.on('mark-read', async (data: { chatId: string; messageId: string }) => {
    // Queue read receipt update
    await publishToQueue('message-read', {
      chatId: data.chatId,
      messageId: data.messageId,
      userId
    });
    
    // Notify sender
    socket.to(`chat:${data.chatId}`).emit('message-read', {
      messageId: data.messageId,
      readBy: userId
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    redisClient.del(`user:${userId}:online`);
    socket.to(`user:${userId}`).emit('user-offline', { userId });
  });
});
```

### 2. Message Persistence Worker

```typescript
// src/workers/messagePersist.ts
import { consumeFromQueue } from './config/rabbitmq';
import { Message } from './models/Message';
import { Chat } from './models/Chat';
import { createClient } from 'redis';

const redisClient = createClient();

// Consumer for message persistence
consumeFromQueue('message-persist', async (message) => {
  try {
    const { chatId, senderId, content, type, timestamp } = message;
    
    // 1. Save message to MongoDB
    const savedMessage = await Message.create({
      chatId,
      senderId,
      content,
      type,
      status: 'sent',
      createdAt: timestamp
    });
    
    // 2. Update chat's latest message
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: {
        text: content,
        sender: senderId,
        timestamp
      },
      updatedAt: new Date()
    });
    
    // 3. Cache recent messages in Redis (last 50 messages)
    const recentMessages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    await redisClient.set(
      `chat:${chatId}:messages`,
      JSON.stringify(recentMessages),
      { EX: 3600 } // 1 hour cache
    );
    
    // 4. Queue notification if recipient is offline
    const chat = await Chat.findById(chatId);
    const recipientId = chat.users.find(id => id !== senderId);
    const isOnline = await redisClient.get(`user:${recipientId}:online`);
    
    if (!isOnline) {
      await publishToQueue('notification-send', {
        userId: recipientId,
        type: 'new-message',
        chatId,
        message: content,
        senderId
      });
    }
    
    // 5. Queue for search indexing
    await publishToQueue('message-index', {
      messageId: savedMessage._id,
      chatId,
      content,
      senderId
    });
    
  } catch (error) {
    console.error('Error persisting message:', error);
    // Retry logic or dead letter queue
  }
});
```

### 3. Chat Controller (REST API)

```typescript
// src/controller/chat.ts
import { Request, Response } from 'express';
import { Chat } from '../models/Chat';
import { Message } from '../models/Message';
import { createClient } from 'redis';

const redisClient = createClient();

// Get all chats for a user
export const getUserChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    
    // Try Redis cache first
    const cacheKey = `user:${userId}:chats`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json({ chats: JSON.parse(cached) });
    }
    
    // Fetch from DB
    const chats = await Chat.find({ users: userId })
      .sort({ updatedAt: -1 })
      .populate('users', 'name email avatar')
      .lean();
    
    // Cache for 5 minutes
    await redisClient.set(cacheKey, JSON.stringify(chats), { EX: 300 });
    
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chats' });
  }
};

// Get messages for a chat
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    
    // Try Redis cache for recent messages
    const cacheKey = `chat:${chatId}:messages`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached && page === 1) {
      return res.json({ messages: JSON.parse(cached) });
    }
    
    // Fetch from DB with pagination
    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'name avatar')
      .lean();
    
    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

// Create group chat
export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body;
    const adminId = req.user._id;
    
    const group = await Chat.create({
      type: 'group',
      name,
      description,
      admin: adminId,
      members: [
        { userId: adminId, role: 'admin', joinedAt: new Date() },
        ...memberIds.map((id: string) => ({
          userId: id,
          role: 'member',
          joinedAt: new Date()
        }))
      ],
      users: [adminId, ...memberIds]
    });
    
    // Notify all members via WebSocket
    // (This would be done through Redis Pub/Sub)
    
    res.json({ group });
  } catch (error) {
    res.status(500).json({ message: 'Error creating group' });
  }
};
```

### 4. Notification Worker

```typescript
// src/workers/notificationWorker.ts
import { consumeFromQueue } from './config/rabbitmq';
import { User } from '../models/User';

consumeFromQueue('notification-send', async (data) => {
  try {
    const { userId, type, chatId, message, senderId } = data;
    
    // Get user's device tokens
    const user = await User.findById(userId);
    const deviceTokens = user.deviceTokens || [];
    
    // Get sender info
    const sender = await User.findById(senderId);
    
    // Send push notification to each device
    for (const token of deviceTokens) {
      await sendPushNotification({
        token,
        title: sender.name,
        body: message,
        data: { chatId, type }
      });
    }
    
    // Optionally send email notification
    if (user.emailNotifications) {
      await publishToQueue('email-send', {
        to: user.email,
        subject: `New message from ${sender.name}`,
        template: 'new-message',
        data: { senderName: sender.name, message }
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
});
```

---

## 🔑 Key Design Patterns

### 1. **Write-Through Cache Pattern**
- Write to Redis immediately for fast reads
- Async write to MongoDB for persistence
- Best of both worlds: speed + durability

### 2. **Pub/Sub for Real-time**
- Redis Pub/Sub for instant message delivery
- WebSocket for client connection
- Decouples message sending from delivery

### 3. **Queue-Based Processing**
- Heavy operations (DB writes, notifications) go to queues
- Prevents blocking the main request
- Enables horizontal scaling

### 4. **Room-Based Broadcasting**
- Each chat is a Socket.IO room
- Messages broadcast only to room members
- Efficient and scalable

---

## 📈 Scalability Considerations

### Horizontal Scaling
```
┌─────────────┐
│  Load       │
│  Balancer   │
└──────┬──────┘
       │
   ┌───┴───┬─────────┬─────────┐
   │       │         │         │
┌──▼──┐ ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│WS   │ │WS   │  │WS   │  │WS   │
│Srv1 │ │Srv2 │  │Srv3 │  │Srv4 │
└──┬──┘ └──┬──┘  └──┬──┘  └──┬──┘
   │       │         │         │
   └───┬───┴─────────┴─────────┘
       │
   ┌───▼───┐
   │ Redis │ (Shared state & Pub/Sub)
   │Cluster│
   └───┬───┘
       │
   ┌───▼───┐
   │RabbitMQ│ (Message Queue)
   └───┬───┘
       │
   ┌───▼───┐
   │MongoDB│ (Database)
   └───────┘
```

### Redis for Shared State
- All WebSocket servers connect to same Redis
- Pub/Sub ensures messages reach all servers
- Session data shared across instances

### Sticky Sessions (Optional)
- Use session affinity in load balancer
- Client always connects to same server
- Reduces Redis Pub/Sub overhead

---

## 🎯 Feature Implementation Examples

### Typing Indicators
```typescript
// Client sends typing event
socket.on('typing', (data) => {
  // Store in Redis with TTL
  redisClient.set(
    `chat:${data.chatId}:typing:${userId}`,
    'true',
    { EX: 3 } // Auto-expire after 3 seconds
  );
  
  // Broadcast to chat room
  socket.to(`chat:${data.chatId}`).emit('user-typing', {
    userId,
    isTyping: true
  });
});
```

### Online/Offline Status
```typescript
// On connect
redisClient.set(`user:${userId}:online`, 'true', { EX: 300 });

// Heartbeat every 60 seconds
setInterval(() => {
  redisClient.set(`user:${userId}:online`, 'true', { EX: 300 });
}, 60000);

// On disconnect
redisClient.del(`user:${userId}:online`);
```

### Read Receipts
```typescript
// When user opens chat
socket.on('mark-chat-read', async (chatId) => {
  // Update all unread messages
  await Message.updateMany(
    { chatId, readBy: { $ne: userId } },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );
  
  // Notify other participants
  socket.to(`chat:${chatId}`).emit('chat-read', {
    chatId,
    readBy: userId
  });
});
```

---

## 🔐 Security Considerations

1. **Authentication**: Verify JWT on WebSocket connection
2. **Authorization**: Check user is member of chat before joining room
3. **Rate Limiting**: Limit messages per user per second (Redis)
4. **Input Validation**: Sanitize message content
5. **Encryption**: Use WSS (WebSocket Secure) in production

---

## 📊 Performance Optimizations

1. **Message Pagination**: Load 50 messages at a time
2. **Redis Caching**: Cache recent messages and chat lists
3. **Lazy Loading**: Load older messages on scroll
4. **Connection Pooling**: Reuse DB connections
5. **Indexes**: Index `chatId`, `senderId`, `createdAt` in MongoDB

---

## 🚀 Summary

**Flow Summary:**
1. **User sends message** → WebSocket receives
2. **Redis Pub/Sub** → Instant delivery to all connected clients
3. **RabbitMQ** → Queue for async processing
4. **Worker** → Saves to MongoDB, sends notifications
5. **Redis Cache** → Stores recent messages for fast retrieval

**Benefits:**
- ✅ Real-time delivery (WebSocket + Redis Pub/Sub)
- ✅ Scalable (multiple WebSocket servers)
- ✅ Reliable (RabbitMQ ensures message persistence)
- ✅ Fast (Redis caching)
- ✅ Durable (MongoDB storage)

This architecture handles millions of messages efficiently while maintaining real-time performance!



