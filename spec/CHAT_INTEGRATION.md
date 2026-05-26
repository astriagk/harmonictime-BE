# Chat Integration Guide — Frontend

Product-level Q&A chat between buyers and sellers using REST + Socket.io.

---

## Overview

- A **ChatThread** is created per (product, buyer) pair — one thread per buyer per product.
- A **ChatMessage** belongs to a thread, sent by either `buyer` or `seller`.
- Real-time delivery uses **Socket.io**. A REST fallback is also available.

---

## Installation

```bash
npm install socket.io-client
```

---

## 1. REST API

Base URL: `https://your-api.com/api`

All endpoints require `Authorization: Bearer <JWT>`.

### Create or fetch a thread (Buyer)

```
POST /api/chat/threads
Content-Type: application/json

{ "productId": "664abc123def456789012345" }
```

Response:
```json
{
  "message": "Thread created",
  "data": {
    "_id": "thread_id",
    "Status": "open",
    "CreatedAt": "2026-05-26T10:00:00.000Z",
    "UpdatedAt": "2026-05-26T10:00:00.000Z",
    "Product": {
      "_id": "product_id",
      "ProductName": "Rolex Submariner",
      "Price": 85000,
      "Description": {
        "Title": "Classic Dive Watch",
        "Content": "First 200 characters of the product description..."
      },
      "PrimaryImage": "https://bucket.s3.amazonaws.com/image.jpg"
    },
    "Buyer": { "_id": "buyer_id", "email": "buyer@example.com" },
    "Seller": { "_id": "seller_id", "email": "seller@example.com" }
  }
}
```

If a thread already exists for this buyer + product, the existing one is returned (200) with the same enriched shape.

---

### Get my threads

```
GET /api/chat/threads
```

Returns all threads where the authenticated user is either the buyer or the seller — no role parameter needed.

Returns an array sorted newest-updated first. Each item includes:

```json
{
  "_id": "thread_id",
  "Status": "open",
  "CreatedAt": "...",
  "UpdatedAt": "...",
  "Product": {
    "_id": "product_id",
    "ProductName": "Rolex Submariner",
    "Price": 85000,
    "Description": {
      "Title": "Classic Dive Watch",
      "Content": "First 200 chars of description..."
    },
    "PrimaryImage": "https://bucket.s3.amazonaws.com/image.jpg"
  },
  "Buyer":  { "_id": "...", "email": "buyer@example.com" },
  "Seller": { "_id": "...", "email": "seller@example.com" }
}
```

Use `Product.PrimaryImage` as the thumbnail, `Product.ProductName` as the heading, and `Product.Description.Content` as the preview blurb in your thread list UI.

---

### Get messages in a thread

```
GET /api/chat/threads/:threadId/messages
```

Returns messages sorted oldest-first. Also marks all incoming messages as read.

Response:
```json
{
  "message": "Messages fetched",
  "data": [
    {
      "_id": "msg_id",
      "ThreadID": "thread_id",
      "SenderID": "user_id",
      "SenderRole": "buyer",
      "Text": "Is this watch water resistant?",
      "IsRead": true,
      "CreatedAt": "2026-05-26T10:01:00.000Z"
    }
  ]
}
```

---

### Send a message (REST fallback)

```
POST /api/chat/threads/:threadId/messages
Content-Type: application/json

{ "text": "Is this watch water resistant?" }
```

---

### Close a thread (Seller only)

```
PATCH /api/chat/threads/:threadId/close
```

---

## 2. Real-Time (Socket.io)

### Connect

```typescript
import { io } from "socket.io-client";

const socket = io("https://your-api.com", {
  path: "/socket.io",
  auth: { token: "YOUR_JWT_TOKEN" },
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  // "Authentication token required" or "Invalid or expired token"
});
```

---

### Join a thread room

Must join before sending or receiving messages in that thread.

```typescript
socket.emit("join_thread", threadId);

socket.on("joined_thread", ({ threadId }) => {
  console.log("Joined thread:", threadId);
});
```

---

### Send a message

```typescript
socket.emit("send_message", {
  threadId: "thread_id_here",
  text: "Is this watch water resistant?",
});
```

---

### Receive new messages

All participants in the room receive this event (including the sender).

```typescript
socket.on("new_message", (message) => {
  console.log(message);
  // {
  //   _id: "msg_id",
  //   ThreadID: "thread_id",
  //   SenderID: "user_id",
  //   SenderRole: "buyer" | "seller",
  //   Text: "Is this watch water resistant?",
  //   IsRead: false,
  //   CreatedAt: "2026-05-26T10:01:00.000Z"
  // }
});
```

---

### Leave a thread room

```typescript
socket.emit("leave_thread", threadId);
```

---

### Handle errors

```typescript
socket.on("error", ({ message }) => {
  console.error("Socket error:", message);
  // Possible messages:
  // "Thread not found"
  // "Access denied"
  // "Thread is closed"
  // "Message text is required"
});
```

---

## 3. Full Example — Buyer Opens Chat on Product Page

```typescript
import { io } from "socket.io-client";

const BASE_URL = "https://your-api.com";
const token = localStorage.getItem("token");

// Step 1: Create or fetch the thread for this product
async function openChat(productId: string) {
  const res = await fetch(`${BASE_URL}/api/chat/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId }),
  });
  const { data: thread } = await res.json();

  // Step 2: Load history
  const histRes = await fetch(
    `${BASE_URL}/api/chat/threads/${thread._id}/messages`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { data: messages } = await histRes.json();
  renderMessages(messages);

  // Step 3: Connect socket and join the thread room
  const socket = io(BASE_URL, {
    path: "/socket.io",
    auth: { token },
  });

  socket.on("connect", () => {
    socket.emit("join_thread", thread._id);
  });

  socket.on("new_message", (msg) => {
    renderMessages([msg]); // append new message to UI
  });

  return { thread, socket };
}

// Step 4: Send a message
function sendMessage(socket: any, threadId: string, text: string) {
  socket.emit("send_message", { threadId, text });
}
```

---

## 4. Full Example — Seller Reply Panel

```typescript
import { io } from "socket.io-client";

const BASE_URL = "https://your-api.com";
const token = localStorage.getItem("token");

async function loadSellerThreads() {
  const res = await fetch(`${BASE_URL}/api/chat/threads?role=seller`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: threads } = await res.json();
  return threads;
}

async function openSellerThread(threadId: string) {
  const res = await fetch(`${BASE_URL}/api/chat/threads/${threadId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: messages } = await res.json();

  const socket = io(BASE_URL, {
    path: "/socket.io",
    auth: { token },
  });

  socket.on("connect", () => {
    socket.emit("join_thread", threadId);
  });

  socket.on("new_message", (msg) => {
    // append to UI
  });

  return { messages, socket };
}

async function closeThread(threadId: string) {
  await fetch(`${BASE_URL}/api/chat/threads/${threadId}/close`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

---

## 5. Event Reference

| Direction | Event | Payload | Description |
|---|---|---|---|
| Client → Server | `join_thread` | `threadId: string` | Join a thread room |
| Server → Client | `joined_thread` | `{ threadId }` | Confirmed join |
| Client → Server | `leave_thread` | `threadId: string` | Leave a thread room |
| Client → Server | `send_message` | `{ threadId, text }` | Send a message |
| Server → Client | `new_message` | `ChatMessage` | Broadcast to all in room |
| Server → Client | `error` | `{ message }` | Error from any event |

---

## 6. REST Endpoint Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/chat/threads` | Buyer | Create or get thread for product |
| GET | `/api/chat/threads` | Both | List all my threads (buyer + seller) |
| GET | `/api/chat/threads/:id/messages` | Both | Fetch messages (marks as read) |
| POST | `/api/chat/threads/:id/messages` | Both | Send message (REST fallback) |
| PATCH | `/api/chat/threads/:id/close` | Seller | Close thread |

---

## 7. Content Filtering (Anti-Bypass)

To prevent off-platform transactions, the server **automatically redacts** any contact information from message text before it is stored. This applies to both Socket.io and REST sends.

The following are replaced with `****`:

| Type | Examples |
|---|---|
| Email addresses | `john@gmail.com`, `user@domain.co.uk` |
| Phone numbers | `+91 9876543210`, `(123) 456-7890`, `07911 123456` |
| Social-media URLs | `instagram.com/...`, `wa.me/...`, `t.me/...`, `facebook.com/...`, `twitter.com/...`, `x.com/...`, `snapchat.com/...`, `linkedin.com/...`, `tiktok.com/...` |
| @handles | `@john_doe`, `@seller123` |
| Invite links | `wa.me/9876543210`, `t.me/mygroup` |

**Example — what the buyer sends:**
```
Is this waterproof? Contact me at john@gmail.com or +91 9876543210
```

**What gets stored and delivered:**
```
Is this waterproof? Contact me at **** or ****
```

**Frontend note:** Do not attempt to filter on the client side — filtering is enforced server-side only. The stored message already contains `****`; display it as-is.

---

## 8. Notes

- **One thread per buyer per product.** Calling `POST /api/chat/threads` twice with the same `productId` returns the existing thread.
- **Socket.io is preferred** for sending messages — use REST only as fallback (e.g. failed socket connection).
- **Messages are marked as read** automatically when `GET .../messages` is called.
- **Sellers cannot start threads.** Only buyers initiate; sellers reply.
- The `SenderRole` field (`"buyer"` or `"seller"`) is determined server-side from the thread — the client does not need to send it.
