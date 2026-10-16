/* ПУБЛИЧНЫЙ ОСМОТР ЖИВОЙ ПЛОЩАДКИ: что видит участник без входа.
   Проверяет, что роль нигде не выбирается вручную, а площадка работает на живой базе. */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
const T = (n, f) => Promise.resolve().then(f).then(r => console.log('✓', n, r ? '— ' + r : ''), e => { console.log('✗', n, '→', e.message); fails.push(n); });
const norm = x => String(x).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const ts = Date.now();
  const page = await (await fetch(SITE + 'index.html?cb=' + ts)).text();
  const cfg = await (await fetch(SITE + 'config.js?cb=' + ts)).text();
  const url = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1], key = cfg.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
  const html = page.replace(/<script src="config\.js"><\/script>/, `<script>window.KONTREIT_CONFIG={supabaseUrl:"${url}",supabaseAnonKey:"${key}"};</script>`);
  const vc = new VirtualConsole();
  const jsErr = [];
  vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) jsErr.push(e.message); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: SITE, virtualConsole: vc, beforeParse(w) { w.fetch = (u, o) => fetch(u, o); } });
  const w = dom.window, d = w.document;
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  await T('площадка открывается и работает с живой базой', () => {
    const tag = norm(d.querySelector('#storeTag').textContent);
    if (w.eval('SB_STATE') !== 'ok') throw new Error('состояние базы: ' + w.eval('SB_STATE'));
    return tag + ' · тариф ' + w.eval('(DB.tariff&&DB.tariff.version)||"—"');
  });
  await T('режима просмотра нет ни в интерфейсе, ни в текстах', () => {
    const all = norm(d.body.textContent);
    if (/Режим просмотра/i.test(all)) throw new Error('текст «Режим просмотра» остался');
    if (d.querySelector('#roleSel')) throw new Error('переключатель ролей остался');
    return 'слово «режим просмотра» на странице отсутствует';
  });
  await T('в шапке — только вход и регистрация', () => {
    const box = norm(d.querySelector('#authBox').textContent);
    if (!/Вход/.test(box) || !/Регистрация/.test(box)) throw new Error(box);
    return box;
  });
  await T('кабинет у гостя — форма заявки с личным кабинетом (e-mail и пароль)', () => {
    w.showTab('cabinet');
    const box = norm(d.querySelector('#view').textContent);
    if (!d.querySelector('#r_email') || !d.querySelector('#r_pass')) throw new Error('нет полей e-mail/пароля');
    if (!/Перевозчик/.test(box)) throw new Error('нет пояснения про роль перевозчика');
    return 'форма заявки + пояснение: регистрация даёт роль «Перевозчик»';
  });
  await T('калькулятор считает по живому тарифу', () => {
    w.showTab('calc');
    w.calcPreset('Новороссийск', 'Москва');
    const out = norm(d.querySelector('#calcOut').textContent);
    const km = d.querySelector('#c_km') ? d.querySelector('#c_km').value : '—';
    if (!/₽/.test(out)) throw new Error('нет результата расчёта');
    return km + ' км → ' + out.slice(0, 60) + '…';
  });
  await T('реестр перевозчиков открывается', () => {
    w.showTab('carriers');
    const t = norm(d.querySelector('#view').textContent);
    if (!/Перевозчик/.test(t)) throw new Error('раздел не открылся');
    return /Реестр пуст|ожидает|заявку/i.test(t) ? 'раздел на месте, реестр пока пуст — приглашение подать заявку' : 'раздел на месте';
  });
  await T('строка показателей: статичная, только актуальные цифры', () => {
    const strip = d.querySelector('#indicIn');
    if (!strip) throw new Error('нет строки показателей');
    const st = w.getComputedStyle(strip);
    if (st.animationName && st.animationName !== 'none') throw new Error('строка анимируется: ' + st.animationName);
    const t = norm(strip.textContent);
    ['ДТ', '«Платон»', 'Рыночный ориентир', 'USD'].forEach(x => { if (!t.includes(x)) throw new Error('нет показателя ' + x); });
    [/Реестр:/, /Биржа:/, /Подсказка/].forEach(rx => { if (rx.test(t)) throw new Error('в строке лишнее: ' + rx); });
    return t.slice(0, 110) + '…';
  });
  await T('меню разделов выезжает по кнопке', () => {
    d.querySelector('#menuBtn').click();
    const open = d.querySelector('#drawer').classList.contains('open') || d.body.classList.contains('menu-open');
    if (!open) throw new Error('меню не открылось');
    d.querySelector('#menuBtn').click();
    return 'меню открывается и закрывается';
  });
  await T('гость не может верифицировать перевозчика', async () => {
    const before = JSON.stringify(await (await fetch(url + '/rest/v1/carriers?select=id,status', { headers: { apikey: key } })).json());
    w.eval("try{verifyCarrier('C-200')}catch(e){}");
    await sleep(1200);
    const after = JSON.stringify(await (await fetch(url + '/rest/v1/carriers?select=id,status', { headers: { apikey: key } })).json());
    if (before !== after) throw new Error('данные изменились!');
    return 'действий не прошло — карточки не изменились';
  });
  await T('нет ошибок JavaScript', () => { if (jsErr.length) throw new Error(jsErr.join(' | ')); return 'чисто'; });

  console.log('\nПровалов:', fails.length);
  process.exit(fails.length ? 1 : 0);
})();
