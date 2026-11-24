#include "buzzer.h"
#include "config.h"

// The core's tone() uses a software Ticker and its stop() leaves the GPIO in
// whatever state it was in, which can keep the buzzer transistor conducting.
// A PwmOut gives a clean 4 kHz square wave with no CPU load, and duty 0 holds
// the pin low.

namespace {

mbed::PwmOut *pwm = nullptr;
mbed::DigitalOut *led = nullptr;

struct Pattern {
  const uint16_t *steps;  // on, off, on, off... in ms
  uint8_t count;
  uint16_t cycleMs;
};

// FIND: beep 150 ms, gap 100 ms, beep 150 ms, gap 600 ms (1 s cycle).
const uint16_t kFindSteps[] = {150, 100, 150, 600};
const Pattern kFind = {kFindSteps, 4, 1000};
// Left behind: three longer beeps, then a pause (3 s cycle), so it sounds
// different from FIND and uses less battery.
const uint16_t kAwaySteps[] = {300, 150, 300, 150, 300, 1800};
const Pattern kAway = {kAwaySteps, 6, 3000};

bool active = false;
const Pattern *pattern = &kFind;
unsigned long endsAt = 0;
unsigned long patternStartedAt = 0;

void start(const Pattern *p, uint16_t seconds) {
  pattern = p;
  active = true;
  patternStartedAt = millis();
  endsAt = patternStartedAt + (unsigned long)seconds * 1000UL;
}

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
  start(&kFind, seconds);
}

void startAway(uint16_t seconds) {
  if (seconds == 0) seconds = AWAY_BEEP_SECONDS;
  if (seconds > FIND_MAX_SECONDS) seconds = FIND_MAX_SECONDS;
  start(&kAway, seconds);
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

bool isAway() { return active && pattern == &kAway; }

bool update() {
  if (!active) return false;

  unsigned long now = millis();
  if ((long)(now - endsAt) >= 0) {
    bool wasFind = pattern == &kFind;
    stop();
    return wasFind;
  }

  // Even steps of the pattern are "on", odd steps are "off".
  uint16_t t = (now - patternStartedAt) % pattern->cycleMs;
  uint8_t step = 0;
  while (step < pattern->count - 1 && t >= pattern->steps[step]) {
    t -= pattern->steps[step];
    step++;
  }
  sound(step % 2 == 0);
  return false;
}

}  // namespace buzzer
