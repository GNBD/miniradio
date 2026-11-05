/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * Network bridge implementation.
 *
 * Protocol (NUS, text lines unless noted):
 *   device -> app : "BRQ,<id>,<url>"
 *   app -> device : 'd' <id> <len:2 LE> <bytes>   (write)
 *                   'e' <id> <status:1>           (write, status 0 = OK)
 */
#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

#include "app.h"
#include "ble.h"
#include "net_bridge.h"

static const char *TAG = "bridge";

#define BR_RING 8192

static volatile bool s_enabled;

static uint8_t s_ring[BR_RING];
static volatile uint16_t s_head;   /* write index (BLE task) */
static volatile uint16_t s_tail;   /* read index (fetch task) */
static volatile bool s_overflow;
static portMUX_TYPE s_lock = portMUX_INITIALIZER_UNLOCKED;

/* request state: 0=idle 1=waiting 2=done 3=failed */
static volatile int s_state;
static volatile uint8_t s_req_id;
static volatile uint8_t s_status;
static volatile uint8_t s_next_id;

static volatile bool s_time_waiting;
static volatile uint64_t s_time_value;

void net_bridge_set_enabled(bool on)
{
    s_enabled = on;
    if (!on) {
        s_state = 3;
    }
    ESP_LOGI(TAG, "bridge %s", on ? "on" : "off");
}

bool net_bridge_enabled(void)
{
    return s_enabled;
}

bool net_bridge_available(void)
{
    return s_enabled && ble_get_state() == 2;
}

bool net_bridge_busy(void)
{
    return s_state == 1;
}

void net_bridge_disconnected(void)
{
    if (s_state == 1) {
        s_state = 3;
    }
    s_time_waiting = false;
}

/* ---- time sync ------------------------------------------------------- */

void net_bridge_rx_time(uint64_t epoch)
{
    if (s_time_waiting) {
        s_time_value = epoch;
        s_time_waiting = false;
    }
}

int net_bridge_request_time(uint64_t *epoch, uint32_t timeout_ms)
{
    if (ble_get_state() != 2 || epoch == NULL) {
        return -1;
    }
    s_time_value = 0;
    s_time_waiting = true;
    if (!ble_notify("TIM", 3)) {
        s_time_waiting = false;
        return -1;
    }
    uint32_t start = (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
    while (s_time_waiting) {
        uint32_t now = (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
        if ((now - start) >= timeout_ms) {
            break;
        }
        vTaskDelay(pdMS_TO_TICKS(20));
    }
    bool ok = !s_time_waiting && s_time_value > 1700000000ULL;
    s_time_waiting = false;
    if (!ok) {
        return -1;
    }
    *epoch = s_time_value;
    return 0;
}

void net_bridge_rx_data(uint8_t id, const uint8_t *data, uint16_t len)
{
    if (s_state != 1 || id != s_req_id || len == 0) {
        return;
    }
    portENTER_CRITICAL(&s_lock);
    uint16_t head = s_head;
    uint16_t tail = s_tail;
    uint16_t used = (uint16_t)((head - tail + BR_RING) % BR_RING);
    uint16_t freeb = (uint16_t)(BR_RING - 1 - used);
    if (len > freeb) {
        s_overflow = true;
        portEXIT_CRITICAL(&s_lock);
        return;
    }
    uint16_t second = (uint16_t)(BR_RING - head);
    if (len <= second) {
        memcpy(&s_ring[head], data, len);
    } else {
        memcpy(&s_ring[head], data, second);
        memcpy(&s_ring[0], data + second, len - second);
    }
    s_head = (uint16_t)((head + len) % BR_RING);
    portEXIT_CRITICAL(&s_lock);
}

void net_bridge_rx_done(uint8_t id, uint8_t status)
{
    if (s_state != 1 || id != s_req_id) {
        return;
    }
    s_status = status;
    s_state = (status == 0) ? 2 : 3;
}

static int bridge_drain(net_bridge_data_cb cb, void *ctx, int total)
{
    for (;;) {
        uint16_t head, tail;
        portENTER_CRITICAL(&s_lock);
        head = s_head;
        tail = s_tail;
        portEXIT_CRITICAL(&s_lock);
        if (head == tail) {
            break;
        }
        uint16_t chunk = (head > tail) ? (uint16_t)(head - tail)
                                       : (uint16_t)(BR_RING - tail);
        if (cb) {
            cb(&s_ring[tail], chunk, ctx);
        }
        total += chunk;
        portENTER_CRITICAL(&s_lock);
        s_tail = (uint16_t)((tail + chunk) % BR_RING);
        portEXIT_CRITICAL(&s_lock);
    }
    return total;
}

int net_bridge_fetch(const char *url, net_bridge_data_cb cb, void *ctx,
                     uint32_t timeout_ms)
{
    if (!net_bridge_available() || url == NULL) {
        return -1;
    }

    uint8_t id = ++s_next_id;
    if (id == 0) {
        id = ++s_next_id;
    }
    portENTER_CRITICAL(&s_lock);
    s_head = 0;
    s_tail = 0;
    s_overflow = false;
    portEXIT_CRITICAL(&s_lock);
    s_req_id = id;
    s_status = 0;
    s_state = 1;

    char msg[210];
    snprintf(msg, sizeof(msg), "BRQ,%u,%s", (unsigned)id, url);
    if (!ble_notify(msg, strlen(msg))) {
        s_state = 0;
        return -1;
    }
    ESP_LOGI(TAG, "request %u: %s", (unsigned)id, url);

    uint32_t start = (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
    int total = 0;
    while (s_state == 1) {
        total = bridge_drain(cb, ctx, total);
        uint32_t now = (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
        if ((now - start) >= timeout_ms) {
            s_state = 3;
            break;
        }
        vTaskDelay(pdMS_TO_TICKS(20));
    }
    total = bridge_drain(cb, ctx, total);

    int result = -1;
    if (s_state == 2 && !s_overflow) {
        result = total;
    } else {
        ESP_LOGW(TAG, "failed (state=%d status=%u overflow=%d)",
                 s_state, (unsigned)s_status, (int)s_overflow);
    }
    s_state = 0;
    return result;
}
