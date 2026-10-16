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
const DB = () => JSON.parse(w.localStorage.getItem('ks_db') || '{}');
const T = (n, f) => { try { const r = f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };

T('локальный режим: демо-данные и бейдж', () => { if (!/локальный/.test(d.querySelector('#storeTag').textContent)) throw new Error('бейдж'); if (!/локальный демо-режим/.test(norm(d.querySelector('#authBox').textContent))) throw new Error('блок входа'); return w.eval('DB.carriers.length') + ' перевозчиков'; });
T('все вкладки рисуются', () => { ['about','calc','carriers','loads','council','docs','cabinet'].forEach(t => w.showTab(t)); return 'ок'; });
T('локальный режим: админ-функции доступны без входа', () => {
  const sel = d.querySelector('#roleSel'); sel.value = 'admin'; sel.dispatchEvent(new w.Event('change'));
  w.showTab('cabinet');
  if (!txt().includes('Заявки на верификацию')) throw new Error('нет админ-панели');
  w.verifyCarrier('C-109');
  if (DB().carriers.find(c => c.id === 'C-109').status !== 'verified') throw new Error('верификация не сработала');
  return 'админ-панель работает (локальный режим без ограничений)';
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
T('регистрация перевозчика в локальном режиме', () => {
  w.resetDemo();
  w.showTab('cabinet');
  ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#'+id).checked = true);
  d.querySelector('#r_name').value = 'ООО «Локальный Тест»';
  w.register();
  if (!DB().carriers.some(c => c.name === 'ООО «Локальный Тест»')) throw new Error('нет перевозчика');
  return 'перевозчик добавлен';
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
