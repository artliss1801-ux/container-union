/* Проверка интерфейса: логотип-контейнеровоз (один, в шапке) и меню-панель слева */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('/home/user/index.html', 'utf8');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://ks.local/', virtualConsole: vc });
const w = dom.window, d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
const txt = sel => norm((d.querySelector(sel) || {}).textContent || '');
const T = (n, f) => Promise.resolve().then(f).then(r => console.log('✓', n, r ? '— ' + r : ''), e => { console.log('✗', n, '→', e.message); errs.push(n); });

(async () => {
  await sleep(300);
  await T('логотип только один — в шапке', () => {
    const logos = d.querySelectorAll('.ks-logo');
    if (logos.length !== 1) throw new Error('логотипов на странице: ' + logos.length);
    if (!d.querySelector('#ksLogo')) throw new Error('это не логотип в шапке');
    if (d.querySelector('#view').querySelector('.ks-logo')) throw new Error('логотип остался в содержимом');
    if (String(d.querySelector('footer').innerHTML).includes('ks-logo')) throw new Error('логотип остался в футере');
    return 'одно место — шапка; в содержимом и футере нет';
  });
  await T('логотип собран как контейнеровоз', () => {
    const box = d.querySelector('#ksLogo');
    if (!box.querySelector('.ks-ship') || !box.querySelector('.ks-hull') || !box.querySelector('.ks-sea')) throw new Error('нет корпуса/волн');
    const words = [...box.querySelectorAll('.ks-word')].map(x => x.textContent.trim());
    if (words[0] !== 'онтейнерный' || words[1] !== 'оюз') throw new Error(words.join(' | '));
    const idx = [...box.querySelectorAll('.ks-word i')].map(x => Number(x.style.getPropertyValue('--i')));
    if (idx.length !== 14) throw new Error('букв: ' + idx.length);
    if (Math.max(...idx) !== 13) throw new Error('порядок разворота: ' + idx.join(','));
    return 'К + онтейнерный = Контейнерный, С + оюз = Союз; буквы появляются по порядку 0…13';
  });
  await T('разворот читается: буквы не наезжают друг на друга', () => {
    const css = html;
    if (!/\.ks-logo:hover \.ks-word i,\.ks-logo\.open \.ks-word i\{max-width:1\.05em/.test(css)) throw new Error('нет общего предела ширины буквы — возможны наезды');
    if (!/\.ks-logo:hover \.ks-box:before,\.ks-logo\.open \.ks-box:before\{opacity:0\}/.test(css)) throw new Error('контейнеры не растворяются при развороте');
    if (!/\.ks-logo:hover \.ks-box,\.ks-logo\.open \.ks-box\{color:#ffd9a6\}/.test(css)) throw new Error('буквы К и С не переходят в общий цвет слова');
    return 'единый предел ширины букв, контейнеры растворяются — слово читается как «Контейнерный Союз»';
  });
  await T('разворот: К и С прижаты к слову — читаются как цельные слова', () => {
    const css = html;
    if (!/\.ks-box\{[^}]*padding:0 7px/.test(css)) throw new Error('плитка буквы снова фиксированной ширины — будет зазор');
    if (!/\.ks-logo:hover \.ks-box,\.ks-logo\.open \.ks-box\{padding:0\}/.test(css)) throw new Error('при развороте плитка не сжимается по букве');
    if (!/\.ks-box-b\{margin-left:4px\}/.test(css)) throw new Error('нет межсловного интервала перед «С»');
    const box = d.querySelector('#ksLogo');
    const first = box.querySelector('.ks-box'), second = box.querySelector('.ks-box-b');
    if (!first || !second) throw new Error('плитки К и С не найдены');
    if (second.textContent.trim() !== 'С' && first.textContent.trim() !== 'К') throw new Error('в плитках не К и С');
    const w2 = w.getComputedStyle(second).marginLeft;
    if (!/4px/.test(w2)) throw new Error('у «С» нет отступа от первого слова: ' + w2);
    const before = w.getComputedStyle(first).padding;
    box.classList.add('open');
    const after = w.getComputedStyle(first).padding;
    box.classList.remove('open');
    if (!/0px/.test(after)) throw new Error('в развороте остаётся поле вокруг буквы: ' + after);
    if (before === after) throw new Error('поле вокруг буквы не меняется: ' + before);
    return 'К + онтейнерный и С + оюз смыкаются вплотную, между словами — обычный интервал (' + before.trim() + ' → 0)';
  });
  await T('клик по логотипу разворачивает название (для телефона)', () => {
    const box = d.querySelector('#ksLogo');
    box.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!box.classList.contains('open')) throw new Error('класс open не поставлен');
    box.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (box.classList.contains('open')) throw new Error('повторный клик не свернул');
    return 'разворот/сворот работает';
  });
  await T('верхней строки вкладок больше нет', () => {
    if (d.querySelector('.tabs-in') && !d.querySelector('.tabs-in').closest('.drawer')) throw new Error('осталась строка вкладок');
    if (d.querySelector('#tabs')) throw new Error('остался контейнер вкладок');
    if (html.includes('overflow-x:auto;max-width:1240px')) throw new Error('осталось правило горизонтальной прокрутки меню');
    return 'разделы убраны с верха страницы';
  });
  await T('кнопка-тулбар открывает меню слева', () => {
    const btn = d.querySelector('#menuBtn');
    if (!btn) throw new Error('нет кнопки меню');
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const dr = d.querySelector('#drawer');
    if (!dr.classList.contains('open')) throw new Error('меню не открылось');
    if (!d.querySelector('#drawerBg').classList.contains('open')) throw new Error('нет затемнения фона');
    if (w.getComputedStyle(dr).position !== 'fixed') throw new Error('меню не плавающее: ' + w.getComputedStyle(dr).position);
    return 'меню выехало, фон затемнён, панель поверх страницы';
  });
  await T('в меню все разделы с описанием и значками', () => {
    const items = d.querySelectorAll('#menuList .nav-item');
    if (items.length !== 7) throw new Error('разделов в меню: ' + items.length);
    const names = [...items].map(x => x.querySelector('.tx').childNodes[0].textContent.trim());
    const need = ['О платформе', 'Калькулятор ставки', 'Перевозчики и рейтинг', 'Грузы', 'Совет перевозчиков', 'Документы платформы', 'Кабинет'];
    const missing = need.filter(x => !names.includes(x));
    if (missing.length) throw new Error('нет разделов: ' + missing.join(', '));
    if (![...items].every(x => x.querySelector('.ds'))) throw new Error('нет пояснений');
    if (![...items].every(x => x.querySelector('.ic'))) throw new Error('нет значков');
    return names.join(' · ');
  });
  await T('название текущего раздела видно на самой кнопке', () => {
    w.showTab('loads'); w.openMenu();
    const lbl = txt('#menuBtnLabel');
    if (lbl !== 'Грузы') throw new Error('на кнопке: ' + lbl);
    const active = txt('#menuList .nav-item.active .tx').split('\n')[0];
    if (!/Грузы/.test(active)) throw new Error('активный раздел: ' + active);
    return 'на кнопке: «' + lbl + '», в меню подсвечен раздел «' + active + '»';
  });
  await T('выбор раздела закрывает меню и открывает раздел', () => {
    w.showTab('calc');
    if (d.querySelector('#drawer').classList.contains('open')) throw new Error('меню осталось открытым');
    if (w.eval('TAB') !== 'calc') throw new Error('раздел не переключился');
    return 'меню закрылось, открылся «Калькулятор»';
  });
  await T('Esc закрывает меню, кнопка ✕ тоже', () => {
    w.openMenu();
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (d.querySelector('#drawer').classList.contains('open')) throw new Error('Esc не сработал');
    w.openMenu(); w.closeMenu();
    if (d.querySelector('#drawer').classList.contains('open')) throw new Error('✕ не сработал');
    return 'оба способа работают';
  });
  await T('меню не прокручивает страницу под собой', () => {
    w.openMenu();
    const locked = d.body.style.overflow === 'hidden';
    w.closeMenu();
    const free = d.body.style.overflow === '';
    if (!locked || !free) throw new Error('блокировка: ' + JSON.stringify([locked, free, d.body.style.overflow]));
    return 'прокрутка блокируется при открытом меню и возвращается после';
  });
  await T('пресеты плеч и авторасчёт работают', async () => {
    w.showTab('calc');
    w.calcPreset('Новороссийск', 'Москва');
    const m = txt('#calcOut').match(/([\d\s]{5,})₽/);
    if (!m) throw new Error('нет расчёта');
    const before = txt('#calcOut');
    const inp = d.querySelector('#c_km'); inp.value = 700;
    inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    await sleep(700);
    const after = txt('#calcOut');
    if (after === before) throw new Error('авторасчёт не сработал');
    return 'пресет дал ' + m[1].trim() + ' ₽, авторасчёт пересчитал при 700 км';
  });
  await T('поиск по реестру фильтрует таблицу', () => {
    w.showTab('carriers');
    w.carrierSearch('Новороссийск');
    const counter = txt('#cf_count');
    if (!/найдено/.test(counter)) throw new Error('счётчик: ' + counter);
    w.carrierSearch('');
    return counter;
  });
  await T('клавиши ← → переключают разделы', () => {
    w.showTab('about');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const a = w.eval('TAB');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const b = w.eval('TAB');
    if (a !== 'calc' || b !== 'about') throw new Error(a + '/' + b);
    return 'вправо → ' + a + ', влево → ' + b;
  });
  await T('шапка не меняет высоту при прокрутке (нет тряски)', () => {
    if (/scrolled/.test(html)) throw new Error('остались правила, менявшие шапку при прокрутке');
    if (/body\.scrolled|classList\.toggle\('scrolled'/.test(html)) throw new Error('класс scrolled ещё ставится');
    const topIn = d.querySelector('.top-in');
    const h0 = topIn.getBoundingClientRect ? JSON.stringify(topIn.getBoundingClientRect()) : 'нет макета';
    d.dispatchEvent(new w.Event('scroll'));
    const after = topIn.getBoundingClientRect ? JSON.stringify(topIn.getBoundingClientRect()) : h0;
    if (h0 !== after) throw new Error('размеры шапки изменились при прокрутке');
    const st = w.getComputedStyle(topIn);
    return 'высота шапки постоянна (padding ' + st.paddingTop + '), порог прокрутки ничего не переключает';
  });
  await T('рядом с логотипом нет текста', () => {
    if (d.querySelector('.logo-title')) throw new Error('блок с названием остался');
    const top = norm(d.querySelector('.top-in').textContent).replace(/\s+/g, ' ').trim();
    if (/Открытая платформа/.test(top)) throw new Error('описание осталось в шапке: ' + top);
    const logoScreenReader = norm(d.querySelector('#ksLogo').textContent);
    if (!/Контейнерный Союз/.test(logoScreenReader)) throw new Error('логотип не читается программами для слепых');
    return 'в шапке только кнопка меню и логотип; название читается с экрана как «Контейнерный Союз»';
  });
  await T('точки маршрута: расходы и время показаны без полей ввода', () => {
    w.showTab('calc');
    if (d.querySelectorAll('#routePoints input[inputmode="decimal"]').length) throw new Error('есть числовые поля');
    const rows = Array.from(d.querySelectorAll('#routePoints .route-row')).map(x => norm(x.textContent));
    if (!rows[0].includes('2 ч') || !rows[rows.length - 1].includes('2 ч')) throw new Error('нет авто-значений погрузки/выгрузки: ' + rows.join(' || '));
    if (!d.querySelector('#routePoints .pt-auto')) throw new Error('нет подписи авто-значений');
    return 'в строке: вид точки · населённый пункт · что точка добавляет к ставке';
  });
  await T('строка показателей: статичная и только актуальные цифры', () => {
    const strip = d.querySelector('#indicIn');
    if (!strip) throw new Error('нет строки показателей');
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('') + (w.getComputedStyle ? w.getComputedStyle(strip).cssText : '');
    if (/marquee/i.test(css)) throw new Error('осталась анимация бегущей строки');
    const st = w.getComputedStyle(strip);
    if (st.animationName && st.animationName !== 'none') throw new Error('строка анимируется: ' + st.animationName);
    const t2 = norm(strip.textContent);
    ['ДТ', '«Платон»', 'Рыночный ориентир', 'USD'].forEach(x => { if (!t2.includes(x)) throw new Error('нет показателя ' + x); });
    /* в строке не должно быть событий платформы и подсказок */
    [/Реестр:/, /Биржа:/, /Подсказка/, /Логотип/, /Переходный период/].forEach(rx => {
      if (rx.test(t2)) throw new Error('в строке лишнее: ' + rx);
    });
    return t2.replace(/\s+/g, ' ').trim().slice(0, 120);
  });
  console.log('\nПровалов:', errs.length);
  process.exit(errs.length ? 1 : 0);
})();
