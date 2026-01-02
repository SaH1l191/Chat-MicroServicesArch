# Quick Start: Redis & Queue Integration

## 📦 Required Packages

Install the following packages in your chat service:

```bash
cd be/chat
pnpm add redis ioredis
pnpm add -D @types/amqplib  # If not already installed
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
# Or for Redis cluster:
# REDIS_URL=redis://redis-1:6379,redis://redis-2:6379,redis://redis-3:6379

# RabbitMQ (if not already configured)
Rabbitmq_Host=localhost
Rabbitmq_Port=5672
Rabbitmq_Username=guest
Rabbitmq_Password=guest

# User Service (for fetching user data)
USER_SERVICE=http://localhost:3001
```

## 🚀 Setup Steps

### 1. Install Redis
```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server
```

### 2. Verify RabbitMQ is Running
```bash
# Check if RabbitMQ is accessible
# Default: http://localhost:15672 (management UI)
# Username: guest, Password: guest
```

### 3. Update Your Controllers

You have two options:

**Option A: Use Enhanced Controller (Recommended)**
- Replace `chat.ts` with `chat.enhanced.ts` (or merge the changes)
- This includes Redis caching and queue integration

**Option B: Gradual Migration**
- Keep existing `chat.ts` for now
- Use `chat.enhanced.ts` as reference
- Gradually add caching to existing functions

### 4. Start the Service

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## 📋 What's Been Added

### New Files:
1. **`src/config/redis.ts`** - Redis connection and utility functions
2. **`src/config/rabbitmq.ts`** - Enhanced RabbitMQ configuration with queues
3. **`src/workers/messagePersistWorker.ts`** - Background worker for message persistence
4. **`src/workers/notificationWorker.ts`** - Background worker for notifications
5. **`src/workers/messageReadWorker.ts`** - Background worker for read receipts
6. **`src/controller/chat.enhanced.ts`** - Enhanced controller with caching

### Updated Files:
1. **`src/index.ts`** - Now initializes Redis and starts workers

## 🔄 How It Works

### Message Flow:
```
1. Client sends message → WebSocket/API
2. Fast Path: Redis Pub/Sub → Instant delivery to all clients
3. Slow Path: RabbitMQ Queue → Background worker saves to DB
4. Worker updates Redis cache → Future reads are fast
5. Worker queues notifications → For offline users
```

### Caching Strategy:
- **Chat List**: Cached for 5 minutes, invalidated on new message
- **Recent Messages**: Cached for 1 hour, last 50 messages
- **Chat Info**: Cached for 1 hour
- **User Online Status**: Cached for 5 minutes, refreshed on heartbeat

## 🧪 Testing

### Test Redis Connection:
```typescript
import { connectRedis, cacheSet, cacheGet } from './config/redis';

await connectRedis();
await cacheSet('test', { hello: 'world' }, 60);
const value = await cacheGet('test');
console.log(value); // { hello: 'world' }
```

### Test Queue:
```typescript
import { publishToQueue } from './config/rabbitmq';

await publishToQueue('message-persist', {
  chatId: 'test',
  senderId: 'user1',
  content: 'Hello',
  type: 'text'
});
```

## 📊 Monitoring

### Redis Monitoring:
- Use `redis-cli` to check cache: `redis-cli GET "user:userId:chats"`
- Monitor memory: `redis-cli INFO memory`
- Check connected clients: `redis-cli CLIENT LIST`

### RabbitMQ Monitoring:
- Access management UI: http://localhost:15672
- Check queue depths
- Monitor message rates
- View dead letter queues

## 🐛 Troubleshooting

### Redis Connection Failed:
- Check if Redis is running: `redis-cli ping`
- Verify `REDIS_URL` in `.env`
- Check firewall/network settings

### RabbitMQ Connection Failed:
- Check if RabbitMQ is running: `docker ps` or `systemctl status rabbitmq`
- Verify credentials in `.env`
- Check port 5672 is accessible

### Workers Not Processing:
- Check if workers are started in `index.ts`
- Verify queue names match in publisher and consumer
- Check RabbitMQ management UI for queue status

## 🎯 Next Steps

1. **Add WebSocket Integration**: Use Redis Pub/Sub for cross-server communication
2. **Add Monitoring**: Set up metrics for cache hit rates, queue depths
3. **Add Rate Limiting**: Use Redis for rate limiting message sends
4. **Optimize Cache Keys**: Review and optimize cache TTLs based on usage
5. **Add Cache Warming**: Pre-populate cache for active chats

## 📚 Related Documentation

- **High-Level Design**: See `SCALABILITY_CACHING_HLD.md`
- **Group Chat Implementation**: See `GROUP_CHAT_IMPLEMENTATION.md`
- **Architecture Overview**: See `../CHAT_ARCHITECTURE_HLD.md`


