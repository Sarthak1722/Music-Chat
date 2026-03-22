import express from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import { createRoom, listMyRooms, getRoom } from "../controllers/roomController.js";

const router = express.Router();

router.route("/").get(isAuthenticated, listMyRooms).post(isAuthenticated, createRoom);
router.route("/:id").get(isAuthenticated, getRoom);

export default router;
