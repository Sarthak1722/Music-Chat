import {
  pairRoomId,
  applyPlay,
  applyPause,
  applySeek,
  applyChangeTrack,
  applyNextTrack,
  applyPrevTrack,
  buildPlaybackPayload,
  getOrCreateRoomState,
} from "./playbackStore.js";
import { assertPlaybackRoomAccess } from "./groupPlaybackAccess.js";

function resolveRoomId(socketUserId, { peerUserId, roomId }) {
  if (roomId != null && String(roomId).startsWith("group:")) {
    return String(roomId);
  }
  if (peerUserId) return pairRoomId(socketUserId, peerUserId);
  return null;
}

function leavePlaybackRoom(socket) {
  const prev = socket.data?.playbackRoom;
  if (prev) {
    socket.leave(prev);
    socket.data.playbackRoom = null;
  }
}

function ensureJoinedRoom(socket, roomId) {
  if (!roomId) return false;
  return socket.data?.playbackRoom === roomId;
}

/**
 * Playback sync: all fan-out via io.to(roomId). Group rooms require DB membership.
 */
export function attachPlaybackSocketHandlers(io, socket, userId) {
  if (!userId) return;

  socket.on("playbackJoin", async (payload = {}) => {
    const { peerUserId, roomId: explicitRoom } = payload;
    const roomId = resolveRoomId(userId, { peerUserId, roomId: explicitRoom });
    if (!roomId) return;
    if (!(await assertPlaybackRoomAccess(userId, roomId))) return;

    leavePlaybackRoom(socket);
    socket.join(roomId);
    socket.data.playbackRoom = roomId;

    const state = getOrCreateRoomState(roomId);
    socket.emit("playbackUpdate", buildPlaybackPayload(roomId, state));
  });

  socket.on("playbackLeave", () => {
    leavePlaybackRoom(socket);
  });

  const guard = async (payload, fn) => {
    const roomId = resolveRoomId(userId, payload);
    if (!roomId || !ensureJoinedRoom(socket, roomId)) return;
    if (!(await assertPlaybackRoomAccess(userId, roomId))) return;
    const out = fn(roomId);
    if (out) io.to(roomId).emit("playbackUpdate", out);
  };

  socket.on("play", (payload) => {
    void guard(payload, (roomId) => applyPlay(roomId, userId));
  });

  socket.on("pause", (payload) => {
    void guard(payload, (roomId) => applyPause(roomId, userId));
  });

  socket.on("seek", (payload) => {
    void guard(payload, (roomId) => applySeek(roomId, userId, payload.time));
  });

  socket.on("changeTrack", (payload) => {
    if (!payload?.trackId) return;
    void guard(payload, (roomId) => applyChangeTrack(roomId, userId, payload.trackId));
  });

  socket.on("nextTrack", (payload) => {
    void guard(payload, (roomId) => applyNextTrack(roomId, userId));
  });

  socket.on("prevTrack", (payload) => {
    void guard(payload, (roomId) => applyPrevTrack(roomId, userId));
  });
}

export function detachPlaybackOnDisconnect(socket) {
  leavePlaybackRoom(socket);
}
