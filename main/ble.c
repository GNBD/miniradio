/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * BLE (NimBLE) NUS 호환 구현.
 *
 * 공식 ATS Mini Companion과의 단순 호환: NUS 서비스 UUID만 공유한다.
 *   서비스  6E400001-B5A3-F393-E0A9-E50E24DCCA9E
 *   RX(0002) central -> device 쓰기
 *   TX(0003) device  -> central notify
 *
 * 스택/서비스는 ESP-IDF(Apache-2.0)의 NimBLE를 사용하며,
 * 본 파일의 서비스 정의·상태 처리는 자체 작성이다.
 */
#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "esp_err.h"
#include "esp_mac.h"

#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/ble_uuid.h"
#include "host/util/util.h"
#include "os/os_mbuf.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "host/ble_store.h"

#include "app.h"
#include "ble.h"
#include "net_bridge.h"
#include "hmi.h"

static const char *BLE_TAG = "ble";

/* ---- NUS UUID (LE 바이트 배열) ---- */
#define NUS_SVC_UUID  0x9E,0xCA,0xDC,0x24,0x0E,0xE5,0xA9,0xE0, \
                      0x93,0xF3,0xA3,0xB5,0x01,0x00,0x40,0x6E
#define NUS_RX_UUID   0x9E,0xCA,0xDC,0x24,0x0E,0xE5,0xA9,0xE0, \
                      0x93,0xF3,0xA3,0xB5,0x02,0x00,0x40,0x6E
#define NUS_TX_UUID   0x9E,0xCA,0xDC,0x24,0x0E,0xE5,0xA9,0xE0, \
                      0x93,0xF3,0xA3,0xB5,0x03,0x00,0x40,0x6E

#define DEVICE_NAME   "miniradio"

/* ---- 상태 (0=끊김, 1=연결중, 2=연결완료) ---- */
static volatile int s_state;          /* 마지막으로 알린 상태 */
static volatile int s_pending;        /* GAP 스레드가 기록한 새 상태 */
static volatile bool s_ble_dirty;
static uint8_t s_own_addr_type = BLE_OWN_ADDR_PUBLIC;
static bool s_enabled;                /* 광고 허용 여부 */

static uint16_t s_conn_handle = BLE_HS_CONN_HANDLE_NONE;

/* TX notify 구독 여부 + 특성 핸들 */
static volatile bool s_tx_subscribed;
static volatile uint16_t s_tx_handle;

/* 수신 버퍼 (NUS RX) */
#define RX_MAX 512
static volatile uint16_t s_rx_len;
static uint8_t s_rx_buf[RX_MAX];

/* 명령 큐 (ble_take_cmd 로 메인루프가 소비) */
typedef struct {
    uint8_t cmd;
    uint32_t arg;
} ble_cmd_t;

#define CMD_Q 16
static volatile ble_cmd_t s_cmd_q[CMD_Q];
static volatile uint8_t s_cmd_head;
static volatile uint8_t s_cmd_tail;

void ble_store_config_init(void);

static int ble_gap_event(struct ble_gap_event *event, void *arg);

/* ---------------------------------------------------------- 상태 알림 */

static void ble_set_state(int st)
{
    if (s_pending != st) {
        s_pending = st;
        s_ble_dirty = true;
    }
}

int ble_get_state(void)
{
    return s_pending;
}

bool ble_has_rx(char *out, size_t n)
{
    uint16_t len = s_rx_len;
    if (len == 0 || n == 0) {
        return false;
    }
    if (len >= n) {
        len = (uint16_t)(n - 1);
    }
    memcpy(out, s_rx_buf, len);
    out[len] = '\0';
    s_rx_len = 0;
    return true;
}

int ble_take_cmd(int *arg)
{
    uint8_t tail = s_cmd_tail;
    if (tail == s_cmd_head) {
        return -1;
    }
    ble_cmd_t v = s_cmd_q[tail];
    s_cmd_tail = (uint8_t)((tail + 1) % CMD_Q);
    if (arg) {
        *arg = (int)v.arg;
    }
    return (int)v.cmd;
}

bool ble_notify(const void *data, size_t len)
{
    if (!s_tx_subscribed || s_conn_handle == BLE_HS_CONN_HANDLE_NONE ||
        s_tx_handle == 0) {
        return false;
    }
    struct os_mbuf *om = ble_hs_mbuf_from_flat(data, (uint16_t)len);
    if (om == NULL) {
        return false;
    }
    if (ble_gatts_notify_custom(s_conn_handle, s_tx_handle, om) != 0) {
        os_mbuf_free_chain(om);
        return false;
    }
    return true;
}

/* ---------------------------------------------------------- GATT 정의 */

static int
nus_rx_access(uint16_t conn_handle, uint16_t attr_handle,
              struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }
    uint8_t buf[RX_MAX];
    uint16_t len = 0;
    int rc = ble_hs_mbuf_to_flat(ctxt->om, buf, sizeof(buf), &len);
    if (rc != 0) {
        return BLE_ATT_ERR_INSUFFICIENT_RES;
    }
    if (len > 0) {
        memcpy((void *)s_rx_buf, buf, len);
        s_rx_len = len;

        /* 명령 파싱: F=주파수(4B LE), V/O/B/T/X=값(1B), c=설정(2B),
           n=브리지 on/off, d/e=브리지 응답, 그 외 1문자 */
        uint16_t i = 0;
        while (i < len) {
            uint8_t c = buf[i++];

            if (c == 'n' && i < len) {
                net_bridge_set_enabled(buf[i++] != 0);
                continue;
            }
            if (c == 'd' && (uint16_t)(i + 3) <= len) {
                uint8_t id = buf[i];
                uint16_t n = (uint16_t)(buf[i + 1] | (buf[i + 2] << 8));
                i = (uint16_t)(i + 3);
                if ((uint16_t)(i + n) > len) {
                    n = (uint16_t)(len - i);
                }
                net_bridge_rx_data(id, &buf[i], n);
                i = (uint16_t)(i + n);
                continue;
            }
            if (c == 'e' && (uint16_t)(i + 2) <= len) {
                net_bridge_rx_done(buf[i], buf[i + 1]);
                i = (uint16_t)(i + 2);
                continue;
            }
            if (c == 'z' && (uint16_t)(i + 8) <= len) {
                uint64_t secs = 0;
                for (int b = 0; b < 8; ++b) {
                    secs |= ((uint64_t)buf[i + b]) << (8 * b);
                }
                net_bridge_rx_time(secs);
                i = (uint16_t)(i + 8);
                continue;
            }
            if (c == 'Z' && (uint16_t)(i + 8) <= len) {
                uint64_t secs = 0;
                for (int b = 0; b < 8; ++b) {
                    secs |= ((uint64_t)buf[i + b]) << (8 * b);
                }
                if (secs > 1700000000ULL && secs < 4102444800ULL) {
                    s_clock_base = (int64_t)secs;
                    s_clock_ms0 = now_ms();
                    s_clock_set = true;
                    clock_save_now();
                    clock_update();
                    ui_refresh_top();
                    ESP_LOGI(BLE_TAG, "time set: %llu", (unsigned long long)secs);
                }
                i = (uint16_t)(i + 8);
                continue;
            }

            uint32_t arg = 0;
            if (c == 'F' && (uint16_t)(i + 4) <= len) {
                arg = (uint32_t)buf[i] | ((uint32_t)buf[i + 1] << 8) |
                      ((uint32_t)buf[i + 2] << 16) |
                      ((uint32_t)buf[i + 3] << 24);
                i = (uint16_t)(i + 4);
            } else if ((c == 'V' || c == 'O' || c == 'B' || c == 'T' ||
                        c == 'X') && i < len) {
                arg = buf[i++];
            } else if (c == 'c' && (uint16_t)(i + 2) <= len) {
                arg = (uint32_t)buf[i] | ((uint32_t)buf[i + 1] << 8);
                i = (uint16_t)(i + 2);
            }
            uint8_t next = (uint8_t)((s_cmd_head + 1) % CMD_Q);
            if (next == s_cmd_tail) {
                break;          /* 큐 가득참 */
            }
            s_cmd_q[s_cmd_head].cmd = c;
            s_cmd_q[s_cmd_head].arg = arg;
            s_cmd_head = next;
        }
    }
    return 0;
}

static int
nus_tx_access(uint16_t conn_handle, uint16_t attr_handle,
              struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;
    (void)ctxt;
    return 0;
}

static const struct ble_gatt_svc_def s_nus_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = BLE_UUID128_DECLARE(NUS_SVC_UUID),
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                .uuid = BLE_UUID128_DECLARE(NUS_RX_UUID),
                .access_cb = nus_rx_access,
                .flags = BLE_GATT_CHR_F_WRITE,
            },
            {
                .uuid = BLE_UUID128_DECLARE(NUS_TX_UUID),
                .access_cb = nus_tx_access,
                .flags = BLE_GATT_CHR_F_NOTIFY,
            },
            { 0 },
        },
    },
    { 0 },
};

/* ---------------------------------------------------------- 광고 */

static void ble_advertise(void)
{
    if (!s_enabled || !ble_hs_synced()) {
        return;
    }
    if (ble_gap_adv_active()) {
        return;
    }

    struct ble_hs_adv_fields fields;
    memset(&fields, 0, sizeof(fields));

    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.tx_pwr_lvl_is_present = 1;
    fields.tx_pwr_lvl = BLE_HS_ADV_TX_PWR_LVL_AUTO;

    const char *name = ble_svc_gap_device_name();
    fields.name = (uint8_t *)name;
    fields.name_len = (uint8_t)strlen(name);
    fields.name_is_complete = 1;

    /* 128-bit 서비스 UUID는 스캔 응답에 넣는다 (31바이트 제한 회피) */
    int rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGW(BLE_TAG, "adv set fields rc=%d", rc);
    }

    struct ble_hs_adv_fields rsp;
    memset(&rsp, 0, sizeof(rsp));
    ble_uuid128_t nus_uuid = BLE_UUID128_INIT(NUS_SVC_UUID);
    rsp.uuids128 = &nus_uuid;
    rsp.num_uuids128 = 1;
    rsp.uuids128_is_complete = 1;
    rc = ble_gap_adv_rsp_set_fields(&rsp);
    if (rc != 0) {
        ESP_LOGW(BLE_TAG, "adv rsp fields rc=%d", rc);
    }

    struct ble_gap_adv_params adv_params;
    memset(&adv_params, 0, sizeof(adv_params));
    adv_params.conn_mode = BLE_GAP_CONN_MODE_UND;
    adv_params.disc_mode = BLE_GAP_DISC_MODE_GEN;

    rc = ble_gap_adv_start(s_own_addr_type, NULL, BLE_HS_FOREVER,
                           &adv_params, ble_gap_event, NULL);
    if (rc != 0) {
        ESP_LOGW(BLE_TAG, "adv start rc=%d", rc);
        ble_set_state(0);
    } else {
        ble_set_state(1);
    }
}

static void ble_stop_adv(void)
{
    if (ble_gap_adv_active()) {
        ble_gap_adv_stop();
    }
    if (s_conn_handle != BLE_HS_CONN_HANDLE_NONE) {
        ble_gap_terminate(s_conn_handle, BLE_ERR_REM_USER_CONN_TERM);
    }
}

/* ---------------------------------------------------------- GAP 이벤트 */

static int
ble_gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;

    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            s_conn_handle = event->connect.conn_handle;
            ble_set_state(2);
        } else {
            s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
            ble_advertise();
        }
        return 0;

    case BLE_GAP_EVENT_DISCONNECT:
        s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
        s_tx_subscribed = false;
        s_tx_handle = 0;
        net_bridge_disconnected();
        ble_advertise();
        return 0;

    case BLE_GAP_EVENT_ADV_COMPLETE:
        ble_advertise();
        return 0;

    case BLE_GAP_EVENT_SUBSCRIBE:
        if (event->subscribe.cur_notify) {
            s_tx_handle = event->subscribe.attr_handle;
            s_tx_subscribed = true;
        } else {
            s_tx_subscribed = false;
        }
        return 0;

    case BLE_GAP_EVENT_MTU:
        ESP_LOGI(BLE_TAG, "mtu=%d", event->mtu.value);
        return 0;

    case BLE_GAP_EVENT_REPEAT_PAIRING: {
        /* 저장된 본드가 있는데 재페어링 요청 → 기존 키 삭제 후 재시도 */
        struct ble_gap_conn_desc desc;
        if (ble_gap_conn_find(event->repeat_pairing.conn_handle, &desc) == 0) {
            ble_store_util_delete_peer(&desc.peer_id_addr);
        }
        return BLE_GAP_REPEAT_PAIRING_RETRY;
    }

    default:
        return 0;
    }
}

/* ---------------------------------------------------------- 호스트 */

static void
ble_on_reset(int reason)
{
    ESP_LOGW(BLE_TAG, "host reset reason=%d", reason);
    s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
    s_tx_subscribed = false;
}

static void
ble_on_sync(void)
{
    /* Use a static random address derived from the factory BT MAC. Android
       caches GATT per address; this keeps a stable identity while wiping any
       bond/cache left by older firmware. */
    uint8_t base[6] = {0};
    uint8_t rnd[6] = {0};
    esp_read_mac(base, ESP_MAC_BT);
    memcpy(rnd, base, sizeof(rnd));
    rnd[0] ^= 0x5A;
    rnd[5] = (uint8_t)((rnd[5] & 0x3F) | 0xC0);   /* static random */
    ble_hs_id_set_rnd(rnd);
    int rc = ble_hs_util_ensure_addr(1);
    if (rc != 0) {
        ESP_LOGE(BLE_TAG, "ensure_addr rc=%d", rc);
        return;
    }
    rc = ble_hs_id_infer_auto(1, &s_own_addr_type);
    if (rc != 0) {
        ESP_LOGE(BLE_TAG, "infer_auto rc=%d", rc);
        return;
    }
    ble_advertise();
}

static void
ble_host_task(void *param)
{
    (void)param;
    nimble_port_run();
    nimble_port_freertos_deinit();
}

/* ---------------------------------------------------------- 공개 API */

void ble_init(void)
{
    s_enabled = s_ble_on;

    esp_err_t err = nimble_port_init();
    if (err != ESP_OK) {
        ESP_LOGE(BLE_TAG, "nimble_port_init failed %d", (int)err);
        return;
    }

    ble_hs_cfg.reset_cb = ble_on_reset;
    ble_hs_cfg.sync_cb = ble_on_sync;
    ble_hs_cfg.store_status_cb = ble_store_util_status_rr;

    /* 일회성 연결: 본딩/보안 없이 바로 연결 (기기 등록 안 함) */
    ble_hs_cfg.sm_io_cap = BLE_SM_IO_CAP_NO_IO;
    ble_hs_cfg.sm_bonding = 0;
    ble_hs_cfg.sm_sc = 0;
    ble_hs_cfg.sm_mitm = 0;

    ble_svc_gap_init();
    ble_svc_gatt_init();
    (void)ble_svc_gap_device_name_set(DEVICE_NAME);

    int rc = ble_gatts_count_cfg(s_nus_svcs);
    if (rc != 0) {
        ESP_LOGE(BLE_TAG, "count_cfg rc=%d", rc);
        return;
    }
    rc = ble_gatts_add_svcs(s_nus_svcs);
    if (rc != 0) {
        ESP_LOGE(BLE_TAG, "add_svcs rc=%d", rc);
        return;
    }

    ble_store_config_init();
    nimble_port_freertos_init(ble_host_task);

    ESP_LOGI(BLE_TAG, "initialized (%s)", DEVICE_NAME);
}

void ble_set_enabled(bool on)
{
    s_enabled = on;
    if (!on) {
        ble_stop_adv();
        ble_set_state(0);
        s_tx_subscribed = false;
    } else if (ble_hs_synced()) {
        ble_advertise();
    }
}

void ble_clear_bonds(void)
{
    ESP_LOGI(BLE_TAG, "clearing all bonds");
    if (s_conn_handle != BLE_HS_CONN_HANDLE_NONE) {
        ble_gap_terminate(s_conn_handle, BLE_ERR_REM_USER_CONN_TERM);
    }
    ble_store_clear();
    s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
    s_tx_subscribed = false;
    s_tx_handle = 0;
    ble_set_state(0);
    ble_advertise();
}

void ble_poll(void)
{
    if (!s_ble_dirty) {
        return;
    }
    s_ble_dirty = false;
    int st = s_pending;
    if (st == s_state) {
        return;
    }
    s_state = st;
    s_ble_state = st;
    ui_refresh_top();
}
