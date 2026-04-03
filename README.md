# KatEye

Andy Tran (hardware)  
Kevin Nguyen (client)  
Tyler Le (AI/ML)

KatEye is the **mobile client** for fleet and in-transit package telemetry: a supervisor-style view of devices, recent driving events, and per-unit detail (including IMU context when the backend stores it). It is built with **Expo** and **React Native**. **Firebase Realtime Database** holds **`alerts`** rows that the app subscribes to in real time, plus optional static JSON for local demos. Screens include fleet overview, digital twin, a map centered on the handset’s location, and a **Config** tab for connection diagnostics.

## Stack (at a glance)

- **Expo 54** + **Expo Router** (file-based routes under `mobile/app/`)
- **React Native** UI, **react-native-maps** + **expo-location** on the map screen
- **Firebase** JS SDK → **Realtime Database** (`alerts` path), wired in `mobile/features/firebase/`

## How data reaches the app

Gateways or backends write alert documents under **`alerts/<eventId>`** in RTDB (device id, event type, timestamp, optional IMU `snapshot` object). The app opens one **`onValue`** listener on **`alerts`**, normalizes rows in code, and feeds the overview dashboard and per-device digital twin screens. Nothing in this repo pushes to Firebase; it only reads (and merges env config at build time).

## Directory map

```text
KatEye/
├── .env.example          # template for EXPO_PUBLIC_* (copy to .env at repo root)
├── firebase-rtdb-alerts.fixture.json
├── mobile/
│   ├── app/              # Expo Router screens (tabs: overview, digital-twin, map, reports)
│   ├── components/       # shared UI (e.g. top/bottom navigation)
│   ├── context/          # theme, alert events subscription
│   ├── features/
│   │   ├── dashboard/    # fleet overview, charts, package cards
│   │   ├── digital-twin/ # device detail + telemetry list
│   │   └── firebase/     # RTDB client, parsing, optional fixture load
│   ├── styles/           # theme tokens and shared styles
│   └── assets/
└── hardware/             # placeholder for firmware / edge notes (currently empty)
```

## System architecture
<img width="976" height="561" alt="PNG image" src="https://github.com/user-attachments/assets/80b85f67-63d5-4522-937e-4144244bed02" />

## ML model

The edge stack uses a small 1D CNN on gyro + accelerometer windows to classify driving events on-device (ESP32-S3), instead of shipping raw streams to the cloud. When firmware or a gateway emits a detection, that event is what ends up as **`event_type`** (and often **`snapshot`** IMU series) under **`alerts`** in RTDB—same six-channel shape the model was trained on—which KatEye then lists on the dashboard and in the digital twin. Details, training pipeline, and export artifacts live in **[tylerrleee/driving-classifier](https://github.com/tylerrleee/driving-classifier)** (driving behavior classifier from IMU data, INT8 TFLite for embedded use).

## Requirements

- macOS with **Xcode** (iOS Simulator) or an **iPhone** with [Expo Go](https://expo.dev/go)
- **Node.js** 20+ and npm

## Environment

Copy `.env.example` to `.env` in the **repo root** (same level as `mobile/`). Fill in the `EXPO_PUBLIC_*` keys from your Firebase project (Project settings – your apps / SDK snippet). Those names must stay prefixed with `EXPO_PUBLIC_` so Metro can embed them in the client build. Do not commit `.env`; it should stay gitignored.

## Run (iOS)

From the repo root:

```bash
cd mobile
npm install
npx expo start
```

Press `i` for the iOS Simulator, or use Expo Go on a device. With the dev server running, press `r` in that terminal to reload the app; Fast Refresh usually picks up saves on its own. Ensure `.env` exists at the repo root before running (see **Environment**).

## Roadmap (gantt)

<img width="1149" height="247" alt="CleanShot 2026-04-03 at 14 37 05@2x" src="https://github.com/user-attachments/assets/b89fa9dc-276d-4801-9f37-5c0148c90838" />

## Troubleshooting

- **Expo Go cannot load the bundle**: Phone and computer must be on the same LAN, or run Expo with **tunnel** so traffic does not rely on local network discovery. Corporate or guest Wi‑Fi often blocks device-to-laptop ports.
- **Env vars missing in the app**: `mobile` scripts load `.env` from the **parent** directory; the file must live next to `mobile/`, not inside `mobile/`. Restart Metro after editing `.env`.
- **Stale JS after upgrades**: `npx expo start --clear` (or delete `.expo` / Metro cache) before assuming a dependency change failed.
- **RTDB empty or permission errors**: Confirm `EXPO_PUBLIC_FIREBASE_DATABASE_URL` and security rules allow the client to **read** `alerts` for your test identity. In the app, open the **Config** tab (bottom navigation), use the **Data connection** card, and tap refresh: it re-runs the Firebase read and surfaces the same status string you would infer from logs (fixture vs live, count, or error message) without digging into Metro.

## Screenshots
<p>
  <img width="19%" alt="image" src="https://github.com/user-attachments/assets/67991ec0-742f-41cf-8600-c1d984c5b1fb" />
  <img width="19%" alt="image" src="https://github.com/user-attachments/assets/3822b859-adf1-485f-89f9-3a9bf33251f0" />
  <img width="19%" alt="simulator_screenshot_55F98F53-8354-4424-BC60-15FD8C5712D5" src="https://github.com/user-attachments/assets/b4c41ff9-bf4a-4b56-9485-ed9532800f1c" />
  <img width="19%" alt="image" src="https://github.com/user-attachments/assets/1dee3d40-8a0e-4d23-bb9b-2f2be22af361" />
  <img width="19%" alt="image" src="https://github.com/user-attachments/assets/a3c1885c-8e15-49a3-9df9-73af8bce4e6f" />
</p>

## License

See `LICENSE`.
