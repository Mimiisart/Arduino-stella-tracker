import asyncio, struct, sys
from bleak import BleakScanner, BleakClient

SVC = "1c400001-524a-4696-9523-dd1cee737c33"
CMD = "1c400002-524a-4696-9523-dd1cee737c33"
EVT = "1c400003-524a-4696-9523-dd1cee737c33"
STA = "1c400004-524a-4696-9523-dd1cee737c33"

events = asyncio.Queue()

def fmt_status(b):
    ver, flags, mv, fmaj, fmin = struct.unpack("<BBHBB", bytes(b))
    names = [n for bit, n in [(1, "buzzer"), (2, "uwb"), (4, "batt_valid"), (8, "usb")] if flags & bit]
    return f"v{ver} flags={names} mv={mv} fw={fmaj}.{fmin}"

async def expect(prefix, timeout=5.0):
    end = asyncio.get_event_loop().time() + timeout
    while True:
        left = end - asyncio.get_event_loop().time()
        if left <= 0:
            print(f"  FAIL: no '{prefix}' within {timeout}s"); return False
        try:
            e = await asyncio.wait_for(events.get(), left)
        except asyncio.TimeoutError:
            continue
        if e.startswith(prefix):
            print(f"  PASS: got '{e}'"); return True
        print(f"  (other event '{e}')")

async def main():
    print("Scanning for MiniTag...")
    dev = await BleakScanner.find_device_by_name("MiniTag", timeout=15)
    if not dev:
        print("MiniTag not found"); sys.exit(1)
    print("Found", dev.address)
    async with BleakClient(dev) as c:
        print("Services:")
        for s in c.services:
            print("  ", s.uuid, [ch.uuid[:8] + ":" + ",".join(ch.properties) for ch in s.characteristics])
        print("Initial status:", fmt_status(await c.read_gatt_char(STA)))
        await c.start_notify(EVT, lambda _, d: events.put_nowait(bytes(d).decode()))
        await c.start_notify(STA, lambda _, d: print("  status ->", fmt_status(d)))

        async def send(t):
            print(f"\n>> {t!r}")
            await c.write_gatt_char(CMD, t.encode(), response=True)

        await send("STATUS");        await expect("OK STATUS")
        await send("find 3");        await expect("OK FIND 3")
        await expect("EVT FIND_TIMEOUT", 6)
        await send("FIND");          await expect("OK FIND 30")
        await asyncio.sleep(2)
        await send("STOP\n");        await expect("OK STOP")
        await send("FIND abc");      await expect("ERR BAD_ARG")
        await send("FIND 999");      await expect("OK FIND 120")
        await send("STOP");          await expect("OK STOP")
        await send("UWB_START");     await expect("ERR UWB_VIA_NI")
        await send("HELLO");         await expect("ERR UNKNOWN_CMD")
        print("\nFinal status:", fmt_status(await c.read_gatt_char(STA)))

asyncio.run(main())
