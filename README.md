# Soundgram — React chat + synced playback

Full-stack demo: **JWT auth**, **REST + cookies**, **MongoDB**, **Socket.IO** for real-time **messages**, **typing**, **read receipts**, and **shared music playback** (1:1 or **group jam rooms**). Audio plays **only in the browser**; the server holds playback state and broadcasts updates.

---

## Quick start

### Backend

```bash
cd backend
cp .env.example .env   # if you use one; set PORT, MONGODB_URI, JWT_SECRET_KEY
npm install
npm run dev
```

- Serves HTTP + Socket.IO on `PORT` (binds `0.0.0.0` for LAN).
- Static MP3s: add files under `backend/public/songs/` to match `tracks.json`.

### Frontend

```bash
cd frontend
# VITE_API_URL must match your API origin, e.g. http://localhost:8080
npm install
npm run dev
```

---

## Repository layout

```
backend/
  config/           # Mongo connection
  controllers/    # HTTP handlers (user, message, playback, rooms)
  middleware/       # isAuthenticated (JWT from cookie)
  models/           # Mongoose: User, Message, Conversation, GroupRoom
  playback/         # In-memory playback state + socket wiring + track catalog loader
  public/songs/     # tracks.json + .mp3 files (served at /songs)
  routes/           # Express routers mounted under /api/v1/*
  socket/socket.js  # Socket.IO server + chat + playback handlers
  index.js          # Express app (from socket.js), static /songs, listen()

frontend/
  src/
    api/            # Axios wrappers (messages, playback, rooms)
    components/     # UI (nav, chat, playback bar, …)
    components/playback/
    context/        # SocketProvider — one io() client per logged-in user
    hooks/          # useChatSocket, usePlaybackSocket, useGetMessages, …
    pages/          # Route-level screens (Discover, Messages, Rooms, …)
    redux/          # store, slices (user, messages, playback, rooms)
    utils/          # Pure helpers (message ids, playback time)
  main.jsx          # Redux Provider, PersistGate, SocketProvider, App
  App.jsx           # Router + useChatSocket()
```

---

## How frontend and backend connect

| Layer | Role |
|--------|------|
| **HTTP** | Login/register, logout, list users, messages CRUD, playback track list, **group rooms** CRUD. Uses `axios` + `withCredentials: true` so the **httpOnly** JWT cookie is sent. |
| **Socket.IO** | Same origin as API (`VITE_API_URL`). Handshake query: `userId=<mongo _id>`. Used for online users, typing, read receipts, **newMessage**, and **playbackUpdate** / playback commands. |

CORS + Socket.IO `origin` must include your Vite dev URL (e.g. `http://localhost:5173`).

---

## Redux store (what lives where)

Configured in `frontend/src/redux/store.js` with **redux-persist** (only **`user`** is persisted — see `whitelist`).

| Slice | Purpose |
|--------|---------|
| **`user`** | `authUser`, `otherUsers`, `selectedUser`, `onlineUsers` |
| **`messages`** | Current thread messages, pagination flag, `peerTyping` |
| **`playback`** | Mirror of server playback state for the **active jam room** (`currentTrack`, `isPlaying`, `positionSeconds`, `playheadEpochMs`, `serverNow`, …). **No** `Audio` or `socket` here. |
| **`rooms`** | `list` (your `GroupRoom` documents from API), **`activeJam`** — which context drives playback |

### `activeJam` (drives `usePlaybackSocket`)

- **`{ kind: 'dm', peerId, label }`** — Socket room id is a **deterministic pair** `playback:<sorted user ids>` (computed on server).
- **`{ kind: 'group', roomId: 'group:<mongoId>', groupId, label }`** — Everyone in that `GroupRoom` may join; server checks **membership** before applying playback actions.

Setting **`activeJam`** is done from:

- **Messages** header: **Jam together** / **DM jam on** (toggles DM jam for the open chat).
- **Jam rooms** page: **Enter jam** on a group card.

**Clear active jam**: Rooms page “Clear active jam”, or toggle off DM jam, or log out.

---

## Socket.IO — connection and events

### Connection (`frontend/src/context/SocketContext.jsx`)

- Created when `authUser._id` exists.
- `io(VITE_API_URL, { query: { userId: authUser._id } })`.
- **Not** stored in Redux (non-serializable).
- Provider is **outside** `<StrictMode>` in `main.jsx` so dev double-mount does not tear down the handshake.

### Chat (`frontend/src/hooks/useChatSocket.js`)

| Event | Direction | Action |
|--------|-----------|--------|
| `newMessage` | server → client | `receiveSocketMessage` (reconcile optimistic sends via `clientMessageId`) |
| `getOnlineUsers` | server → client | `setonlineUsers` |
| `messagesRead` | server → client | `applyMessagesRead` |
| `peerTyping` | server → client | `setPeerTyping` |
| `typing` / `stopTyping` | client → server | from `SendInput` |
| `markRead` | client → server | from `MessageContainer` |

### Playback (`frontend/src/hooks/usePlaybackSocket.js`)

Mounted once inside **`PlaybackActionsProvider`** (see `Homepage.jsx`).

| Client → server | When |
|-----------------|------|
| `playbackJoin` | `{ peerUserId }` **or** `{ roomId: 'group:…' }` |
| `playbackLeave` | Leaving jam / unmount / logout |
| `play` / `pause` / `seek` / `changeTrack` / `nextTrack` / `prevTrack` | Payload includes **`peerUserId`** (DM) **or** **`roomId`** (group) matching joined room |

| Server → client | Payload |
|-----------------|--------|
| `playbackUpdate` | Full room state: `roomId`, `currentTrack`, `isPlaying`, `positionSeconds`, `playheadEpochMs`, `serverNow`, `updatedBy` |

**UI rule:** the bottom player **only emits** the events above; **`<audio>`** is synced from Redux via **`usePlaybackAudioSync`**, which reacts to `playbackUpdate`–driven state.

### Server-side playback (`backend/playback/`)

- **`playbackStore.js`** — `Map<roomId, state>`; play/pause/seek/track mutations; **`buildPlaybackPayload`**.
- **`playbackSocket.js`** — joins socket to `roomId`, validates **group** membership via **`groupPlaybackAccess.js`** + `GroupRoom` model, then **`io.to(roomId).emit('playbackUpdate', …)`**.

---

## MongoDB models (backend)

- **User** — auth profile.
- **Message** — `senderID`, `receiverID`, text, optional `clientMessageId`, `deliveredAt`, `readAt`.
- **Conversation** — participant ids + message id refs (messages also queried by pair for pagination).
- **GroupRoom** — `name`, `members[]`, `createdBy` — used for **jam rooms** and **playback authorization**.

---

## HTTP API overview

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/user/register` | No |
| POST | `/api/v1/user/login` | Sets cookie |
| GET | `/api/v1/user/logout` | Yes |
| GET | `/api/v1/user/` | Yes — directory of other users |
| POST | `/api/v1/message/send/:receiverId` | Yes |
| GET | `/api/v1/message/:peerId` | Yes — `?before=&limit=` pagination |
| GET | `/api/v1/playback/tracks` | Yes — static catalog URLs |
| GET/POST | `/api/v1/rooms` | Yes — list / create group room |
| GET | `/api/v1/rooms/:id` | Yes — detail if member |

---

## Shared playback: DM vs group

- **DM:** room key `playback:<idA>:<idB>` (sorted). Any two users who joined via `playbackJoin` + `peerUserId` share state.
- **Group:** room key `group:<GroupRoom._id>`. Only users listed in **`GroupRoom.members`** pass **`assertPlaybackRoomAccess`** for playback actions.

---

## Phase 2: Spotify (hint)

1. Replace **`loadTrackCatalog()`** / **`GET /playback/tracks`** with Spotify metadata + preview or stream URLs.
2. Keep the **`{ id, title, artist, url }`** shape returned to clients so **`playbackStore`** and the Redux **`playback`** slice stay unchanged.

---

## Scripts

| | Frontend | Backend |
|---|----------|---------|
| Dev | `npm run dev` | `npm run dev` (nodemon) |
| Build | `npm run build` | — |

---

## License

Personal / study project — adjust as needed.
