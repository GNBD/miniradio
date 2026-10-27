/*
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * Lua runtime port: PSRAM-backed allocator and sandboxed state creation.
 *
 * This source file is licensed under the MIT License.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "lua.h"

/* Lua 힙을 PSRAM 에 두어 내부 SRAM 을 보호한다 */
lua_State *lua_port_new(void);
void lua_port_close(lua_State *L);

/* 제한 시간/명령 수를 걸고 청크를 실행한다. 실패 시 오류 문자열 반환. */
const char *lua_port_exec(lua_State *L, const char *src, size_t len,
                          const char *chunkname);

/* 마지막 오류 메시지 (실행 실패 시 원인 표기용) */
const char *lua_port_error(void);
