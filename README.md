# MiniTag: Arduino Stella ID-card tracker

MiniTag clips to a student ID-card holder and helps you find it. An **Arduino
Stella** board beeps on command over Bluetooth Low Energy, and an iPhone app
shows where you last had it and warns you if you walk away without it.

| Part | Folder | Built with |
|---|---|---|
| Tag firmware | [`firmware/MiniTag`](firmware/MiniTag) | C++, Arduino Mbed OS Stella core, ArduinoBLE, StellaUWB |
| Bluetooth protocol | [`docs/ble-protocol.md`](docs/ble-protocol.md) | Custom GATT service (commands, events, 6-byte status) |
| Mobile app | [`app`](app) | React Native, Expo SDK 58, TypeScript |
| Cloud back end | [`backend`](backend) | Supabase (PostgreSQL + Auth, row level security) |
| Test tools | [`tools`](tools) | Python (bleak) |
| Project book | [`docs/MiniTag_Project_Book.pdf`](docs/MiniTag_Project_Book.pdf) | How everything works, for the defence |

## Features

- **Find My ID:** make the tag beep; stop it from the app or the tag's button
- **Left-behind alert:** a notification when the tag disconnects and doesn't come back
- **Last-seen map** and **safe places** where no alert fires
- Four colour themes, each in light and dark
- In progress: Precision Find (UWB) and community finding

## Getting started

- Firmware: see [`firmware/README.md`](firmware/README.md)
- App: see [`app/README.md`](app/README.md)
- Back end: see [`backend/README.md`](backend/README.md)
