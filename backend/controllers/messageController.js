import mongoose from "mongoose";
import { Conversation } from "../models/conversationModel.js";
import { Message } from "../models/messageModel.js";
import {
  emitNewMessageToParticipants,
  getSocketIdForUser,
} from "../socket/socket.js";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;

function participantThreadFilter(senderID, receiverID) {
  const a = new mongoose.Types.ObjectId(String(senderID));
  const b = new mongoose.Types.ObjectId(String(receiverID));
  return {
    $or: [
      { senderID: a, receiverID: b },
      { senderID: b, receiverID: a },
    ],
  };
}

export const sendMessage = async (req, res) => {
  try {
    const senderID = new mongoose.Types.ObjectId(String(req.id));
    const receiverID = new mongoose.Types.ObjectId(String(req.params.id));
    const { message, clientMessageId } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    let gotConversation = await Conversation.findOne({
      participants: { $all: [senderID, receiverID] },
    });
    if (!gotConversation) {
      gotConversation = await Conversation.create({
        participants: [senderID, receiverID],
      });
    }

    const newMessage = await Message.create({
      senderID,
      receiverID,
      message: String(message).trim(),
      clientMessageId:
        clientMessageId && String(clientMessageId).trim()
          ? String(clientMessageId).trim()
          : undefined,
    });

    gotConversation.messages.push(newMessage._id);
    await gotConversation.save();

    let doc = newMessage;
    if (getSocketIdForUser(String(receiverID))) {
      await Message.findByIdAndUpdate(newMessage._id, {
        deliveredAt: new Date(),
      });
      doc = await Message.findById(newMessage._id);
    }

    emitNewMessageToParticipants(String(senderID), String(receiverID), doc);

    return res.status(201).json({
      message: "message sent, expect a reply soon ❤️",
      contents: doc,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

export const getMessage = async (req, res) => {
  try {
    const senderID = req.id;
    const receiverID = req.params.id;
    const before = req.query.before;
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const baseFilter = participantThreadFilter(senderID, receiverID);
    const filter = { ...baseFilter };

    if (before && mongoose.Types.ObjectId.isValid(String(before))) {
      const cursor = await Message.findById(before).lean();
      if (cursor) {
        filter.createdAt = { $lt: cursor.createdAt };
      }
    }

    const batch = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const chronological = batch.reverse();
    const hasMore = batch.length === limit;

    return res.status(200).json({
      messages: chronological,
      hasMore,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};
