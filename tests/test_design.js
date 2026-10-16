/* Проверка «живого интерфейса»: логотип, лента, пресеты, поиск, клавиши, свайп */
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
  await T('логотип-контейнеровоз собран', () => {
    const logos = d.querySelectorAll('.ks-logo');
    if (logos.length < 3) throw new Error('логотипов: ' + logos.length);
    const ship = logos[0].querySelector('.ks-ship');
    if (!ship) throw new Error('нет корпуса судна');
    if (!ship.querySelector('.ks-bridge')) throw new Error('нет надстройки');
    if (!logos[0].querySelector('.ks-hull')) throw new Error('нет корпуса');
    if (!logos[0].querySelector('.ks-sea')) throw new Error('нет волн');
    const letters = logos[0].querySelectorAll('.ks-word i');
    if (letters.length !== 14) throw new Error('букв разворота: ' + letters.length);
    return 'логотипов: ' + logos.length + ', букв разворота: 14 (онтейнерный + оюз), волны и корпус на месте';
  });
  await T('из К собирается «Контейнерный», из С — «Союз»', () => {
    const box = d.querySelectorAll('.ks-logo')[0];
    const boxes = [...box.querySelectorAll('.ks-box')].map(x => x.textContent.trim());
    if (boxes[0] !== 'К' || boxes[1] !== 'С') throw new Error('буквы: ' + boxes.join(''));
    const words = [...box.querySelectorAll('.ks-word')].map(x => x.textContent.trim());
    if (words[0] !== 'онтейнерный') throw new Error('первое слово: ' + words[0]);
    if (words[1] !== 'оюз') throw new Error('второе слово: ' + words[1]);
    return 'К + ' + words[0] + ' = Контейнерный · С + ' + words[1] + ' = Союз';
  });
  await T('клик по логотипу разворачивает название (для телефона)', () => {
    const box = d.querySelectorAll('.ks-logo')[0];
    box.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (!box.classList.contains('open')) throw new Error('класс open не поставлен');
    box.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (box.classList.contains('open')) throw new Error('повторный клик не свернул');
    return 'разворот/сворот работает';
  });
  await T('лента событий платформы заполнена', () => {
    const items = d.querySelectorAll('#tickerIn span');
    if (items.length < 10) throw new Error('элементов: ' + items.length);
    const t = txt('#tickerIn');
    if (!/Тарифная сетка/.test(t)) throw new Error('нет тарифа');
    if (!/Реестр/.test(t)) throw new Error('нет реестра');
    if (!/Подсказка/.test(t)) throw new Error('нет подсказки');
    return items.length + ' сообщений, дублированы для бесконечной прокрутки';
  });
  await T('пресеты плеч считают ставку в один клик', async () => {
    w.showTab('calc');
    w.calcPreset('Новороссийск', 'Москва');
    const km = d.querySelector('#c_km').value;
    const out = txt('#calcOut');
    const m = out.match(/([\d\s]{5,})₽/);
    if (!m) throw new Error('нет расчёта: ' + out.slice(0, 80));
    return 'плечо подставлено, ' + km + ' км → ' + m[1].trim() + ' ₽';
  });
  await T('ставка пересчитывается сама при изменении поля', async () => {
    const before = txt('#calcOut');
    const inp = d.querySelector('#c_km');
    inp.value = 500;
    inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    await sleep(700);
    const after = txt('#calcOut');
    if (after === before) throw new Error('результат не обновился');
    const m1 = before.match(/([\d\s]{5,})₽/), m2 = after.match(/([\d\s]{5,})₽/);
    return 'при 500 км вместо ' + (m1 ? m1[1].trim() : '?') + ' ₽ → ' + (m2 ? m2[1].trim() : '?') + ' ₽ (без нажатия кнопки)';
  });
  await T('поиск по реестру фильтрует таблицу', () => {
    w.showTab('carriers');
    const rows = d.querySelectorAll('#carrierRows tr[data-s]');
    if (!rows.length) throw new Error('строк нет');
    w.carrierSearch('Новороссийск');
    const visible = [...rows].filter(r => r.style.display !== 'none').length;
    const counter = txt('#cf_count');
    if (!/найдено/.test(counter)) throw new Error('счётчик: ' + counter);
    w.carrierSearch('');
    const all = [...d.querySelectorAll('#carrierRows tr[data-s]')].filter(r => r.style.display !== 'none').length;
    return 'всего ' + rows.length + ', по «Новороссийск» — ' + visible + ', сброс — ' + all + ' (' + counter + ')';
  });
  await T('клавиши ← и → переключают вкладки', () => {
    w.showTab('about');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const t1 = w.eval('TAB');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const t2 = w.eval('TAB');
    if (t1 !== 'calc' || t2 !== 'about') throw new Error('переходы: ' + t1 + ' / ' + t2);
    return 'вправо → ' + t1 + ', влево → ' + t2;
  });
  await T('ввод в поле не переключает вкладки (стрелки для курсора)', () => {
    w.showTab('calc');
    const inp = d.querySelector('#c_km');
    inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    if (w.eval('TAB') !== 'calc') throw new Error('вкладка уехала');
    return 'фокус в поле — вкладка не меняется';
  });
  await T('вкладки без горизонтальной прокрутки', () => {
    const st = w.getComputedStyle(d.querySelector('.tabs-in'));
    if (st.overflowX === 'auto' || st.overflowX === 'scroll') throw new Error('осталась прокрутка: ' + st.overflowX);
    if (st.flexWrap !== 'wrap') throw new Error('нет переноса: ' + st.flexWrap);
    const labels = [...d.querySelectorAll('#tabs button .lt')].map(x => x.textContent);
    const short = [...d.querySelectorAll('#tabs button .st')].map(x => x.textContent);
    return 'перенос строк вместо бегунка; длинные: ' + labels.length + ', короткие: ' + short.join(' / ');
  });
  await T('копирование ссылки не роняет страницу', () => {
    w.copyLink('https://cont-union.ru', 'Адрес сайта скопирован');
    return 'обработчик сработал (в браузере — буфер обмена)';
  });
  await T('прогресс чтения и кнопка «наверх» на месте', () => {
    if (!d.querySelector('#progress')) throw new Error('нет полосы');
    if (!d.querySelector('#toTop')) throw new Error('нет кнопки');
    return 'есть';
  });
  await T('шапка и логотип в шапке на месте', () => {
    const b = norm(d.querySelector('#ksLogo').textContent);
    if (!/Контейнерный Союз/.test(b)) throw new Error('нет полного названия для чтения с экрана');
    return 'логотип читается как «Контейнерный Союз»';
  });
  const real = errs.filter(e => !/^ *(✓|✗)/.test(e) && !/pdf/.test(e));
  console.log('\nПровалов:', errs.length, real.length !== errs.length ? '| посторонние сообщения: ' + real.join(' | ') : '');
  process.exit(errs.length ? 1 : 0);
})();
