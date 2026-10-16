/* ПОЛНЫЙ ЦИКЛ РОЛЕЙ на живой базе Supabase:
   регистрация перевозчика → роль присваивается сама → администратор назначает роли →
   защита главного администратора → снятие доступа → уборка. */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const SB = 'https://nciyhaghjqddkqzuimff.supabase.co';
const KEY = 'sb_publishable_vL0U2ble-aE4F5juUPNXpQ_raUy-eaR';
const REF = 'nciyhaghjqddkqzuimff';
/* Секреты НЕ хранятся в файле: передаются переменными окружения при запуске.
   SUPABASE_MGMT_TOKEN — токен управления проектом (только для уборки тестового аккаунта),
   ADMIN_EMAIL / ADMIN_PASSWORD — аккаунт администратора платформы. */
const MGMT = process.env.SUPABASE_MGMT_TOKEN || '';
const ADMIN = { email: process.env.ADMIN_EMAIL || '', pass: process.env.ADMIN_PASSWORD || '' };
const TEST = { email: 'test-perevozchik-' + Date.now() + '@example.com', pass: 'Kont2026!Test' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const T = (n, f) => Promise.resolve().then(f).then(r => console.log('✓', n, r ? '— ' + r : ''), e => { console.log('✗', n, '→', e.message); errs.push(n); });
const H = (jwt) => ({ apikey: KEY, Authorization: 'Bearer ' + (jwt || KEY), 'Content-Type': 'application/json' });

const rest = async (path, jwt) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H(jwt) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const restWrite = async (path, method, body, jwt) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { method, headers: { ...H(jwt), Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};

async function openSite() {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }
  return { w, d, norm: s => s.replace(/[\u00a0\u202f]/g, ' '), box: () => s => s };
}

(async () => {
  console.log('▸ Тестовый перевозчик:', TEST.email);

  /* ---------- 1. Регистрация перевозчика (роль присваивается сама) ---------- */
  const s1 = await openSite();
  const { w, d } = s1;
  const norm = x => String(x).replace(/[\u00a0\u202f]/g, ' ');
  const authBox = () => norm(d.querySelector('#authBox').textContent).trim();
  const toasts = () => norm(d.querySelector('#toasts').textContent);
  await T('гость: переключателя ролей нет, есть «Вход» и «Регистрация»', () => {
    if (d.querySelector('#roleSel')) throw new Error('селект остался');
    if (!/Вход/.test(authBox())) throw new Error(authBox());
    return authBox();
  });
  w.showTab('cabinet');
  ['r_c1', 'r_c2', 'r_c3'].forEach(id => d.querySelector('#' + id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Тест Ролей»';
  d.querySelector('#r_city').value = 'Новороссийск';
  d.querySelector('#r_email').value = TEST.email;
  d.querySelector('#r_pass').value = TEST.pass;
  w.register();
  await sleep(6000);
  await T('перевозчик зарегистрировался: аккаунт + роль автоматически', () => {
    if (!/Перевозчик: /.test(authBox())) throw new Error('бейдж: ' + authBox() + ' | тосты: ' + toasts().slice(0, 160));
    return authBox();
  });
  const prof1 = await rest('profiles?select=id,email,role&email=eq.' + encodeURIComponent(TEST.email));
  await T('в базе появилась роль «перевозчик»', () => {
    const p = (prof1.data || [])[0];
    if (!p) throw new Error('нет записи в profiles');
    if (p.role !== 'carrier') throw new Error('роль: ' + p.role);
    return 'profiles: ' + p.email + ' → ' + p.role + ' (присвоено триггером базы)';
  });
  const testUid = (prof1.data || [])[0] && prof1.data[0].id;
  const card = await rest('carriers?select=id,status,owner,name&name=eq.' + encodeURIComponent('ООО «Тест Ролей»'));
  await T('карточка перевозчика создана и привязана к аккаунту', () => {
    const c = (card.data || [])[0];
    if (!c) throw new Error('нет карточки');
    if (c.owner !== testUid) throw new Error('владелец: ' + c.owner);
    if (c.status !== 'pending') throw new Error('статус: ' + c.status);
    return c.id + ' · статус ' + c.status + ' · владелец совпадает с аккаунтом';
  });
  const carrierId = (card.data || [])[0] && card.data[0].id;

  /* токен перевозчика */
  const cTok = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: TEST.email, password: TEST.pass }) })).json();
  const cJwt = cTok.access_token;
  await T('вход перевозчика работает и роль подтверждается базой', () => (cJwt ? 'токен получен' : (() => { throw new Error('нет токена'); })()));

  const selfVerify = await restWrite('carriers?id=eq.' + carrierId, 'PATCH', { status: 'verified' }, cJwt);
  await T('перевозчик не может верифицировать себя (база отклоняет)', () => {
    if (selfVerify.status !== 401 && selfVerify.status !== 403) throw new Error('HTTP ' + selfVerify.status + ' — правило не сработало');
    return 'HTTP ' + selfVerify.status;
  });
  const selfAdmin = await restWrite('profiles?id=eq.' + testUid, 'PATCH', { role: 'admin' }, cJwt);
  await T('перевозчик не может назначить себя администратором', () => {
    if (selfAdmin.status !== 401 && selfAdmin.status !== 403) throw new Error('HTTP ' + selfAdmin.status);
    return 'HTTP ' + selfAdmin.status;
  });
  const appsAsCarrier = await rest('applications?select=id', cJwt);
  await T('заявки участников перевозчику не видны', () => {
    if ((appsAsCarrier.data || []).length) throw new Error('видит ' + appsAsCarrier.data.length);
    return '0 строк';
  });

  /* ---------- 2. Администратор: назначение ролей ---------- */
  const aTok = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })).json();
  const aJwt = aTok.access_token;
  await T('вход администратора выполнен', () => (aJwt ? 'токен администратора получен' : (() => { throw new Error('нет токена'); })()));

  const s2 = await openSite();
  const w2 = s2.w, d2 = s2.d;
  const authBox2 = () => norm(d2.querySelector('#authBox').textContent).trim();
  w2.openLogin(); await sleep(400);
  d2.querySelector('#lg_email').value = ADMIN.email;
  d2.querySelector('#lg_pass').value = ADMIN.pass;
  w2.doLogin(); await sleep(6000);
  await T('администратор вошёл: роль определена автоматически', () => {
    if (!/Администратор: /.test(authBox2())) throw new Error(authBox2());
    return authBox2();
  });
  await T('в кабинете — раздел «Пользователи и роли» со списком участников', () => {
    w2.showTab('cabinet');
    const t = norm(d2.querySelector('#view').textContent);
    if (!/Пользователи и роли/.test(t)) throw new Error('нет раздела');
    if (!t.includes(TEST.email)) throw new Error('нет тестового перевозчика в списке');
    return 'виден перевозчик и главный администратор';
  });
  await T('главный администратор защищён в интерфейсе', () => {
    const rows = [...d2.querySelectorAll('#view table tbody tr')];
    const adminRow = rows.find(r => norm(r.textContent).includes(ADMIN.email));
    if (!adminRow) throw new Error('нет строки администратора');
    if (adminRow.querySelectorAll('button').length) throw new Error('есть кнопки управления');
    return 'кнопок нет — изменить владельца нельзя';
  });

  await T('администратор назначает перевозчика членом Совета', async () => {
    w2.setUserRole(testUid, 'council', TEST.email);
    await sleep(2500);
    const p = await rest('profiles?select=role&id=eq.' + testUid);
    const role = (p.data || [])[0] && p.data[0].role;
    if (role !== 'council') throw new Error('роль: ' + role);
    return 'profiles.role → council';
  });
  await T('администратор назначает второго администратора', async () => {
    w2.setUserRole(testUid, 'admin', TEST.email);
    await sleep(2500);
    const p = await rest('profiles?select=role&id=eq.' + testUid);
    const role = (p.data || [])[0] && p.data[0].role;
    if (role !== 'admin') throw new Error('роль: ' + role);
    return 'profiles.role → admin (назначить может только администратор)';
  });
  await T('второй администратор вошёл и получил права', async () => {
    const t2 = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: TEST.email, password: TEST.pass }) })).json();
    const jwt2 = t2.access_token;
    const apps = await rest('applications?select=id', jwt2);
    if (apps.status !== 200) throw new Error('HTTP ' + apps.status);
    return 'видит заявки (права администратора), строк: ' + (apps.data || []).length;
  });
  await T('владелец платформы по-прежнему главный (защита от понижения)', async () => {
    const me = await rest('profiles?select=id,is_primary&email=eq.' + encodeURIComponent(ADMIN.email));
    const row = (me.data || [])[0];
    const patch = await restWrite('profiles?id=eq.' + row.id, 'PATCH', { role: 'carrier' }, aJwt);
    if (patch.status !== 403) throw new Error('HTTP ' + patch.status + ' — база позволила понизить владельца!');
    return 'HTTP 403 — понизить главного администратора нельзя даже администратору';
  });
  await T('снятие доступа: роль отозвана', async () => {
    const del = await fetch(`${SB}/rest/v1/profiles?id=eq.${testUid}`, { method: 'DELETE', headers: H(aJwt) });
    if (del.status !== 204 && del.status !== 200) throw new Error('HTTP ' + del.status);
    const p = await rest('profiles?select=role&id=eq.' + testUid);
    if ((p.data || []).length) throw new Error('запись осталась');
    return 'запись роли удалена — у участника больше нет прав';
  });

  /* ---------- 3. Уборка ---------- */
  console.log('\n▸ Уборка тестовых данных…');
  if (carrierId) await fetch(`${SB}/rest/v1/carriers?id=eq.${carrierId}`, { method: 'DELETE', headers: H(aJwt) });
  await fetch(`${SB}/rest/v1/applications?name=eq.` + encodeURIComponent('ООО «Тест Ролей»'), { method: 'DELETE', headers: H(aJwt) });
  await fetch(`${SB}/rest/v1/journal?text=like.*Тест Ролей*`, { method: 'DELETE', headers: H(aJwt) });
  if (testUid) {
    const del = await fetch(`https://api.supabase.com/v1/projects/${REF}/auth/admin/users/${testUid}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + MGMT } });
    console.log('  аккаунт удалён из Supabase Auth:', del.status === 200 || del.status === 204 ? 'да' : 'HTTP ' + del.status);
  }
  const left = await rest('profiles?select=email,role,is_primary');
  console.log('  роли в базе после уборки:', JSON.stringify(left.data));
  console.log('\nОшибки JS:', errs.filter(e => /JSDOM/.test(e)).length);
  process.exit(errs.length ? 1 : 0);
})();
