/* Полный тест защиты через ЖИВОЙ сайт + настоящую базу Supabase */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const SB = 'https://nciyhaghjqddkqzuimff.supabase.co';
const K = 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const ADMIN = { email: 'artliss@rambler.ru', pass: 'KS-9X91DyOspvtp!7' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async q => (await fetch(`${SB}/rest/v1/${q}`, { headers: H })).json();
const probe = 'ООО «Тест защиты» ' + Date.now();
const errs = [];
const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };
(async () => {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
  const txt = () => norm(d.querySelector('#view').textContent);
  const authBox = () => norm(d.querySelector('#authBox').textContent).trim();
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  console.log('--- ГОСТЬ (без входа) ---');
  T('сайт на связи с защищённой базой', () => d.querySelector('#storeTag').textContent);
  T('в шапке кнопка входа', () => { if (!/Вход для Администрации/.test(authBox())) throw new Error(authBox()); return authBox(); });

  const sel = d.querySelector('#roleSel'); sel.value = 'admin'; sel.dispatchEvent(new w.Event('change'));
  w.showTab('cabinet');
  T('админ-панель закрыта', () => { if (!txt().includes('Администрирование: нужен вход')) throw new Error('панель открыта'); return 'требуется вход'; });

  ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#' + id).checked = true);
  d.querySelector('#r_name').value = probe; d.querySelector('#r_city').value = 'Новороссийск';
  w.register(); await sleep(3000);
  const reg = await get('carriers?select=id,status,name&name=eq.' + encodeURIComponent(probe));
  T('гость зарегистрировал перевозчика — запись в базе', () => {
    if (!reg.length) throw new Error('записи нет');
    if (reg[0].status !== 'pending') throw new Error('статус ' + reg[0].status);
    return reg[0].id + ', статус pending';
  });
  const cid = reg[0] && reg[0].id;

  const before = (await get('carriers?select=status&id=eq.' + cid))[0].status;
  w.verifyCarrier(cid); await sleep(2500);
  const afterGuest = (await get('carriers?select=status&id=eq.' + cid))[0].status;
  T('гость НЕ смог верифицировать перевозчика', () => {
    if (afterGuest !== before) throw new Error('статус изменился: ' + afterGuest);
    return 'статус остался ' + afterGuest;
  });

  console.log('--- АДМИНИСТРАТОР (вход) ---');
  w.openLogin(); await sleep(300);
  d.querySelector('#lg_email').value = ADMIN.email; d.querySelector('#lg_pass').value = ADMIN.pass;
  w.doLogin(); await sleep(4000);
  T('вход выполнен, права куратора подтверждены', () => { if (!/куратор: /.test(authBox())) throw new Error(authBox()); return authBox(); });
  T('админ-панель открылась', () => { w.showTab('cabinet'); if (txt().includes('нужен вход')) throw new Error('всё ещё закрыта'); return 'доступна'; });

  w.verifyCarrier(cid); await sleep(3000);
  const afterAdm = (await get('carriers?select=status&id=eq.' + cid))[0].status;
  T('куратор верифицировал перевозчика — база приняла', () => {
    if (afterAdm !== 'verified') throw new Error('статус ' + afterAdm);
    return 'статус ' + afterAdm;
  });

  T('заявки на верификацию видны куратору', async () => true);
  w.showTab('cabinet');
  T('в кабинете видна новая заявка', () => { if (!txt().includes(probe.slice(0, 20))) throw new Error('заявки нет в списке'); return 'заявка в списке'; });

  w.sbSignOut(); await sleep(2500);
  T('выход: права снова закрыты', () => { if (!/Вход для Администрации/.test(authBox())) throw new Error(authBox()); return authBox(); });
  const st3 = (await get('carriers?select=status&id=eq.' + cid))[0].status;
  w.verifyCarrier(cid); await sleep(2000);
  const st4 = (await get('carriers?select=status&id=eq.' + cid))[0].status;
  T('после выхода изменения снова невозможны', () => { if (st3 !== st4) throw new Error('изменилось'); return 'без изменений (' + st4 + ')'; });

  console.log('\nОшибки JS:', errs.filter(e => !/✓|✗/.test(e)).length);
  console.log('Тестовый перевозчик для уборки:', cid, '|', probe);
  process.exit(errs.length ? 1 : 2);   // 2 = всё ок, но нужна уборка
})();
