import mongoose from "mongoose";
import { GroupRoom } from "../models/groupRoomModel.js";
import { User } from "../models/userModel.js";

function uniqueIds(ids) {
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
}

export const createRoom = async (req, res) => {
  try {
    const me = req.id;
    const { name, memberIds = [] } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }
    const others = Array.isArray(memberIds) ? memberIds : [];
    const members = uniqueIds([me, ...others]);
    if (members.length < 2) {
      return res.status(400).json({ message: "Add at least one other person to the room" });
    }

    for (const id of members) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid member id: ${id}` });
      }
      const u = await User.findById(id).select("_id");
      if (!u) {
        return res.status(400).json({ message: `User not found: ${id}` });
      }
    }

    const room = await GroupRoom.create({
      name: String(name).trim(),
      members,
      createdBy: me,
    });

    const populated = await GroupRoom.findById(room._id)
      .populate("members", "fullName userName profilePhoto")
      .lean();

    return res.status(201).json(populated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to create room" });
  }
};

export const listMyRooms = async (req, res) => {
  try {
    const rooms = await GroupRoom.find({ members: req.id })
      .populate("members", "fullName userName profilePhoto")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json(rooms);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to list rooms" });
  }
};

export const getRoom = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid room id" });
    }
    const room = await GroupRoom.findOne({
      _id: id,
      members: req.id,
    })
      .populate("members", "fullName userName profilePhoto")
      .lean();

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    return res.status(200).json(room);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to load room" });
  }
};
