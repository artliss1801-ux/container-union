const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('/home/user/index.html', 'utf8');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) errs.push('JSDOM: ' + e.message); });
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://ks.local/', virtualConsole: vc });
const w = dom.window, d = w.document;
const norm = s => s.replace(/[\u00a0\u202f]/g, ' ');
const txt = () => norm(d.querySelector('#view').textContent);
const strip = () => norm(d.querySelector('#indicIn').textContent).replace(/\s+/g, ' ').trim();
const DB = () => JSON.parse(w.localStorage.getItem('ks_db') || '{}');
const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };

T('локальный режим: демо-данные и бейдж', () => { if (!/локальный/.test(d.querySelector('#storeTag').textContent)) throw new Error('бейдж'); if (!/локальный демо-режим/.test(norm(d.querySelector('#authBox').textContent))) throw new Error('блок входа'); return w.eval('DB.carriers.length') + ' перевозчиков'; });
T('все вкладки рисуются', () => { ['about','calc','carriers','loads','council','docs','cabinet'].forEach(t => w.showTab(t)); return 'ок'; });

T('роли: демо-вход определяет права (переключателя в шапке нет)', () => {
  if (d.querySelector('#roleSel')) throw new Error('переключатель ролей остался');
  w.demoEnter('council'); w.showTab('cabinet');
  if (!/Кабинет члена Совета|члена Совета/.test(txt())) throw new Error('нет кабинета Совета');
  w.demoEnter('admin'); w.showTab('cabinet');
  if (!txt().includes('Администрирование')) throw new Error('нет админ-панели');
  w.demoEnter('guest'); w.showTab('cabinet');
  if (!d.querySelector('#r_email') || !d.querySelector('#r_pass')) throw new Error('у гостя нет формы заявки с кабинетом');
  return 'член Совета · администратор · гость — права совпадают с ролью';
});
T('локальный режим: админ-функции доступны без входа', () => {
  w.demoEnter('admin'); w.showTab('cabinet');
  if (!txt().includes('Заявки на верификацию')) throw new Error('нет админ-панели');
  w.verifyCarrier('C-109');
  if (DB().carriers.find(c => c.id === 'C-109').status !== 'verified') throw new Error('верификация не сработала');
  return 'админ-панель работает (локальный режим без ограничений)';
});
T('рыночный ориентир меняет Администрация (переходный период)', () => {
  w.showTab('cabinet');
  const inp = d.querySelector('#ind_market'); if (!inp) throw new Error('нет поля ориентира');
  const before = w.eval('DB.tariff.val.marketPerKm');
  inp.value = '92,50';
  w.saveMarketBenchmark();
  const after = w.eval('DB.tariff.val.marketPerKm');
  if (after !== 92.5) throw new Error('ориентир: ' + after);
  if (!strip().includes('92,50')) throw new Error('строка показателей не обновилась: ' + strip());
  if (!DB().decisions.some(x => /Рыночный ориентир/.test(x.title))) throw new Error('нет записи в реестре решений');
  return before + ' → ' + after + ' ₽/км, решение в реестре';
});
T('курсы валют обновляет Администрация, строка показывает актуальные', () => {
  w.showTab('cabinet');
  d.querySelector('#ind_usd').value = '84,50';
  d.querySelector('#ind_cny').value = '12,60';
  d.querySelector('#ind_date').value = '2026-10-17';
  w.saveIndicators();
  const st = strip();
  if (!st.includes('84,50') || !st.includes('12,60')) throw new Error('строка: ' + st);
  if (!/17\.10\.2026/.test(st)) throw new Error('нет даты курса: ' + st);
  return st.slice(0, 110) + '…';
});
T('строка показателей статичная: без событий, реестра и подсказок', () => {
  const st = strip();
  if (/Реестр:|Биржа:|Подсказка|Логотип|Переходный период/.test(st)) throw new Error('в строке лишнее: ' + st);
  const cs = w.getComputedStyle(d.querySelector('#indicIn'));
  if (cs.animationName && cs.animationName !== 'none') throw new Error('строка анимируется');
  if (/marquee/i.test(html)) throw new Error('в стилях осталась бегущая строка');
  return 'только цифры: ДТ, «Платон», ориентир, курсы, версия сетки';
});
T('учебный режим: тариф не меняется', () => {
  const before = w.eval('DB.tariff.val.fuelPrice');
  w.showTab('council'); w.toggleDemoCouncil();
  ['M-3','M-5','M-6','M-7'].forEach(m => { w.setVoteAs(m); w.castVote('ТАР-2026-06','for'); });
  if (w.eval('DB.tariff.val.fuelPrice') !== before) throw new Error('тариф изменился');
  w.toggleDemoCouncil();
  return 'тариф ' + before + ' ₽/л не изменён';
});
T('переходный период и выборы работают', () => {
  w.eval(`const tmpl=DB.carriers.find(c=>c.demo);for(let i=0;i<50;i++){const c=JSON.parse(JSON.stringify(tmpl));c.id='C-4'+String(i).padStart(2,'0');c.demo=false;c.name='ООО «П'+i+'»';c.status='verified';DB.carriers.push(c);}save();render();`);
  w.showTab('council'); w.scheduleElections();
  if (!DB().settings.elections) throw new Error('выборы не назначены');
  w.publishCouncil();
  if (DB().members.length !== 9) throw new Error('состав: ' + DB().members.length);
  return 'выборы назначены, состав из 9 избран';
});
T('регистрация перевозчика в локальном режиме (гость)', () => {
  w.resetDemo();
  w.demoEnter('guest'); w.showTab('cabinet');
  ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#'+id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Локальный Тест»';
  w.register();
  if (!DB().carriers.some(c => c.name === 'ООО «Локальный Тест»')) throw new Error('нет перевозчика');
  return 'перевозчик добавлен, роль «Перевозчик» присвоена';
});
T('калькулятор считает', () => {
  w.showTab('calc'); w.eval("document.querySelector('#c_from').value='Новороссийск';document.querySelector('#c_to').value='Москва';calcDistance();calcRun();");
  const m = txt().match(/([\d\s]{5,})₽/);
  if (!m) throw new Error('нет расчёта');
  return m[1].trim() + ' ₽';
});
T('нет ошибок JS', () => { if (errs.length) throw new Error(errs.join(' | ')); });
console.log('\nПровалов:', errs.length);
process.exit(errs.length ? 1 : 0);
