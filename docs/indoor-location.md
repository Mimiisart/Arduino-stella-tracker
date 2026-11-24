# Indoor location: building, floor and room

MiniTag tells a student where they left their ID card, e.g.
**"Classroom 2 · First floor · Felix Ohiwerei Building"**. The tag has no GPS,
so the location is always the **phone's** location at the moment the tag lost
its connection. This document explains how that location is worked out, how
accurate it is, and how it will improve.

## The approach: campus geodata + phone sensors (sensor fusion over a GIS model)

| Layer | Source | Gives |
|---|---|---|
| **Campus model (GIS)** | OpenStreetMap building footprints for Pan-Atlantic University (73 buildings, 18 named) + rooms recorded by campus admins | Where every building is, its exact outline, which rooms exist on which floor |
| **Horizontal position** | Phone GPS / Core Location (satellites + Wi-Fi assistance) | Roughly where the phone is (5-30 m indoors) |
| **Vertical position** | Phone barometer (air-pressure sensor) | How high the phone is above the ground floor |

### 1. Building: point-in-polygon

Each building's outline (footprint) is a polygon from OpenStreetMap. A ray-casting
**point-in-polygon** test checks whether the phone's position is inside a
footprint. If it is in none, the nearest footprint within the GPS uncertainty
gives "Near Students' Centre".

### 2. Floor: barometric altimetry

Air pressure falls about **0.12 hPa per metre** of height near sea level (about
8.3 m per hPa). With a ground-level reference pressure `p0`, the international
barometric formula gives the height of the phone:

```
height = 44330 × (1 − (p / p0)^(1 / 5.255))      metres
floor  = round(height / floor_height)             floor_height ≈ 3.5 m
```

On iPhone we prefer iOS's fused **relative altitude** (CMAltimeter), which is
smoother than raw pressure, and fall back to the formula across app restarts.

**The ground reference** is taken automatically whenever the phone is clearly
**outdoors** (GPS accuracy ≤ 15 m and at least 8 m from every building), which
happens naturally as students walk between buildings. A **"I'm on the ground
floor"** button sets it by hand.

**Why the reference expires:** air pressure changes with the weather and, in the
tropics, with the daily **atmospheric pressure tide** (about 1-2 hPa in Lagos, i.e.
10-15 m of apparent height over a day). So floor confidence is **high** for 20
minutes after calibration, **medium** up to an hour, then **low** (the label
shows "First floor?").

### 3. Room: rooms on that floor near the phone

Rooms are stored per building and floor, either as a polygon (from a floor plan)
or as a centre point recorded by an admin standing in the room (GPS averaged over
15 seconds, weighted by each reading's accuracy). The app picks rooms **on the
detected floor** whose polygon contains the phone, or whose centre is within the
GPS uncertainty. If two rooms fit, it says so: "Classroom 2 or Lab A".

## Accuracy you can claim

| Question | Reliability today |
|---|---|
| Which building? | Good: footprints are exact, GPS is usually within one building's size |
| Which floor? | Good when calibrated in the last 20-60 minutes; stacked rooms on different floors are separated by the barometer |
| Which room on the same floor? | Only when rooms are far apart (about 30-40 m+); neighbouring rooms are reported as "A or B" |

## Limits (say these in the defence)

- GPS indoors is typically 5-30 m; walls and roofs block satellite signals.
- iOS does not let apps scan Wi-Fi networks, so Wi-Fi fingerprinting is not possible.
- Background: when the tag disconnects while the app is closed, iOS may not run
  the sensors, so the label uses the last reading taken while the app was open.
- Floor accuracy depends on a recent ground reference (pressure tide).

## Future improvements

| Improvement | How it works | What it adds | Needs |
|---|---|---|---|
| **Bluetooth Low Energy beacons** | A small battery beacon in each room broadcasts an ID; the phone measures signal strength (RSSI) and picks the strongest beacon | Room-level location on the same floor (about 2-5 m) | One beacon per room; iOS iBeacon region monitoring also works in the background |
| **UWB anchors** | Fixed UWB nodes (e.g. another Arduino Stella, or the Portenta UWB Shield) in each room; the tag measures time-of-flight distances to them and the position is solved by **trilateration** | Room and position to about 10 cm, independent of GPS; the Stella is designed for this (RTLS) | Three or more anchors per area, a small gateway to report positions |
| **Official floor plans** | Room polygons from PAU's estates office instead of single points | Exact room shapes, better "which room" decisions | Floor plans, digitised to GeoJSON |
| **Apple Indoor Maps (IMDF)** | Register PAU's buildings in Apple's Indoor Mapping Data Format | Floor detection by iOS itself in registered venues | Apple's indoor maps programme |
| **Tag-side accelerometer** | The Stella's SC7A20 detects whether the tag is moving | "Left behind" vs "on the move with you" | Firmware work only |

## Data and licence

Building footprints come from **OpenStreetMap**, © OpenStreetMap contributors,
licensed under the **Open Database License (ODbL)**. The attribution is shown on
the Map screen. Conversion script: `tools/osm_to_campus.py`; raw export and
GeoJSON: `backend/geodata/`; database: `backend/supabase/002_buildings_rooms.sql`
and `seed_pau_buildings.sql`.
