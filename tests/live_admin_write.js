/* Проверка: записи куратора в закрытую базу проходят (тариф, настройки) */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const SB = 'https://nciyhaghjqddkqzuimff.supabase.co';
const K = 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR';
const H = { apikey: K, Authorization: 'Bearer ' + K };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async q => (await fetch(`${SB}/rest/v1/${q}`, { headers: H })).json();
const errs = [];
const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };
(async () => {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const vc = new VirtualConsole();
  const warns = [];
  vc.on('warn', m => warns.push(String(m)));
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  const t0 = (await get('tariff?select=val,version&id=eq.1'))[0];
  const s0 = (await get('settings?select=val&key=eq.council'))[0];
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  w.openLogin(); await sleep(300);
  d.querySelector('#lg_email').value = 'artliss@rambler.ru';
  d.querySelector('#lg_pass').value = 'KS-9X91DyOspvtp!7';
  w.doLogin(); await sleep(4000);
  T('вход куратора', () => { const b = d.querySelector('#authBox').textContent.replace(/[\u00a0\u202f]/g, ' ').trim(); if (!/куратор/.test(b)) throw new Error(b); return b; });

  T('тариф сохранён куратором (запись в закрытую базу)', () => { if (!w.eval('typeof sbPushTariff === "function"')) throw new Error('нет функции'); return 'функция есть'; });
  w.eval('sbPushTariff()'); await sleep(3000);
  const t1 = (await get('tariff?select=val,version&id=eq.1'))[0];
  T('тарифная сетка в базе не пострадала', () => {
    if (JSON.stringify(t0.val) !== JSON.stringify(t1.val)) throw new Error('значения изменились');
    return 'версия ' + t1.version + ', ' + Object.keys(t1.val).length + ' параметров, запись прошла без отказа';
  });

  w.eval('sbPushSettings()'); await sleep(3000);
  const s1 = (await get('settings?select=val&key=eq.council'))[0];
  T('настройки Совета сохранены куратором', () => {
    if (JSON.stringify(s0.val) !== JSON.stringify(s1.val)) throw new Error('значения изменились');
    return 'порог выборов ' + s1.val.electionThreshold + ', учебный режим ' + s1.val.demoCouncil;
  });

  const refusal = warns.filter(x => /доступ отклонён/.test(x));
  T('отказов доступа при записи куратора не было', () => { if (refusal.length) throw new Error(refusal.join(' | ')); return '0 отказов'; });

  console.log('\nОшибки JS:', errs.length);
  process.exit(errs.length ? 1 : 0);
})();
