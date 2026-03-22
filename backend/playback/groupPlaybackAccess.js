import { GroupRoom } from "../models/groupRoomModel.js";

export function parseGroupDocumentId(roomId) {
  if (!roomId || !String(roomId).startsWith("group:")) return null;
  const id = String(roomId).slice("group:".length);
  return id || null;
}

/**
 * DM rooms: allowed if socket already joined (pair verified at join).
 * Group rooms: user must be in GroupRoom.members.
 */
export async function assertPlaybackRoomAccess(userId, roomId) {
  if (!roomId) return false;
  if (!String(roomId).startsWith("group:")) return true;

  const gid = parseGroupDocumentId(roomId);
  if (!gid) return false;

  const room = await GroupRoom.findById(gid).select("members").lean();
  if (!room) return false;
  return room.members.some((m) => String(m) === String(userId));
}
