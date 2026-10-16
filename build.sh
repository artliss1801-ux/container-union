#!/usr/bin/env bash
# Сборка платформы «Контейнерный Союз»: части складываются в один автономный файл index.html
set -euo pipefail
cd "$(dirname "$0")"
{
  cat parts/p1.html
  echo '<script>'
  cat parts/p2.js parts/p2b.settlements.js parts/p3.js parts/p4.js parts/p5.online.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html
echo "Собрано: index.html ($(wc -c < index.html) байт)"
