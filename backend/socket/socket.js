import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { Message } from "../models/messageModel.js";
import {
  attachPlaybackSocketHandlers,
  detachPlaybackOnDisconnect,
} from "../playback/playbackSocket.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://10.145.9.182:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/** @type {Record<string, string>} userId (string) -> socket.id */
const userSocketMap = {};

export function getSocketIdForUser(userId) {
  if (userId == null || userId === "undefined") return undefined;
  return userSocketMap[String(userId)];
}

/**
 * Plain JSON-safe message for clients (consistent string ids).
 */
function toMessagePayload(doc) {
  const o = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    ...o,
    _id: o._id != null ? String(o._id) : o._id,
    senderID: o.senderID != null ? String(o.senderID) : o.senderID,
    receiverID: o.receiverID != null ? String(o.receiverID) : o.receiverID,
    clientMessageId: o.clientMessageId || undefined,
    deliveredAt: o.deliveredAt ? new Date(o.deliveredAt).toISOString() : null,
    readAt: o.readAt ? new Date(o.readAt).toISOString() : null,
  };
}

/**
 * Emit a new message exactly once to each connected participant (sender + receiver).
 */
export function emitNewMessageToParticipants(senderId, receiverId, messageDoc) {
  const payload = toMessagePayload(messageDoc);
  const senderSocketId = getSocketIdForUser(senderId);
  const receiverSocketId = getSocketIdForUser(receiverId);

  if (senderSocketId) {
    io.to(senderSocketId).emit("newMessage", payload);
  }
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", payload);
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  const rawUserId = socket.handshake.query.userId;
  const userId =
    rawUserId != null && String(rawUserId) !== "undefined" ? String(rawUserId) : null;

  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  attachPlaybackSocketHandlers(io, socket, userId);

  socket.on("typing", ({ toUserId }) => {
    if (!userId || !toUserId) return;
    const sid = getSocketIdForUser(toUserId);
    if (sid) io.to(sid).emit("peerTyping", { fromUserId: userId, typing: true });
  });

  socket.on("stopTyping", ({ toUserId }) => {
    if (!userId || !toUserId) return;
    const sid = getSocketIdForUser(toUserId);
    if (sid) io.to(sid).emit("peerTyping", { fromUserId: userId, typing: false });
  });

  socket.on("markRead", async ({ withUserId }) => {
    try {
      if (!userId || !withUserId) return;
      const reader = new mongoose.Types.ObjectId(String(userId));
      const sender = new mongoose.Types.ObjectId(String(withUserId));
      const list = await Message.find({
        senderID: sender,
        receiverID: reader,
        readAt: null,
      }).select("_id");
      if (!list.length) return;
      const ids = list.map((d) => d._id);
      const now = new Date();
      await Message.updateMany({ _id: { $in: ids } }, { $set: { readAt: now } });
      const senderSock = getSocketIdForUser(withUserId);
      if (senderSock) {
        io.to(senderSock).emit("messagesRead", {
          messageIds: ids.map((id) => String(id)),
          readAt: now.toISOString(),
        });
      }
    } catch (e) {
      console.error("markRead", e);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    detachPlaybackOnDisconnect(socket);
    if (userId) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io };
