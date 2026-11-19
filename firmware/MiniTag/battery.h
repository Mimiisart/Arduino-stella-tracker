// Supply measurement using the nRF52840's internal VDD input.
// On a CR2032 the chip runs straight off the cell, so VDD ~= battery voltage.
// On USB, VDD is the regulated ~3.3 V rail and says nothing about the cell.
#pragma once

#include <Arduino.h>

namespace battery {

// Returns VDD in millivolts, or 0 if the ADC did not respond.
uint16_t readMillivolts();

// True when USB VBUS is present (board is USB powered).
bool usbPowered();

}  // namespace battery
