/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * Network bridge: the phone performs HTTP requests on behalf of the radio
 * when the radio has no Wi-Fi path (BLE GATT, NUS service).
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*net_bridge_data_cb)(const uint8_t *data, int len, void *ctx);

/** Bridge enable flag (app setting, RAM only). */
void net_bridge_set_enabled(bool on);
bool net_bridge_enabled(void);

/** True when the bridge can be used right now (enabled + BLE linked). */
bool net_bridge_available(void);

/**
 * Fetch an HTTP URL through the phone.
 * @param cb       receives body chunks in the caller's task context
 * @param timeout_ms overall timeout
 * @return body bytes received, or -1 on failure
 */
int net_bridge_fetch(const char *url, net_bridge_data_cb cb, void *ctx,
                     uint32_t timeout_ms);

/* Called from the BLE RX path (host task). */
void net_bridge_rx_data(uint8_t id, const uint8_t *data, uint16_t len);
void net_bridge_rx_done(uint8_t id, uint8_t status);
void net_bridge_disconnected(void);

/** True while a bridge request is in flight. */
bool net_bridge_busy(void);

/** Ask the phone for its current Unix time (UTC seconds). */
int net_bridge_request_time(uint64_t *epoch, uint32_t timeout_ms);
void net_bridge_rx_time(uint64_t epoch);

#ifdef __cplusplus
}
#endif
