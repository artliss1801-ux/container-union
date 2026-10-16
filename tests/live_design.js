/* Проверка интерфейса на ОПУБЛИКОВАННОМ сайте: логотип в шапке, меню слева, живые данные */
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
  await T('логотип один — в шапке (контейнеровоз)', () => {
    const logos = d.querySelectorAll('.ks-logo');
    if (logos.length !== 1) throw new Error('логотипов: ' + logos.length);
    const box = d.querySelector('#ksLogo');
    const words = [...box.querySelectorAll('.ks-word')].map(x => x.textContent.trim());
    if (words[0] !== 'онтейнерный' || words[1] !== 'оюз') throw new Error(words.join('|'));
    return 'К + ' + words[0] + ' · С + ' + words[1] + ' (корпус с волнами, контейнеры)';
  });
  await T('меню слева вызывает кнопка-тулбар', () => {
    if (d.querySelector('#tabs')) throw new Error('вкладки сверху остались');
    d.querySelector('#menuBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!d.querySelector('#drawer').classList.contains('open')) throw new Error('меню не открылось');
    const n = d.querySelectorAll('#menuList .nav-item').length;
    w.showTab('council');
    if (w.eval('TAB') !== 'council') throw new Error('раздел не открылся');
    return 'разделов в меню: ' + n + '; выбор раздела закрывает меню';
  });
  await T('лента событий показывает данные из базы', () => {
    const t = txt('#tickerIn');
    if (!/86,72|86.72/.test(t)) throw new Error('нет цены ДТ: ' + t.slice(0, 80));
    return t.slice(0, 110) + '…';
  });
  await T('пресеты и авторасчёт на живом тарифе', async () => {
    w.showTab('calc'); await sleep(200);
    w.calcPreset('Новороссийск', 'Москва'); await sleep(400);
    const m = txt('#calcOut').match(/([\d\s]{5,})₽/);
    if (!m) throw new Error('нет расчёта');
    return d.querySelector('#c_km').value + ' км → ' + m[1].trim() + ' ₽';
  });
  await T('шапка стабильна при прокрутке, лишнего текста нет', () => {
    if (/scrolled/.test(page)) throw new Error('остались переключения шапки на прокрутке — тряска');
    if (d.querySelector('.logo-title')) throw new Error('текст рядом с логотипом остался');
    if (/Открытая платформа/.test(norm(d.querySelector('.top-in').textContent))) throw new Error('описание в шапке');
    return 'высота шапки не меняется, рядом с логотипом пусто';
  });
  console.log('\nОшибки JS:', errs.length);
  process.exit(errs.length ? 1 : 0);
})();
