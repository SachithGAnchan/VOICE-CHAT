import { Room, RoomEvent, Track, ConnectionState } from "https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/dist/livekit-client.esm.mjs";

const $ = (id) => document.getElementById(id);
const loginView = $("loginView");
const roomView = $("roomView");
const joinForm = $("joinForm");
const joinButton = $("joinButton");
const loginError = $("loginError");
const peopleGrid = $("peopleGrid");
const audioContainer = $("audioContainer");

let room = null;
let localMicOn = true;
let pttMode = false;
let pttHeld = false;
let displayName = "";
let livekitRoomName = "hangout-friends";
const attachedAudio = new Map();

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.style.display = "none", 2600);
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
}

function escapeText(value) {
  return String(value ?? "");
}

function participantList() {
  if (!room) return [];
  return [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
}

function renderPeople() {
  if (!room) return;
  const participants = participantList();
  $("participantCount").textContent = `${participants.length} / 12 people`;
  peopleGrid.replaceChildren();

  for (const participant of participants) {
    const isLocal = participant === room.localParticipant;
    const name = participant.name || participant.identity || "Guest";
    const speaking = Boolean(participant.isSpeaking);
    const card = document.createElement("div");
    card.className = `person${isLocal ? " me" : ""}${speaking ? " speaking" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(name);

    const label = document.createElement("div");
    label.className = "personname";
    label.textContent = isLocal ? `${escapeText(name)} (You)` : escapeText(name);

    const meta = document.createElement("div");
    meta.className = "personmeta";
    const micPub = participant.getTrackPublication?.(Track.Source.Microphone);
    const micMuted = isLocal ? !localMicOn : Boolean(micPub?.isMuted);
    meta.textContent = speaking ? "Speaking" : (micMuted ? "Mic muted" : "Connected");

    card.append(avatar, label, meta);
    peopleGrid.append(card);
  }
}

function updateMicUI() {
  $("muteButton").textContent = localMicOn ? "ON" : "OFF";
  $("muteButton").classList.toggle("on", localMicOn);
  $("micButton").textContent = localMicOn ? "🎙 Mute" : "🔇 Unmute";
  $("micButton").classList.toggle("active", localMicOn);
}

async function setMic(enabled) {
  if (!room) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(enabled);
    localMicOn = enabled;
    updateMicUI();
    renderPeople();
  } catch (err) {
    toast(`Microphone error: ${err?.message || "check browser permission"}`);
  }
}

function attachTrack(track, participant) {
  if (track.kind !== Track.Kind.Audio) return;
  const element = track.attach();
  element.autoplay = true;
  element.dataset.participant = participant.identity;
  audioContainer.append(element);
  attachedAudio.set(track.sid, element);
}

function detachTrack(track) {
  const element = attachedAudio.get(track.sid);
  if (element) {
    track.detach(element);
    element.remove();
    attachedAudio.delete(track.sid);
  }
}

async function connectToRoom(data) {
  room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    attachTrack(track, participant);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => detachTrack(track));
  room.on(RoomEvent.ParticipantConnected, renderPeople);
  room.on(RoomEvent.ParticipantDisconnected, renderPeople);
  room.on(RoomEvent.ActiveSpeakersChanged, renderPeople);
  room.on(RoomEvent.TrackMuted, renderPeople);
  room.on(RoomEvent.TrackUnmuted, renderPeople);
  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    $("connectionText").textContent = state === ConnectionState.Connected ? "Connected" : String(state);
  });
  room.on(RoomEvent.Disconnected, () => {
    toast("Disconnected from the voice room.");
    cleanupRoom(false);
  });

  await room.connect(data.livekitUrl, data.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  localMicOn = true;
  loginView.style.display = "none";
  roomView.style.display = "block";
  $("roomTitle").textContent = "Hangout Friends";
  $("connectionText").textContent = "Connected";
  updateMicUI();
  renderPeople();
}

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  displayName = $("displayName").value.trim();
  const inviteCode = $("inviteCode").value;
  if (displayName.length < 2) {
    loginError.textContent = "Please enter a name with at least 2 characters.";
    return;
  }

  joinButton.disabled = true;
  joinButton.textContent = "Connecting…";
  try {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, inviteCode })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not join the room.");
    livekitRoomName = data.roomName;
    await connectToRoom(data);
  } catch (err) {
    loginError.textContent = err?.message || "Something went wrong. Please try again.";
    if (room) {
      try { await room.disconnect(); } catch {}
      room = null;
    }
  } finally {
    joinButton.disabled = false;
    joinButton.textContent = "Join voice room";
  }
});

async function cleanupRoom(showLogin = true) {
  if (room) {
    for (const el of attachedAudio.values()) el.remove();
    attachedAudio.clear();
    const oldRoom = room;
    room = null;
    try { await oldRoom.disconnect(); } catch {}
  }
  localMicOn = false;
  pttHeld = false;
  pttMode = false;
  $("pttModeButton").textContent = "OFF";
  $("pttModeButton").classList.remove("on");
  $("pttButton").hidden = true;
  updateMicUI();
  if (showLogin) {
    roomView.style.display = "none";
    loginView.style.display = "block";
  }
}

$("micButton").addEventListener("click", () => {
  if (pttMode) {
    toast("Turn off push-to-talk mode to use the mute button.");
    return;
  }
  setMic(!localMicOn);
});
$("muteButton").addEventListener("click", () => {
  if (pttMode) return toast("Push-to-talk is enabled.");
  setMic(!localMicOn);
});
$("leaveButton").addEventListener("click", () => cleanupRoom(true));

$("pttModeButton").addEventListener("click", async () => {
  pttMode = !pttMode;
  $("pttModeButton").textContent = pttMode ? "ON" : "OFF";
  $("pttModeButton").classList.toggle("on", pttMode);
  $("pttButton").hidden = !pttMode;
  pttHeld = false;
  await setMic(!pttMode);
  if (pttMode) toast("Push-to-talk enabled. Hold the button or Space to speak.");
});

async function holdToTalk(held) {
  if (!room || !pttMode || pttHeld === held) return;
  pttHeld = held;
  $("pttButton").classList.toggle("held", held);
  await setMic(held);
}
const pttButton = $("pttButton");
pttButton.addEventListener("pointerdown", (e) => { e.preventDefault(); pttButton.setPointerCapture?.(e.pointerId); holdToTalk(true); });
pttButton.addEventListener("pointerup", () => holdToTalk(false));
pttButton.addEventListener("pointercancel", () => holdToTalk(false));
pttButton.addEventListener("lostpointercapture", () => holdToTalk(false));

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && pttMode && !e.repeat && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    holdToTalk(true);
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && pttMode) {
    e.preventDefault();
    holdToTalk(false);
  }
});
window.addEventListener("blur", () => { if (pttMode) holdToTalk(false); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
