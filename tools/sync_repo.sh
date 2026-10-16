#!/usr/bin/env bash
# =====================================================================
#  Обновление репозитория «Контейнерный Союз» (пошагово, без вложений)
#
#  Что делает: клонирует репозиторий, кладёт свежую сборку, части, тесты,
#  инструменты и документы, убирает устаревшие копии из корня, коммитит
#  и пушит. Файлы .github/workflows НЕ трогает (у токена нет scope workflow):
#  ночную задачу пользователь добавляет сам по инструкции.
#
#  Токен — только через переменную окружения, в файлы не попадает:
#    GH_TOKEN=ghp_xxx REPO=container-union bash tools/sync_repo.sh
# =====================================================================
set -euo pipefail

: "${GH_TOKEN:?Нужен GH_TOKEN — временный токен GitHub (окружение, не файл)}"
REPO="${REPO:-container-union}"
API="https://api.github.com"
SRC="/home/user"
AUTH=(-H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json")

echo "▸ Шаг 1. Проверка токена"
OWNER=$(curl -s "${AUTH[@]}" "$API/user" | python3 -c "import sys,json;print(json.load(sys.stdin).get('login',''))")
[ -n "$OWNER" ] || { echo "  ✗ токен не принят"; exit 1; }
BRANCH=$(curl -s "${AUTH[@]}" "$API/repos/$OWNER/$REPO" | python3 -c "import sys,json;print(json.load(sys.stdin).get('default_branch') or 'main')")
echo "  аккаунт: $OWNER · репозиторий: $OWNER/$REPO · ветка: $BRANCH"

WORK="$(mktemp -d /tmp/ks-sync.XXXXXX)"
cd "$WORK"
echo "▸ Шаг 2. Клон репозитория"
git clone -q "https://x-access-token:$GH_TOKEN@github.com/$OWNER/$REPO.git" repo
cd repo
git checkout -q "$BRANCH"
BEFORE=$(git rev-parse --short HEAD)
git config user.name "$OWNER"
git config user.email "$OWNER@users.noreply.github.com"

echo "▸ Шаг 3. Свежая сборка"
cd "$SRC" && bash build.sh >/dev/null
SIZE=$(wc -c < index.html)
echo "  index.html: $SIZE байт"

echo "▸ Шаг 4. Раскладка файлов"
cd "$WORK/repo"
for f in index.html config.js README.md "Публикация.md" "Документы_Контейнерный_Союз.md" "Домен.md" build.sh; do
  cp "$SRC/$f" .
done
mkdir -p parts supabase tools tests
cp "$SRC"/parts/*.js "$SRC"/parts/*.html parts/
cp "$SRC"/supabase/*.sql "$SRC"/supabase/*.md supabase/
cp "$SRC"/tools/*.mjs "$SRC"/tools/*.py "$SRC"/tools/*.sh "$SRC"/tools/*.yml tools/
cp "$SRC"/tests/*.js "$SRC"/tests/*.txt tests/
# устаревшие копии тестов в корне (их место — папка tests/)
rm -f README.txt test_master.js test_design.js test_strict.js mock_strict.js \
      live_public.js live_roles.js live_indicators.js live_design.js live_admin_write.js
echo "  файлов всего: $(git ls-files --others --exclude-standard $(git ls-files) 2>/dev/null | wc -l)"

echo "▸ Шаг 5. Коммит и публикация"
git add -A
if git diff --cached --quiet; then
  echo "  • изменений нет — файлы уже совпадают"
else
  git commit -q -m "Показатели из открытых источников, сетка только по решению, база НП России и доп. точки (таможни) в маршруте

- курсы ЦБ РФ подтягиваются в браузере, ДТ и «Платон» — ночным сбором tools/fetch_indicators.mjs
- значение тарифной сетки меняется только проектом решения: утверждение Администрации (переходный период) либо голосование Совета
- строка под шапкой: рыночные показатели с источником и датой + отдельный блок тарифной сетки
- калькулятор: 1130 населённых пунктов России с автоподбором, дополнительные точки (таможня, порт, терминал) в ставке
- таблица settlements (порты и таможни), инструменты сборки, обновлённые тесты и документы"
  git push -q -u origin "$BRANCH"
  echo "  ✓ запушено: $BEFORE → $(git rev-parse --short HEAD)"
fi
git remote set-url origin "https://github.com/$OWNER/$REPO.git"   # токен в историю не попадает

echo "▸ Шаг 6. Проверка GitHub Pages"
for i in $(seq 1 30); do
  sleep 10
  HTTP=$(curl -s -o /tmp/ks-check.html -w "%{http_code}" -L "https://$OWNER.github.io/$REPO/?cb=$(date +%s)" || true)
  if [ "$HTTP" = "200" ]; then
    N=$(wc -c < /tmp/ks-check.html)
    echo "  ✓ сайт отвечает, страница $N байт (попытка $i)"
    [ "$N" -ge $((SIZE - 3000)) ] && echo "  ✓ на сайте новая сборка" || echo "  … Pages ещё собирает (кэш 1–3 мин)"
    break
  fi
  echo "  … ждём сборку Pages ($i/30, HTTP ${HTTP:-—})"
done
rm -rf "$WORK"
