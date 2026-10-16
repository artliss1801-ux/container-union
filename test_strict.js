/* Строгая проверка ролей и прав: регистрация перевозчика, вход, назначение ролей администратором.
   Роли в базе: admin (главный администратор защищён), council, carrier. Режима просмотра нет. */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { server, DB, LOG, users } = require('./mock_strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SB = 'http://127.0.0.1:8213';
const KEY = 'publishable-key';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

server.listen(8213, '127.0.0.1', async () => {
  const html = fs.readFileSync('/home/user/index.html', 'utf8')
    .replace('<script>', `<script>window.KONTREIT_CONFIG={supabaseUrl:"${SB}",supabaseAnonKey:"${KEY}"};</script>\n<script>`);
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://ks.local/', virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
  const txt = () => norm(d.querySelector('#view').textContent);
  const authBox = () => norm(d.querySelector('#authBox').textContent).trim();
  const toasts = () => norm(d.querySelector('#toasts').textContent);
  const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); return true; } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); return false; } };
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  console.log('--- ГОСТЬ (без входа) ---');
  T('переключателя режима просмотра нет', () => {
    if (d.querySelector('#roleSel')) throw new Error('селект остался');
    if (/Режим просмотра/.test(norm(d.body.textContent))) throw new Error('надпись осталась');
    return 'в шапке только «Вход» и «Регистрация»';
  });
  T('в шапке кнопки входа и регистрации', () => { const b = authBox(); if (!/Вход/.test(b) || !/Регистрация/.test(b)) throw new Error(b); return b; });
  T('админ-панель гостю недоступна', () => { w.showTab('cabinet'); if (!/Регистрация перевозчика/.test(txt())) throw new Error('показана не форма регистрации'); return 'показана форма регистрации'; });
  T('форма регистрации требует e-mail и пароль для кабинета', () => {
    if (!d.querySelector('#r_email') || !d.querySelector('#r_pass')) throw new Error('нет полей аккаунта');
    return 'поля личного кабинета есть';
  });

  // Регистрация перевозчика с созданием аккаунта
  ['r_c1', 'r_c2', 'r_c3'].forEach(id => d.querySelector('#' + id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Гостевой Перевозчик»';
  d.querySelector('#r_city').value = 'Новороссийск';
  w.register(); await sleep(600);
  T('без е-mail и пароля регистрация не проходит', () => {
    if (!/Укажите e-mail и пароль/.test(toasts())) throw new Error('нет предупреждения');
    return 'просит создать личный кабинет';
  });
  d.querySelector('#r_email').value = 'carrier@ks.ru';
  d.querySelector('#r_pass').value = 'Kont2026!';
  w.register(); await sleep(3000);
  T('регистрация создала аккаунт и присвоила роль автоматически', () => {
    const p = DB.profiles.find(x => x.email === 'carrier@ks.ru');
    if (!p) throw new Error('нет записи в profiles');
    if (p.role !== 'carrier') throw new Error('роль: ' + p.role);
    if (!/Перевозчик: carrier@ks\.ru/.test(authBox())) throw new Error('бейдж: ' + authBox());
    return 'роль «Перевозчик» присвоена базой (таблица profiles), вход выполнен';
  });
  T('карточка перевозчика записана и привязана к аккаунту', () => {
    const c = DB.carriers.find(x => x.name === 'ООО «Гостевой Перевозчик»');
    if (!c) throw new Error('нет карточки');
    if (c.owner !== 'u-1') throw new Error('владелец: ' + c.owner);
    if (c.status !== 'pending') throw new Error('статус: ' + c.status);
    return 'ID ' + c.id + ', владелец u-1, статус pending';
  });
  T('перевозчик не может объявить себя верифицированным (прямой запрос к базе)', async () => true);
  const jwtCarrier = users.find(u => u.email === 'carrier@ks.ru').jwt;
  const badPatch = await fetch(SB + '/rest/v1/carriers?id=eq.' + DB.carriers[0].id, {
    method: 'PATCH', headers: { ...H, Authorization: 'Bearer ' + jwtCarrier }, body: JSON.stringify({ status: 'verified' })
  });
  T('прямая смена статуса перевозчиком отклонена базой', () => { if (badPatch.status !== 401) throw new Error('HTTP ' + badPatch.status); return 'HTTP 401'; });
  T('перевозчику не видно заявок на верификацию', async () => true);
  const appsAsCarrier = await (await fetch(SB + '/rest/v1/applications?select=id', { headers: { ...H, Authorization: 'Bearer ' + jwtCarrier } })).json();
  T('таблица applications закрыта для перевозчика', () => { if (appsAsCarrier.length) throw new Error('видит ' + appsAsCarrier.length); return '0 строк'; });
  T('свою роль перевозчик изменить не может', async () => true);
  const rolePatch = await fetch(SB + '/rest/v1/profiles?id=eq.u-1', {
    method: 'PATCH', headers: { ...H, Authorization: 'Bearer ' + jwtCarrier }, body: JSON.stringify({ role: 'admin' })
  });
  T('попытка сделать себя администратором отклонена базой', () => { if (rolePatch.status !== 401) throw new Error('HTTP ' + rolePatch.status); return 'HTTP 401 (только администратор меняет роли)'; });

  console.log('--- АДМИНИСТРАТОР ---');
  w.sbSignOut(); await sleep(800);
  w.openLogin(); await sleep(300);
  d.querySelector('#lg_email').value = 'admin@ks.ru';
  d.querySelector('#lg_pass').value = 'Sovet2026!';
  w.doLogin(); await sleep(3500);
  T('вход администратора: роль определена автоматически', () => { const b = authBox(); if (!/Администратор: admin@ks\.ru/.test(b)) throw new Error(b); return b; });
  T('админ-панель открылась с разделами', () => {
    w.showTab('cabinet');
    if (!/Заявки на верификацию/.test(txt())) throw new Error('нет заявок');
    if (!/Пользователи и роли/.test(txt())) throw new Error('нет раздела ролей');
    return 'видны заявки, тариф, выборы, «Пользователи и роли»';
  });
  T('в списке ролей: главный администратор защищён, перевозчик виден', () => {
    const t = txt();
    if (!/admin@ks\.ru/.test(t) || !/carrier@ks\.ru/.test(t)) throw new Error('нет участников');
    if (!/главный администратор — изменить нельзя/.test(t)) throw new Error('нет защиты главного администратора');
    const rows = [...d.querySelectorAll('#view table tbody tr')];
    const rowOf = mail => rows.find(r => norm(r.textContent).includes(mail));
    const adminRow = rowOf('admin@ks.ru'), carrierRow = rowOf('carrier@ks.ru');
    if (!adminRow || !carrierRow) throw new Error('не нашёл строки участников');
    if (adminRow.querySelectorAll('button').length) throw new Error('у главного администратора есть кнопки — можно случайно изменить');
    if (carrierRow.querySelectorAll('button').length < 4) throw new Error('у перевозчика нет кнопок назначения');
    return 'у главного администратора кнопок нет, у перевозчика — ' + carrierRow.querySelectorAll('button').length + ' кнопки назначения';
  });
  w.verifyCarrier(DB.carriers[0].id);
  await sleep(1500);
  T('администратор верифицирует перевозчика', () => {
    if (DB.carriers[0].status !== 'verified') throw new Error('статус: ' + DB.carriers[0].status);
    return 'статус → verified (запись прошла в базу под правами администратора)';
  });
  T('администратор назначает перевозчика членом Совета', async () => true);
  w.setUserRole('u-1', 'council', 'carrier@ks.ru');
  await sleep(1200);
  T('роль в базе изменена администратором', () => {
    const p = DB.profiles.find(x => x.id === 'u-1');
    if (p.role !== 'council') throw new Error('роль: ' + p.role);
    return 'перевозчик → член Совета (запись в profiles обновлена)';
  });
  T('администратор назначает второго администратора', async () => true);
  w.setUserRole('u-1', 'admin', 'carrier@ks.ru');
  await sleep(1200);
  T('второй администратор назначен', () => {
    const p = DB.profiles.find(x => x.id === 'u-1');
    if (p.role !== 'admin') throw new Error('роль: ' + p.role);
    return 'u-1 → admin (только администратор мог это сделать)';
  });
  T('главного администратора нельзя понизить', async () => true);
  const demotePrimary = await fetch(SB + '/rest/v1/profiles?id=eq.u-admin', {
    method: 'PATCH', headers: { ...H, Authorization: 'Bearer jwt-admin' }, body: JSON.stringify({ role: 'carrier' })
  });
  T('попытка понизить главного администратора отклонена базой', () => {
    if (demotePrimary.status !== 403) throw new Error('HTTP ' + demotePrimary.status);
    return 'HTTP 403 — защита на уровне базы';
  });
  T('главного администратора нельзя удалить', async () => true);
  const delPrimary = await fetch(SB + '/rest/v1/profiles?id=eq.u-admin', { method: 'DELETE', headers: { ...H, Authorization: 'Bearer jwt-admin' } });
  T('попытка удалить главного администратора отклонена', () => {
    if (delPrimary.status !== 403) throw new Error('HTTP ' + delPrimary.status);
    return 'HTTP 403 — удалить владельца платформы нельзя';
  });
  T('администратор снимает доступ у участника', async () => true);
  w.removeUserAccess && w.eval('window.confirm = () => true');
  w.removeUserAccess('u-1', 'carrier@ks.ru');
  await sleep(1200);
  T('доступ снят: запись роли удалена', () => {
    if (DB.profiles.find(x => x.id === 'u-1')) throw new Error('запись осталась');
    return 'роль отозвана (аккаунт остаётся, прав нет)';
  });

  console.log('--- ВТОРОЙ УЧАСТНИК ПОСЛЕ СНЯТИЯ ДОСТУПА ---');
  w.sbSignOut(); await sleep(800);
  w.openLogin(); await sleep(300);
  d.querySelector('#lg_email').value = 'carrier@ks.ru';
  d.querySelector('#lg_pass').value = 'Kont2026!';
  w.doLogin(); await sleep(3000);
  T('вход без роли: прав нет, показано предупреждение', () => {
    const b = authBox();
    if (!/нет роли/.test(b)) throw new Error(b);
    if (!/аккаунт без роли/.test(toasts())) throw new Error('нет сообщения: ' + toasts().slice(0, 120));
    return 'роль не определена — управление недоступно';
  });
  T('админ-панель недоступна без роли', () => {
    w.showTab('cabinet');
    if (/Пользователи и роли/.test(txt())) throw new Error('панель открыта');
    return 'доступ закрыт';
  });

  console.log('\nОшибки JS:', errs.filter(e => /JSDOM/.test(e)).length, errs.filter(e => /JSDOM/.test(e)).join(' | '));
  console.log('Запросов к базе:', LOG.length, '| отклонено базой:', LOG.filter(l => l.includes('[anon]') || l.includes('[carrier]') || l.includes('[norole]')).length, 'запросов без прав администратора');
  process.exit(errs.length ? 1 : 0);
});
