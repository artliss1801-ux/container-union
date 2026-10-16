/* СТРОКА ПОКАЗАТЕЛЕЙ на живом сайте: статичная, только актуальные цифры из базы.
   Плюс проверка прав: рыночный ориентир в переходный период меняет Администрация,
   курсы — справочные, тоже Администрация. После проверки всё возвращается как было. */
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
    ['ДТ', '«Платон»', 'Рыночный ориентир', 'USD'].forEach(x => { if (!t.includes(x)) throw new Error('нет ' + x); });
    [/Реестр:/, /Биржа:/, /Подсказка/, /Логотип/].forEach(rx => { if (rx.test(t)) throw new Error('лишнее: ' + rx); });
    return t.slice(0, 115) + '…';
  });
  await T('ДТ, «Платон» и ориентир совпадают с тарифной сеткой в базе', () => {
    const t = strip().replace(/\s/g, '');
    const v = origTariff.val;
    const need = [String(v.fuelPrice).replace('.', ','), String(v.platon).replace('.', ','), String(v.marketPerKm).replace('.', ',')];
    need.forEach(x => { if (!t.includes(x)) throw new Error('нет значения ' + x + ' в строке: ' + t.slice(0, 150)); });
    return 'ДТ ' + v.fuelPrice + ' ₽/л · «Платон» ' + v.platon + ' ₽/км · ориентир ' + v.marketPerKm + ' ₽/км · сетка ' + origTariff.version;
  });
  await T('курс доллара взят из базы и подписан источником и датой', () => {
    const t = strip();
    if (!origInd) throw new Error('в базе нет записи indicators');
    const usd = String(origInd.usd).replace('.', ',');
    if (!t.includes(usd)) throw new Error('нет курса ' + usd + ': ' + t);
    if (!/ЦБ/.test(t)) throw new Error('нет источника');
    if (!/\d{2}\.\d{2}\.\d{4}/.test(t)) throw new Error('нет даты');
    return 'USD ' + usd + ' ₽ · ' + origInd.src + ' на ' + origInd.asOf;
  });

  /* --- права: вход администратора и редактирование показателей --- */
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
  await T('Администрация меняет рыночный ориентир — база и строка обновляются', async () => {
    d.querySelector('#ind_market').value = '89,50';
    w.saveMarketBenchmark();
    await sleep(2500);
    const t = (await (await fetch(`${SB}/rest/v1/tariff?select=val,approved_by&id=eq.1`, { headers: H() })).json())[0];
    if (Number(t.val.marketPerKm) !== 89.5) throw new Error('в базе: ' + t.val.marketPerKm);
    if (!/89,50/.test(strip())) throw new Error('строка: ' + strip());
    return 'ориентир 88 → 89,50 ₽/км, основание: ' + t.approved_by;
  });
  await T('изменение ориентира попало в реестр решений и журнал', async () => {
    const dec = await (await fetch(`${SB}/rest/v1/decisions?select=id,title,result&order=at.desc&limit=1`, { headers: H(aJwt) })).json();
    if (!dec.length || !/ориентир/i.test(dec[0].title)) throw new Error('нет решения: ' + JSON.stringify(dec).slice(0, 160));
    return dec[0].id + ' · ' + dec[0].title;
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
    return 'USD → 84,10 ₽ (база и строка), дата ' + s.val.asOf;
  });
  await T('гость не может менять показатели', async () => {
    const guest = await (await fetch(`${SB}/rest/v1/settings?key=eq.indicators`, { method: 'PATCH', headers: { ...H(), Prefer: 'return=representation' }, body: JSON.stringify({ val: { usd: 1 } }) })).json();
    if (Array.isArray(guest) && guest.length) throw new Error('база позволила запись без входа!');
    const strip2 = await (await fetch(`${SB}/rest/v1/settings?select=val&key=eq.indicators`, { headers: H() })).json();
    if (Number(strip2[0].val.usd) !== 84.1) throw new Error('значение изменилось');
    return 'запрос без прав отклонён, значение цело';
  });

  /* --- возвращаем всё как было --- */
  console.log('\n▸ Возвращаю исходные значения…');
  await fetch(`${SB}/rest/v1/tariff?id=eq.1`, { method: 'PATCH', headers: { ...H(aJwt), Prefer: 'return=minimal' }, body: JSON.stringify({ version: origTariff.version, approved: origTariff.approved, approved_by: origTariff.approved_by, val: origTariff.val }) });
  await fetch(`${SB}/rest/v1/settings?key=eq.indicators`, { method: 'PATCH', headers: { ...H(aJwt), Prefer: 'return=minimal' }, body: JSON.stringify({ val: origInd }) });
  await sql("delete from decisions where title ilike '%Рыночный ориентир%'; delete from journal where text ilike '%ориентир%' or text ilike '%Курсы обновлены%';");
  const back = (await (await fetch(`${SB}/rest/v1/tariff?select=val,version,approved_by&id=eq.1`, { headers: H() })).json())[0];
  const backInd = (await (await fetch(`${SB}/rest/v1/settings?select=val&key=eq.indicators`, { headers: H() })).json())[0];
  console.log('  сетка:', back.version, '| ориентир', back.val.marketPerKm, '₽/км | основание:', back.approved_by);
  console.log('  показатели:', JSON.stringify(backInd.val));
  console.log('\nОшибки JS:', jsErr.length);
  process.exit(fails.length ? 1 : 0);
})();
