# High-Level Design: Caching & Scalability Architecture

## Overview
This document provides a comprehensive high-level design for implementing **Redis caching**, **RabbitMQ queues**, and **scalability patterns** in your chat microservices architecture. It explains how WebSocket, Redis, and queues work together to create a highly scalable, real-time chat system.

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Web     │  │  Mobile  │  │  Desktop │  │  API     │       │
│  │  App     │  │  App     │  │  App     │  │  Client  │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                    │
        ┌───────────▼────────────┐
        │   Load Balancer        │
        │   (NGINX/HAProxy)      │
        └───────────┬────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼───┐      ┌───▼───┐      ┌───▼───┐
│ API   │      │ API   │      │ API   │
│ Server│      │ Server│      │ Server│
│  1    │      │  2    │      │  N    │
└───┬───┘      └───┬───┘      └───┬───┘
    │              │              │
    └──────────────┼──────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐     ┌───▼───┐     ┌───▼───┐
│WebSocket│    │WebSocket│    │WebSocket│
│ Server  │    │ Server  │    │ Server  │
│   1     │    │   2     │    │   N     │
└───┬───┘     └───┬───┘     └───┬───┘
    │             │              │
    └─────────────┼──────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│ Redis │    │RabbitMQ│   │MongoDB│
│Cluster│    │ Cluster│   │Replica│
│       │    │        │   │  Set  │
└───────┘    └────────┘   └───────┘
```

---

## 🔄 Data Flow: Complete Message Journey

### Scenario: User A sends a message to User B in a chat

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Message Received via WebSocket                          │
└─────────────────────────────────────────────────────────────────┘
Client A → WebSocket Server (Instance 1)
  ├─ Authenticate user (JWT validation)
  ├─ Validate chat membership
  └─ Receive message payload

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Fast Path - Real-time Delivery (Redis Pub/Sub)         │
└─────────────────────────────────────────────────────────────────┘
WebSocket Server → Redis Pub/Sub
  ├─ Publish to channel: "chat:{chatId}"
  ├─ Message: { chatId, senderId, content, timestamp, messageId }
  └─ TTL: None (ephemeral, for real-time only)

Redis Pub/Sub → All WebSocket Servers
  ├─ Server 1 subscribes → Receives message
  ├─ Server 2 subscribes → Receives message
  └─ Server N subscribes → Receives message

Each WebSocket Server → Connected Clients
  ├─ Check if client is in room: "chat:{chatId}"
  ├─ If yes → Emit 'new-message' event
  └─ Client B receives message instantly (< 10ms)

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Persistence Path - Queue for DB Write (RabbitMQ)      │
└─────────────────────────────────────────────────────────────────┘
WebSocket Server → RabbitMQ Queue: "message-persist"
  ├─ Queue: Durable (survives restart)
  ├─ Message: { chatId, senderId, content, type, timestamp }
  └─ Acknowledgment: Fire-and-forget (non-blocking)

┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Worker Processing (Background)                         │
└─────────────────────────────────────────────────────────────────┘
Worker Service (Consumer) → Consumes from "message-persist"
  ├─ Save message to MongoDB
  ├─ Update Chat.latestMessage
  ├─ Update Redis cache (write-through)
  └─ Publish to next queues (if needed)

┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Cache Update (Redis Write-Through)                  │
└─────────────────────────────────────────────────────────────────┘
Worker → Redis Cache
  ├─ Key: "chat:{chatId}:messages"
  ├─ Value: Last 50 messages (JSON array)
  ├─ TTL: 1 hour
  └─ Strategy: Append new message, trim to 50

┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Notification Queue (If User Offline)                   │
└─────────────────────────────────────────────────────────────────┘
Worker → Check Redis: "user:{userId}:online"
  ├─ If offline → Publish to "notification-send" queue
  └─ If online → Skip (already received via WebSocket)

Notification Worker → Consumes "notification-send"
  ├─ Get user's device tokens
  ├─ Send push notification
  └─ Log notification sent
```

---

## 📦 Redis Caching Strategy

### 1. Cache-Aside Pattern (Read-Heavy Operations)

**Use Case:** Fetching chat lists, user profiles, recent messages

```typescript
// Example: Get user's chat list
async function getUserChats(userId: string) {
  const cacheKey = `user:${userId}:chats`;
  
  // 1. Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Cache miss - fetch from DB
  const chats = await Chat.find({ users: userId })
    .sort({ updatedAt: -1 })
    .lean();
  
  // 3. Populate cache for next time
  await redis.setex(cacheKey, 300, JSON.stringify(chats)); // 5 min TTL
  
  return chats;
}
```

**Cache Keys:**
- `user:{userId}:chats` - User's chat list (TTL: 5 min)
- `chat:{chatId}:info` - Chat metadata (TTL: 1 hour)
- `user:{userId}:profile` - User profile (TTL: 15 min)
- `group:{groupId}:members` - Group members list (TTL: 10 min)

### 2. Write-Through Pattern (Message Caching)

**Use Case:** Caching recent messages for fast retrieval

```typescript
// When message is saved to DB, also update cache
async function saveMessage(messageData: any) {
  // 1. Save to MongoDB (via queue)
  await publishToQueue('message-persist', messageData);
  
  // 2. Update Redis cache immediately
  const cacheKey = `chat:${messageData.chatId}:messages`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    const messages = JSON.parse(cached);
    messages.push(messageData);
    // Keep only last 50 messages
    const recent = messages.slice(-50);
    await redis.setex(cacheKey, 3600, JSON.stringify(recent));
  }
}
```

**Cache Keys:**
- `chat:{chatId}:messages` - Last 50 messages (TTL: 1 hour)
- `chat:{chatId}:unread:{userId}` - Unread count (TTL: 5 min)

### 3. Write-Behind Pattern (High Write Volume)

**Use Case:** Typing indicators, online status (ephemeral data)

```typescript
// Write to Redis only, sync to DB periodically
async function updateTypingStatus(chatId: string, userId: string) {
  const key = `chat:${chatId}:typing:${userId}`;
  
  // Write to Redis with short TTL
  await redis.setex(key, 3, 'true'); // Auto-expire after 3 seconds
  
  // Optionally: Queue for analytics (non-critical)
  await publishToQueue('analytics:typing', { chatId, userId, timestamp: Date.now() });
}
```

**Cache Keys:**
- `chat:{chatId}:typing:{userId}` - Typing indicator (TTL: 3 seconds)
- `user:{userId}:online` - Online status (TTL: 5 min, refreshed on heartbeat)

### 4. Redis Pub/Sub for Real-time Events

**Use Case:** Cross-server message broadcasting

```typescript
// Publisher (WebSocket Server)
async function broadcastMessage(chatId: string, message: any) {
  await redis.publish(`chat:${chatId}`, JSON.stringify(message));
}

// Subscriber (All WebSocket Servers)
redis.subscribe('chat:*', (channel, message) => {
  const data = JSON.parse(message);
  const chatId = channel.split(':')[1];
  
  // Broadcast to all clients in this chat room
  io.to(`chat:${chatId}`).emit('new-message', data);
});
```

**Pub/Sub Channels:**
- `chat:{chatId}` - New messages in chat
- `user:{userId}` - User-specific events (notifications)
- `group:{groupId}` - Group events (member added, etc.)

---

## 🚀 RabbitMQ Queue Architecture

### Queue Design Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    QUEUE HIERARCHY                           │
└─────────────────────────────────────────────────────────────┘

Primary Queues (High Priority)
├─ message-persist          → Save messages to MongoDB
├─ message-read             → Update read receipts
└─ chat-update              → Update chat metadata

Secondary Queues (Medium Priority)
├─ notification-send        → Push notifications
├─ email-send               → Email notifications
└─ message-index            → Search indexing

Background Queues (Low Priority)
├─ analytics                → Message analytics
├─ user-activity            → Activity tracking
└─ cleanup                  → Cache cleanup, old data
```

### Queue Configuration

```typescript
// Queue definitions with priorities
const QUEUES = {
  'message-persist': {
    durable: true,
    maxPriority: 10,
    arguments: {
      'x-max-priority': 10,
      'x-message-ttl': 3600000, // 1 hour
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'message-persist-failed'
    }
  },
  'notification-send': {
    durable: true,
    maxPriority: 5,
    arguments: {
      'x-max-priority': 5,
      'x-message-ttl': 86400000 // 24 hours
    }
  },
  'analytics': {
    durable: false, // Can lose messages
    maxPriority: 1
  }
};
```

### Message Priority System

```typescript
// High priority: Direct messages
await publishToQueue('message-persist', messageData, { priority: 10 });

// Medium priority: Group messages
await publishToQueue('message-persist', messageData, { priority: 5 });

// Low priority: System messages
await publishToQueue('message-persist', messageData, { priority: 1 });
```

### Dead Letter Queue (DLQ) Pattern

```typescript
// Failed messages go to DLQ for retry
const dlqConfig = {
  exchange: 'dlx',
  routingKey: 'message-persist-failed',
  queue: 'dlq-message-persist'
};

// Retry logic
consumeFromQueue('dlq-message-persist', async (message, retryCount) => {
  if (retryCount < 3) {
    // Retry after delay
    await delay(1000 * retryCount);
    await publishToQueue('message-persist', message);
  } else {
    // Log to monitoring system
    await logError('Message persistence failed after 3 retries', message);
  }
});
```

---

## 🔄 Complete Integration: WebSocket + Redis + RabbitMQ

### Message Sending Flow (Detailed)

```typescript
// WebSocket Handler
io.on('connection', (socket) => {
  socket.on('send-message', async (data) => {
    const { chatId, content, type } = data;
    const senderId = socket.data.userId;
    
    // 1. Validate (check cache first)
    const chatKey = `chat:${chatId}:info`;
    let chat = await redis.get(chatKey);
    
    if (!chat) {
      // Cache miss - fetch from DB
      chat = await Chat.findById(chatId);
      await redis.setex(chatKey, 3600, JSON.stringify(chat));
    } else {
      chat = JSON.parse(chat);
    }
    
    // Validate user is member
    if (!chat.users.includes(senderId)) {
      return socket.emit('error', { message: 'Not a member' });
    }
    
    // 2. Create message object
    const message = {
      messageId: generateId(),
      chatId,
      senderId,
      content,
      type,
      timestamp: new Date(),
      status: 'sent'
    };
    
    // 3. FAST PATH: Redis Pub/Sub (real-time delivery)
    await redis.publish(`chat:${chatId}`, JSON.stringify(message));
    
    // 4. SLOW PATH: Queue for persistence (async)
    await publishToQueue('message-persist', {
      ...message,
      priority: chat.chatType === 'direct' ? 10 : 5
    });
    
    // 5. Update typing indicator cache
    await redis.del(`chat:${chatId}:typing:${senderId}`);
    
    // 6. Return acknowledgment
    socket.emit('message-sent', { messageId: message.messageId });
  });
});
```

### Message Persistence Worker

```typescript
// Worker Service
consumeFromQueue('message-persist', async (messageData) => {
  try {
    // 1. Save to MongoDB
    const savedMessage = await Message.create(messageData);
    
    // 2. Update Chat.latestMessage
    await Chat.findByIdAndUpdate(messageData.chatId, {
      latestMessage: {
        text: messageData.content,
        sender: messageData.senderId,
        timestamp: messageData.timestamp
      },
      updatedAt: new Date()
    });
    
    // 3. Update Redis cache (write-through)
    const cacheKey = `chat:${messageData.chatId}:messages`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      const messages = JSON.parse(cached);
      messages.push(savedMessage);
      const recent = messages.slice(-50); // Keep last 50
      await redis.setex(cacheKey, 3600, JSON.stringify(recent));
    } else {
      // Cache miss - fetch and cache
      const recentMessages = await Message.find({ chatId: messageData.chatId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      await redis.setex(cacheKey, 3600, JSON.stringify(recentMessages.reverse()));
    }
    
    // 4. Invalidate chat list cache for all participants
    const chat = await Chat.findById(messageData.chatId);
    for (const userId of chat.users) {
      await redis.del(`user:${userId}:chats`);
    }
    
    // 5. Check if recipients are online
    const recipients = chat.users.filter(id => id !== messageData.senderId);
    for (const recipientId of recipients) {
      const isOnline = await redis.get(`user:${recipientId}:online`);
      
      if (!isOnline) {
        // Queue notification
        await publishToQueue('notification-send', {
          userId: recipientId,
          chatId: messageData.chatId,
          message: messageData.content,
          senderId: messageData.senderId,
          priority: 5
        });
      }
    }
    
    // 6. Queue for search indexing (low priority)
    await publishToQueue('message-index', {
      messageId: savedMessage._id,
      chatId: messageData.chatId,
      content: messageData.content,
      senderId: messageData.senderId
    }, { priority: 1 });
    
  } catch (error) {
    console.error('Error persisting message:', error);
    // Send to DLQ for retry
    await publishToQueue('dlq-message-persist', messageData);
  }
});
```

### Redis Pub/Sub Subscriber (All WebSocket Servers)

```typescript
// Each WebSocket server subscribes to Redis channels
const redisSubscriber = createClient();

// Subscribe to chat channels
redisSubscriber.psubscribe('chat:*');

redisSubscriber.on('pmessage', (pattern, channel, message) => {
  const data = JSON.parse(message);
  const chatId = channel.split(':')[1];
  
  // Broadcast to all clients in this chat room
  io.to(`chat:${chatId}`).emit('new-message', data);
  
  // Also emit to sender for confirmation
  io.to(`user:${data.senderId}`).emit('message-delivered', {
    messageId: data.messageId,
    chatId
  });
});
```

---

## 📊 Scalability Patterns

### 1. Horizontal Scaling of WebSocket Servers

**Challenge:** WebSocket connections are stateful. How to share state across servers?

**Solution:** Redis for shared state + Pub/Sub for cross-server communication

```typescript
// Each server maintains its own Socket.IO instance
// But all servers connect to the same Redis cluster

// Server 1
const io1 = new Server(server1);
io1.on('connection', (socket) => {
  socket.join(`chat:${chatId}`);
  // Only clients connected to Server 1 receive direct emits
});

// Server 2
const io2 = new Server(server2);
io2.on('connection', (socket) => {
  socket.join(`chat:${chatId}`);
  // Only clients connected to Server 2 receive direct emits
});

// But Redis Pub/Sub ensures all servers receive the message
// Each server then broadcasts to its own connected clients
```

**Load Balancing:**
- Use **sticky sessions** (session affinity) so client always connects to same server
- Or use **Redis adapter** for Socket.IO (handles this automatically)

### 2. Redis Cluster Configuration

```typescript
// Redis Cluster Setup
const redis = createCluster({
  rootNodes: [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 }
  ],
  defaults: {
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) return new Error('Max retries exceeded');
        return Math.min(retries * 50, 1000);
      }
    }
  }
});
```

### 3. RabbitMQ Cluster for High Availability

```typescript
// RabbitMQ Cluster Connection
const connection = await amqp.connect({
  protocol: 'amqp',
  hostname: 'rabbitmq-cluster', // DNS resolves to cluster
  port: 5672,
  // Connection will automatically failover to other nodes
});
```

### 4. Database Read Replicas

```typescript
// MongoDB Connection with Read Replicas
mongoose.connect(process.env.MONGO_URI, {
  readPreference: 'secondaryPreferred', // Read from replica if available
  replicaSet: 'rs0'
});

// Write operations go to primary
// Read operations can go to replicas
```

---

## 🎯 Caching Strategies by Use Case

### 1. Chat List (Frequently Accessed)

```typescript
// Cache key: user:{userId}:chats
// TTL: 5 minutes
// Invalidation: On new message, member added/removed

async function getUserChats(userId: string) {
  const cacheKey = `user:${userId}:chats`;
  
  // Try cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from DB
  const chats = await Chat.find({ users: userId })
    .sort({ updatedAt: -1 })
    .populate('users', 'name avatar')
    .lean();
  
  // Cache with TTL
  await redis.setex(cacheKey, 300, JSON.stringify(chats));
  
  return chats;
}

// Invalidate on message
async function invalidateChatListCache(chatId: string) {
  const chat = await Chat.findById(chatId);
  for (const userId of chat.users) {
    await redis.del(`user:${userId}:chats`);
  }
}
```

### 2. Recent Messages (Write-Through)

```typescript
// Cache key: chat:{chatId}:messages
// TTL: 1 hour
// Strategy: Keep last 50 messages

async function getChatMessages(chatId: string, page: number = 1) {
  const cacheKey = `chat:${chatId}:messages`;
  
  // For first page, try cache
  if (page === 1) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }
  
  // Fetch from DB with pagination
  const limit = 50;
  const messages = await Message.find({ chatId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  // Cache first page
  if (page === 1) {
    await redis.setex(cacheKey, 3600, JSON.stringify(messages.reverse()));
  }
  
  return messages.reverse();
}
```

### 3. User Online Status

```typescript
// Cache key: user:{userId}:online
// TTL: 5 minutes (refreshed on heartbeat)
// Strategy: Write-behind (ephemeral)

async function markUserOnline(userId: string) {
  await redis.setex(`user:${userId}:online`, 300, 'true');
  
  // Publish online event
  await redis.publish(`user:${userId}`, JSON.stringify({
    type: 'online',
    userId,
    timestamp: Date.now()
  }));
}

async function isUserOnline(userId: string): Promise<boolean> {
  const status = await redis.get(`user:${userId}:online`);
  return status === 'true';
}

// Heartbeat every 60 seconds
setInterval(async () => {
  const userId = getCurrentUserId();
  await redis.setex(`user:${userId}:online`, 300, 'true');
}, 60000);
```

### 4. Typing Indicators

```typescript
// Cache key: chat:{chatId}:typing:{userId}
// TTL: 3 seconds (auto-expire)
// Strategy: Write-behind (ephemeral, no DB)

async function setTypingStatus(chatId: string, userId: string, isTyping: boolean) {
  const key = `chat:${chatId}:typing:${userId}`;
  
  if (isTyping) {
    await redis.setex(key, 3, 'true');
  } else {
    await redis.del(key);
  }
  
  // Broadcast via WebSocket (not Redis Pub/Sub for typing)
  io.to(`chat:${chatId}`).emit('typing', { userId, isTyping });
}

async function getTypingUsers(chatId: string): Promise<string[]> {
  const pattern = `chat:${chatId}:typing:*`;
  const keys = await redis.keys(pattern);
  return keys.map(key => key.split(':').pop());
}
```

---

## 🔧 Implementation Checklist

### Phase 1: Redis Setup
- [ ] Install Redis client library (`ioredis` or `redis`)
- [ ] Configure Redis connection (single instance or cluster)
- [ ] Implement cache utility functions
- [ ] Set up Redis Pub/Sub subscribers
- [ ] Add cache invalidation logic

### Phase 2: RabbitMQ Enhancement
- [ ] Add queue consumers for message persistence
- [ ] Implement dead letter queues
- [ ] Add message priority system
- [ ] Set up queue monitoring
- [ ] Implement retry logic

### Phase 3: Integration
- [ ] Integrate Redis caching in controllers
- [ ] Add Redis Pub/Sub for cross-server communication
- [ ] Update WebSocket handlers to use Redis
- [ ] Implement write-through caching for messages
- [ ] Add cache invalidation on updates

### Phase 4: Scalability
- [ ] Set up Redis cluster (if needed)
- [ ] Configure RabbitMQ cluster
- [ ] Implement load balancing for WebSocket servers
- [ ] Add monitoring and metrics
- [ ] Performance testing

---

## 📈 Performance Metrics

### Target Latencies
- **WebSocket message delivery**: < 10ms (via Redis Pub/Sub)
- **Cache hit response**: < 5ms
- **Cache miss (DB query)**: < 50ms
- **Queue processing**: < 100ms (background)

### Scalability Targets
- **Concurrent WebSocket connections**: 100K+ per server
- **Messages per second**: 10K+ (with horizontal scaling)
- **Cache hit ratio**: > 80%
- **Queue processing rate**: 5K+ messages/second

---

## 🛡️ Failure Handling

### Redis Failure
- **Fallback**: Direct DB queries (slower but functional)
- **Circuit breaker**: Stop caching if Redis is down
- **Monitoring**: Alert on Redis connection failures

### RabbitMQ Failure
- **Retry**: Exponential backoff for failed messages
- **Dead letter queue**: Store failed messages for manual review
- **Monitoring**: Alert on queue depth and processing delays

### WebSocket Server Failure
- **Load balancer**: Health checks, remove unhealthy servers
- **Client reconnection**: Auto-reconnect with exponential backoff
- **State recovery**: Rejoin rooms on reconnect

---

## 📚 Key Takeaways

1. **Redis for Speed**: Cache frequently accessed data, use Pub/Sub for real-time
2. **RabbitMQ for Reliability**: Queue heavy operations, ensure message persistence
3. **WebSocket for Real-time**: Direct client communication, enhanced by Redis Pub/Sub
4. **Horizontal Scaling**: All components (Redis, RabbitMQ, WebSocket) can scale horizontally
5. **Cache Strategy**: Use cache-aside for reads, write-through for writes, write-behind for ephemeral data

This architecture supports millions of users and messages while maintaining sub-10ms real-time delivery!

