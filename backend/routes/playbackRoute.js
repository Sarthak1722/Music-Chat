import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { listPlaybackTracks } from "../controllers/playbackController.js";

const router = express.Router();
router.route("/tracks").get(isAuthenticated, listPlaybackTracks);

export default router;
