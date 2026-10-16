/* Проверка нового дизайна на ОПУБЛИКОВАННОМ сайте (с настоящей базой) */
const { JSDOM, VirtualConsole } = require('jsdom');
const SITE = 'https://artliss1801-ux.github.io/container-union/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const T = (n, f) => Promise.resolve().then(f).then(r => console.log('✓', n, r ? '— ' + r : ''), e => { console.log('✗', n, '→', e.message); errs.push(n); });
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
  const txt = sel => norm((d.querySelector(sel) || {}).textContent || '').trim();
  for (let i = 0; i < 40; i++) { await sleep(500); if (w.eval('SB_STATE') === 'ok') break; }

  await T('сайт на связи с базой', () => txt('#storeTag'));
  await T('логотип-контейнеровоз в шапке', () => {
    const box = d.querySelector('#ksLogo');
    if (!box.querySelector('.ks-hull') || !box.querySelector('.ks-sea')) throw new Error('нет корпуса/волн');
    const words = [...box.querySelectorAll('.ks-word')].map(x => x.textContent.trim());
    if (words[0] !== 'онтейнерный' || words[1] !== 'оюз') throw new Error(words.join(' | '));
    return 'К + ' + words[0] + ' = Контейнерный, С + ' + words[1] + ' = Союз';
  });
  await T('лента событий показывает живые данные базы', () => {
    const t = txt('#tickerIn');
    if (!/86,72|86.72/.test(t)) throw new Error('нет цены ДТ из базы: ' + t.slice(0, 90));
    if (!/3,53|3.53/.test(t)) throw new Error('нет «Платона»');
    return t.slice(0, 120) + '…';
  });
  await T('пресеты и авторасчёт работают на живом тарифе', async () => {
    w.showTab('calc'); await sleep(200);
    w.calcPreset('Новороссийск', 'Москва'); await sleep(400);
    const out = txt('#calcOut');
    const m = out.match(/([\d\s]{5,})₽/);
    if (!m) throw new Error('нет расчёта');
    return d.querySelector('#c_km').value + ' км → ' + m[1].trim() + ' ₽ (сетка из базы)';
  });
  await T('в реестре — понятная заглушка и нет бегунка', () => {
    w.showTab('carriers');
    const st = w.getComputedStyle(d.querySelector('.tabs-in'));
    if (st.overflowX === 'auto' || st.overflowX === 'scroll') throw new Error('бегунок остался');
    const t = txt('#view');
    return /В реестре пока нет перевозчиков/.test(t) ? 'реестр пуст — приглашение зарегистрироваться, перенос вкладок вместо прокрутки' : 'в реестре есть записи';
  });
  await T('клавиши ← → переключают вкладки', () => {
    w.showTab('about');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const a = w.eval('TAB');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const b = w.eval('TAB');
    if (a !== 'calc' || b !== 'about') throw new Error(a + '/' + b);
    return 'вправо → ' + a + ', влево → ' + b;
  });
  console.log('\nОшибки JS:', errs.length);
  process.exit(errs.length ? 1 : 0);
})();
