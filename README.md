# Chat Microservices (Next.js + Express + RabbitMQ)

Real-time 1:1 chat built as 3 backend services + a Next.js frontend. Core idea: **Chat messages are processed asynchronously** via RabbitMQ, while delivery + presence is real-time via Socket.IO.

## Architecture (services)

- **Frontend** `fe/` (Next.js 16)
  - Calls User/Chat APIs with cookies (`withCredentials`)
  - Connects to Chat service Socket.IO using `userId` in the handshake query
- **User service** `be/user/` (Express + MongoDB + Redis)
  - OTP login + JWT cookies (`accessToken`, `refreshToken`)
  - Stores OTP + refresh tokens in Redis
  - Publishes OTP email jobs to RabbitMQ queue `send-otp`
- **Mail service** `be/mail/` (Express + Nodemailer)
  - Consumes RabbitMQ queue `send-otp` and sends email
- **Chat service** `be/chat/` (Express + MongoDB + Socket.IO + Cloudinary)
  - Chat + message APIs
  - Image uploads go to Cloudinary via Multer storage
  - Publishes chat message jobs to RabbitMQ queue `chat:messages`
  - Runs a **single worker** that does: save → emit → notifications/read logic

## System flow (end-to-end)

### Auth (OTP → cookies)

1. FE → User: `POST /api/v1/login` (email)
2. User stores OTP in Redis + publishes `{to, subject, body}` to queue `send-otp`
3. Mail consumes `send-otp` and sends email
4. FE → User: `POST /api/v1/verify` (email + otp)
5. User sets HTTP-only cookies: `accessToken` (15m), `refreshToken` (15d)
6. FE auto-refreshes via `GET /api/v1/auth/refresh` when it gets 401s

### Messaging (HTTP → RabbitMQ → DB → WebSocket)

1. FE → Chat: `POST /api/v1/message` (text + optional image)
2. Chat uploads image to Cloudinary (if present) and publishes a job to `chat:messages`
3. Chat worker consumes `chat:messages` and:
   - Saves the message to MongoDB + updates chat `latestMessage`
   - Emits `message:new` to room `chat:{chatId}`
   - If receiver is online and viewing the same chat, marks seen and emits `message:read`
   - Else emits `chat:refresh` to the receiver (to update chat list/unread count)

### Presence / typing / rooms (Socket.IO)

- Online users: Chat service keeps an in-memory `userId -> socketId` map and emits `getOnlineUsers`
- Rooms: `join:chat`, `leave:chat` (room name `chat:{chatId}`)
- Typing: `typing:start` / `typing:stop` → `typing:status`
- Viewing state: `viewing:chat` / `not:viewing:chat` to drive read receipts

## API (what FE uses)

### User service (`/api/v1`)

- `POST /login` (request OTP)
- `POST /verify` (verify OTP, set cookies)
- `GET /auth/refresh` (refresh access token)
- `GET /me` (auth)
- `POST /logout` (auth)
- `POST /user/all` (auth)
- `GET /user/:id`

### Chat service (`/api/v1`)

- `POST /chat/new` (auth)
- `GET /chat/all` (auth)
- `POST /message` (auth, multipart for image)
- `GET /message/:chatId` (auth; also marks unseen messages as seen)

## Local run (recommended ports)

Infra: **MongoDB + Redis + RabbitMQ** must be running.

- User: `3000`
- Mail: `3001`
- Chat: `3002`
- FE: `3003` (Next defaults to 3000, so explicitly set it)

### 1) Install

Run in each folder: `be/user`, `be/mail`, `be/chat`, `fe`

```bash
pnpm i
```

### 2) Env vars

Create these files (minimal set):

`be/user/.env`

```env
PORT=3000
CODEBASE=development
FRONTEND_URL=http://localhost:3003
DB_URI=mongodb://localhost:27017/chat-users
REDIS_URL=redis://localhost:6379
Rabbitmq_URL=amqp://localhost:5672
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
```

`be/mail/.env`

```env
PORT=3001
CODEBASE=development
FRONTEND_URL=http://localhost:3003
Rabbitmq_URL=amqp://localhost:5672
MAIL_USER=you@gmail.com
MAIL_PASS=your-app-password
```

`be/chat/.env`

```env
PORT=3002
CODEBASE=development
FRONTEND_URL=http://localhost:3003
DB_URI=mongodb://localhost:27017/chat-messages
Rabbitmq_URL=amqp://localhost:5672
JWT_ACCESS_SECRET=change-me

CLOUD_NAME=...
API_KEY=...
API_SECRET=...

# Used by Chat service to fetch user profiles
NEXT_USER_SERVICE_APP_URL=http://localhost:3000
```

`fe/.env.local`

```env
NEXT_PUBLIC_CODEBASE=development
NEXT_PUBLIC_CHAT_API_URL=http://localhost:3002

# Used by FE to call the User service (and for refresh flow)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3) Start (dev)

Backend services (each in its own terminal):

```bash
pnpm dev
```

Frontend:

```bash
pnpm dev -- -p 3003
```

