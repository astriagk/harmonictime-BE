import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { ObjectId } from "mongodb";
import { verifyToken } from "../../shared/services/token.service";
import { chatThreadRepository, chatMessageRepository } from "./chat.repository";
import { maskSensitiveContent } from "./chat.filter";
import logger from "../../shared/utils/logger";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function initChatGateway(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  // Auth handshake: token must be passed in socket.auth.token or as query param.
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      (socket.handshake.auth as { token?: string }).token ||
      (socket.handshake.query.token as string | undefined);

    if (!token) return next(new Error("Authentication token required"));

    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: userId=${socket.userId}`);

    // Client joins a thread room to receive real-time messages.
    socket.on("join_thread", async (threadId: string) => {
      try {
        const thread = await chatThreadRepository.findById(threadId);
        if (!thread) return socket.emit("error", { message: "Thread not found" });

        const isBuyer = thread.BuyerID.toString() === socket.userId;
        const isSeller = thread.SellerID.toString() === socket.userId;
        if (!isBuyer && !isSeller)
          return socket.emit("error", { message: "Access denied" });

        socket.join(`thread:${threadId}`);
        socket.emit("joined_thread", { threadId });
      } catch (err) {
        logger.error(`join_thread error: ${err}`);
        socket.emit("error", { message: "Failed to join thread" });
      }
    });

    socket.on("leave_thread", (threadId: string) => {
      socket.leave(`thread:${threadId}`);
    });

    // Client sends a message inside a thread room.
    socket.on(
      "send_message",
      async (payload: { threadId: string; text: string }) => {
        const { threadId, text } = payload;

        if (!text?.trim()) {
          return socket.emit("error", { message: "Message text is required" });
        }

        try {
          const thread = await chatThreadRepository.findById(threadId);
          if (!thread) return socket.emit("error", { message: "Thread not found" });
          if (thread.Status === "closed")
            return socket.emit("error", { message: "Thread is closed" });

          const isBuyer = thread.BuyerID.toString() === socket.userId;
          const isSeller = thread.SellerID.toString() === socket.userId;
          if (!isBuyer && !isSeller)
            return socket.emit("error", { message: "Access denied" });

          const result = await chatMessageRepository.insertOne({
            ThreadID: new ObjectId(threadId),
            SenderID: new ObjectId(socket.userId!),
            SenderRole: isBuyer ? "buyer" : "seller",
            Text: maskSensitiveContent(text.trim()),
            IsRead: false,
            CreatedAt: new Date(),
          });

          await chatThreadRepository.updateById(threadId, {
            UpdatedAt: new Date(),
          } as any);

          const message = await chatMessageRepository.findById(result.insertedId);

          // Broadcast to all participants in the room (including sender).
          io.to(`thread:${threadId}`).emit("new_message", message);
        } catch (err) {
          logger.error(`send_message error: ${err}`);
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: userId=${socket.userId}`);
    });
  });

  return io;
}
