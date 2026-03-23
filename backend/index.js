import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/database.js";
import userRoute from "./routes/userRoute.js";
import messageRoute from "./routes/messageRoute.js";
import playbackRoute from "./routes/playbackRoute.js";
import roomRoute from "./routes/roomRoute.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { app, server } from "./socket/socket.js";

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT;

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cookieParser());

const corsOption = {
  origin: ['http://localhost:5173', 'http://10.145.9.182:5173', '*'],
  credentials: true
};
app.use(cors(corsOption));

app.use("/songs", express.static(path.join(__dirname, "public/songs")));

//ROUTES
app.use("/api/v1/user", userRoute);
app.use("/api/v1/message", messageRoute);
app.use("/api/v1/playback", playbackRoute);
app.use("/api/v1/rooms", roomRoute);

server.listen(PORT, "0.0.0.0", () => {
  connectDB();
  console.log(`Server listening on 0.0.0.0:${PORT} (LAN + localhost)`);
});
