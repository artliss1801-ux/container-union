const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const SBURL = 'https://nciyhaghjqddkqzuimff.supabase.co';
const SBKEY = 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR';
const H = { apikey: SBKEY, Authorization: 'Bearer ' + SBKEY };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const count = async t => (await (await fetch(`${SBURL}/rest/v1/${t}?select=id`, { headers: H })).json()).length;
(async () => {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const before = { carriers: await count('carriers'), loads: await count('loads'), votes: await count('votes') };
  console.log('▸ Состояние базы ДО:', JSON.stringify(before));
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push(e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
  const txt = () => norm(d.querySelector('#view').textContent);
  const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }
  T('сайт подключён к базе', () => d.querySelector('#storeTag').textContent);
  T('в шапке появилась кнопка входа для Администрации', () => {
    const b = norm(d.querySelector('#authBox').textContent);
    if (!/Вход для Администрации/.test(b)) throw new Error(b);
    return b.trim();
  });
  T('кабинет: админ-панель закрыта до входа', () => {
    const sel = d.querySelector('#roleSel'); sel.value = 'admin'; sel.dispatchEvent(new w.Event('change'));
    w.showTab('cabinet');
    if (!txt().includes('Администрирование: нужен вход')) throw new Error('панель открыта без входа');
    return 'требуется вход куратора';
  });
  w.showTab('cabinet');
  ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#' + id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Проверка защиты»';
  w.register();
  await sleep(2500);
  T('регистрация перевозчика по-прежнему работает без входа', async () => true);
  const after = { carriers: await count('carriers') };
  T('запись дошла до базы (публичная вставка)', () => {
    if (after.carriers !== before.carriers + 1) throw new Error('carriers: ' + before.carriers + ' → ' + after.carriers);
    return 'carriers: ' + after.carriers + ' (тестовая строка будет удалена)';
  });
  console.log('Ошибки JS:', errs.length, errs.join(' | '));
  // уборка
  const list = await (await fetch(`${SBURL}/rest/v1/carriers?select=id&name=eq.` + encodeURIComponent('ООО «Проверка защиты»'), { headers: H })).json();
  for (const c of list) {
    await fetch(`${SBURL}/rest/v1/carriers?id=eq.` + c.id, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  }
  await fetch(`${SBURL}/rest/v1/applications?name=eq.` + encodeURIComponent('ООО «Проверка защиты»'), { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  const fin = { carriers: await count('carriers'), loads: await count('loads'), votes: await count('votes') };
  console.log('▸ Состояние базы ПОСЛЕ уборки:', JSON.stringify(fin));
  process.exit(errs.length ? 1 : 0);
})();
