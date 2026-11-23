import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AccessToken } from "livekit-server-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const LIVEKIT_URL = (process.env.LIVEKIT_URL || "").trim();
const LIVEKIT_API_KEY = (process.env.LIVEKIT_API_KEY || "").trim();
const LIVEKIT_API_SECRET = (process.env.LIVEKIT_API_SECRET || "").trim();
const INVITE_CODE = process.env.ROOM_INVITE_CODE || "";
const ROOM_NAME = (process.env.ROOM_NAME || "hangout-friends").trim();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https:", "wss:"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
    }
  }
}));
app.use(express.json({ limit: "10kb" }));

const tokenLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many join attempts. Please wait a few minutes." }
});

function configIsReady() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET && INVITE_CODE);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "hangout-voice-chat" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ready: configIsReady(),
    livekitUrl: LIVEKIT_URL || null,
    roomName: ROOM_NAME,
    maxParticipants: 12
  });
});

app.post("/api/token", tokenLimiter, async (req, res) => {
  try {
    if (!configIsReady()) {
      return res.status(503).json({ error: "The voice server is not configured yet. Ask the app owner to finish deployment settings." });
    }

    const displayName = String(req.body?.displayName || "").trim().replace(/\s+/g, " ");
    const inviteCode = String(req.body?.inviteCode || "");

    if (displayName.length < 2 || displayName.length > 24) {
      return res.status(400).json({ error: "Name must be between 2 and 24 characters." });
    }
    if (inviteCode.length > 200 || inviteCode !== INVITE_CODE) {
      return res.status(401).json({ error: "That invite code is not correct." });
    }

    // Use a unique identity for every connection; the visible name remains the chosen display name.
    const identity = `guest-${crypto.randomUUID()}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: "1h"
    });

    token.addGrant({
      roomJoin: true,
      room: ROOM_NAME,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const jwt = await token.toJwt();
    res.json({
      token: jwt,
      livekitUrl: LIVEKIT_URL,
      roomName: ROOM_NAME,
      identity,
      displayName
    });
  } catch (error) {
    console.error("Token creation failed:", error);
    res.status(500).json({ error: "Could not create a voice session. Please try again." });
  }
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Hangout is running on http://localhost:${PORT}`);
  if (!configIsReady()) {
    console.log("LiveKit is not configured yet. Copy .env.example to .env and add your credentials.");
  }
});
