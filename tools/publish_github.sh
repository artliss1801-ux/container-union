#!/usr/bin/env bash
# =====================================================================
#  Публикация «Контейнерного Союза» на GitHub + включение GitHub Pages
#  Версия 2: работает и с пустым репозиторием, и с уже созданным
#  (сохраняет существующую историю коммитов).
#
#  Токен передаётся только через переменную окружения и нигде не сохраняется.
#
#  Запуск:
#    GH_TOKEN=ghp_xxx GH_OWNER=ваш-логин REPO=container-union bash tools/publish_github.sh
# =====================================================================
set -euo pipefail

: "${GH_TOKEN:?Нужен GH_TOKEN — временный токен GitHub}"
: "${GH_OWNER:?Нужен GH_OWNER — логин GitHub}"
REPO="${REPO:-container-union}"
API="https://api.github.com"
SRC="/home/user"
STAGE="$(mktemp -d /tmp/ks-src.XXXXXX)"     # что кладём в репозиторий
WORK="$(mktemp -d /tmp/ks-repo.XXXXXX)"     # рабочая копия репозитория
AUTH=(-H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json")

echo "▸ Шаг 1. Сбор файлов платформы"
cd "$SRC"
for f in index.html config.js README.md "Публикация.md" "Документы_Контейнерный_Союз.md" build.sh; do
  if [ -f "$f" ]; then cp "$f" "$STAGE/"; else echo "  ! пропущен (нет): $f"; fi
done
mkdir -p "$STAGE/supabase" "$STAGE/parts"
cp supabase/schema.sql supabase/README.md "$STAGE/supabase/"
cp parts/*.js parts/*.html "$STAGE/parts/"
echo "  готово файлов: $(find "$STAGE" -type f | wc -l)"

echo "▸ Шаг 2. Проверка аккаунта"
LOGIN=$(curl -s "${AUTH[@]}" "$API/user" | python3 -c "import sys,json;print(json.load(sys.stdin).get('login',''))")
[ -n "$LOGIN" ] || { echo "  ✗ токен не принят"; exit 1; }
echo "  аккаунт: $LOGIN"
GH_OWNER="$LOGIN"

echo "▸ Шаг 3. Репозиторий $GH_OWNER/$REPO"
if curl -sf "${AUTH[@]}" "$API/repos/$GH_OWNER/$REPO" >/dev/null; then
  echo "  • уже существует — использую его"
else
  echo "  • создаю новый"
  curl -s "${AUTH[@]}" -X POST "$API/user/repos" \
    -d "{\"name\":\"$REPO\",\"description\":\"Контейнерный Союз — открытая платформа контейнерных автоперевозок России\",\"private\":false}" >/dev/null
fi
BRANCH=$(curl -s "${AUTH[@]}" "$API/repos/$GH_OWNER/$REPO" | python3 -c "import sys,json;print(json.load(sys.stdin).get('default_branch') or 'main')")

echo "▸ Шаг 4. Рабочая копия репозитория (ветка $BRANCH)"
cd "$WORK"
CLONE_URL="https://x-access-token:$GH_TOKEN@github.com/$GH_OWNER/$REPO.git"
if git clone -q "$CLONE_URL" repo 2>/dev/null; then
  cd repo
  git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH"
  echo "  • скачана существующая история ($(git rev-list --count HEAD 2>/dev/null || echo 0) коммитов)"
else
  mkdir -p repo && cd repo && git init -q -b "$BRANCH"
  git remote add origin "$CLONE_URL"
  echo "  • репозиторий пуст — начинаю историю с нуля"
fi
git config user.name "$GH_OWNER"
git config user.email "$GH_OWNER@users.noreply.github.com"

echo "▸ Шаг 5. Загрузка файлов"
cp -R "$STAGE/." .
rm -f .gitkeep
git add -A
if git diff --cached --quiet; then
  echo "  • новых изменений нет (файлы уже совпадают)"
else
  git commit -q -m "Платформа «Контейнерный Союз»: калькулятор ставки, реестр перевозчиков и рейтинг, биржа грузов, переходный период Совета (порог выборов 50 перевозчиков), пакет документов, схема базы Supabase"
  git push -q -u origin "$BRANCH"
  echo "  ✓ загружено, коммит: $(git rev-parse --short HEAD)"
fi
git remote set-url origin "https://github.com/$GH_OWNER/$REPO.git"   # токен в конфиг не попадает

echo "▸ Шаг 6. Включение GitHub Pages"
CODE=$(curl -s -o /tmp/ks-pages.json -w "%{http_code}" "${AUTH[@]}" -X POST \
  "$API/repos/$GH_OWNER/$REPO/pages" -d "{\"source\":{\"branch\":\"$BRANCH\",\"path\":\"/\"}}")
case "$CODE" in
  201) echo "  ✓ Pages включены";;
  409) echo "  • Pages уже включены";;
  *)   echo "  ! не удалось автоматически (HTTP $CODE): $(head -c 200 /tmp/ks-pages.json)";;
esac

URL="https://$GH_OWNER.github.io/$REPO/"
echo "▸ Шаг 7. Ожидание сборки: $URL"
for i in $(seq 1 30); do
  sleep 10
  HTTP=$(curl -s -o /tmp/ks-site.html -w "%{http_code}" -L "$URL" || true)
  if [ "$HTTP" = "200" ] && grep -q "Контейнерный Союз" /tmp/ks-site.html 2>/dev/null; then
    echo "  ✓ сайт опубликован и отвечает (попытка $i)"
    echo
    echo "════════════════════════════════════════════════════════════"
    echo "  САЙТ:        $URL"
    echo "  РЕПОЗИТОРИЙ: https://github.com/$GH_OWNER/$REPO"
    echo "  Файлов:      $(find "$STAGE" -type f | wc -l) | Ветка: $BRANCH"
    echo "════════════════════════════════════════════════════════════"
    rm -rf "$STAGE" "$WORK"
    exit 0
  fi
  echo "  … сборка идёт ($i/30, HTTP ${HTTP:-—})"
done
echo "  ! сайт ещё не отвечает. Обычно помогает подождать 5–10 минут;"
echo "    статус сборки виден в репозитории → вкладка Actions."
rm -rf "$STAGE" "$WORK"
