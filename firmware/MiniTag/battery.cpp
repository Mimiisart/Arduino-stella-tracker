#include "battery.h"
#include <nrf.h>

namespace {

// Spin until a SAADC event fires, with a bound so a stuck ADC can't hang loop().
bool waitFor(volatile uint32_t &event) {
  for (uint32_t i = 0; i < 100000; i++) {
    if (event) return true;
  }
  return false;
}

}  // namespace

namespace battery {

uint16_t readMillivolts() {
  volatile int16_t result = 0;

  NRF_SAADC->ENABLE = SAADC_ENABLE_ENABLE_Enabled << SAADC_ENABLE_ENABLE_Pos;
  NRF_SAADC->RESOLUTION = SAADC_RESOLUTION_VAL_12bit;
  NRF_SAADC->OVERSAMPLE = SAADC_OVERSAMPLE_OVERSAMPLE_Bypass;
  // Gain 1/6 with the 0.6 V internal reference gives a 3.6 V full scale.
  NRF_SAADC->CH[0].CONFIG =
      (SAADC_CH_CONFIG_RESP_Bypass << SAADC_CH_CONFIG_RESP_Pos) |
      (SAADC_CH_CONFIG_RESN_Bypass << SAADC_CH_CONFIG_RESN_Pos) |
      (SAADC_CH_CONFIG_GAIN_Gain1_6 << SAADC_CH_CONFIG_GAIN_Pos) |
      (SAADC_CH_CONFIG_REFSEL_Internal << SAADC_CH_CONFIG_REFSEL_Pos) |
      (SAADC_CH_CONFIG_TACQ_10us << SAADC_CH_CONFIG_TACQ_Pos) |
      (SAADC_CH_CONFIG_MODE_SE << SAADC_CH_CONFIG_MODE_Pos);
  NRF_SAADC->CH[0].PSELN = SAADC_CH_PSELN_PSELN_NC;
  NRF_SAADC->CH[0].PSELP = SAADC_CH_PSELP_PSELP_VDD;
  NRF_SAADC->RESULT.PTR = (uint32_t)&result;
  NRF_SAADC->RESULT.MAXCNT = 1;

  bool ok = true;
  NRF_SAADC->EVENTS_STARTED = 0;
  NRF_SAADC->TASKS_START = 1;
  ok = ok && waitFor(NRF_SAADC->EVENTS_STARTED);

  NRF_SAADC->EVENTS_END = 0;
  NRF_SAADC->TASKS_SAMPLE = 1;
  ok = ok && waitFor(NRF_SAADC->EVENTS_END);

  NRF_SAADC->EVENTS_STOPPED = 0;
  NRF_SAADC->TASKS_STOP = 1;
  waitFor(NRF_SAADC->EVENTS_STOPPED);

  // Leave the peripheral off so it draws nothing between samples.
  NRF_SAADC->CH[0].PSELP = SAADC_CH_PSELP_PSELP_NC;
  NRF_SAADC->EVENTS_STARTED = 0;
  NRF_SAADC->EVENTS_END = 0;
  NRF_SAADC->EVENTS_STOPPED = 0;
  NRF_SAADC->ENABLE = SAADC_ENABLE_ENABLE_Disabled << SAADC_ENABLE_ENABLE_Pos;

  if (!ok) return 0;
  int32_t raw = result < 0 ? 0 : result;
  return (uint16_t)((raw * 3600L) / 4096L);
}

bool usbPowered() {
  return (NRF_POWER->USBREGSTATUS & POWER_USBREGSTATUS_VBUSDETECT_Msk) != 0;
}

}  // namespace battery
