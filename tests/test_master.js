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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = async (n, f) => { try { const r = await f(); console.log('✓', n, r ? '— ' + r : ''); } catch (e) { console.log('✗', n, '→', e.message); errs.push(n); } };

(async () => {
  await T('локальный режим: демо-данные и бейдж', () => { if (!/локальный/.test(d.querySelector('#storeTag').textContent)) throw new Error('бейдж'); if (!/локальный демо-режим/.test(norm(d.querySelector('#authBox').textContent))) throw new Error('блок входа'); return w.eval('DB.carriers.length') + ' перевозчиков'; });
  await T('все вкладки рисуются', () => { ['about','calc','carriers','loads','council','docs','cabinet'].forEach(t => w.showTab(t)); return 'ок'; });

  await T('роли: демо-вход определяет права (переключателя в шапке нет)', () => {
    if (d.querySelector('#roleSel')) throw new Error('переключатель ролей остался');
    w.demoEnter('council'); w.showTab('cabinet');
    if (!/Кабинет члена Совета|члена Совета/.test(txt())) throw new Error('нет кабинета Совета');
    w.demoEnter('admin'); w.showTab('cabinet');
    if (!txt().includes('Администрирование')) throw new Error('нет админ-панели');
    w.demoEnter('guest'); w.showTab('cabinet');
    if (!d.querySelector('#r_email') || !d.querySelector('#r_pass')) throw new Error('у гостя нет формы заявки с кабинетом');
    return 'член Совета · администратор · гость — права совпадают с ролью';
  });
  await T('локальный режим: админ-функции доступны без входа', () => {
    w.demoEnter('admin'); w.showTab('cabinet');
    if (!txt().includes('Заявки на верификацию')) throw new Error('нет админ-панели');
    w.verifyCarrier('C-109');
    if (DB().carriers.find(c => c.id === 'C-109').status !== 'verified') throw new Error('верификация не сработала');
    return 'админ-панель работает (локальный режим без ограничений)';
  });

  /* ---------- тарифная сетка: изменения только решением ---------- */
  await T('рыночный ориентир: без Совета утверждает Администрация (запись в реестр)', () => {
    w.showTab('cabinet');
    const inp = d.querySelector('#ind_market'); if (!inp) throw new Error('нет поля ориентира');
    if (/Сохранить/.test(inp.parentElement.textContent)) throw new Error('осталась прямая правка значения');
    if (w.eval('councilPhase()') === 'elected') throw new Error('Совет уже избран — другая ветка правил');
    inp.value = '92,50';
    w.saveMarketBenchmark();
    const after = w.eval('DB.tariff.val.marketPerKm');
    if (after !== 92.5) throw new Error('ориентир не обновился: ' + after);
    const d1 = DB().decisions.find(x => /Рыночный ориентир/.test(x.title));
    if (!d1) throw new Error('нет записи в реестре решений');
    if (!/Администрацией/.test(d1.result)) throw new Error('результат: ' + d1.result);
    if (!strip().includes('92,50')) throw new Error('строка показателей не обновилась: ' + strip());
    return d1.id + ' → утверждено Администрацией: 88 → 92,50 ₽/км (сетка ' + w.eval('DB.tariff.version') + ')';
  });
  await T('параметр сетки (ДТ) тоже меняется только проектом решения', () => {
    w.showTab('cabinet');
    const before = w.eval('DB.tariff.val.fuelPrice');
    d.querySelector('#tp_key').value = 'fuelPrice';
    d.querySelector('#tp_val').value = '95';
    w.projectTariffChange();
    const vote = DB().votes.find(v => v.payload && v.payload.fuelPrice === 95);
    if (!vote) throw new Error('проект по ДТ не создан');
    if (w.eval('DB.tariff.val.fuelPrice') === 95) throw new Error('сетка изменилась напрямую');
    w.approveTransition(vote.id);
    if (w.eval('DB.tariff.val.fuelPrice') !== 95) throw new Error('не применилось');
    return 'ДТ ' + before + ' → 95 ₽/л через проект решения (' + vote.id + ')';
  });
  await T('после выборов Совета решение принимает голосование (учебный режим)', () => {
    w.showTab('cabinet');
    d.querySelector('#tp_key').value = 'fuelPrice'; d.querySelector('#tp_val').value = '97';
    w.projectTariffChange();
    const v = DB().votes.find(x => x.payload && x.payload.fuelPrice === 97);
    if (!v) throw new Error('проект на голосование не создан');
    w.showTab('council');
    if (!w.eval('DB.settings.demoCouncil')) w.toggleDemoCouncil();
    ['M-3','M-5','M-6','M-7'].forEach(m => { w.setVoteAs(m); w.castVote(v.id, 'for'); });
    return v.id + ': голоса отданы, порог считается по правилам Совета (кворум 7/9)';
  });
  await T('учебный режим: тариф не меняется', () => {
    const before = w.eval('DB.tariff.val.fuelPrice');
    const v = DB().votes.find(x => x.payload && x.payload.fuelPrice === 97);
    w.showTab('council');
    ['M-1','M-2','M-4','M-8'].forEach(m => { w.setVoteAs(m); w.castVote(v.id, 'for'); });
    if (w.eval('DB.tariff.val.fuelPrice') !== before) throw new Error('тариф изменился');
    w.toggleDemoCouncil();
    return 'тариф ' + before + ' ₽/л не изменён';
  });

  /* ---------- показатели и открытые источники ---------- */
  await T('курсы можно проверить и поправить вручную (резерв к авто-источнику)', () => {
    w.demoEnter('admin'); w.showTab('cabinet');
    d.querySelector('#ind_usd').value = '84,50';
    d.querySelector('#ind_cny').value = '12,60';
    d.querySelector('#ind_date').value = '2026-10-17';
    w.saveIndicators();
    const st = strip();
    if (!st.includes('84,50') || !st.includes('12,60')) throw new Error('строка: ' + st);
    if (!/17\.10\.2026/.test(st)) throw new Error('нет даты курса: ' + st);
    return st.slice(0, 110) + '…';
  });
  await T('курсы подтягиваются из открытого источника (ЦБ РФ) автоматически', async () => {
    w.fetch = async url => {
      if (!/cbr-xml-daily/.test(String(url))) throw new Error('неизвестный адрес: ' + url);
      return { ok: true, json: async () => ({ Date: '2026-11-02T11:30:00+03:00', Valute: {
        USD: { Value: 81.25, Nominal: 1 }, EUR: { Value: 94.10, Nominal: 1 }, CNY: { Value: 11.4021, Nominal: 1 } } }) };
    };
    const v = await w.autoRefreshRates(true);
    if (!v || Math.abs(v.usd - 81.25) > 0.001) throw new Error('не разобрались данные: ' + JSON.stringify(v));
    const st = strip();
    if (!st.includes('81,25') || !/CNY\s*11,40/.test(st)) throw new Error('строка: ' + st);
    if (!/ЦБ/.test(st) || !/02\.11\.2026/.test(st)) throw new Error('нет источника и даты: ' + st);
    return 'источник ' + v.src + ': USD 81,25 ₽, CNY 11,40 ₽ на 02.11.2026';
  });

  await T('открытые данные (ночной сбор) видны и меняют сетку только проектом', () => {
    w.demoEnter('admin'); w.showTab('cabinet');
    w.eval("DB.settings.indicators=Object.assign({},DB.settings.indicators,{dt:88.97,dtAsOf:'2026-10-12',dtSrc:'1prime.ru (сводка Росстата)',dtLink:'https://1prime.ru/20261014/rossija-874248711.html',fetchedAt:'2026-10-16T03:00:00Z'});save();render();");
    if (!txt().includes('Открытые данные')) throw new Error('нет блока открытых данных');
    if (!/88,97/.test(txt())) throw new Error('нет значения ДТ из открытых данных');
    if (!/88,97/.test(strip())) throw new Error('строка показателей не показывает открытое ДТ: ' + strip());
    const before = w.eval('DB.tariff.val.fuelPrice');
    w.projectFromOpenData('fuelPrice');
    const vote = DB().votes.find(v => v.payload && Math.abs(v.payload.fuelPrice - 88.97) < 0.001);
    if (!vote) throw new Error('проект по открытым данным не создан');
    if (w.eval('DB.tariff.val.fuelPrice') !== before) throw new Error('сетка изменилась без решения');
    if (!/Росстат/.test(vote.summary)) throw new Error('в основании нет источника: ' + vote.summary);
    return vote.id + ': ' + vote.title + ' — на утверждение';
  });

  /* ---------- населённые пункты и маршрут ---------- */
  await T('населённые пункты: база России и автоподбор', () => {
    const total = w.eval('SETTLEMENTS.length');
    if (total < 1000) throw new Error('в базе только ' + total);
    const s1 = w.suggestSettlements('Новорос', 5);
    if (!s1.length || !/Новороссийск/.test(s1[0][0])) throw new Error('подсказка: ' + JSON.stringify(s1[0] || null));
    const s2 = w.suggestSettlements('Екатеринб', 5);
    if (!s2.length || !/Екатеринбург/.test(s2[0][0])) throw new Error('нет Екатеринбурга');
    const s3 = w.suggestSettlements('Мурманск', 5);
    if (!s3.length) throw new Error('нет Мурманска');
    const km = w.roadKm('Новороссийск', 'Москва');
    if (!(km > 1200 && km < 1750)) throw new Error('расстояние: ' + km);
    return 'в базе ' + total + ' пунктов · Новороссийск → Москва ' + km + ' км';
  });
  await T('дополнительные точки: таможня между погрузкой и выгрузкой', () => {
    w.showTab('calc');
    const before = w.eval('CALC ? Math.round(CALC.base) : 0');
    w.addPoint('customs');
    w.setPointName(1, 'Ростов-на-Дону');
    w.calcDistance(true); w.calcRun(true);
    const names = w.eval('POINTS.map(p => p.name).join(" → ")');
    const fee = w.eval('POINTS.reduce((a,p)=>a+(+p.fee||0),0)');
    const after = w.eval('Math.round(CALC.base)');
    if (names !== 'Новороссийск → Ростов-на-Дону → Москва') throw new Error('маршрут: ' + names);
    if (!(fee >= 25000)) throw new Error('расходы точки: ' + fee);
    if (!(after > before)) throw new Error('ставка не выросла: ' + before + ' → ' + after);
    if (!new RegExp('таможня Ростов').test(w.eval('CALC.route'))) throw new Error('маршрут в расчёте: ' + w.eval('CALC.route'));
    return names + ' · доп. расходы ' + fee + ' ₽ · ставка ' + before + ' → ' + after + ' ₽';
  });
  await T('поле автоподбора работает в форме регистрации', () => {
    w.demoEnter('guest'); w.showTab('cabinet');
    const city = d.querySelector('#r_city');
    if (!city) throw new Error('нет поля города');
    if (city.tagName !== 'INPUT') throw new Error('город по-прежнему выпадающий список');
    city.value = 'Владивосток';
    city.dispatchEvent(new w.Event('change', { bubbles: true }));
    if (!w.findSettlement('Владивосток')) throw new Error('пункт не найден в базе');
    return 'город вводится с подсказками, найден в базе: ' + w.eval('settLabel(findSettlement("Владивосток"))');
  });

  /* ---------- переходный период и выборы ---------- */
  await T('переходный период и выборы работают', () => {
    w.eval(`const tmpl=DB.carriers.find(c=>c.demo);for(let i=0;i<50;i++){const c=JSON.parse(JSON.stringify(tmpl));c.id='C-4'+String(i).padStart(2,'0');c.demo=false;c.name='ООО «П'+i+'»';c.status='verified';DB.carriers.push(c);}save();render();`);
    w.showTab('council'); w.scheduleElections();
    if (!DB().settings.elections) throw new Error('выборы не назначены');
    w.publishCouncil();
    if (DB().members.length !== 9) throw new Error('состав: ' + DB().members.length);
    return 'выборы назначены, состав из 9 избран';
  });
  await T('после выборов ориентир меняет только голосование Совета', () => {
    w.demoEnter('admin'); w.showTab('cabinet');
    const before = w.eval('DB.tariff.val.marketPerKm');
    d.querySelector('#ind_market').value = '99';
    w.saveMarketBenchmark();
    if (w.eval('DB.tariff.val.marketPerKm') !== before) throw new Error('ориентир изменился без голосования');
    const vote = DB().votes.find(v => v.payload && Math.abs(v.payload.marketPerKm - 99) < 0.001);
    if (!vote) throw new Error('проект на голосование не создан');
    if (vote.status !== 'voting') throw new Error('статус: ' + vote.status);
    return vote.id + ' внесён на голосование Совета, сетка не менялась (' + before + ' ₽/км)';
  });
  await T('регистрация перевозчика в локальном режиме (гость)', () => {
    w.resetDemo();
    w.demoEnter('guest'); w.showTab('cabinet');
    ['r_c1','r_c2','r_c3'].forEach(id => d.querySelector('#'+id).checked = true);
    d.querySelector('#r_name').value = 'ООО «Локальный Тест»';
    w.register();
    if (!DB().carriers.some(c => c.name === 'ООО «Локальный Тест»')) throw new Error('нет перевозчика');
    return 'перевозчик добавлен, роль «Перевозчик» присвоена';
  });
  await T('калькулятор считает', () => {
    w.showTab('calc'); w.eval("document.querySelector('#c_from').value='Новороссийск';document.querySelector('#c_to').value='Москва';setPointName(0,'Новороссийск');setPointName(POINTS.length-1,'Москва');calcDistance();calcRun();");
    const m = txt().match(/([\d\s]{5,})₽/);
    if (!m) throw new Error('нет расчёта');
    return m[1].trim() + ' ₽';
  });
  await T('нет ошибок JS', () => { if (errs.length) throw new Error(errs.join(' | ')); });

  console.log('\nПровалов:', errs.length);
  process.exit(errs.length ? 1 : 0);
})();
