import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached = null;

/**
 * Static catalog (phase 1). Phase 2: swap loader for Spotify metadata adapter.
 */
export function loadTrackCatalog() {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(__dirname, "../public/songs/tracks.json"), "utf8");
    const data = JSON.parse(raw);
    cached = Array.isArray(data.tracks) ? data.tracks : [];
  } catch {
    cached = [];
  }
  return cached;
}

export function trackById(id) {
  return loadTrackCatalog().find((t) => t.id === id) || null;
}

export function toPlaybackTrack(track) {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: `/songs/${track.file}`,
  };
}
