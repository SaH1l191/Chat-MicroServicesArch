# Chat Microservices Application

A real-time chat application built with a microservices architecture, featuring instant messaging, image sharing, read receipts, typing indicators, and more.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Background Workers](#background-workers)
- [Real-time Features](#real-time-features)
- [Authentication & Security](#authentication--security)
- [Running the Application](#running-the-application)

## 🎯 Overview

This is a full-stack real-time chat application built using a microservices architecture. The system consists of three backend services (User, Chat, and Mail) and a Next.js frontend application. The application supports instant messaging, image sharing, read receipts, typing indicators, and uses RabbitMQ for asynchronous message processing.

## 🏗️ Architecture

The application follows a **microservices architecture** with the following services:

### Backend Services

1. **User Service** (`be/user/`)
   - Port: 3000 (default)
   - Handles user authentication, OTP verification, and user management
   - Uses MongoDB for user data storage
   - Uses Redis for OTP storage and rate limiting

2. **Chat Service** (`be/chat/`)
   - Port: 3002 (default)
   - Handles chat creation, message sending, and real-time communication
   - Uses MongoDB for chat and message storage
   - Uses Socket.IO for WebSocket connections
   - Uses RabbitMQ for asynchronous message processing
   - Uses Cloudinary for image storage

3. **Mail Service** (`be/mail/`)
   - Port: 3001 (default)
   - Handles email sending (OTP emails)
   - Consumes messages from RabbitMQ queue
   - Uses Nodemailer for email delivery

### Frontend

- **Next.js Application** (`fe/`)
   - Port: 3003 (default)
   - React 19 with TypeScript
   - Uses Socket.IO client for real-time updates
   - Uses React Query for data fetching
   - Tailwind CSS for styling

## ✨ Features

### Core Features

- ✅ **User Authentication**
  - OTP-based login (email verification)
  - JWT-based authentication with access and refresh tokens
  - Automatic token refresh
  - Secure HTTP-only cookies

- ✅ **Real-time Messaging**
  - Instant message delivery via WebSocket
  - Text and image messages
  - Message history persistence
  - Chat list with latest messages

- ✅ **Read Receipts**
  - Single tick (✓) for sent messages
  - Double tick (✓✓) for read messages
  - Automatic read marking when viewing chat
  - Real-time read status updates

- ✅ **Typing Indicators**
  - Real-time typing status
  - Shows when other user is typing
  - Auto-hide after 4 seconds

- ✅ **Online Status**
  - Real-time online/offline status
  - Visual indicators in chat interface
  - Socket-based presence tracking

- ✅ **Image Sharing**
  - Upload and share images in chats
  - Cloudinary integration for image storage
  - Image optimization and transformation
  - Support for JPG, PNG, JPEG, GIF, WEBP formats

- ✅ **Chat Management**
  - Create new chats with other users
  - View all chats with latest messages
  - Unread message count
  - Chat list sorted by last activity

- ✅ **Asynchronous Processing**
  - RabbitMQ message queues for:
    - Message storage
    - Message delivery
    - Message notifications
  - Background workers for reliable message processing

### Advanced Features

- **Microservices Communication**
  - Service-to-service API calls
  - RabbitMQ for async communication
  - Graceful fallback handling

- **Scalability**
  - Worker-based architecture
  - Queue-based message processing
  - Horizontal scaling support

- **Security**
  - JWT token authentication
  - HTTP-only cookies
  - CORS configuration
  - Rate limiting for OTP requests
  - Input validation

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose)
- **Cache**: Redis
- **Message Queue**: RabbitMQ (AMQP)
- **WebSocket**: Socket.IO
- **File Storage**: Cloudinary
- **Email**: Nodemailer
- **Authentication**: JWT (jsonwebtoken)

### Frontend

- **Framework**: Next.js 16.x
- **Language**: TypeScript
- **UI Library**: React 19
- **State Management**: React Query (TanStack Query)
- **Styling**: Tailwind CSS 4.x
- **UI Components**: Radix UI, shadcn/ui
- **WebSocket Client**: Socket.IO Client
- **HTTP Client**: Axios
- **Date Formatting**: date-fns

### Infrastructure

- **Package Manager**: pnpm
- **Build Tool**: TypeScript Compiler
- **Process Manager**: Nodemon (development)

## 📁 Project Structure

```
Chat-microservices/
├── be/                          # Backend services
│   ├── chat/                    # Chat service
│   │   ├── src/
│   │   │   ├── config/          # Configuration files
│   │   │   │   ├── db.ts        # MongoDB connection
│   │   │   │   ├── rabbitmq.ts  # RabbitMQ setup
│   │   │   │   └── cloudinary.ts # Cloudinary config
│   │   │   ├── controller/      # Route handlers
│   │   │   │   └── chat.ts      # Chat & message controllers
│   │   │   ├── middleware/      # Express middleware
│   │   │   │   ├── auth.ts      # JWT authentication
│   │   │   │   └── multer.ts    # File upload handling
│   │   │   ├── models/          # Mongoose models
│   │   │   │   ├── Chat.ts      # Chat schema
│   │   │   │   └── Message.ts   # Message schema
│   │   │   ├── routes/          # Express routes
│   │   │   │   └── route.ts     # Chat routes
│   │   │   ├── socket/          # Socket.IO setup
│   │   │   │   └── socket.ts    # WebSocket handlers
│   │   │   ├── workers/         # Background workers
│   │   │   │   ├── messageStorageWorker.ts
│   │   │   │   ├── messageDeliveryWorker.ts
│   │   │   │   └── messageNotificationWorker.ts
│   │   │   └── index.ts         # Service entry point
│   │   └── package.json
│   │
│   ├── user/                     # User service
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── db.ts        # MongoDB connection
│   │   │   │   └── rabbitmq.ts  # RabbitMQ setup
│   │   │   ├── controller/
│   │   │   │   └── user.ts      # User controllers
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts      # JWT authentication
│   │   │   ├── models/
│   │   │   │   └── User.ts      # User schema
│   │   │   ├── routes/
│   │   │   │   └── user.ts      # User routes
│   │   │   ├── utils/
│   │   │   │   └── token.ts     # JWT token utilities
│   │   │   └── index.ts         # Service entry point
│   │   └── package.json
│   │
│   └── mail/                     # Mail service
│       ├── src/
│       │   ├── config/
│       │   │   └── mailConfig.ts # Nodemailer config
│       │   ├── consumer.ts       # RabbitMQ consumer
│       │   └── index.ts          # Service entry point
│       └── package.json
│
└── fe/                           # Frontend application
    ├── app/                      # Next.js app directory
    │   ├── chat/                 # Chat page
    │   ├── login/                # Login page
    │   └── page.tsx              # Home page
    ├── components/               # React components
    │   ├── chat/                 # Chat components
    │   │   ├── ChatInterface.tsx
    │   │   ├── ChatSidebar.tsx
    │   │   └── MessageInput.tsx
    │   └── ui/                   # UI components
    ├── lib/                      # Utilities & API clients
    │   ├── axios.ts              # Axios instance
    │   ├── chatApi.ts            # Chat API client
    │   └── queries/              # React Query hooks
    ├── providers/                # Context providers
    │   ├── AuthProvider.tsx
    │   ├── ChatProvider.tsx
    │   ├── QueryProvider.tsx
    │   └── SocketProvider.tsx
    └── package.json
```

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v10.24.0 or higher)
- **MongoDB** (running locally or connection string)
- **Redis** (running locally or connection string)
- **RabbitMQ** (running locally or connection string)

### Optional Services

- **Cloudinary Account** (for image storage)
- **Email Service** (SMTP credentials for Nodemailer)

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Chat-microservices
```

### 2. Install Dependencies

Install dependencies for all services:

```bash
# Backend services
cd be/user && pnpm install
cd ../chat && pnpm install
cd ../mail && pnpm install

# Frontend
cd ../../fe && pnpm install
```

### 3. Start Infrastructure Services

Ensure the following services are running:

#### MongoDB
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Or use MongoDB Atlas connection string
```

#### Redis
```bash
# Using Docker
docker run -d -p 6379:6379 --name redis redis

# Or use Redis Cloud connection string
```

#### RabbitMQ
```bash
# Using Docker
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:3-management

# Access management UI at http://localhost:15672
# Default credentials: guest/guest
```

### 4. Configure Environment Variables

Create `.env` files in each service directory. See [Environment Variables](#environment-variables) section for details.

### 5. Build TypeScript

Build all TypeScript services:

```bash
cd be/user && pnpm build
cd ../chat && pnpm build
cd ../mail && pnpm build
```

### 6. Start Services

Start services in separate terminals:

**Terminal 1 - User Service:**
```bash
cd be/user
pnpm dev
```

**Terminal 2 - Chat Service:**
```bash
cd be/chat
pnpm dev
```

**Terminal 3 - Mail Service:**
```bash
cd be/mail
pnpm dev
```

**Terminal 4 - Frontend:**
```bash
cd fe
pnpm dev
```

## 🔐 Environment Variables

### User Service (`be/user/.env`)

```env
# Server
PORT=3000
CODEBASE=development  # or "production"
FRONTEND_URL=http://localhost:3003

# Database
MONGODB_URI=mongodb://localhost:27017/chat-users

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret

# RabbitMQ
Rabbitmq_URL=amqp://localhost:5672
```

### Chat Service (`be/chat/.env`)

```env
# Server
PORT=3002
CODEBASE=development  # or "production"
FRONTEND_URL=http://localhost:3003

# Database
MONGODB_URI=mongodb://localhost:27017/chat-messages

# RabbitMQ
Rabbitmq_URL=amqp://localhost:5672

# Cloudinary
CLOUD_NAME=your-cloudinary-cloud-name
API_KEY=your-cloudinary-api-key
API_SECRET=your-cloudinary-api-secret

# User Service (for fetching user data)
NEXT_USER_SERVICE_APP_URL=http://localhost:3000
```

### Mail Service (`be/mail/.env`)

```env
# Server
PORT=3001
CODEBASE=development  # or "production"
FRONTEND_URL=http://localhost:3003

# RabbitMQ
Rabbitmq_URL=amqp://localhost:5672

# Email (Nodemailer)
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
```

### Frontend (`fe/.env.local`)

```env
# Environment
NEXT_PUBLIC_CODEBASE=development  # or "production"

# API URLs
NEXT_PUBLIC_CHAT_API_URL=http://localhost:3002
NEXT_PUBLIC_USER_API_URL=http://localhost:3000
```

## 📡 API Endpoints

### User Service (`http://localhost:3000`)

#### Authentication
- `POST /api/v1/login` - Request OTP (sends email)
- `POST /api/v1/verify` - Verify OTP and login
- `POST /api/v1/logout` - Logout user
- `GET /api/v1/auth/refresh` - Refresh access token

#### User Management
- `GET /api/v1/me` - Get current user (protected)
- `POST /api/v1/update/user` - Update user name (protected)
- `GET /api/v1/user/:id` - Get user by ID
- `POST /api/v1/user/all` - Get all users (protected)

### Chat Service (`http://localhost:3002`)

#### Chat Management
- `POST /api/v1/chat/new` - Create new chat (protected)
- `GET /api/v1/chat/all` - Get all chats for user (protected)

#### Messages
- `POST /api/v1/message` - Send message (text/image) (protected)
- `GET /api/v1/message/:chatId` - Get messages for chat (protected)

## 🔄 Background Workers

The Chat Service uses RabbitMQ workers for asynchronous message processing:

### 1. Message Storage Worker
- **Queue**: `chat:message:storage`
- **Purpose**: Saves messages to MongoDB database
- **Features**:
  - Persists messages to database
  - Updates chat's latest message
  - Handles retries on failure

### 2. Message Delivery Worker
- **Queue**: `chat:message:delivery`
- **Purpose**: Delivers messages via WebSocket
- **Features**:
  - Emits messages to Socket.IO rooms
  - Retries if message not found in DB
  - Ensures reliable delivery

### 3. Message Notification Worker
- **Queue**: `chat:message:notification`
- **Purpose**: Handles notifications and read receipts
- **Features**:
  - Checks if receiver is online
  - Marks messages as seen if receiver is viewing chat
  - Sends chat refresh notifications
  - Can integrate push notifications (offline users)

### Worker Architecture

Messages are published to a **fanout exchange** (`chat:messages`) which distributes to all three queues:

```
Message Sent
    ↓
Fanout Exchange (chat:messages)
    ├──→ Storage Queue → Storage Worker
    ├──→ Delivery Queue → Delivery Worker
    └──→ Notification Queue → Notification Worker
```

## 🔌 Real-time Features

### Socket.IO Events

#### Client → Server

- `join:chat` - Join a chat room
- `leave:chat` - Leave a chat room
- `viewing:chat` - Notify server user is viewing a chat
- `not:viewing:chat` - Notify server user stopped viewing
- `typing:start` - User started typing
- `typing:stop` - User stopped typing
- `message:sent` - Message sent (for real-time updates)
- `message:read` - Mark messages as read

#### Server → Client

- `getOnlineUsers` - List of online user IDs
- `chat:new` - New chat created
- `chat:refresh` - Chat list needs refresh
- `message:new` - New message received
- `message:read` - Messages marked as read
- `typing:status` - Typing indicator update
- `user:joined:room` - User joined chat room

## 🔒 Authentication & Security

### Token System

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (15 days), stored in Redis, used to get new access tokens

### Security Features

- HTTP-only cookies (prevents XSS attacks)
- CORS configuration
- Rate limiting for OTP requests (60 seconds)
- OTP expiration (5 minutes)
- JWT token validation
- Input validation and sanitization

### Authentication Flow

1. User requests OTP via email
2. User verifies OTP
3. Server generates access + refresh tokens
4. Tokens stored in HTTP-only cookies
5. Access token used for API requests
6. When access token expires, refresh token used to get new access token
7. User stays logged in without re-entering OTP

## 🏃 Running the Application

### Development Mode

All services support hot-reload with `pnpm dev`:

```bash
# Each service watches TypeScript files and restarts on changes
pnpm dev
```

### Production Mode

Build and run:

```bash
# Build TypeScript
pnpm build

# Start services
pnpm start
```

### Service Ports

- User Service: `http://localhost:3000`
- Mail Service: `http://localhost:3001`
- Chat Service: `http://localhost:3002`
- Frontend: `http://localhost:3003`

## 📝 Notes

- All services use TypeScript
- Services communicate via HTTP APIs and RabbitMQ
- Frontend uses React Query for caching and state management
- Socket.IO handles real-time bidirectional communication
- Cloudinary handles image uploads and optimization
- Redis used for OTP storage and refresh token management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC

---

**Built with ❤️ using Microservices Architecture**

