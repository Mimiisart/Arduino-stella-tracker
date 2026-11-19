# MiniTag BLE Protocol (v1)

This is the contract between the MiniTag firmware (`firmware/MiniTag`) and the
mobile app. Change both sides together and bump `MINITAG_PROTOCOL_VER`.

## Discovery

| Item | Value |
|---|---|
| Advertised local name | `MiniTag` |
| Advertised service UUID | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` (Nordic UART, added by StellaUWB for Nearby Interaction) |

Scan for the name `MiniTag`. The MiniTag service UUID is **not** in the
advertising packet (there is no room next to the Nordic UART service UUID), but
it appears after connecting and discovering services.

## MiniTag service `1c400001-524a-4696-9523-dd1cee737c33`

| Characteristic | UUID | Properties | Format |
|---|---|---|---|
| Command | `1c400002-524a-4696-9523-dd1cee737c33` | Write, Write Without Response | UTF-8 text, ≤ 32 bytes |
| Event | `1c400003-524a-4696-9523-dd1cee737c33` | Read, Notify | UTF-8 text, ≤ 20 bytes |
| Status | `1c400004-524a-4696-9523-dd1cee737c33` | Read, Notify | 6 bytes, binary |

Subscribe to **Event** and **Status** right after connecting.

### Commands (write to Command)

Commands are case-insensitive. Leading and trailing spaces and newlines are ignored.

| Command | Effect | Event reply |
|---|---|---|
| `FIND` | Starts the buzzer and LED pattern for 30 s | `OK FIND 30` |
| `FIND <seconds>` | Same, for 1–120 s (larger values are capped at 120) | `OK FIND <n>` or `ERR BAD_ARG` |
| `STOP` | Stops the buzzer immediately | `OK STOP` |
| `STATUS` | Re-samples the battery and publishes Status | `OK STATUS` |
| `BATTERY` | Same as `STATUS` | `OK BATTERY` |
| `UWB_START` / `UWB_STOP` | Not used: UWB goes through Nearby Interaction (see below) | `ERR UWB_VIA_NI` |
| anything else | — | `ERR UNKNOWN_CMD` |

### Events (notify on Event)

| Event | Meaning |
|---|---|
| `EVT READY` | The firmware has booted (only readable; usually sent before any phone connects) |
| `EVT BUTTON` | The tag's button was pressed. If the buzzer was on, the press also stopped it |
| `EVT FIND_TIMEOUT` | A FIND ran out of time and stopped by itself |
| `OK …` / `ERR …` | Replies to commands, as listed above |

Events stay within 20 bytes, so they fit the default BLE MTU and the app does
not need to request a larger one.

### Status (read / notify)

| Byte | Field | Notes |
|---|---|---|
| 0 | protocol version | currently `1` |
| 1 | flags | bit0 buzzer active · bit1 UWB session active · bit2 battery reading valid · bit3 USB powered |
| 2–3 | supply millivolts | uint16, little-endian; `0` = unknown |
| 4 | firmware major | |
| 5 | firmware minor | |

The firmware notifies Status when you connect, when the buzzer starts or stops,
when a UWB session starts or stops, and about once a minute after a battery sample.

**Battery:** the value is the nRF52840's own supply voltage (VDD). On a CR2032
this is roughly the cell voltage. When bit3 (USB) is set, it is the regulated
~3.3 V rail, so show "USB power" instead of a battery level. CR2032 cells read
about 3.0 V when fresh and fall steeply below about 2.5 V. Show this as a rough
level (Good / Low / Replace) rather than an exact percentage.

TypeScript parsing sketch (`react-native-ble-plx` gives characteristic values
as base64 strings):

```ts
import { Buffer } from 'buffer';

export function parseStatus(base64: string) {
  const b = Buffer.from(base64, 'base64');
  const flags = b.readUInt8(1);
  return {
    protocolVersion: b.readUInt8(0),
    buzzing: (flags & 0x01) !== 0,
    uwbActive: (flags & 0x02) !== 0,
    batteryValid: (flags & 0x04) !== 0,
    usbPowered: (flags & 0x08) !== 0,
    millivolts: b.readUInt16LE(2),
    firmware: `${b.readUInt8(4)}.${b.readUInt8(5)}`,
  };
}

// Commands and events are plain UTF-8 text:
const encodeCommand = (cmd: string) => Buffer.from(cmd, 'utf8').toString('base64');
const decodeEvent = (base64: string) => Buffer.from(base64, 'base64').toString('utf8');
```

## UWB precision finding

The StellaUWB library implements the accessory side of Apple's **Nearby
Interaction** accessory protocol and of the Android UWB demo protocol. It runs
over the Nordic UART service (`6E400002` write / `6E400003` notify) and the
Nearby service (`48FE3E40-0817-4BB2-8633-3073689C2DBA`). The phone drives the
session, so the app's Precision Find screen speaks that protocol directly. There
is no MiniTag command for it.

Before writing app code, test the UWB side with NXP Trimension AR or Qorvo
Nearby Interaction (iOS), or the NXP / Truesense UWB demos (Android). They should
find the tag as `MiniTag`.

## Leave-behind detection

Leave-behind detection runs entirely on the phone: it watches for the BLE
disconnect and then applies the delay and reconnect check from the spec. The
firmware deliberately keeps any active FIND sounding after a disconnect, so you
can still walk toward the beep. The FIND timeout still ends it.
