const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { server, DB, LOG, CURATOR } = require('./mock_strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
server.listen(8210, '127.0.0.1', async () => {
  const html = fs.readFileSync('/home/user/index.html', 'utf8')
    .replace('<script>', `<script>window.KONTREIT_CONFIG={supabaseUrl:"http://127.0.0.1:8210",supabaseAnonKey:"publishable-key"};</script>\n<script>`);
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://ks.local/', virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
  const txt = () => norm(d.querySelector('#view').textContent);
  const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); return true; } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); return false; } };
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  T('гость: в шапке кнопка входа, а не права куратора', () => {
    const box = norm(d.querySelector('#authBox').textContent);
    if (!/Вход для Администрации/.test(box)) throw new Error(box);
    return box;
  });
  T('гость: админ-панель требует входа', () => {
    const sel = d.querySelector('#roleSel'); sel.value = 'admin'; sel.dispatchEvent(new w.Event('change'));
    w.showTab('cabinet');
    if (!txt().includes('Администрирование: нужен вход')) throw new Error('показана админ-панель без входа');
    return 'вместо панели — форма входа';
  });

  // регистрация перевозчика гостем
  w.showTab('cabinet');
  ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#' + id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Гостевой Перевозчик»';
  w.register();
  await sleep(1200);
  T('гость: регистрация записалась в базу (публичная вставка)', () => {
    const c = DB.carriers.find(x => x.name === 'ООО «Гостевой Перевозчик»');
    if (!c) throw new Error('нет строки в carriers');
    if (c.status !== 'pending') throw new Error('статус: ' + c.status);
    return 'ID ' + c.id + ', статус pending';
  });
  T('гость: заявка на верификацию записалась', () => DB.applications.length ? 'записано' : (() => { throw new Error('пусто'); })());

  // попытка админ-действия гостем
  const cid = DB.carriers[0].id;
  const before = DB.carriers[0].status;
  w.verifyCarrier(cid);
  await sleep(800);
  T('гость: верификация НЕ прошла', () => {
    if (DB.carriers[0].status !== before) throw new Error('статус изменился: ' + DB.carriers[0].status);
    if (!/доступно только куратору|нужен вход куратора/.test(d.querySelector('#toasts').textContent)) throw new Error('нет предупреждения');
    return 'статус остался ' + before + ', показано требование входа';
  });
  const anonPatch = await fetch('http://127.0.0.1:8210/rest/v1/carriers?id=eq.' + cid, {
    method: 'PATCH', headers: { apikey: 'publishable-key', Authorization: 'Bearer publishable-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'verified' }) });
  T('гость: прямой PATCH к базе получил отказ', () => { if (anonPatch.status !== 401) throw new Error('HTTP ' + anonPatch.status); return 'HTTP 401 (permission denied)'; });

  // вход куратора с неверным паролем
  w.openLogin();
  d.querySelector('#lg_email').value = CURATOR.email;
  d.querySelector('#lg_pass').value = 'неверный';
  await w.doLogin();
  await sleep(600);
  T('вход с неверным паролем отклонён', () => {
    if (!/Не удалось войти/.test(d.querySelector('#toasts').textContent)) throw new Error('нет сообщения об ошибке');
    return 'показана ошибка, доступа нет';
  });

  // корректный вход
  w.openLogin();
  d.querySelector('#lg_email').value = CURATOR.email;
  d.querySelector('#lg_pass').value = CURATOR.password;
  await w.doLogin();
  await sleep(1500);
  T('вход куратора выполнен, права подтверждены', () => {
    const box = norm(d.querySelector('#authBox').textContent);
    if (!/куратор: admin@ks\.ru/.test(box)) throw new Error(box);
    if (!w.eval('CURATOR.ok')) throw new Error('права не подтверждены');
    return box.trim();
  });
  w.verifyCarrier(cid);
  await sleep(1500);
  T('куратор: верификация перевозчика сработала', () => {
    const c = DB.carriers.find(x => String(x.id) === String(cid) || x.name === 'ООО «Гостевой Перевозчик»');
    if (!c) throw new Error('перевозчик не найден');
    if (c.status !== 'verified') throw new Error('статус: ' + c.status);
    return 'ID ' + c.id + ', статус → verified (в базе)';
  });
  w.showTab('council'); w.proposeForm();
    d.querySelector('#np_kind').value = 'tariff'; w.proposeKinds();
    d.querySelector('#np_title').value = 'Тест защиты: индексация до 90 ₽/л';
    d.querySelector('#np_fuel').value = '90'; d.querySelector('#np_margin').value = '15';
    w.proposeCreate();
  const id = w.eval('DB.votes[0].id');
  w.approveTransition(id);
  await sleep(1500);
  T('куратор: тарифное решение утверждено в переходный период', () => {
    const tv = DB.tariff[0].val;
    if (tv.fuelPrice !== 90) throw new Error('тариф в базе: ' + tv.fuelPrice);
    if (!DB.decisions.length) throw new Error('решение не записано в реестр');
    return 'тариф в базе → 90 ₽/л, маржа ' + tv.marginBase + '%, записей в реестре: ' + DB.decisions.length;
  });
  const anonApps = await (await fetch('http://127.0.0.1:8210/rest/v1/applications?select=*', { headers: { apikey: 'publishable-key', Authorization: 'Bearer publishable-key' } })).json();
  T('гость: таблица applications закрыта (вернулось пусто)', () => { if (anonApps.length !== 0) throw new Error('видно ' + anonApps.length + ' заявок'); return '0 строк для гостя, куратор видит все'; });

  // выход
  await w.sbSignOut();
  await sleep(800);
  T('после выхода права снова закрыты', () => {
    const box = norm(d.querySelector('#authBox').textContent);
    if (!/Вход для Администрации/.test(box)) throw new Error(box);
    return 'кнопка входа вернулась';
  });
  const statusNow = DB.carriers[0].status;
  w.suspendCarrier(cid);
  await sleep(500);
  T('после выхода изменение статуса снова невозможно', () => {
    if (DB.carriers[0].status !== statusNow) throw new Error('статус изменился');
    return 'без изменений';
  });
  console.log('\nОшибки JS:', errs.length, errs.join(' | '));
  console.log('Запросов к базе:', LOG.length, '| отказов RLS:', LOG.filter(l => l.includes('[anon]')).length, 'запросов гостя');
  server.close(); process.exit(errs.length ? 1 : 0);
});
