#!/usr/bin/env node
/* ============================================================
   Автоматическое обновление показателей строки под шапкой
   из открытых источников (запускается ночной задачей на GitHub).

   Что тянем:
     • курсы валют   — ЦБ РФ (зеркало cbr-xml-daily.ru, официальные курсы) с резервом open.er-api.com
     • дизельное топливо — Росстат: недельная средняя цена по РФ, публикуется в открытых сводках
     • «Платон»      — тариф системы (индексируется постановлением Правительства РФ)

   Записывает результат в таблицу settings (ключ indicators) базы Supabase.
   Если источник не ответил или значение не проходит проверку — прежнее значение
   сохраняется, в отчёте пишется причина: показатели не портятся «мусором».

   Переменные окружения (задаются в GitHub → Settings → Secrets and variables → Actions):
     SUPABASE_URL       — адрес проекта, например https://xxxx.supabase.co
     SUPABASE_SERVICE_KEY — служебный ключ (service_role); в файлы не попадает
   ============================================================ */
'use strict';

const SB_URL = (process.env.SUPABASE_URL || 'https://nciyhaghjqddkqzuimff.supabase.co').replace(/\/$/, '');  // адрес проекта (публичный)
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';            // служебный ключ (если задан — используется он)
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR'; // публичный ключ платформы
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';                 // иначе — вход администратора платформы
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DRY = process.argv.includes('--dry') || (!SB_KEY && !(ADMIN_EMAIL && ADMIN_PASSWORD));
let TOKEN = '';                                                   // доступ к базе: служебный ключ или токен администратора

/* ---------- утилиты ---------- */
const log = (...a) => console.log(new Date().toISOString().slice(0, 16).replace('T', ' '), '·', ...a);
const num = v => { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const today = () => new Date().toISOString().slice(0, 10);
async function get(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, Object.assign({
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36', 'Accept-Language': 'ru-RU,ru;q=0.9' }
    }, opts || {}));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
/* поиск значения рядом с ключевым словом: «дизельное топливо … 86,67 рубля за литр» */
function pickNumber(text, keywords, min, max) {
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&laquo;|&raquo;/g, ' ').replace(/\s+/g, ' ');
  for (const kw of keywords) {
    const re = new RegExp(kw, 'gi');
    let m;
    while ((m = re.exec(flat))) {
      const win = flat.slice(m.index, m.index + 260);
      const nums = win.match(/\d{1,4}[,.]\d{1,2}|\d{2,4}/g) || [];
      for (const raw of nums) {
        const v = num(raw);
        if (v >= min && v <= max && !/^0[,.]/.test(raw)) {
          return { value: v, index: m.index, quote: flat.slice(m.index, m.index + 200).trim() };
        }
      }
    }
  }
  return null;
}
function pickDate(text) {
  const months = { 'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12 };
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const iso = flat.match(/(20\d\d)-(\d\d)-(\d\d)/);
  if (iso) return iso[0];
  const ru = flat.match(/(\d{1,2})\s+(январ[а-яё]*|феврал[а-яё]*|март[а-яё]*|апрел[а-яё]*|ма[а-яё]+|июн[а-яё]*|июл[а-яё]*|август[а-яё]*|сентябр[а-яё]*|октябр[а-яё]*|ноябр[а-яё]*|декабр[а-яё]*)\s*(20\d\d)?/i);
  if (ru) {
    const mKey = Object.keys(months).find(k => ru[2].toLowerCase().startsWith(k));
    const mm = mKey ? months[mKey] : null; const year = ru[3] ? Number(ru[3]) : new Date().getFullYear();
    if (mm) return `${year}-${String(mm).padStart(2, '0')}-${String(Number(ru[1])).padStart(2, '0')}`;
  }
  const dots = flat.match(/(\d{1,2})\.(\d{2})\.(20\d\d)/);
  if (dots) return `${dots[3]}-${dots[2]}-${dots[1].padStart(2, '0')}`;
  return today();
}

/* ---------- источники ---------- */
async function ratesFromCbr() {
  const txt = await get('https://www.cbr-xml-daily.ru/daily_json.js');
  const d = JSON.parse(txt);
  const v = k => d.Valute[k].Value / d.Valute[k].Nominal;
  return { usd: v('USD'), eur: v('EUR'), cny: v('CNY'), asOf: String(d.Date).slice(0, 10), src: 'ЦБ РФ' };
}
async function ratesFromErApi() {
  const d = JSON.parse(await get('https://open.er-api.com/v6/latest/RUB'));
  return { usd: 1 / d.rates.USD, eur: 1 / d.rates.EUR, cny: 1 / d.rates.CNY, asOf: today(), src: 'open.er-api.com' };
}
/* ---------- ДТ: недельная средняя цена по РФ (Росстат) ----------
   Росстат публикует недельную сводку на своём сайте; сайт Росстата недоступен с зарубежных
   адресов, поэтому берём открытые сводки, которые приводят цифру Росстата дословно:
   находим свежую заметку про топливо, читаем её и берём цену дизтоплива. */
function addDateParsers() {}
function pickIsoDateNear(text, at) {
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const win = flat.slice(Math.max(0, at - 400), at + 400);
  const m1 = win.match(/(\d{1,2})\s+(январ[а-яё]*|феврал[а-яё]*|март[а-яё]*|апрел[а-яё]*|ма[а-яё]+|июн[а-яё]*|июл[а-яё]*|август[а-яё]*|сентябр[а-яё]*|октябр[а-яё]*|ноябр[а-яё]*|декабр[а-яё]*)\s*(20\d\d)?/i);
  const months = { 'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12 };
  if (m1) {
    const key = Object.keys(months).find(k => m1[2].toLowerCase().startsWith(k));
    if (key) return `${m1[3] || new Date().getFullYear()}-${String(months[key]).padStart(2, '0')}-${String(Number(m1[1])).padStart(2, '0')}`;
  }
  const m2 = win.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(январ[а-яё]*|феврал[а-яё]*|март[а-яё]*|апрел[а-яё]*|ма[а-яё]+|июн[а-яё]*|июл[а-яё]*|август[а-яё]*|сентябр[а-яё]*|октябр[а-яё]*|ноябр[а-яё]*|декабр[а-яё]*)\s*(20\d\d)?/i);
  if (m2) {
    const key = Object.keys(months).find(k => m2[3].toLowerCase().startsWith(k));
    if (key) return `${m2[4] || new Date().getFullYear()}-${String(months[key]).padStart(2, '0')}-${String(Number(m2[2])).padStart(2, '0')}`;
  }
  const m3 = win.match(/(\d{1,2})[.-]([A-Za-z]{3})[.-](20\d\d)/);
  if (m3) {
    const mm = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }[m3[2].toLowerCase()];
    if (mm) return `${m3[3]}-${String(mm).padStart(2, '0')}-${m3[1].padStart(2, '0')}`;
  }
  return null;
}
/* Сведения о топливе: свежие публикации с недельной цифрой Росстата.
   Схема: страница поиска → свежие заметки (за последние 10 дней) → ищем «дизельное топливо … рубля за литр».
   Источник и ссылка на заметку сохраняются — значение всегда можно проверить. */
const NEWS_SOURCES = [
  { name: '1prime.ru', search: q => 'https://1prime.ru/search/?query=' + encodeURIComponent(q), base: 'https://1prime.ru' },
  { name: 'investfuture.ru', search: q => 'https://investfuture.ru/search?query=' + encodeURIComponent(q), base: 'https://investfuture.ru' },
  { name: 'eprussia.ru', search: q => 'https://eprussia.ru/search/?q=' + encodeURIComponent(q), base: 'https://eprussia.ru' }
];
function articleLinks(html, base) {
  const links = Array.from(new Set((html.match(/href="([^"#]+?\.html)"/g) || []).map(x => x.replace(/^href="|"$/g, ''))))
    .filter(u => !/\/docs\/|terms_|privacy|recommendation|_social|_ecological/i.test(u))
    .map(u => u.startsWith('http') ? u : base + (u.startsWith('/') ? '' : '/') + u);
  const cutoff = Date.now() - 10 * 86400000;
  /* сначала свежие по дате в адресе (/20261014/…), затем остальные */
  const dated = links.map(u => {
    const m = u.match(/\/(20\d\d)(\d\d)(\d\d)\//);
    return m ? { u, t: Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) || 0 } : { u, t: 0 };
  });
  const fresh = dated.filter(x => x.t >= cutoff).sort((a, b) => b.t - a.t).map(x => x.u);
  return (fresh.length ? fresh : dated.sort((a, b) => b.t - a.t).map(x => x.u)).slice(0, 4);
}
async function dieselPrice() {
  const queries = ['дизельное топливо россстат', 'Росстат цены на топливо'];
  for (const src of NEWS_SOURCES) {
    for (const q of queries) {
      let html;
      try { html = await get(src.search(q)); } catch (e) { log('ДТ:', src.name, '— поиск недоступен:', e.message); continue; }
      const links = articleLinks(html, src.base);
      if (!links.length) log('ДТ:', src.name, '— по запросу «' + q + '» свежих заметок не нашлось');
      for (const link of links.slice(0, 3)) {
        try {
          const txt = await get(link);
          const hit = pickNumber(txt, ['дизельн[а-яё]*[ ]+топлив[а-яё]*'], 60, 130);
          if (!hit) continue;
          const asOf = pickIsoDateNear(txt, hit.index) || today();
          if (Date.now() - Date.parse(asOf) > 45 * 86400000) { log('ДТ: заметка устарела (' + asOf + ') — ищем свежую'); continue; }
          log('ДТ:', src.name, link, '—', hit.value, '₽/л, дата', asOf);
          return { value: hit.value, asOf, src: src.name + ' (сводка Росстата)', link, quote: hit.quote };
        } catch (e) { log('ДТ: заметка не прочиталась —', e.message); }
      }
    }
  }
  /* резерв: открытый мониторинг розничных цен (методика отличается от сводки Росстата — помечаем) */
  try {
    const txt = await get('https://www.globalpetrolprices.com/Russia/diesel_prices/');
    const hit = pickNumber(txt, ['diesel'], 60, 130);
    if (hit) {
      const asOf = pickIsoDateNear(txt, hit.index) || today();
      log('ДТ: резервный источник (розничные цены)', hit.value, '₽/л на', asOf);
      return { value: hit.value, asOf, src: 'globalpetrolprices.com (розничные цены)', link: 'https://www.globalpetrolprices.com/Russia/diesel_prices/', quote: hit.quote };
    }
  } catch (e) { log('ДТ: резервный источник недоступен —', e.message); }
  return null;
}
/* «Платон»: тариф системы (руб./км) — ищем в открытых публикациях */
const PLATON_QUERIES = ['Платон тариф рубля за километр', 'система Платон тариф индексация'];
async function platonRate() {
  for (const src of NEWS_SOURCES) {
    for (const q of PLATON_QUERIES) {
      let html;
      try { html = await get(src.search(q)); } catch (e) { continue; }
      for (const link of articleLinks(html, src.base).slice(0, 3)) {
        try {
          const txt = await get(link);
          const hit = pickNumber(txt, ['«?Платон»?[^.]{0,140}?(?:тариф|ставк[а-яё]*)'], 1, 10);
          if (!hit) continue;
          if (!/километр|за км|\/км/i.test(hit.quote)) { log('«Платон»: в заметке нет привязки к километру — пропускаем'); continue; }
          const asOf = pickIsoDateNear(txt, hit.index) || today();
          if (Date.now() - Date.parse(asOf) > 120 * 86400000) { log('«Платон»: заметка устарела (' + asOf + ') — ищем свежую'); continue; }
          log('«Платон»:', src.name, link, '—', hit.value, '₽/км, дата', asOf);
          return { value: hit.value, asOf, src: src.name, link, quote: hit.quote };
        } catch (e) { /* следующая заметка */ }
      }
    }
  }
  return null;
}

/* ---------- доступ к базе и запись ---------- */
/* Если служебного ключа нет — входим как администратор платформы и пишем его токеном:
   права проверяет сама база (политика admin_all для is_admin()). Пароль в лог не попадает. */
async function authToken() {
  if (SB_KEY) return SB_KEY;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  if (!r.ok) throw new Error('вход администратора не удался: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  const d = await r.json();
  if (!d.access_token) throw new Error('вход администратора: база не вернула токен');
  return d.access_token;
}
const HEAD = (extra) => Object.assign({ apikey: SB_KEY || SB_ANON, Authorization: 'Bearer ' + (TOKEN || SB_KEY) }, extra || {});
async function readIndicators() {
  const r = await fetch(`${SB_URL}/rest/v1/settings?select=val&key=eq.indicators`, { headers: HEAD() });
  if (!r.ok) throw new Error('чтение настроек: HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 140));
  const rows = await r.json();
  return (rows[0] && rows[0].val) || {};
}
async function writeIndicators(val) {
  const r = await fetch(`${SB_URL}/rest/v1/settings?on_conflict=key`, {
    method: 'POST',
    headers: HEAD({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ key: 'indicators', val }])
  });
  if (!r.ok) throw new Error('запись настроек: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

(async () => {
  log('Обновление показателей. Режим:', DRY ? 'проверка без записи' : 'запись в базу');

  let rates = null;
  try { rates = await ratesFromCbr(); log('курсы ЦБ РФ:', rates.usd, '₽/USD,', rates.cny, '₽/CNY на', rates.asOf); }
  catch (e) { log('ЦБ РФ недоступен —', e.message); }
  if (!rates) { try { rates = await ratesFromErApi(); log('курсы из резервного источника:', rates.src, rates.usd); } catch (e) { log('резервный источник тоже недоступен —', e.message); } }

  const diesel = await dieselPrice();
  if (diesel) log('ДТ по открытым данным:', diesel.value, '₽/л ·', diesel.src, '·', diesel.asOf, '·', diesel.link || '');
  else log('ДТ: значение получить не удалось — оставляем прежнее');

  const platon = await platonRate();
  if (platon) log('«Платон» по открытым данным:', platon.value, '₽/км ·', platon.src, '·', platon.asOf, '·', platon.link || '');
  else log('«Платон»: значение получить не удалось — оставляем прежнее');

  if (DRY) { log('Готово (без записи).'); return; }

  TOKEN = await authToken();
  log('Доступ к базе:', SB_KEY ? 'служебный ключ' : 'вход администратора платформы');
  const prev = await readIndicators();
  const next = Object.assign({}, prev, { fetchedAt: new Date().toISOString(), auto: true });
  if (rates) Object.assign(next, { usd: rates.usd, eur: rates.eur, cny: rates.cny, asOf: rates.asOf, src: rates.src });
  if (diesel) Object.assign(next, { dt: diesel.value, dtAsOf: diesel.asOf, dtSrc: diesel.src, dtLink: diesel.link || '' });
  if (platon) Object.assign(next, { platon: platon.value, platonAsOf: platon.asOf, platonSrc: platon.src, platonLink: platon.link || '' });
  next.sources = Object.assign({}, prev.sources || {}, rates ? { rates: rates.src } : {}, diesel ? { dt: diesel.src } : {}, platon ? { platon: platon.src } : {});
  await writeIndicators(next);
  log('Записано в базу. Обновлено:', [rates && 'курсы', diesel && 'ДТ', platon && '«Платон»'].filter(Boolean).join(', ') || 'ничего');
})().catch(e => { console.error('Ошибка обновления:', e.message); process.exit(1); });
