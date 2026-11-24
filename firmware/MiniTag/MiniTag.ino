/**
  MiniTag tracker firmware for the Arduino Stella (ABX00131).

  - Advertises as "MiniTag" over BLE.
  - MiniTag service: text commands (FIND / STOP / STATUS / BATTERY), short
    text events and a 6-byte binary status. See docs/ble-protocol.md.
  - Left-behind beep: once the app sends ARM, losing the phone for longer
    than AWAY_GRACE_SECONDS makes the tag beep for AWAY_BEEP_SECONDS.
  - Apple Nearby Interaction / Android UWB precision finding through the
    StellaUWB library's own BLE services, on the same connection.

  Board:     Tools > Board > Arduino Mbed OS Stella Boards > Arduino Stella
  Libraries: ArduinoBLE, StellaUWB (https://github.com/Truesense-it/StellaUWB)
*/

#include <ArduinoBLE.h>
#include <StellaUWB.h>

#include "config.h"
#include "buzzer.h"
#include "battery.h"

// ---- MiniTag BLE service ----------------------------------------------------

BLEService miniTagService(MINITAG_SERVICE_UUID);
BLECharacteristic commandChar(MINITAG_COMMAND_UUID, BLEWrite | BLEWriteWithoutResponse, 32);
// Events stay <= 20 bytes so they fit the default ATT MTU without negotiation.
BLECharacteristic eventChar(MINITAG_EVENT_UUID, BLERead | BLENotify, 20);
BLECharacteristic statusChar(MINITAG_STATUS_UUID, BLERead | BLENotify, 6, true);

// Status flag bits (byte 1 of the status characteristic).
const uint8_t FLAG_BUZZER_ACTIVE = 1 << 0;
const uint8_t FLAG_UWB_SESSION   = 1 << 1;
const uint8_t FLAG_BATTERY_VALID = 1 << 2;
const uint8_t FLAG_USB_POWERED   = 1 << 3;
const uint8_t FLAG_AWAY_ARMED    = 1 << 4;

uint16_t numConnected = 0;
uint16_t numUwbSessions = 0;
uint16_t lastBatteryMv = 0;
unsigned long lastBatterySampleAt = 0;

// Left-behind state. Armed lives in RAM only: after a reset the tag stays
// quiet until the phone reconnects and arms it again.
bool awayArmed = false;
bool awayPending = false;       // phone lost, waiting out the grace period
unsigned long awayDueAt = 0;

// ---- Helpers ----------------------------------------------------------------

void sendEvent(const char *text) {
  size_t len = strlen(text);
  if (len > 20) len = 20;
  eventChar.writeValue((const uint8_t *)text, len);
  Serial.print("> ");
  Serial.println(text);
}

void publishStatus() {
  uint8_t flags = 0;
  if (buzzer::isActive())   flags |= FLAG_BUZZER_ACTIVE;
  if (numUwbSessions > 0)   flags |= FLAG_UWB_SESSION;
  if (lastBatteryMv > 0)    flags |= FLAG_BATTERY_VALID;
  if (battery::usbPowered()) flags |= FLAG_USB_POWERED;
  if (awayArmed)            flags |= FLAG_AWAY_ARMED;

  uint8_t status[6] = {
    MINITAG_PROTOCOL_VER,
    flags,
    (uint8_t)(lastBatteryMv & 0xFF),   // little-endian millivolts
    (uint8_t)(lastBatteryMv >> 8),
    MINITAG_FW_MAJOR,
    MINITAG_FW_MINOR,
  };
  statusChar.writeValue(status, sizeof(status));
}

void sampleBattery() {
  lastBatteryMv = battery::readMillivolts();
  lastBatterySampleAt = millis();
}

// ---- Commands ---------------------------------------------------------------

void handleCommand(char *cmd) {
  // Split "FIND 20" into verb and optional argument.
  char *arg = strchr(cmd, ' ');
  if (arg) {
    *arg++ = '\0';
    while (*arg == ' ') arg++;
  }

  if (strcmp(cmd, "FIND") == 0) {
    long seconds = FIND_DEFAULT_SECONDS;
    if (arg && *arg) {
      char *end;
      seconds = strtol(arg, &end, 10);
      if (*end != '\0' || seconds < 1) {
        sendEvent("ERR BAD_ARG");
        return;
      }
      if (seconds > FIND_MAX_SECONDS) seconds = FIND_MAX_SECONDS;
    }
    buzzer::startFind((uint16_t)seconds);
    char reply[21];
    snprintf(reply, sizeof(reply), "OK FIND %ld", seconds);
    sendEvent(reply);
    publishStatus();

  } else if (strcmp(cmd, "STOP") == 0) {
    buzzer::stop();
    sendEvent("OK STOP");
    publishStatus();

  } else if (strcmp(cmd, "ARM") == 0) {
    awayArmed = true;
    sendEvent("OK ARM");
    publishStatus();

  } else if (strcmp(cmd, "DISARM") == 0) {
    awayArmed = false;
    awayPending = false;
    if (buzzer::isAway()) buzzer::stop();
    sendEvent("OK DISARM");
    publishStatus();

  } else if (strcmp(cmd, "STATUS") == 0 || strcmp(cmd, "BATTERY") == 0) {
    sampleBattery();
    publishStatus();
    sendEvent(strcmp(cmd, "STATUS") == 0 ? "OK STATUS" : "OK BATTERY");

  } else if (strcmp(cmd, "UWB_START") == 0 || strcmp(cmd, "UWB_STOP") == 0) {
    // UWB sessions are negotiated by the phone through the Nearby
    // Interaction service (StellaUWB), not through MiniTag commands.
    sendEvent("ERR UWB_VIA_NI");

  } else {
    sendEvent("ERR UNKNOWN_CMD");
  }
}

void onCommandWritten(BLEDevice central, BLECharacteristic characteristic) {
  char buf[33];
  int len = characteristic.valueLength();
  if (len > 32) len = 32;
  memcpy(buf, characteristic.value(), len);
  buf[len] = '\0';

  // Trim trailing whitespace / newlines (handy when typing in nRF Connect).
  while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r' || buf[len - 1] == ' ')) {
    buf[--len] = '\0';
  }
  char *start = buf;
  while (*start == ' ') start++;
  for (char *p = start; *p; p++) *p = toupper((unsigned char)*p);

  Serial.print("< ");
  Serial.println(start);
  handleCommand(start);
}

// ---- Nearby / UWB callbacks (from the StellaUWB example) ---------------------

void rangingHandler(UWBRangingData &rangingData) {
  if (rangingData.measureType() != (uint8_t)uwb::MeasurementType::TWO_WAY) return;
  RangingMeasures twr = rangingData.twoWayRangingMeasure();
  for (int j = 0; j < rangingData.available(); j++) {
    if (twr[j].status == 0 && twr[j].distance != 0xFFFF) {
      Serial.print("UWB distance: ");
      Serial.println(twr[j].distance);
    }
  }
}

void clientConnected(BLEDevice dev) {
  if (numConnected == 0) {
    UWB.begin();  // start the UWB engine only while a phone is connected
  }
  numConnected++;
  // The phone is back: cancel or silence the left-behind beep.
  awayPending = false;
  if (buzzer::isAway()) buzzer::stop();
  Serial.print("Connected: ");
  Serial.println(dev.address());
  sampleBattery();
  publishStatus();
}

void clientDisconnected(BLEDevice dev) {
  if (numConnected > 0) numConnected--;
  if (numConnected == 0) {
    UWB.end();
    numUwbSessions = 0;
  }
  // Left behind? Wait out short drops before beeping (see loop()).
  if (numConnected == 0 && awayArmed) {
    awayPending = true;
    awayDueAt = millis() + AWAY_GRACE_SECONDS * 1000UL;
  }
  // A FIND keeps sounding after the phone drops: the user may be walking
  // toward the beep. The FIND timeout still stops it.
  Serial.print("Disconnected: ");
  Serial.println(dev.address());
}

void sessionStarted(BLEDevice dev) {
  numUwbSessions++;
  Serial.println("UWB session started");
  publishStatus();
}

void sessionStopped(BLEDevice dev) {
  if (numUwbSessions > 0) numUwbSessions--;
  Serial.println("UWB session stopped");
  publishStatus();
}

// ---- Button -----------------------------------------------------------------

bool lastButtonDown = false;
unsigned long buttonChangedAt = 0;

void pollButton() {
  bool down = digitalRead(BUTTON_PIN) == LOW;  // active-low with pull-up
  unsigned long now = millis();
  if (down == lastButtonDown || now - buttonChangedAt < 30) return;  // debounce
  lastButtonDown = down;
  buttonChangedAt = now;
  if (!down) return;  // act on press only

  if (buzzer::isActive()) {
    // Found it: pressing the tag's button silences it.
    buzzer::stop();
    publishStatus();
  }
  sendEvent("EVT BUTTON");
}

// ---- Arduino entry points -----------------------------------------------------

void setup() {
  Serial.begin(115200);

  buzzer::begin();
  pinMode(BUTTON_PIN, INPUT_PULLUP);

#if BOOT_CHIRP
  buzzer::chirp(80);
#endif

  Serial.println("MiniTag starting...");

  UWB.registerRangingCallback(rangingHandler);
  UWBNearbySessionManager.onConnect(clientConnected);
  UWBNearbySessionManager.onDisconnect(clientDisconnected);
  UWBNearbySessionManager.onSessionStart(sessionStarted);
  UWBNearbySessionManager.onSessionStop(sessionStopped);

  // Starts BLE and adds the Nearby Interaction services. Advertising begins
  // on the first poll(), so our service must be added before then.
  UWBNearbySessionManager.begin(MINITAG_DEVICE_NAME);

  miniTagService.addCharacteristic(commandChar);
  miniTagService.addCharacteristic(eventChar);
  miniTagService.addCharacteristic(statusChar);
  BLE.addService(miniTagService);
  commandChar.setEventHandler(BLEWritten, onCommandWritten);

  sampleBattery();
  publishStatus();
  sendEvent("EVT READY");
}

void loop() {
  UWBNearbySessionManager.poll();  // BLE events + UWB housekeeping

  if (buzzer::update()) {
    sendEvent("EVT FIND_TIMEOUT");
    publishStatus();
  }

  if (awayPending && (long)(millis() - awayDueAt) >= 0) {
    awayPending = false;
    if (!buzzer::isActive()) {  // never cut short a FIND
      Serial.println("Left behind: beeping");
      buzzer::startAway(AWAY_BEEP_SECONDS);
    }
  }

  pollButton();

  if (millis() - lastBatterySampleAt >= BATTERY_SAMPLE_MS) {
    sampleBattery();
    publishStatus();
  }

  delay(10);  // mbed delay() sleeps the thread, which saves power
}
