/* СТРОКА ПОКАЗАТЕЛЕЙ на живом сайте: статичная, только актуальные цифры.
   Курсы — из открытого источника (ЦБ РФ), ДТ и «Платон» — из ночного сбора либо из сетки;
   значения тарифной сетки показаны отдельным блоком. Плюс проверка прав: рыночный ориентир
   в переходный период утверждает Администрация (с записью в реестр решений), после выборов —
   только голосование Совета. После проверки всё возвращается как было. */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const SB = 'https://nciyhaghjqddkqzuimff.supabase.co';
const KEY = 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR';
const MGMT = process.env.SUPABASE_MGMT_TOKEN || '';
const ADMIN = { email: process.env.ADMIN_EMAIL || '', password: process.env.ADMIN_PASSWORD || '' };
const REF = 'nciyhaghjqddkqzuimff';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = x => String(x).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const fails = [], jsErr = [];
const T = (n, f) => Promise.resolve().then(f).then(r => console.log('✓', n, r ? '— ' + r : ''), e => { console.log('✗', n, '→', e.message); fails.push(n); });
const H = jwt => ({ apikey: KEY, Authorization: 'Bearer ' + (jwt || KEY), 'Content-Type': 'application/json' });
const sql = async query => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: 'Bearer ' + MGMT, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  return r.json();
};
const num = x => String(x).replace('.', ',');

(async () => {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) jsErr.push(e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }
  const strip = () => norm(d.querySelector('#indicIn').textContent);

  const settings = await (await fetch(`${SB}/rest/v1/settings?select=key,val&key=eq.indicators`, { headers: H() })).json();
  const origTariff = (await (await fetch(`${SB}/rest/v1/tariff?select=version,approved,approved_by,val&id=eq.1`, { headers: H() })).json())[0];
  const origInd = settings[0] && settings[0].val;

  await T('строка показателей есть и не бежит', () => {
    if (!d.querySelector('#indicIn')) throw new Error('нет строки');
    const st = w.getComputedStyle(d.querySelector('#indicIn'));
    if (st.animationName && st.animationName !== 'none') throw new Error('анимируется: ' + st.animationName);
    if (/marquee/i.test(html)) throw new Error('в стилях осталась бегущая строка');
    return 'статичная строка';
  });
  await T('в строке только актуальные показатели — без событий и подсказок', () => {
    const t = strip();
    ['ДТ', '«Платон»', 'Рыночный ориентир', 'USD', 'сетка'].forEach(x => { if (!t.includes(x)) throw new Error('нет ' + x); });
    [/Реестр:/, /Биржа:/, /Подсказка/, /Логотип/].forEach(rx => { if (rx.test(t)) throw new Error('лишнее: ' + rx); });
    return t.slice(0, 120) + '…';
  });
  await T('ДТ и «Платон»: открытые данные приоритетнее, иначе — значение сетки', () => {
    const t = strip().replace(/\s/g, ''), v = origTariff.val, ind = origInd || {};
    const dt = ind.dt ? num(ind.dt) : num(v.fuelPrice);
    const pl = ind.platon ? num(ind.platon) : num(v.platon);
    if (!t.includes(dt)) throw new Error('ДТ ' + dt + ' нет в строке: ' + t.slice(0, 160));
    if (!t.includes(pl)) throw new Error('«Платон» ' + pl + ' нет в строке');
    return 'ДТ ' + dt + ' ₽/л (' + (ind.dt ? 'открытые данные ' + (ind.dtAsOf || '') : 'по тарифной сетке') + ') · «Платон» ' + pl + ' ₽/км';
  });
  await T('блок тарифной сетки в строке совпадает с базой', () => {
    const t = strip().replace(/\s/g, ''), v = origTariff.val;
    if (!t.includes(num(v.fuelPrice)) || !t.includes(num(v.platon))) throw new Error('значения сетки не совпадают: ' + t.slice(0, 200));
    if (!strip().includes(origTariff.version)) throw new Error('нет версии сетки ' + origTariff.version);
    return origTariff.version + ' · ДТ ' + v.fuelPrice + ' · «Платон» ' + v.platon + ' ₽/км';
  });
  await T('рыночный ориентир в строке совпадает с базой', () => {
    const v = origTariff.val;
    if (!strip().replace(/\s/g, '').includes(num(v.marketPerKm))) throw new Error('нет ориентира ' + v.marketPerKm);
    return fmt(v.marketPerKm) + ' ₽/км';
  });
  await T('курс доллара взят из базы и подписан источником и датой', () => {
    const t = strip();
    if (!origInd) throw new Error('в базе нет записи indicators');
    const usd = num(origInd.usd);
    if (!t.includes(usd)) throw new Error('нет курса ' + usd + ': ' + t);
    if (!/ЦБ/.test(t)) throw new Error('нет источника');
    if (!/\d{2}\.\d{2}\.\d{4}/.test(t)) throw new Error('нет даты');
    return 'USD ' + usd + ' ₽ · ' + origInd.src + ' на ' + origInd.asOf;
  });
  await T('курсы подтягиваются из открытого источника (ЦБ РФ)', async () => {
    const v = await w.fetchRates();
    if (!v || !(v.usd > 60 && v.usd < 120)) throw new Error('нет курса: ' + JSON.stringify(v));
    if (!/ЦБ/.test(v.src)) throw new Error('источник: ' + v.src);
    return v.src + ': USD ' + num(v.usd) + ' ₽ на ' + v.asOf;
  });
  await T('база НП России подключена: подсказки и маршрут', () => {
    const total = w.eval('SETTLEMENTS.length');
    if (total < 1000) throw new Error('в базе только ' + total);
    const s = w.suggestSettlements('Новорос', 5);
    if (!s.length || !/Новороссийск/.test(s[0][0])) throw new Error('нет подсказки');
    const km = w.roadKm('Новороссийск', 'Москва');
    if (!(km > 1200 && km < 1750)) throw new Error('расстояние: ' + km);
    return total + ' пунктов · Новороссийск → Москва ' + km + ' км';
  });
  await T('таблица дополнительных точек читается из базы (порты и таможни)', async () => {
    const rows = await (await fetch(`${SB}/rest/v1/settlements?select=name,kind&limit=100`, { headers: H() })).json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('нет данных: ' + JSON.stringify(rows).slice(0, 120));
    const kinds = [...new Set(rows.map(r => r.kind))].join('/');
    if (w.loadSettlements) await w.loadSettlements(true);
    return rows.length + ' строк, виды: ' + kinds;
  });

  /* --- права: вход администратора --- */
  const aTok = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }) })).json();
  const aJwt = aTok.access_token;
  w.openLogin(); await sleep(400);
  d.querySelector('#lg_email').value = ADMIN.email;
  d.querySelector('#lg_pass').value = ADMIN.password;
  w.doLogin(); await sleep(6000);

  await T('администратор видит раздел «Показатели строки под шапкой»', () => {
    w.showTab('cabinet');
    const t = norm(d.querySelector('#view').textContent);
    if (!/Показатели строки под шапкой/.test(t)) throw new Error('нет раздела');
    if (!d.querySelector('#ind_market')) throw new Error('нет поля рыночного ориентира');
    return 'поля ориентира и курсов на месте';
  });
  await T('в кабинете виден блок «Открытые данные» ночного сбора', () => {
    const t = norm(d.querySelector('#view').textContent);
    if (!/Открытые данные/.test(t)) throw new Error('нет блока');
    if (!/Внести проект/.test(t)) throw new Error('нет кнопки переноса значения в проект решения');
    const phase = w.eval('councilPhase()');
    return 'блок на месте · фаза Совета: ' + phase + (origInd && origInd.dt ? ' · ДТ из открытых данных ' + num(origInd.dt) : ' · ждём первый ночной сбор');
  });
  await T('Администрация утверждает рыночный ориентир — база, строка и реестр решений', async () => {
    if (w.eval('councilPhase()') === 'elected') return 'Совет избран — ориентир меняет только голосование (проверка пропущена)';
    d.querySelector('#ind_market').value = '89,50';
    w.saveMarketBenchmark();
    await sleep(3000);
    const t = (await (await fetch(`${SB}/rest/v1/tariff?select=val,approved_by,version&id=eq.1`, { headers: H() })).json())[0];
    if (Number(t.val.marketPerKm) !== 89.5) throw new Error('в базе: ' + t.val.marketPerKm);
    if (!/89,50/.test(strip())) throw new Error('строка: ' + strip());
    if (!/переходный период/i.test(t.approved_by)) throw new Error('основание: ' + t.approved_by);
    return 'ориентир ' + origTariff.val.marketPerKm + ' → 89,50 ₽/км · ' + t.version + ' · ' + t.approved_by;
  });
  await T('изменение ориентира попало в реестр решений и журнал', async () => {
    const dec = await (await fetch(`${SB}/rest/v1/decisions?select=id,title,result&order=at.desc&limit=3`, { headers: H(aJwt) })).json();
    const hit = (dec || []).find(x => /ориентир/i.test(x.title));
    if (!hit) throw new Error('нет решения: ' + JSON.stringify(dec).slice(0, 160));
    if (!/Администрацией/.test(hit.result)) throw new Error('результат: ' + hit.result);
    return hit.id + ' · ' + hit.title + ' · ' + hit.result;
  });
  await T('открытое значение ДТ переносится в проект решения (сетка не меняется)', async () => {
    if (!origInd || !origInd.dt) return 'открытых данных ДТ пока нет — проверка пропущена';
    w.showTab('cabinet');
    const before = (await (await fetch(`${SB}/rest/v1/tariff?select=val&id=eq.1`, { headers: H() })).json())[0].val.fuelPrice;
    w.projectFromOpenData('fuelPrice');
    await sleep(2500);
    const votes = await (await fetch(`${SB}/rest/v1/votes?select=id,title,payload,status&order=created.desc&limit=3`, { headers: H(aJwt) })).json();
    const hit = (votes || []).find(v => v.payload && Math.abs(Number(v.payload.fuelPrice) - Number(origInd.dt)) < 0.001);
    if (!hit) throw new Error('проекта нет: ' + JSON.stringify(votes).slice(0, 160));
    const after = (await (await fetch(`${SB}/rest/v1/tariff?select=val&id=eq.1`, { headers: H() })).json())[0].val.fuelPrice;
    if (Number(after) !== Number(before)) throw new Error('сетка изменилась без решения: ' + before + ' → ' + after);
    return hit.id + ' · ' + hit.title + ' · статус ' + hit.status + ' · сетка не тронута (' + after + ' ₽/л)';
  });
  await T('Администрация обновляет курсы — они появляются в строке', async () => {
    w.showTab('cabinet');
    d.querySelector('#ind_usd').value = '84,10';
    d.querySelector('#ind_date').value = '2026-10-17';
    w.saveIndicators();
    await sleep(2500);
    const s = (await (await fetch(`${SB}/rest/v1/settings?select=val&key=eq.indicators`, { headers: H() })).json())[0];
    if (Number(s.val.usd) !== 84.1) throw new Error('в базе: ' + s.val.usd);
    if (!/84,10/.test(strip())) throw new Error('строка: ' + strip());
    if (origInd && origInd.dt && Number(s.val.dt) !== Number(origInd.dt)) throw new Error('ручной ввод затёр открытое значение ДТ');
    return 'USD → 84,10 ₽ (база и строка), дата ' + s.val.asOf + (origInd && origInd.dt ? '; открытые данные ДТ не тронуты' : '');
  });
  await T('гость не может менять показатели', async () => {
    const guest = await (await fetch(`${SB}/rest/v1/settings?key=eq.indicators`, { method: 'PATCH', headers: { ...H(), Prefer: 'return=representation' }, body: JSON.stringify({ val: { usd: 1 } }) })).json();
    if (Array.isArray(guest) && guest.length) throw new Error('база позволила запись без входа!');
    const after = await (await fetch(`${SB}/rest/v1/settings?select=val&key=eq.indicators`, { headers: H() })).json();
    if (Number(after[0].val.usd) !== 84.1) throw new Error('значение изменилось');
    return 'запрос без прав отклонён, значение цело';
  });
  await T('нет ошибок JS на живом сайте', () => { if (jsErr.length) throw new Error(jsErr.slice(0, 2).join(' | ')); return 'чисто'; });

  /* --- возвращаем всё как было --- */
  console.log('\n▸ Возвращаю исходные значения…');
  await fetch(`${SB}/rest/v1/tariff?id=eq.1`, { method: 'PATCH', headers: { ...H(aJwt), Prefer: 'return=minimal' }, body: JSON.stringify({ version: origTariff.version, approved: origTariff.approved, approved_by: origTariff.approved_by, val: origTariff.val }) });
  await fetch(`${SB}/rest/v1/settings?key=eq.indicators`, { method: 'PATCH', headers: { ...H(aJwt), Prefer: 'return=minimal' }, body: JSON.stringify({ val: origInd }) });
  /* Уборка тестовых записей: через Management API, а если токена нет — обычными удалениями
     под правами администратора (политика admin_all разрешает все операции). */
  if (MGMT) {
    await sql("delete from decisions where title ilike '%ориентир%'; delete from journal where text ilike '%ориентир%' or text ilike '%Курсы обновлены%'; delete from votes where title ilike '%ориентир%';");
  } else {
    const del = async (t, q) => fetch(`${SB}/rest/v1/${t}?${q}`, { method: 'DELETE', headers: { ...H(aJwt), Prefer: 'return=minimal' } });
    await del('decisions', 'title=' + encodeURIComponent('ilike.*ориентир*'));
    await del('decisions', 'title=' + encodeURIComponent('ilike.*дизельн*'));
    await del('votes', 'title=' + encodeURIComponent('ilike.*ориентир*'));
    await del('votes', 'title=' + encodeURIComponent('ilike.*дизельн*'));
    await del('journal', 'or=' + encodeURIComponent('(text.ilike.*ориентир*,text.ilike.*Курсы обновлены*)'));
    console.log('  (Management API-токена нет — уборка выполнена под правами администратора)');
  }
  const back = (await (await fetch(`${SB}/rest/v1/tariff?select=val,version,approved_by&id=eq.1`, { headers: H() })).json())[0];
  const backInd = (await (await fetch(`${SB}/rest/v1/settings?select=val&key=eq.indicators`, { headers: H() })).json())[0];
  console.log('  сетка:', back.version, '| ориентир', back.val.marketPerKm, '₽/км | основание:', back.approved_by);
  console.log('  показатели:', JSON.stringify(backInd.val));
  console.log('\nОшибки JS:', jsErr.length);
  process.exit(fails.length ? 1 : 0);
})();

function fmt(x) { return String(x).replace('.', ','); }
