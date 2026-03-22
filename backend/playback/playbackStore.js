import { loadTrackCatalog, toPlaybackTrack, trackById } from "./trackCatalog.js";

/** @type {Map<string, object>} */
const roomStates = new Map();

export function pairRoomId(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  if (!a || !b || a === b) return null;
  return `playback:${[a, b].sort().join(":")}`;
}

function defaultState() {
  return {
    currentTrack: null,
    isPlaying: false,
    positionSeconds: 0,
    playheadEpochMs: null,
    updatedBy: null,
    catalogIndex: 0,
  };
}

export function getOrCreateRoomState(roomId) {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, defaultState());
  }
  return roomStates.get(roomId);
}

function effectivePositionSeconds(state, now = Date.now()) {
  if (!state.isPlaying || state.playheadEpochMs == null) return state.positionSeconds;
  return state.positionSeconds + (now - state.playheadEpochMs) / 1000;
}

function freezePosition(state, now = Date.now()) {
  if (state.isPlaying && state.playheadEpochMs != null) {
    state.positionSeconds = effectivePositionSeconds(state, now);
  }
  state.isPlaying = false;
  state.playheadEpochMs = null;
}

function resumeFromAnchor(state, now = Date.now()) {
  state.isPlaying = true;
  state.playheadEpochMs = now;
}

export function buildPlaybackPayload(roomId, state) {
  const now = Date.now();
  const currentTime = effectivePositionSeconds(state, now);
  return {
    roomId,
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    currentTime,
    positionSeconds: state.positionSeconds,
    playheadEpochMs: state.playheadEpochMs,
    serverNow: now,
    updatedBy: state.updatedBy,
  };
}

export function ensureTrackLoaded(state) {
  const catalog = loadTrackCatalog();
  if (!catalog.length) return false;
  if (!state.currentTrack) {
    state.catalogIndex = 0;
    state.currentTrack = toPlaybackTrack(catalog[0]);
  }
  return true;
}

export function applyPlay(roomId, userId) {
  const state = getOrCreateRoomState(roomId);
  if (!ensureTrackLoaded(state)) return null;
  const now = Date.now();
  if (state.isPlaying) {
    state.positionSeconds = effectivePositionSeconds(state, now);
    state.playheadEpochMs = now;
  } else {
    resumeFromAnchor(state, now);
  }
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}

export function applyPause(roomId, userId) {
  const state = getOrCreateRoomState(roomId);
  freezePosition(state);
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}

export function applySeek(roomId, userId, timeSeconds) {
  const state = getOrCreateRoomState(roomId);
  const now = Date.now();
  const wasPlaying = state.isPlaying;
  freezePosition(state, now);
  state.positionSeconds = Math.max(0, Number(timeSeconds) || 0);
  if (wasPlaying) {
    resumeFromAnchor(state, now);
  }
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}

export function applyChangeTrack(roomId, userId, trackId) {
  const catalog = loadTrackCatalog();
  const state = getOrCreateRoomState(roomId);
  freezePosition(state);
  const idx = catalog.findIndex((t) => t.id === trackId);
  if (idx < 0) return null;
  state.catalogIndex = idx;
  state.currentTrack = toPlaybackTrack(catalog[idx]);
  state.positionSeconds = 0;
  state.isPlaying = false;
  state.playheadEpochMs = null;
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}

export function applyNextTrack(roomId, userId) {
  const catalog = loadTrackCatalog();
  if (!catalog.length) return null;
  const state = getOrCreateRoomState(roomId);
  freezePosition(state);
  if (!state.currentTrack) {
    state.catalogIndex = 0;
  } else {
    state.catalogIndex = (state.catalogIndex + 1) % catalog.length;
  }
  state.currentTrack = toPlaybackTrack(catalog[state.catalogIndex]);
  state.positionSeconds = 0;
  state.isPlaying = false;
  state.playheadEpochMs = null;
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}

export function applyPrevTrack(roomId, userId) {
  const catalog = loadTrackCatalog();
  if (!catalog.length) return null;
  const state = getOrCreateRoomState(roomId);
  freezePosition(state);
  if (!state.currentTrack) {
    state.catalogIndex = 0;
  } else {
    state.catalogIndex = (state.catalogIndex - 1 + catalog.length) % catalog.length;
  }
  state.currentTrack = toPlaybackTrack(catalog[state.catalogIndex]);
  state.positionSeconds = 0;
  state.isPlaying = false;
  state.playheadEpochMs = null;
  state.updatedBy = userId;
  return buildPlaybackPayload(roomId, state);
}
