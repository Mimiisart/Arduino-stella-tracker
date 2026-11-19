#include "buzzer.h"
#include "config.h"

// The core's tone() uses a software Ticker and its stop() leaves the GPIO in
// whatever state it was in, which can keep the buzzer transistor conducting.
// A PwmOut gives a clean 4 kHz square wave with no CPU load, and duty 0 holds
// the pin low.

namespace {

mbed::PwmOut *pwm = nullptr;
mbed::DigitalOut *led = nullptr;

bool active = false;
unsigned long findEndsAt = 0;
unsigned long patternStartedAt = 0;

// Pattern: beep 150 ms, gap 100 ms, beep 150 ms, gap 600 ms (1 s cycle).
const uint16_t kPattern[] = {150, 100, 150, 600};
const uint8_t kPatternSteps = sizeof(kPattern) / sizeof(kPattern[0]);
const uint16_t kCycleMs = 150 + 100 + 150 + 600;

void sound(bool on) {
  pwm->write(on ? 0.5f : 0.0f);
  *led = on ? 0 : 1;  // active-low LED follows the beeps
}

}  // namespace

namespace buzzer {

void begin() {
  pwm = new mbed::PwmOut(BUZZER_PIN);
  pwm->period_us(1000000 / BUZZER_FREQ_HZ);
  led = new mbed::DigitalOut(STATUS_LED_PIN, 1);  // start off
  sound(false);
}

void startFind(uint16_t seconds) {
  if (seconds == 0) seconds = FIND_DEFAULT_SECONDS;
  if (seconds > FIND_MAX_SECONDS) seconds = FIND_MAX_SECONDS;
  active = true;
  patternStartedAt = millis();
  findEndsAt = patternStartedAt + (unsigned long)seconds * 1000UL;
}

void stop() {
  active = false;
  sound(false);
}

void chirp(uint16_t ms) {
  sound(true);
  delay(ms);
  sound(false);
}

bool isActive() { return active; }

bool update() {
  if (!active) return false;

  unsigned long now = millis();
  if ((long)(now - findEndsAt) >= 0) {
    stop();
    return true;
  }

  // Even steps of the pattern are "on", odd steps are "off".
  uint16_t t = (now - patternStartedAt) % kCycleMs;
  uint8_t step = 0;
  while (step < kPatternSteps - 1 && t >= kPattern[step]) {
    t -= kPattern[step];
    step++;
  }
  sound(step % 2 == 0);
  return false;
}

}  // namespace buzzer
