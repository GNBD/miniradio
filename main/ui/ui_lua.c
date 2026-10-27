/*
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * Lua runtime port for ESP32-S3:
 *  - allocator uses PSRAM so scripts never eat internal SRAM
 *  - sandboxed execution with an instruction-count budget (no infinite loops)
 *
 * This source file is licensed under the MIT License.
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "lauxlib.h"
#include "lualib.h"
#include "ui_lua.h"

static const char *TAG = "lua";

#define LUA_MEM_CAPS (MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)
#define LUA_MAX_INSTRUCTIONS 2000000   /* 약 수십 ms 상한 */

static char s_err[192];

static void *psram_alloc(void *ud, void *ptr, size_t osize, size_t nsize)
{
    (void)ud;
    (void)osize;
    if (nsize == 0) {
        heap_caps_free(ptr);
        return NULL;
    }
    void *p = heap_caps_realloc(ptr, nsize, LUA_MEM_CAPS);
    if (!p) {
        /* PSRAM 부족 시 내부 SRAM 으로 폴백 (마지막 수단) */
        p = heap_caps_realloc(ptr, nsize, MALLOC_CAP_8BIT);
    }
    return p;
}

static void hook_count(lua_State *L, lua_Debug *ar)
{
    (void)ar;
    int *budget = (int *)lua_getextraspace(L);
    if (--(*budget) <= 0) {
        luaL_error(L, "E_BUDGET: instruction budget exceeded");
    }
}

lua_State *lua_port_new(void)
{
    lua_State *L = lua_newstate(psram_alloc, NULL);
    if (!L) {
        ESP_LOGE(TAG, "E_MEM: cannot create Lua state");
        return NULL;
    }
    luaL_openlibs(L);
    int *budget = (int *)lua_getextraspace(L);
    *budget = LUA_MAX_INSTRUCTIONS;
    lua_sethook(L, hook_count, LUA_MASKCOUNT, 20000);
    return L;
}

void lua_port_close(lua_State *L)
{
    if (L) {
        lua_close(L);
    }
}

const char *lua_port_error(void)
{
    return s_err[0] ? s_err : "E_UNKNOWN";
}

const char *lua_port_exec(lua_State *L, const char *src, size_t len,
                          const char *chunkname)
{
    s_err[0] = '\0';
    if (!L || !src) {
        snprintf(s_err, sizeof(s_err), "E_ARG: null state or source");
        return s_err;
    }
    int *budget = (int *)lua_getextraspace(L);
    *budget = LUA_MAX_INSTRUCTIONS;

    int rc = luaL_loadbufferx(L, src, len, chunkname ? chunkname : "=script",
                              NULL);
    if (rc != LUA_OK) {
        snprintf(s_err, sizeof(s_err), "E_SYNTAX: %s",
                 lua_tostring(L, -1) ? lua_tostring(L, -1) : "load failed");
        lua_pop(L, 1);
        ESP_LOGW(TAG, "%s", s_err);
        return s_err;
    }
    rc = lua_pcall(L, 0, 0, 0);
    if (rc != LUA_OK) {
        snprintf(s_err, sizeof(s_err), "E_RUNTIME: %s",
                 lua_tostring(L, -1) ? lua_tostring(L, -1) : "call failed");
        lua_pop(L, 1);
        ESP_LOGW(TAG, "%s", s_err);
        return s_err;
    }
    return NULL;
}
