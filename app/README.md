# MiniTag App (React Native + Expo)

Companion app for the MiniTag ID-card tracker. It uses Expo SDK 58, Expo Router
and `react-native-ble-plx`. The BLE contract with the firmware is in
[`../docs/ble-protocol.md`](../docs/ble-protocol.md).

> **Expo Go will not work.** Bluetooth needs native code that Expo Go doesn't
> include, so the app runs as a *development build* on your iPhone.

## What works so far

- **Pairing:** scan for MiniTag, pick it, name it ("School ID") and connect.
- **Dashboard:** connection state, last connected time, battery level and firmware version.
- **Find My ID:** the tag beeps as soon as the screen opens. Stop works from the
  app or from the tag's button. The tag stops by itself after 30 s, and stops if
  you leave the screen.
- **Auto-reconnect:** the app keeps a pending connection open, so the tag
  reconnects when it comes back into range.
- **Remove tracker.**

Not built yet: leave-behind alerts, last-seen location, campus map, Precision
Find (UWB) and settings.

## Run it on your iPhone (free Apple ID)

### One-time setup

1. Install **Xcode** from the Mac App Store. Open it once, accept the licence,
   and let it install the iOS platform.
2. Point the command-line tools at Xcode (this asks for your Mac password):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. In Xcode, go to **Settings → Accounts → +** and sign in with your Apple ID.
4. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode**
   (it restarts the phone). Connect it to the Mac with a cable and tap **Trust**.

### Build and install

```bash
cd ~/"Arduino Stella/app" && npx expo run:ios --device
```

Pick your iPhone from the list. The first build takes several minutes.

- **"No signing team" / "bundle identifier unavailable":** free accounts need a
  unique bundle ID. Change `ios.bundleIdentifier` in `app.json` (for example to
  `com.yourname.minitag`) and run the command again.
- **"Untrusted Developer" on the phone:** go to **Settings → General → VPN &
  Device Management**, open your Apple ID and tap **Trust**.
- With a free Apple ID the app expires after **7 days**. Run the same command
  again to reinstall it.

### Day-to-day

After the first install, JavaScript changes don't need a rebuild:

```bash
npx expo start
```

Open MiniTag on the phone and it connects to the dev server. Rebuild with
`npx expo run:ios --device` only when you add a package with native code or
change `app.json`.

## Checks

```bash
npm run typecheck    # TypeScript
npx expo lint        # ESLint
npm test             # protocol unit tests (Node's test runner)
npx expo-doctor      # dependency and config health
```

## Layout

| Path | What it is |
|---|---|
| `src/ble/protocol.ts` | UUIDs plus status, command and event encoding (pure, unit tested) |
| `src/ble/minitag-client.ts` | BLE connection: scan, connect, reconnect, command replies |
| `src/ble/minitag-context.tsx` | React provider that saves the paired tracker |
| `src/app/index.tsx` | Home dashboard |
| `src/app/pair.tsx` | Tracker discovery and naming |
| `src/app/find.tsx` | Find My ID (buzzer) |
| `src/components/minitag/ui.tsx` | Shared buttons, cards and status pill |
| `tests/protocol.test.ts` | Tests using bytes captured from the real Stella |
