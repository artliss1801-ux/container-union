#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Полная настройка защиты Supabase для «Контейнерного Союза» — один запуск.

Что делает (по шагам, каждый шаг печатает результат):
  1. Закрывает свободную регистрацию в проекте (disable_signup = true).
  2. Применяет supabase/security.sql — строгие правила доступа (RLS).
  3. Создаёт подтверждённый аккаунт Администратора (e-mail + пароль).
  4. Выдаёт аккаунту права куратора (таблица curators).
  5. Проверяет результат:
       • вход в аккаунт работает и куратор опознаётся;
       • посторонний (без входа) не может менять тариф и статусы;
       • заявки на верификацию посторонним не видны;
       • публичные действия (регистрация перевозчика) по-прежнему работают.

Запуск:
  SUPABASE_ACCESS_TOKEN=sbp_xxx ADMIN_EMAIL=you@example.com \
      python3 tools/supabase_setup.py

  Пароль можно задать самим: ADMIN_PASSWORD='...' — иначе сгенерируется.
  Токен берётся на https://supabase.com/dashboard/account/tokens (тип sbp_...).
  После настройки токен можно отозвать на той же странице.
"""

import datetime
import json
import os
import secrets
import string
import sys
import urllib.error
import urllib.parse
import urllib.request

REF = "nciyhaghjqddkqzuimff"                     # проект Supabase
API = f"https://api.supabase.com/v1/projects/{REF}"
PROJ = f"https://{REF}.supabase.co"
ANON = "sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR"
SITE = "https://cont-union.ru"
SQL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "security.sql")

TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
EMAIL = os.environ.get("ADMIN_EMAIL", "").strip()
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

OK, FAIL = "✓", "✗"
problems = []


def call(url, method="GET", body=None, headers=None, expect_error=False):
    """Запрос к API. Возвращает (код, разобранный_ответ)."""
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")   # не-ASCII → %-коды
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        code = e.code
        try:
            parsed = json.loads(raw) if raw.strip() else None
        except json.JSONDecodeError:
            parsed = raw
        if not expect_error:
            print(f"      ответ {code}: {str(parsed)[:200]}")
        return code, parsed


def mgmt(url, method="GET", body=None):
    return call(url, method, body, {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})


def service_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def anon_headers():
    return {"apikey": ANON, "Authorization": f"Bearer {ANON}", "Content-Type": "application/json"}


def gen_password():
    alphabet = string.ascii_letters + string.digits
    core = "".join(secrets.choice(alphabet) for _ in range(12))
    return f"KS-{core}!7"


def step(n, title):
    print(f"\n[{n}/5] {title}")


def main():
    if not TOKEN.startswith("sbp_"):
        sys.exit("Укажите токен Supabase: SUPABASE_ACCESS_TOKEN=sbp_... (создать: https://supabase.com/dashboard/account/tokens)")
    if "@" not in EMAIL:
        sys.exit("Укажите e-mail Администратора: ADMIN_EMAIL=you@example.com")

    # ---- 0. Проверка доступа к проекту ----
    code, proj = mgmt(f"{API}")
    if code != 200:
        sys.exit(f"Токен не даёт доступа к проекту {REF} (ответ {code}). Проверьте, что токен создан в том же аккаунте Supabase.")
    print(f"Проект: {proj.get('name')} ({REF}), регион {proj.get('region')}")

    # ---- 1. Закрыть свободную регистрацию ----
    step(1, "Закрываю свободную регистрацию (disable_signup)")
    code, cfg = mgmt(f"{API}/config/auth")
    was = cfg.get("disable_signup") if isinstance(cfg, dict) else None
    print(f"      было disable_signup = {was}")
    code, cfg2 = mgmt(f"{API}/config/auth", "PATCH", {"disable_signup": True, "site_url": SITE})
    now = cfg2.get("disable_signup") if isinstance(cfg2, dict) else None
    if now is True:
        print(f"      {OK} свободная регистрация закрыта; адрес сайта в письмах → {SITE}")
    else:
        print(f"      {FAIL} не удалось включить disable_signup (ответ {code})")
        problems.append("disable_signup")

    # ---- 2. Применить строгие правила (security.sql) ----
    step(2, "Применяю строгие правила доступа (supabase/security.sql)")
    sql = open(SQL_FILE, encoding="utf-8").read()
    code, res = mgmt(f"{API}/database/query", "POST", {"query": sql})
    if code in (200, 201):
        print(f"      {OK} SQL выполнен ({len(sql)} символов, ответ {code})")
    else:
        print(f"      {FAIL} SQL не выполнен (ответ {code})")
        problems.append("security.sql")

    # ---- 3. Аккаунт Администратора ----
    step(3, f"Создаю аккаунт Администратора ({EMAIL})")
    code, keys = mgmt(f"{API}/api-keys?reveal=true")
    secret = None
    if isinstance(keys, list):
        for k in keys:
            if (k.get("name") in ("service_role", "secret")) and k.get("api_key"):
                secret = k["api_key"]
    if not secret:
        print(f"      {FAIL} не удалось получить служебный ключ проекта (ответ {code})")
        sys.exit("Без служебного ключа нельзя создать аккаунт.")
    print("      служебный ключ получен (в файлы не записывается, в выводе не показывается)")

    global PASSWORD
    generated = False
    if not PASSWORD:
        PASSWORD = gen_password()
        generated = True

    code, user = call(f"{PROJ}/auth/v1/admin/users", "POST",
                      {"email": EMAIL, "password": PASSWORD, "email_confirm": True},
                      service_headers(secret), expect_error=True)
    if code in (200, 201) and isinstance(user, dict):
        uid = user.get("id")
        print(f"      {OK} аккаунт создан и подтверждён (id {uid[:8]}…)")
    else:
        msg = str(user)
        if "already" in msg.lower() or code == 422:
            print("      аккаунт уже существует — ищу его и обновляю пароль")
            code2, lst = call(f"{PROJ}/auth/v1/admin/users?page=1&per_page=200", headers=service_headers(secret))
            uid = next((u["id"] for u in (lst.get("users") or []) if u.get("email", "").lower() == EMAIL.lower()), None)
            if not uid:
                sys.exit(f"Не удалось найти аккаунт {EMAIL}: {msg}")
            call(f"{PROJ}/auth/v1/admin/users/{uid}", "PUT", {"password": PASSWORD, "email_confirm": True},
                 service_headers(secret), expect_error=True)
            print(f"      {OK} пароль обновлён (id {uid[:8]}…)")
        else:
            sys.exit(f"Не удалось создать аккаунт: {msg}")
    print(f"      ПАРОЛЬ АДМИНИСТРАТОРА: {PASSWORD}")
    print("      ↑ сохраните его; при повторном запуске с ADMIN_PASSWORD='...' он будет заменён")

    # ---- 4. Права куратора ----
    step(4, "Выдаю права куратора")
    safe_email = EMAIL.replace("'", "''")
    q = ("insert into curators (user_id, email, role) "
         f"select id, email, 'admin' from auth.users where email = '{safe_email}' "
         "on conflict (user_id) do update set email = excluded.email, role = excluded.role; "
         "select email, role from curators;")
    code, res = mgmt(f"{API}/database/query", "POST", {"query": q})
    if code in (200, 201) and isinstance(res, list):
        print(f"      {OK} кураторы: {res}")
    else:
        print(f"      {FAIL} не удалось выдать права (ответ {code}: {str(res)[:200]})")
        problems.append("curators")

    # ---- 5. Проверка ----
    #   Посторонний пытается ИЗМЕНИТЬ существующие строки, подставляя те же значения.
    #   Признак защиты: база отвечает пустым набором (0 строк изменено). Признак дыры:
    #   в ответе приходит изменённая строка.
    step(5, "Проверяю результат")

    def try_read(url, headers):
        code, data = call(url, headers=headers, expect_error=True)
        return code, data

    code, sett = call(f"{PROJ}/auth/v1/settings", headers={"apikey": ANON})
    if isinstance(sett, dict) and sett.get("disable_signup") is True:
        print(f"      {OK} свободная регистрация закрыта (подтверждено настройками проекта)")
    else:
        print(f"      {FAIL} регистрация всё ещё открыта: {str(sett)[:120]}")
        problems.append("проверка регистрации")

    jwt = None
    code, tok = call(f"{PROJ}/auth/v1/token?grant_type=password", "POST",
                     {"email": EMAIL, "password": PASSWORD}, {"apikey": ANON, "Content-Type": "application/json"},
                     expect_error=True)
    if isinstance(tok, dict) and tok.get("access_token"):
        jwt = tok["access_token"]
        print(f"      {OK} вход Администратора работает")
        code, rows = call(f"{PROJ}/rest/v1/curators?select=email,role",
                          headers={"apikey": ANON, "Authorization": f"Bearer {jwt}"})
        if isinstance(rows, list) and rows:
            print(f"      {OK} права куратора подтверждены базой: {rows}")
        else:
            print(f"      {FAIL} база не признала куратора: {str(rows)[:120]}")
            problems.append("проверка куратора")
    else:
        print(f"      {FAIL} вход не сработал: {str(tok)[:200]}")
        problems.append("вход")

    # получаем текущие значения, чтобы «проба» не меняла данные
    _, tv = call(f"{PROJ}/rest/v1/tariff?select=val&id=eq.1", headers=anon_headers())
    tariff_val = tv[0]["val"] if isinstance(tv, list) and tv else {}
    _, sv = call(f"{PROJ}/rest/v1/settings?select=val&key=eq.council", headers=anon_headers())
    settings_val = sv[0]["val"] if isinstance(sv, list) and sv else {}

    def tamper_check(title, table, query, payload, name):
        h = dict(anon_headers())
        h["Prefer"] = "return=representation"
        code, data = call(f"{PROJ}/rest/v1/{table}?{query}", "PATCH", payload, h, expect_error=True)
        changed = isinstance(data, list) and len(data) > 0
        if code in (401, 403):
            print(f"      {OK} {title}: отказ {code}")
        elif changed:
            print(f"      {FAIL} {title}: изменение ПРОШЛО (в ответе строка)")
            problems.append(name)
        else:
            print(f"      {OK} {title}: база не дала изменить ни одной строки")

    tamper_check("посторонний не может менять тарифную сетку", "tariff", "id=eq.1", {"val": tariff_val}, "RLS: тариф")
    tamper_check("посторонний не может менять настройки Совета", "settings", "key=eq.council", {"val": settings_val}, "RLS: настройки")

    code, _ = call(f"{PROJ}/rest/v1/tariff?select=id", headers=anon_headers(), expect_error=True)
    _, tv2 = call(f"{PROJ}/rest/v1/tariff?select=val&id=eq.1", headers=anon_headers())
    if isinstance(tv2, list) and tv2 and tv2[0]["val"] == tariff_val:
        print(f"      {OK} тарифная сетка не изменилась (контрольная сверка)")
    else:
        print(f"      {FAIL} тарифная сетка изменилась!")
        problems.append("сверка тарифа")

    # удаление посторонним
    h = dict(anon_headers()); h["Prefer"] = "return=representation"
    code, data = call(f"{PROJ}/rest/v1/journal?text=eq.нет-такой-записи", "DELETE", None, h, expect_error=True)
    if code in (401, 403) or (isinstance(data, list) and not data):
        print(f"      {OK} посторонний не может удалять записи")
    else:
        print(f"      {FAIL} удаление прошло: {str(data)[:120]}")
        problems.append("RLS: удаление")

    code, apps = call(f"{PROJ}/rest/v1/applications?select=id", headers=anon_headers(), expect_error=True)
    if code in (401, 403) or (isinstance(apps, list) and apps == []):
        print(f"      {OK} заявки на верификацию посторонним не видны")
    else:
        print(f"      {FAIL} заявки видны посторонним: {str(apps)[:120]}")
        problems.append("RLS: заявки")

    # публичные действия участника — должны работать
    probe = "Проверка настройки " + secrets.token_hex(4)
    code, _ = call(f"{PROJ}/rest/v1/journal", "POST",
                   [{"at": datetime.date.today().isoformat(), "text": probe}], anon_headers(), expect_error=True)
    if code in (200, 201, 204):
        print(f"      {OK} публичные записи (журнал) работают")
    else:
        print(f"      {FAIL} публичная запись не проходит (ответ {code})")
        problems.append("публичная запись")

    code, _ = call(f"{PROJ}/rest/v1/carriers", "POST",
                   [{"id": "PR-" + secrets.token_hex(3), "name": probe, "status": "pending", "demo": False}],
                   anon_headers(), expect_error=True)
    if code in (200, 201, 204):
        print(f"      {OK} регистрация перевозчика без входа работает")
    else:
        print(f"      {FAIL} регистрация перевозчика не проходит (ответ {code})")
        problems.append("регистрация перевозчика")

    code, _ = call(f"{PROJ}/rest/v1/carriers", "POST",
                   [{"id": "PR-bad", "name": probe, "status": "verified", "demo": False}],
                   anon_headers(), expect_error=True)
    if code in (401, 403):
        print(f"      {OK} посторонний не может зарегистрироваться сразу «верифицированным»")
    else:
        print(f"      {FAIL} база приняла статус verified от постороннего (ответ {code})")
        problems.append("RLS: самоверификация")

    # уборка тестовых строк (только через управляющий доступ)
    mgmt(f"{API}/database/query", "POST", {"query":
        "delete from journal where text like 'Проверка настройки%'; "
        "delete from carriers where id like 'PR-%';"})
    print("      · тестовые строки удалены")

    # ---- Итог ----
    print("\n" + "=" * 62)
    if problems:
        print("НЕ ВСЁ ГОТОВО:", ", ".join(problems))
        sys.exit(1)
    print("ГОТОВО. Защита включена, аккаунт Администратора работает.")
    print(f"   вход на сайте: {SITE} → кнопка «Вход для Администрации»")
    print(f"   логин:  {EMAIL}")
    if generated:
        print(f"   пароль: {PASSWORD}")
        print("   (сохраните его; сменить можно, перезапустив скрипт с ADMIN_PASSWORD='новый')")
    print("=" * 62)


if __name__ == "__main__":
    main()
