import { loadTrackCatalog, toPlaybackTrack } from "../playback/trackCatalog.js";

/**
 * Phase 1: static files + manifest. Phase 2: replace body with Spotify adapter.
 */
export const listPlaybackTracks = (req, res) => {
  try {
    const raw = loadTrackCatalog();
    const tracks = raw.map((t) => toPlaybackTrack(t));
    return res.status(200).json({ tracks });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Failed to load track catalog" });
  }
};
