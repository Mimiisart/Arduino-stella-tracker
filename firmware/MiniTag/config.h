// MiniTag firmware configuration.
// Pin assignments come from the ABX00131 schematic (PIN MAP table) and the
// Stella user manual. If the buzzer is silent on the boot chirp, check
// BUZZER_PIN first.
#pragma once

#include <mbed.h>

// ---- Identity ---------------------------------------------------------------
#define MINITAG_DEVICE_NAME   "MiniTag"   // what phones see when scanning
#define MINITAG_FW_MAJOR      0
#define MINITAG_FW_MINOR      2
#define MINITAG_PROTOCOL_VER  1           // bump when the BLE protocol changes

// ---- Pins (nRF52840 pin names) ----------------------------------------------
// BUZ net -> P0.05, drives the FUET-5020 through an SS8050 transistor.
#define BUZZER_PIN            P0_5
// KEY net -> P1.01, the user button (assumed active-low).
#define BUTTON_PIN            P1_1
// LEDW net -> P1.05 (Arduino "p37"); active-low: LOW = on.
#define STATUS_LED_PIN        P1_5

// ---- Buzzer -----------------------------------------------------------------
#define BUZZER_FREQ_HZ        4000        // FUET-5020 resonant frequency
#define FIND_DEFAULT_SECONDS  30          // FIND with no argument
#define FIND_MAX_SECONDS      120         // cap so a lost tag cannot drain the cell
#define BOOT_CHIRP            1           // short beep at power-up (pin self-test)

// ---- Left-behind beep (armed by the app with ARM / DISARM) ------------------
// If an armed tag loses its phone, it waits out short Bluetooth drops, then
// beeps for a limited time so someone nearby notices the ID card.
#define AWAY_GRACE_SECONDS    10          // ignore drops shorter than this
#define AWAY_BEEP_SECONDS     20          // then beep this long (battery cap)

// ---- Battery ----------------------------------------------------------------
#define BATTERY_SAMPLE_MS     60000       // background VDD sample period

// ---- BLE UUIDs (MiniTag service) -------------------------------------------
// The Nearby Interaction / UWB services are added by the StellaUWB library;
// these are MiniTag's own.
#define MINITAG_SERVICE_UUID  "1c400001-524a-4696-9523-dd1cee737c33"
#define MINITAG_COMMAND_UUID  "1c400002-524a-4696-9523-dd1cee737c33"
#define MINITAG_EVENT_UUID    "1c400003-524a-4696-9523-dd1cee737c33"
#define MINITAG_STATUS_UUID   "1c400004-524a-4696-9523-dd1cee737c33"
