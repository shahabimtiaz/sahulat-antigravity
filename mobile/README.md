# Sahulat Mobile (Expo)

React Native app for the Sahulat agentic service orchestrator. Talks to the
Next.js API in the repo root.

## Quick start

```bash
cd mobile
pnpm install
EXPO_PUBLIC_API_BASE=http://192.168.x.x:3000 pnpm start
# (use your laptop's LAN IP so the phone can reach the dev API)
```

Press `a` for Android emulator, `i` for iOS simulator, or scan the QR
code with **Expo Go** on a real device.

## Build an APK

```bash
npx eas-cli login
pnpm build:android      # eas build -p android --profile preview
```

The `preview` profile produces an installable APK (instead of an AAB) for
hackathon demos.

## Screens

- `app/index.tsx`        — landing + sample multilingual prompts
- `app/request.tsx`      — chat → intent → ranked offers → confirm
- `app/booking/[id].tsx` — lifecycle (confirmed → en route → completed),
                          review, dispute, simulate provider cancellation
- `app/trace/[id].tsx`   — Antigravity-style agent timeline with rationales

## Backend

The mobile app reuses the **same** Next.js route handlers in `../app/api/*`.
Switch backends by setting `EXPO_PUBLIC_API_BASE`.
