import mongoose from "mongoose";

const groupRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

groupRoomSchema.index({ members: 1 });

export const GroupRoom = mongoose.model("GroupRoom", groupRoomSchema);
