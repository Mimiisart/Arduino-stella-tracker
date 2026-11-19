// Non-blocking buzzer + LED "find me" pattern driven by hardware PWM.
#pragma once

#include <Arduino.h>

namespace buzzer {

void begin();

// Start the find pattern for `seconds` (clamped to 1..FIND_MAX_SECONDS).
void startFind(uint16_t seconds);

// Stop immediately and force the pin low.
void stop();

// Single short beep (blocking, ~ms). Used for the boot self-test.
void chirp(uint16_t ms);

bool isActive();

// Call from loop(). Returns true once when a FIND times out on its own.
bool update();

}  // namespace buzzer
