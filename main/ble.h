/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * BLE (NimBLE) NUS 호환 인터페이스.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* NimBLE 스택 초기화 (부트 시 1회). 광고는 s_ble_on 일 때만 시작 */
void ble_init(void);

/* 설정 BLUETOOTH 토글에서 호출: 광고 on/off */
void ble_set_enabled(bool on);
/* 메인루프에서 호출: 연결 상태 변경 시 상단바 갱신 */
void ble_poll(void);

/* 현재 상태: 0=끊김, 1=연결중(광고), 2=연결완료 */
int ble_get_state(void);

/* RX로 수신된 데이터가 있으면 복사 후 true */
bool ble_has_rx(char *out, size_t n);

/* 1문자 명령 큐에서 하나 꺼낸다. 없으면 -1. arg에 인자(없으면 0) */
int ble_take_cmd(int *arg);

/* TX notify (구독 중일 때만) */
bool ble_notify(const void *data, size_t len);

/* 등록된(본딩된) 기기 키 모두 삭제 */
void ble_clear_bonds(void);

#ifdef __cplusplus
}
#endif
