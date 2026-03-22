import mongoose from "mongoose";

const messageModel = new mongoose.Schema(
  {
    senderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    /** Client-generated id for optimistic UI reconciliation */
    clientMessageId: {
      type: String,
      sparse: true,
    },
    /** Receiver's device was online when message was sent */
    deliveredAt: {
      type: Date,
      default: null,
    },
    /** Receiver opened the thread and marked read */
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

messageModel.index({ senderID: 1, receiverID: 1, createdAt: -1 });

export const Message = mongoose.model("Message", messageModel);
