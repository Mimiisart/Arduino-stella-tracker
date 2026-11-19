# MiniTag Firmware (Arduino Stella ABX00131)

## Setup (one time)

1. In Arduino IDE, open **Boards Manager** and install **Arduino Mbed OS Stella Boards**.
2. In **Library Manager**, install **ArduinoBLE**.
3. Install **StellaUWB**: download the ZIP from
   <https://github.com/Truesense-it/StellaUWB>, then use
   **Sketch → Include Library → Add .ZIP Library…**.
   (On this Mac it is already cloned into `~/Documents/Arduino/libraries/StellaUWB`.)

## Build and upload

Open `firmware/MiniTag/MiniTag.ino`, select **Tools → Board → Arduino Stella**,
choose the port, then click Upload.

From the terminal, using the CLI bundled with the IDE:

```bash
CLI="/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"
"$CLI" compile --fqbn arduino:mbed_stella:stella firmware/MiniTag
"$CLI" upload  --fqbn arduino:mbed_stella:stella -p <port> firmware/MiniTag
```

**Take the CR2032 out while the board is on USB.** Arduino warns against
powering it from both at once.

## Pins

| Function | nRF pin | Source |
|---|---|---|
| Buzzer (FUET-5020 via SS8050 transistor) | P0.05 | schematic PIN MAP, `BUZ` net |
| User button | P1.01 | schematic PIN MAP, `KEY` net |
| White LED (active-low) | P1.05 (`p37`) | schematic + Stella user manual |

These are set in `config.h`. The buzzer pin was read off the schematic's pin map
table and is **confirmed on hardware**: the board chirps at boot (19 Nov 2026).

## Automated BLE test (from a Mac)

Run this in Terminal. macOS asks for Bluetooth permission the first time; allow it.

```bash
cd ~/"Arduino Stella" && python3 -m venv .venv && .venv/bin/pip install -q -r tools/requirements.txt && .venv/bin/python tools/ble_test.py
```

The script connects, then runs STATUS, a short FIND and its timeout, FIND then
STOP, a bad argument, the 120 s cap, UWB_START and an unknown command. Each
step prints PASS or FAIL.

## Hardware test checklist (nRF Connect app)

1. **Power on.** You should hear a short chirp. The Serial Monitor (115200 baud)
   prints `MiniTag starting...` and then `> EVT READY`.
2. **Scan.** Open nRF Connect and find **MiniTag** in the scan list, then connect.
3. **Subscribe.** In service `1c400001…`, enable notifications on Event (`…0003`)
   and Status (`…0004`).
4. **FIND.** Write the UTF-8 text `FIND` to Command (`…0002`). The buzzer should
   beep twice per second with the LED flashing, and Event shows `OK FIND 30`.
5. **STOP.** Write `STOP`. The beeping stops and Event shows `OK STOP`.
6. **Button.** Start `FIND 60`, then press the tag's button. The beeping stops
   and Event shows `EVT BUTTON`.
7. **Timeout.** Write `FIND 5` and wait. After 5 s Event shows `EVT FIND_TIMEOUT`.
8. **Battery.** On a CR2032 (USB unplugged), write `STATUS`. Bytes 2–3 of Status
   should be about 2800–3100 mV for a fresh cell.
9. **UWB.** On a UWB phone, open NXP Trimension AR or Qorvo Nearby Interaction
   (iOS), or the Truesense or NXP demo (Android), and connect to MiniTag. The
   Serial Monitor prints `UWB session started` and then distance readings.

Protocol details are in [`docs/ble-protocol.md`](../docs/ble-protocol.md).

## Known unknowns (verify on hardware)

- ~~Button polarity~~: confirmed active-low on hardware (19 Nov 2026). A press
  during FIND stops the buzzer and sends `EVT BUTTON`. Find it with `tools/find.py`.
- **Nearby service visibility.** macOS service discovery showed only the Nordic
  UART and MiniTag services, not the Nearby service `48FE3E40…`. Check from a
  phone (nRF Connect, or the Qorvo/NXP UWB apps) before building Precision Find.
- **Power draw.** UWB starts whenever a phone connects, following Arduino's
  NearbyDemo. Measure the current on a coin cell. If it's too high, start UWB
  only when a Nearby session is requested.
- **Background alerts.** Leave-behind detection runs on the phone, so test it
  in the app with the phone locked.
