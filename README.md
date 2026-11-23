# HANGOUT — private gaming voice chat

A responsive, installable web app (PWA) for a private group voice room. It uses:
- Node.js + Express for the app server and secure token endpoint
- LiveKit Cloud for real-time audio (WebRTC/SFU)
- Plain HTML, CSS and JavaScript for the interface

## Important expectations

- The app is designed for a 12-person group, but the free-tier quotas and real-world audio quality depend on your LiveKit account, hosting provider, and network conditions.
- This starter uses one shared invite code and one shared room. Anyone who has the invite code can join. Do not post it publicly.
- This is a deployable starter, not a professionally audited security product.
- HTTPS is required for microphone access on phones. Render provides HTTPS on its hosted URL.
- Browser/PWA audio in the background can be restricted by Android battery settings and browser behavior. Test on the actual phones you plan to use.
- The app does not include voice recording, text chat, or screen sharing.

## 1. Create a LiveKit project

1. Create an account at https://cloud.livekit.io/
2. Create a project.
3. Copy the project's WebSocket URL, API key, and API secret.
4. Check the current free-plan quotas and restrictions in your LiveKit dashboard. Plans can change.

Never put the API secret in frontend code. It belongs only in the server environment variables.

## 2. Run locally on Windows 11

Install Node.js LTS (Node 20 or newer) from https://nodejs.org/ and install VS Code if you want an editor.

1. Extract this ZIP.
2. Open the extracted `hangout-voice-chat` folder in VS Code.
3. In VS Code, choose Terminal > New Terminal.
4. Run:

```powershell
Copy-Item .env.example .env
npm install
```

5. Open `.env` and fill in:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `ROOM_INVITE_CODE` (make a long private code)
6. Save `.env`.
7. Start the app:

```powershell
npm start
```

8. Open http://localhost:3000 in Chrome.
9. Enter a display name and your invite code, then join.

Localhost is treated as a secure context by modern browsers. To test from another phone on your Wi-Fi, use HTTPS hosting; do not expose the local development server directly to the internet.

## 3. Deploy for free with Render (availability and limits may change)

This project includes `render.yaml`.

1. Create a GitHub account at https://github.com/ if you don't already have one.
2. Create a **private** GitHub repository.
3. Upload the extracted project files to that repository. Do not upload `.env`.
4. Create an account at https://render.com/
5. In Render, choose **New > Blueprint** and connect your private repository.
6. Render reads `render.yaml` and creates the web service.
7. In the Render service's Environment settings, add:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `ROOM_INVITE_CODE`
   - `ROOM_NAME` (optional; default is `hangout-friends`)
8. Deploy. Open the `onrender.com` URL shown by Render.
9. Share the HTTPS URL and invite code privately with your friends.

Free hosting providers can sleep, restart, or change their free plans. A sleeping backend may take time to wake up before someone can join.

## 4. Install on Android

1. Open the deployed HTTPS URL in Chrome.
2. Open Chrome's three-dot menu.
3. Choose **Install app** or **Add to Home screen**.
4. Allow microphone permission when prompted.
5. Join the room.

On desktop Chrome/Edge, use the install icon in the address bar or the browser menu if available.

## 5. Test checklist

- Test with two devices first.
- Confirm both devices can hear each other.
- Test mute/unmute.
- Test push-to-talk mode on both touch and keyboard.
- Test with Wi-Fi and mobile data.
- Then gradually test with 4, 8, and finally 12 participants.
- Watch LiveKit usage and quotas in the dashboard.

## Troubleshooting

- **"Voice service is not configured":** Check the four required LiveKit/invite environment variables in Render and redeploy.
- **Microphone permission error:** Use HTTPS, allow microphone access in the browser, and check that another app is not exclusively using the microphone.
- **Can't hear anyone:** Check phone media volume, selected audio output, browser permissions, and LiveKit project status.
- **Can't join from a phone:** Confirm you are using the deployed HTTPS URL, not `localhost`.
- **App sleeps:** The free backend may sleep while idle. Allow time for it to wake or choose a hosting plan that stays online.

## Security notes

- Keep `.env` private and never commit it.
- Use a long, random invite code and rotate it if it leaks.
- API secrets stay on the backend; the browser receives only short-lived room tokens.
- The token endpoint is rate-limited, but this is not a substitute for stronger per-user accounts, abuse controls, or a production security review.
