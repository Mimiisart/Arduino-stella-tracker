"""Start a FIND on MiniTag and print every event for 60 s.

Usage: .venv/bin/python tools/find.py [seconds]
Press the tag's button while it beeps: you should see 'EVT BUTTON' and the beeping stops.
"""
import asyncio, sys
from bleak import BleakScanner, BleakClient

CMD = "1c400002-524a-4696-9523-dd1cee737c33"
EVT = "1c400003-524a-4696-9523-dd1cee737c33"

async def main():
    seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    dev = await BleakScanner.find_device_by_name("MiniTag", timeout=15)
    if not dev:
        print("MiniTag not found"); return
    async with BleakClient(dev) as c:
        await c.start_notify(EVT, lambda _, d: print("event:", bytes(d).decode()))
        await c.write_gatt_char(CMD, f"FIND {seconds}".encode(), response=True)
        print(f"Beeping for up to {seconds}s - press the tag's button now (Ctrl+C to quit)")
        await asyncio.sleep(seconds + 2)

try:
    asyncio.run(main())
except KeyboardInterrupt:
    pass
