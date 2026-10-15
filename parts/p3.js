/* ============================================================
   Часть 2/3: интерфейс — Калькулятор, Перевозчики, Грузы
   ============================================================ */

/* ---------- toast / modal ---------- */
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 4200);
}
function openModal(title, body, footer) {
  $('#modal').innerHTML =
    '<div class="mh"><h3 style="margin:0">' + title + '</h3><button class="btn sm" onclick="closeModal()">Закрыть ✕</button></div>' +
    '<div class="mb">' + body + '</div>' + (footer ? '<div class="mf">' + footer + '</div>' : '');
  $('#modalBg').classList.add('open');
}
function closeModal() { $('#modalBg').classList.remove('open'); }
$('#modalBg') && $('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg') closeModal(); });

/* ---------- вкладки ---------- */
const TABS = [
  ['about', 'О платформе'],
  ['calc', 'Калькулятор ставки'],
  ['carriers', 'Перевозчики и рейтинг'],
  ['loads', 'Грузы'],
  ['council', 'Совет перевозчиков'],
  ['docs', 'Документы платформы'],
  ['cabinet', 'Кабинет']
];
let TAB = 'about';

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([id, l]) =>
    '<button class="' + (TAB === id ? 'active' : '') + '" onclick="showTab(\'' + id + '\')">' + l +
    (id === 'council' && openVotesCount() ? ' <span class="badge b-gold">' + openVotesCount() + '</span>' : '') +
    (id === 'cabinet' && ROLE === 'admin' && DB.applications.filter(a => a.status === 'pending').length ? ' <span class="badge b-info">' + DB.applications.filter(a => a.status === 'pending').length + '</span>' : '') +
    '</button>').join('');
}
function openVotesCount() { return DB.votes.filter(v => v.status === 'voting').length; }
function showTab(id) { TAB = id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
window.showTab = showTab;

function render() { renderTabs(); $('#view').innerHTML = ({ about: viewAbout, calc: viewCalc, carriers: viewCarriers, loads: viewLoads, council: viewCouncil, docs: viewDocs, cabinet: viewCabinet }[TAB])(); if (TAB === 'calc') calcAfterRender(); renderTabs(); }


/* ============================================================
   ВКЛАДКА 0. О ПЛАТФОРМЕ
   ============================================================ */
function viewAbout() {
  const pr = electionProgress();
  const phase = councilPhase();
  return `
  <div class="card">
    <div class="row between" style="align-items:flex-start">
      <div style="max-width:760px">
        <div class="ks-logo" style="margin-bottom:12px"><span class="ks-mark">КС</span><span class="ks-full">Контейнерный&nbsp;<b>Союз</b></span></div>
        <h2 style="font-size:24px">Контейнерный Союз</h2>
        <div class="sub" style="font-size:14px">Открытая отраслевая платформа контейнерных автоперевозок России: экономически обоснованная ставка, рейтинг добросовестности, биржа заявок и отраслевое саморегулирование через Совет перевозчиков.</div>
      </div>
      <div style="text-align:right;min-width:190px">
        <span class="badge ${PHASE_TEXT[phase][1]}">${PHASE_TEXT[phase][0]}</span>
        <div style="font-size:26px;font-weight:900;color:var(--acc);margin-top:10px">${pr.n} / ${pr.need}</div>
        <div class="mini">перевозчиков до выборов Совета</div>
      </div>
    </div>
  </div>

  <div class="grid g3" style="margin-top:16px">
    <div class="card">
      <h3>Зачем это перевозчику</h3>
      <ul class="mini" style="padding-left:18px">
        <li>видеть <b>справедливую ставку</b> по плечу: смета, коридор, ₽/км — и не работать себе в убыток;</li>
        <li>отстаивать цену, опираясь на <b>публичный расчёт себестоимости</b>, а не на «рынок сказал»;</li>
        <li>получать заявки без посредников и видеть <b>рейтинг</b> контрагента;</li>
        <li>влиять на правила через <b>Совет перевозчиков</b> и открытые обсуждения.</li>
      </ul>
    </div>
    <div class="card">
      <h3>Зачем это грузовладельцу</h3>
      <ul class="mini" style="padding-left:18px">
        <li>понятная цена: из чего она состоит и почему меняется;</li>
        <li>проверенные перевозчики: чек-лист доверия, ОСГОП, ЭТрН, рейтинг по срокам и срывам;</li>
        <li>типовой договор и электронные акты вместо переписки;</li>
        <li>претензионная процедура и арбитраж вместо «разбирайтесь сами».</li>
      </ul>
    </div>
    <div class="card">
      <h3>Как это устроено</h3>
      <ul class="mini" style="padding-left:18px">
        <li><b>Калькулятор</b> — тарифная сетка, обновляемая по объективным данным (Росстат, «Платон», показатели участников);</li>
        <li><b>Реестр и рейтинг</b> — 7 показателей, уровни от Бронзы до Платины;</li>
        <li><b>Биржа</b> — заявки, ставки, пол по плечу, пометка демпинга;</li>
        <li><b>Совет перевозчиков</b> — 9 членов, пороги 6/5/7, поименные голосования.</li>
      </ul>
    </div>
  </div>

  <div class="grid g23" style="margin-top:16px">
    <div class="card">
      <h3>Как проходит путь к полноценному регулированию</h3>
      <ol class="tl" style="margin-top:8px">
        <li><b>Переходный период (сейчас).</b> Платформа открыта, реестр наполняется реальными перевозчиками. Тарифную сетку ведёт Администрация строго по методике, любые изменения публикуются с расчётом «до/после». Проекты решений идут в открытые обсуждения.</li>
        <li><b>Порог 50 перевозчиков.</b> Администрация назначает выборы Совета: выдвижение кандидатов 20 дней, кумулятивное голосование участников 15 дней, квоты по федеральным округам.</li>
        <li><b>Избранный Совет.</b> Тарифные решения — 6 из 9, вопросы платформы — 5 из 9, Устав — 7 из 9, кворум 7. Голоса публикуются персонально, решения попадают в открытый реестр.</li>
        <li><b>Далее.</b> Комитеты, арбитраж, публичный индекс ставок «Контейнерного Союза» как ориентир отрасли и коллективная позиция перевозчиков в диалоге с грузовладельцами, портами и государством.</li>
      </ol>
      <div class="note" style="margin-top:12px">Тарифная сетка — <b>ориентир, а не обязательная цена</b>. Участник вправе применить свой расчёт, если он обоснован в карточке рейса. Обязательные для рынка цены платформа устанавливать не может и не будет — это запрещено законом (ст. 11 ФЗ № 135-ФЗ, ст. 421 ГК РФ).</div>
    </div>
    <div>
      <div class="card">
        <h3>С чего начать</h3>
        <div class="row" style="margin-top:8px;flex-wrap:wrap">
          <button class="btn pri" onclick="showTab('cabinet')">Зарегистрировать компанию</button>
          <button class="btn" onclick="showTab('calc')">Посчитать ставку</button>
          <button class="btn" onclick="showTab('loads')">Смотреть заявки</button>
        </div>
        <p class="mini" style="margin-top:10px">Регистрация бесплатна. После верификации открываются биржа заявок, подача ставок, рейтинг и право выдвижения в Совет.</p>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Что уже работает в этой версии</h3>
        <table><tbody>
          <tr><td>Калькулятор ставки с тарифной сеткой</td><td style="text-align:right"><span class="badge b-ok">работает</span></td></tr>
          <tr><td>Реестр перевозчиков и рейтинг</td><td style="text-align:right"><span class="badge b-ok">работает</span></td></tr>
          <tr><td>Биржа заявок и подача ставок</td><td style="text-align:right"><span class="badge b-ok">работает</span></td></tr>
          <tr><td>Совет перевозчиков: выборы</td><td style="text-align:right"><span class="badge b-warn">при 50 перевозчиках</span></td></tr>
          <tr><td>Верификация документов</td><td style="text-align:right"><span class="badge b-info">вручную Администрацией</span></td></tr>
          <tr><td>Документы: Устав, Правила, регламенты</td><td style="text-align:right"><span class="badge b-warn">проекты</span></td></tr>
        </tbody></table>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Навигация</h3>
        <p class="mini">Логотип <b>КС</b> в шапке и в начале строки вкладок ведёт на эту страницу: наведите на него курсор — развернётся полное название.</p>
      </div>
    </div>
  </div>`;
}
window.viewAbout = viewAbout;

/* ============================================================
   ВКЛАДКА 1. КАЛЬКУЛЯТОР
   ============================================================ */
let CALC = null;
function viewCalc() {
  const t = DB.tariff.val;
  const opts = CITIES.map(c => '<option>' + c[0] + '</option>').join('');
  const modes = [['импорт', 'Импорт (порт/терминал → грузополучатель)'], ['экспорт', 'Экспорт (грузоотправитель → порт/терминал)'], ['внутрироссия', 'Внутрироссия (терминал → терминал)'], ['транзит', 'Транзит / иное']];
  return `
  <div class="grid g23">
    <div>
      <div class="card">
        <h2>Калькулятор ставки контейнерной автоперевозки</h2>
        <div class="sub">Расчёт по тарифной сетке платформы <b>${esc(DB.tariff.version)}</b> (утв. ${dt(DB.tariff.approved)}, основание: ${esc(DB.tariff.approvedBy)}). Сетка меняется только решениями Совета перевозчиков.</div>
        <div class="grid g2">
          <div>
            <div class="field"><label>Пункт отправления</label><select id="c_from">${opts}</select></div>
            <div class="field"><label>Пункт назначения</label><select id="c_to">${opts}</select></div>
            <button class="btn sm" onclick="calcDistance()">↔ Рассчитать расстояние</button>
            <div class="fnote">Расстояние определяется справочно по дорожной сети (коэффициент извилистости); при необходимости укажите фактическое значение вручную — оно имеет приоритет.</div>
          </div>
          <div>
            <div class="field"><label>Расстояние, км (гружёный пробег)</label><input type="number" id="c_km" value="1390"></div>
            <div class="field"><label>Порожний пробег, км</label><input type="number" id="c_empty" value="1390"></div>
            <div class="chk"><input type="checkbox" id="c_emptyOn"><label for="c_emptyOn" style="margin:0">Учитывать возврат порожнего контейнера (типовая доля — ${t.emptyReturnK}% плеча; уточняется условиями линии)</label></div>
          </div>
        </div>
        <hr>
        <div class="grid g2">
          <div>
            <div class="field"><label>Тип контейнера</label><select id="c_type">
              <option>20′</option><option selected>40′HC</option><option>40′</option><option>45′HC</option><option>20′ (реф)</option><option>40′ (реф)</option>
            </select></div>
            <div class="field"><label>Количество контейнеров в рейсе</label><input type="number" id="c_units" value="1" min="1" max="2"></div>
            <div class="field"><label>Вес брутто, тонн</label><input type="number" id="c_weight" value="26" step="0.1"></div>
          </div>
          <div>
            <div class="field"><label>Схема перевозки</label><select id="c_mode">${modes.map(m => '<option value="' + m[0] + '">' + m[1] + '</option>').join('')}</select></div>
            <div class="field"><label>Срок рейса, дней</label><input type="number" id="c_days" value="4" min="1"></div>
            <div class="field"><label>Простой на погрузке/выгрузке, часов (норма — ${t.detentionFree} ч)</label><input type="number" id="c_detention" value="6" min="0"></div>
          </div>
        </div>
        <hr>
        <div class="smallcaps" style="margin-bottom:8px">Дополнительные услуги (по факту условий заявки)</div>
        <div class="grid g2">
          ${EXTRAS.map(([k, l, v]) => `
            <div>
              <div class="chk"><input type="checkbox" id="c_ex_${k}" ${['expedition', 'docs'].includes(k) ? 'checked' : ''}><label for="c_ex_${k}" style="margin:0">${l}</label></div>
              <input type="number" id="c_exv_${k}" value="${v}" style="margin-left:24px;width:calc(100% - 24px)" title="Стоимость услуги, ₽">
            </div>`).join('')}
        </div>
        <hr>
        <div class="grid g3">
          <div class="chk"><input type="checkbox" id="c_season"><label for="c_season">Сезонная надбавка (пик спроса), +${t.seasonK}%</label></div>
          <div class="chk"><input type="checkbox" id="c_urgency"><label for="c_urgency">Срочная доставка, +${t.urgencyK}%</label></div>
          <div class="chk"><input type="checkbox" id="c_floor"><label for="c_floor">Учитывать минимальную ставку по решению Совета</label></div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn pri" onclick="calcRun()">Рассчитать ставку</button>
          <button class="btn" onclick="calcSave()">Сохранить расчёт</button>
          <button class="btn" onclick="calcToCouncil()">Внести вопрос по тарифу в Совет</button>
          <button class="btn" onclick="calcReset()">Сбросить</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Как считается «правильная» ставка</h3>
        <p class="mini">Ставка = (прямые затраты + услуги + простой + накладные) × (1 + маржа) × коэффициенты.</p>
        <p class="mini" style="margin-top:8px">Прямые затраты учитывают: топливо (нормативный расход гружёным/порожним), «Платон» (${t.platon} ₽/км с долей пробега по федеральным трассам), лизинг/амортизацию, ФОТ водителя и суточные, ремонт и ТО, шины, страхование. Маржа, цена ДТ и все нормативы утверждаются Советом перевозчиков и фиксируются в тарифной сетке.</p>
        <p class="mini" style="margin-top:8px">Нижняя граница коридора — ставка при минимальной марже: ниже неё перевозка экономически нецелесообразна, такие предложения на бирже помечаются как <span class="badge b-bad">демпинг</span>.</p>
      </div>
    </div>
    <div>
      <div id="calcOut"><div class="result"><div class="mini">Здесь появится расчёт ставки</div><div class="big">— ₽</div><div class="mini">Укажите параметры рейса и нажмите «Рассчитать ставку»</div></div></div>
      <div class="card" style="margin-top:16px">
        <h3>История расчётов</h3>
        <div class="sub">Сохраняется в браузере (в проде — в личном кабинете).</div>
        ${DB.calcs.length ? '<div class="tbl-scroll" style="max-height:280px"><table><thead><tr><th>Дата</th><th>Рейс</th><th>Ставка</th><th>₽/км</th><th></th></tr></thead><tbody>' +
      DB.calcs.slice().reverse().map((c, i) => `<tr><td class="mini">${dt(c.at)}</td><td>${esc(c.route)}<div class="mini">${esc(c.type)}, ${c.km} км</div></td><td class="mono"><b>${money(c.base)}</b></td><td class="mono mini">${fmt2(c.perKm)}</td><td><button class="btn sm" onclick="calcDel(${DB.calcs.length - 1 - i})">✕</button></td></tr>`).join('') + '</tbody></table></div>'
      : '<p class="mini">Расчётов пока нет.</p>'}
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Тарифная сетка (${esc(DB.tariff.version)})</h3>
        <div class="tbl-scroll" style="max-height:320px"><table><tbody>
        ${TARIFF_META.map(([k, l, u]) => '<tr><td>' + esc(l) + '<div class="mini">' + esc(u) + '</div></td><td class="mono" style="text-align:right">' + fmt2(t[k]) + '</td></tr>').join('')}
        </tbody></table></div>
      </div>
    </div>
  </div>`;
}
function calcDistance() {
  const km = roadKm($('#c_from').value, $('#c_to').value);
  if (!km) { toast('Не удалось определить маршрут', 'bad'); return; }
  $('#c_km').value = km; $('#c_empty').value = km;
  toast('Расстояние ' + $('#c_from').value + ' → ' + $('#c_to').value + ': <b>' + fmt(km) + ' км</b> (справочно)');
}
function calcInputs() {
  const inp = {
    from: $('#c_from') ? $('#c_from').value : 'Новороссийск', to: $('#c_to') ? $('#c_to').value : 'Москва',
    km: $('#c_km').value, empty: $('#c_emptyOn').checked, emptyKm: $('#c_empty').value,
    units: $('#c_units').value, type: $('#c_type').value, weight: $('#c_weight').value,
    mode: $('#c_mode').value, days: $('#c_days').value, detention: $('#c_detention').value,
    season: $('#c_season').checked, urgency: $('#c_urgency').checked, floorChk: $('#c_floor').checked
  };
  for (const [k] of EXTRAS) { inp['ex_' + k] = $('#c_ex_' + k).checked; inp['exv_' + k] = $('#c_exv_' + k).value; }
  inp.exv_terminal_units = 2;   // хранение на терминале: 2 суток как типовое условие импортной схемы
  const load = DB.loads.find(l => l.from === inp.from && l.to === inp.to && l.type === inp.type);
  inp.floor = (inp.floorChk && load) ? load.floor : 0;
  return inp;
}
function calcRun(silent) {
  const inp = calcInputs();
  const r = calc(inp); CALC = { ...r, inp, at: todayISO(), route: inp.from + ' → ' + inp.to, type: inp.type };
  const badge = r.belowFloor ? '<span class="badge b-bad">ниже минимальной ставки Совета</span>' : (r.vsMarket < -12 ? '<span class="badge b-warn">ниже рынка более 12%</span>' : '<span class="badge b-ok">в рыночном коридоре</span>');
  $('#calcOut').innerHTML = `
    <div class="result">
      <div class="mini">Рекомендованная ставка</div>
      <div class="big">${money(r.base)}</div>
      <div class="mini">${esc(inp.from)} → ${esc(inp.to)} · ${esc(inp.type)} · ${fmt(r.km)} км гружёным + ${fmt(r.emptyKm)} км порожним${r.units > 1 ? ' · ' + r.units + ' конт.' : ''}</div>
      <hr>
      <div class="row between" style="margin-bottom:6px"><span class="mini">Экономически обоснованный коридор</span>${badge}</div>
      <div class="vote-bar">
        <i style="width:33%;background:#ef5350" title="минимум">${money(r.min)}</i>
        <i style="width:34%;background:#2fbf71" title="базовая">${money(r.base)}</i>
        <i style="width:33%;background:#3ea6ff" title="максимум">${money(r.max)}</i>
      </div>
      <div class="row between" style="margin-top:6px"><span class="mini">нижняя граница (маржа ${fmt2(DB.tariff.val.marginMin)}%)</span><span class="mini">базовая (маржа ${fmt2(DB.tariff.val.marginBase)}%)</span><span class="mini">верхняя</span></div>
      <div class="grid g3" style="margin-top:12px">
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${fmt2(r.perKm)} ₽</div><div class="l">за 1 км</div></div>
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${money(r.perUnit)}</div><div class="l">за контейнер</div></div>
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${fmt(r.vsMarket > 0 ? '+' + r.vsMarket.toFixed(1) : r.vsMarket.toFixed(1))}%</div><div class="l">к рынку (${fmt2(r.marketPerKm)} ₽/км)</div></div>
      </div>
      ${r.belowFloor ? '<div class="note bad" style="margin-top:12px">Внимание: расчётная ставка ниже минимальной ставки, зафиксированной Советом по данному плечу (' + money(r.floorDecision) + '). Рейс в такой ставке помечается как демпинговый.</div>' : ''}
      ${!silent ? '' : ''}
    </div>
    <div class="card" style="margin-top:12px">
      <h3>Смета расчёта</h3>
      <div class="tbl-scroll" style="max-height:420px"><table><tbody>
        ${r.lines.map(l => `<tr><td>${esc(l.name)}<div class="mini">${esc(l.note)}</div></td><td class="mono" style="text-align:right;white-space:nowrap">${money(l.val)}</td></tr>`).join('')}
        ${r.extraRows.map(x => `<tr><td>${esc(x[0])}<div class="mini">доп. услуга</div></td><td class="mono" style="text-align:right">${money(x[1])}</td></tr>`).join('')}
        ${r.detention ? `<tr><td>Простой сверх нормы<div class="mini">${fmt2(DB.tariff.val.detentionRate)} ₽/час</div></td><td class="mono" style="text-align:right">${money(r.detention)}</td></tr>` : ''}
        <tr><td><b>Себестоимость рейса</b></td><td class="mono" style="text-align:right"><b>${money(r.cost)}</b></td></tr>
        <tr><td>Коэффициенты (сезон/срочность/схема)<div class="mini">множитель ${fmt2(r.k)}</div></td><td class="mono" style="text-align:right">×${fmt2(r.k)}</td></tr>
      </tbody></table></div>
    </div>`;
  if (!silent) toast('Расчёт выполнен: <b>' + money(r.base) + '</b>', 'ok');
}
function calcAfterRender() { if (CALC) calcRun(true); }
function calcSave() {
  if (!CALC) calcRun();
  DB.calcs.push({ at: todayISO(), route: CALC.route, type: CALC.type, km: CALC.km, base: Math.round(CALC.base), perKm: CALC.perKm, inp: CALC.inp });
  save(); render(); toast('Расчёт сохранён в истории', 'ok');
}
function calcDel(i) { DB.calcs.splice(i, 1); save(); render(); }
function calcReset() { CALC = null; $('#calcOut').innerHTML = '<div class="result"><div class="mini">Расчёт сброшен</div><div class="big">— ₽</div></div>'; }
function calcToCouncil() {
  const inp = calcInputs();
  showTab('council');
  setTimeout(() => {
    const f = $('#np_title');
    if (!f) { toast('Форма подачи предложения доступна членам Совета и Тарифному комитету', 'bad'); return; }
    $('#np_kind').value = 'tariff';
    $('#np_title').value = 'Ставка по плечу ' + inp.from + ' → ' + inp.to + ' (' + inp.type + '): пересмотр тарифной сетки';
    $('#np_summary').value = 'Предложение внесено из калькулятора. Параметры рейса: ' + inp.km + ' км гружёным, ' + inp.emptyKm + ' км порожним, ' + inp.days + ' сут., простой ' + inp.detention + ' ч.';
    toast('Расчёт перенесён в форму предложения Совета');
  }, 120);
}
[calcDistance, calcRun, calcSave, calcDel, calcReset, calcToCouncil].forEach(f => window[f.name] = f);

/* ============================================================
   ВКЛАДКА 2. ПЕРЕВОЗЧИКИ И РЕЙТИНГ
   ============================================================ */
let FILTER = { region: '', status: '', sort: 'rating' };
const STATUS_LABEL = { verified: ['Верифицирован', 'b-ok'], pending: ['Ожидает верификации', 'b-warn'], suspended: ['Приостановлен', 'b-bad'] };
function viewCarriers() {
  const list = DB.carriers.map(c => ({ ...c, r: rating(c) }));
  const regions = [...new Set(DB.carriers.map(c => c.region))].sort();
  let rows = list.filter(c => (!FILTER.region || c.region === FILTER.region) && (!FILTER.status || c.status === FILTER.status));
  rows.sort((a, b) => FILTER.sort === 'rating' ? b.r.score - a.r.score : FILTER.sort === 'fleet' ? b.fleet - a.fleet : a.name.localeCompare(b.name));
  const avg = (list.reduce((s, c) => s + c.r.score, 0) / list.length).toFixed(1);
  return `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="k">${DB.carriers.length}</div><div class="l">перевозчиков в реестре</div><div class="n">всего зарегистрировано</div></div>
    <div class="kpi"><div class="k">${DB.carriers.filter(c => c.status === 'verified').length}</div><div class="l">верифицированы</div><div class="n">документы и ОСГОП проверены</div></div>
    <div class="kpi"><div class="k">${avg}</div><div class="l">средний балл рейтинга</div><div class="n">шкала 0–100</div></div>
    <div class="kpi"><div class="k">${DB.carriers.length ? Math.round(DB.carriers.reduce((s, c) => s + c.fleet, 0)) : 0}</div><div class="l">единиц техники в парке</div><div class="n">${DB.carriers.reduce((s, c) => s + c.containers, 0)} контейнерных площадок</div></div>
  </div>
  <div class="card pad0">
    <div class="row between" style="padding:14px 16px;gap:10px">
      <div class="row">
        <div><label class="mini">Федеральный округ</label><select id="f_region" style="width:auto" onchange="setFilter('region',this.value)"><option value="">Все</option>${regions.map(r => '<option ' + (FILTER.region === r ? 'selected' : '') + '>' + r + '</option>').join('')}</select></div>
        <div><label class="mini">Статус</label><select id="f_status" style="width:auto" onchange="setFilter('status',this.value)"><option value="">Любой</option>${Object.entries(STATUS_LABEL).map(([k, v]) => '<option value="' + k + '" ' + (FILTER.status === k ? 'selected' : '') + '>' + v[0] + '</option>').join('')}</select></div>
        <div><label class="mini">Сортировка</label><select style="width:auto" onchange="setFilter('sort',this.value)"><option value="rating" ${FILTER.sort === 'rating' ? 'selected' : ''}>По рейтингу</option><option value="fleet" ${FILTER.sort === 'fleet' ? 'selected' : ''}>По размеру парка</option><option value="name" ${FILTER.sort === 'name' ? 'selected' : ''}>По наименованию</option></select></div>
      </div>
      <button class="btn" onclick="showTab('cabinet')">Регистрация перевозчика</button>
    </div>
    <div class="tbl-scroll"><table>
      <thead><tr><th>Место</th><th>Перевозчик</th><th>Регион</th><th>Парк</th><th>Контейнеры</th><th>Рейтинг</th><th>Уровень</th><th>Статус</th><th></th></tr></thead>
      <tbody>
      ${rows.map((c, i) => `<tr>
        <td class="mono"><b>${i + 1}</b></td>
        <td><b>${esc(c.name)}</b><div class="mini">${c.form === 'ИП' ? 'ИП' : 'ООО'}, ИНН ${esc(c.inn)} · на платформе с ${dt(c.joined)}</div></td>
        <td>${esc(c.city)}<div class="mini">${esc(c.region)}</div></td>
        <td class="mono">${c.fleet}</td>
        <td class="mono">${c.containers}<div class="mini">${c.types.join(', ')}</div></td>
        <td><b class="mono">${c.r.score}</b><div class="mini">${starsHtml(c.r.stars)}</div></td>
        <td><span class="badge ${c.r.cls}">${c.r.level}</span></td>
        <td><span class="badge ${STATUS_LABEL[c.status][1]}">${STATUS_LABEL[c.status][0]}</span></td>
        <td><button class="btn sm" onclick="carrierCard('${c.id}')">Карточка</button></td>
      </tr>`).join('')}
      </tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Из чего складывается рейтинг</h3>
    <div class="tbl-scroll"><table><thead><tr><th>Показатель</th><th>Вес</th><th>Как считается</th></tr></thead><tbody>
      ${RATING_WEIGHTS.map(w => '<tr><td>' + w[1] + '</td><td class="mono">' + w[2] + '%</td><td class="mini">' + {
    onTime: 'доля рейсов, доставленных в согласованный срок (данные трекинга и ЭТрН)',
    quality: 'количество срывов, повреждений и претензий, приведённое к числу рейсов',
    reviews: 'средняя оценка грузовладельцев после закрытия рейса',
    tenure: 'стаж участия: 60 месяцев = 100 баллов',
    discipline: 'исполнение решений Совета, участие в арбитраже, оплата взносов (взносы — по решению голосования)',
    transparency: 'заполненность профиля, верификация ИНН, ОСГОП, допуски к портам и терминалам, работа через ЭТрН',
    volume: 'число выполненных рейсов: 500 рейсов = 100 баллов'
  }[w[0]] + '</td></tr>').join('')}
    </tbody></table></div>
    <p class="mini" style="margin-top:10px">Уровни: 90+ Платина · 80+ Золото · 70+ Серебро · 60+ Бронза · менее 60 — Наблюдение (ограничение доступа к отдельным заявкам биржи и невозможность выдвижения в Совет).</p>
  </div>`;
}
function setFilter(k, v) { FILTER[k] = v; render(); }
window.setFilter = setFilter;

function carrierCard(id) {
  const c = DB.carriers.find(x => x.id === id); const r = rating(c);
  const docs = [['egrul', 'Выписка ЕГРЮЛ/ЕГРИП, ИНН'], ['osgop', 'Полис ОСГОП (обязательное страхование ответственности)'], ['ports', 'Допуск в порты (Новороссийск / СПб / Владивосток)'], ['etrn', 'Работа через ЭТрН (электронная транспортная накладная)'], ['taxes', 'Отсутствие налоговой задолженности']];
  const myLoads = DB.loads.filter(l => l.carrierId === c.id);
  openModal('Карточка перевозчика', `
    <div class="row between"><div><b style="font-size:17px">${esc(c.name)}</b><div class="mini">${c.form}, ИНН ${esc(c.inn)} · ${esc(c.city)}, ${esc(c.region)} · ID ${c.id}</div></div>
      <div style="text-align:right"><div style="font-size:26px;font-weight:900;color:var(--acc)">${r.score}</div><div class="mini">${starsHtml(r.stars)} · ${r.level}</div></div></div>
    <hr>
    <div class="grid g3">
      <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.fleet}</div><div class="l">единиц техники</div></div>
      <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.containers}</div><div class="l">контейнерных площадок</div></div>
      <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.metrics.completed}</div><div class="l">рейсов выполнено</div></div>
    </div>
    <h3 style="margin-top:14px">Разбивка рейтинга</h3>
    <table><tbody>${r.rows.map(x => `<tr><td>${x.label}<div class="mini">вес ${x.w}%</div><div class="bar" style="margin-top:5px"><i style="width:${x.v}%"></i></div></td><td class="mono" style="text-align:right;white-space:nowrap">+${fmt2(x.add)}</td></tr>`).join('')}</tbody></table>
    <h3 style="margin-top:14px">Показатели надёжности</h3>
    <p class="mini">Соблюдение сроков — <b>${c.metrics.onTime}%</b> · Срывов/претензий — <b>${c.metrics.failures}</b> · Средняя оценка грузовладельцев — <b>${fmt2(c.metrics.reviews)}/5</b> · Стаж на платформе — <b>${c.metrics.tenureMonths} мес.</b></p>
    <h3 style="margin-top:14px">Чек-лист доверия</h3>
    <table><tbody>${docs.map(d => '<tr><td>' + d[1] + '</td><td style="text-align:right">' + (c.docs[d[0]] ? '<span class="badge b-ok">подтверждено</span>' : '<span class="badge b-bad">не подтверждено</span>') + '</td></tr>').join('')}</tbody></table>
    ${myLoads.length ? '<h3 style="margin-top:14px">Рейсы на платформе</h3><table><tbody>' + myLoads.map(l => '<tr><td>' + l.id + '</td><td>' + l.from + ' → ' + l.to + '</td><td class="mono">' + money(l.rate || 0) + '</td><td>' + l.status + '</td></tr>').join('') + '</tbody></table>' : ''}
    <div class="note" style="margin-top:14px">Рейтинг пересчитывается автоматически после каждого закрытого рейса и ежемесячно в целом по платформе. Порядок обжалования — Регламент рейтинга и арбитража (раздел «Документы»).</div>
  `, '<button class="btn" onclick="closeModal()">Закрыть</button>');
}
window.carrierCard = carrierCard;

/* ============================================================
   ВКЛАДКА 3. ГРУЗЫ
   ============================================================ */
function bestCarriers(load) {
  const scored = DB.carriers.filter(c => c.status === 'verified').map(c => {
    const r = rating(c);
    const sameRegion = c.region === (cityByName(load.from) || [])[3] ? 8 : 0;
    const typeOk = c.types.some(t => load.type.startsWith(t.replace('′HC', '′'))) ? 8 : 0;
    const spare = Math.min(10, c.fleet / 6);
    return { c, s: Math.round((r.score * 0.78 + sameRegion + typeOk + spare) * 10) / 10, r };
  }).sort((a, b) => b.s - a.s);
  return scored.slice(0, 3);
}
function viewLoads() {
  const modes = { 'импорт': 'Импорт', 'экспорт': 'Экспорт', 'внутрироссия': 'Внутрироссия', 'транзит': 'Транзит' };
  const st = { open: ['Свободен', 'b-ok'], bid: ['Идёт отбор', 'b-warn'], assigned: ['Назначен', 'b-info'], done: ['Выполнен', 'b-mut'] };
  const openN = DB.loads.filter(l => l.status === 'open' || l.status === 'bid').length;
  return `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="k">${openN}</div><div class="l">активных заявок</div><div class="n">доступно перевозчикам реестра</div></div>
    <div class="kpi"><div class="k">${Object.values(DB.loads.reduce((a, l) => (a[l.type] = 1, a), {})).length}</div><div class="l">типов контейнеров в заявках</div><div class="n">20′, 40′, 40′HC, реф</div></div>
    <div class="kpi"><div class="k">${DB.loads.filter(l => l.status === 'assigned' || l.status === 'done').length}</div><div class="l">закрыто рейсов</div><div class="n">с расчётом рейтинга</div></div>
    <div class="kpi"><div class="k">${money(DB.loads.reduce((s, l) => s + (l.rate || 0), 0))}</div><div class="l">объём назначенных ставок</div><div class="n">демонстрационные данные</div></div>
  </div>
  <div class="card pad0">
    <div class="row between" style="padding:14px 16px">
      <div><h3 style="margin:0">Биржа грузов</h3><div class="mini">Заявки грузовладельцев и экспедиторов. Перевозчики со статусом «Верифицирован» подают ставку; заявки ниже минимальной ставки Совета помечаются как демпинговые.</div></div>
      <button class="btn" onclick="loadForm()">＋ Разместить заявку</button>
    </div>
    <div class="tbl-scroll"><table>
      <thead><tr><th>Заявка</th><th>Маршрут</th><th>Контейнер</th><th>Схема</th><th>Дата</th><th>Ставка платформы</th><th>Ставок подано</th><th>Статус</th><th></th></tr></thead>
      <tbody>${DB.loads.map(l => {
    const km = roadKm(l.from, l.to);
    const r = calc({ from: l.from, to: l.to, km: km, empty: true, emptyKm: km, units: 1, type: l.type, mode: l.mode, days: Math.max(1, Math.round(km / 450)), detention: 4, season: true, ex_expedition: true, ex_docs: true, ex_terminal: l.mode === 'импорт', exv_terminal_units: 2, exv_terminal: 3500, ex_svh: l.mode === 'импорт', exv_svh: 6000, ex_lifting: true, exv_lifting: 3500 });
    l._calc = r;
    return `<tr>
        <td><b>${l.id}</b><div class="mini">${esc(l.shipper)}</div></td>
        <td>${esc(l.from)} → ${esc(l.to)}<div class="mini">${fmt(km)} км справочно</div></td>
        <td>${esc(l.type)}<div class="mini">${l.weight} т брутто</div></td>
        <td>${modes[l.mode]}<div class="mini">${esc(l.cargo)}</div></td>
        <td class="mono">${dt(l.date)}</td>
        <td class="mono"><b>${money(r.base)}</b><div class="mini">${fmt2(r.perKm)} ₽/км${l.floor ? ' · пол Совета ' + fmt(l.floor) : ''}</div></td>
        <td class="mono">${l.bids}</td>
        <td><span class="badge ${st[l.status][1]}">${st[l.status][0]}</span></td>
        <td><button class="btn sm" onclick="loadCard('${l.id}')">Открыть</button></td>
      </tr>`;
  }).join('')}</tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Как работает подбор перевозчика</h3>
    <p class="mini">При открытии заявки платформа автоматически предлагает перевозчиков с учётом рейтинга (78% веса), совпадения федерального округа отправления, наличия подходящего типа контейнерной площадки и свободного парка. Грузовладелец выбирает исполнителя сам; платформа не является стороной договора-перевозки.</p>
  </div>`;
}
function loadCard(id) {
  const l = DB.loads.find(x => x.id === id);
  const r = l._calc || calc({ from: l.from, to: l.to, km: roadKm(l.from, l.to), empty: true, km2: 0, units: 1, type: l.type, mode: l.mode, days: 3, detention: 4 });
  const best = bestCarriers(l);
  const canBid = ROLE === 'carrier' || ROLE === 'admin';
  openModal('Заявка ' + l.id, `
    <div class="row between"><div><b>${esc(l.from)} → ${esc(l.to)}</b><div class="mini">${esc(l.type)} · ${l.weight} т брутто · погрузка ${dt(l.date)} · ${esc(l.cargo)}</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:800">${money(r.base)}</div><div class="mini">ставка платформы, ${fmt2(r.perKm)} ₽/км</div></div></div>
    <div class="note" style="margin-top:12px">Заказчик: <b>${esc(l.shipper)}</b>. Условия: норма простоя ${DB.tariff.val.detentionFree} ч, далее ${money(DB.tariff.val.detentionRate)}/час; оплата 50% предоплата, 50% по ЭТрН; срок доставки по согласованию.${l.floor ? ' <b>Минимальная ставка по решению Совета: ' + money(l.floor) + '.</b>' : ''}</div>
    <h3 style="margin-top:14px">Рекомендованные перевозчики (автоподбор по рейтингу)</h3>
    <table><tbody>${best.map((b, i) => `<tr><td>${i + 1}. <b>${esc(b.c.name)}</b><div class="mini">${esc(b.c.city)} · ${b.c.fleet} ед. техники · рейтинг ${b.r.score} (${b.r.level})</div></td><td style="text-align:right"><span class="badge ${b.r.cls}">соответствие ${b.s}</span></td></tr>`).join('')}</tbody></table>
    ${canBid ? `
    <h3 style="margin-top:14px">${ROLE === 'admin' ? 'Назначить перевозчика (администрация)' : 'Подать ставку перевозчика'}</h3>
    <div class="grid g2">
      <div><label class="mini">Ставка, ₽</label><input type="number" id="b_rate" value="${Math.round(r.base)}"></div>
      <div><label class="mini">Срок доставки, дней</label><input type="number" id="b_days" value="${Math.max(2, Math.round(roadKm(l.from, l.to) / 450) + 1)}"></div>
    </div>
    <div class="chk"><input type="checkbox" id="b_terms" checked><label for="b_terms" style="margin:0">Подтверждаю условия заявки и <a href="#" onclick="return false">типовой договор-перевозки</a> платформы</label></div>
    ${ROLE === 'admin' ? '<div class="field"><label>Перевозчик</label><select id="b_carrier">' + best.map(b => '<option value="' + b.c.id + '">' + esc(b.c.name) + ' — рейтинг ' + b.r.score + '</option>').join('') + '</select></div>' : ''}
    ` : '<div class="note warn" style="margin-top:14px">Подача ставок доступна верифицированным перевозчикам. Войдите под демо-перевозчиком в переключателе режима вверху или зарегистрируйтесь во вкладке «Кабинет».</div>'}
  `, (canBid ? '<button class="btn pri" onclick="placeBid(\'' + l.id + '\')">' + (ROLE === 'admin' ? 'Назначить рейс' : 'Подать ставку') + '</button>' : '') + '<button class="btn" onclick="closeModal()">Закрыть</button>');
}
function placeBid(id) {
  const l = DB.loads.find(x => x.id === id);
  const rate = num($('#b_rate').value);
  if (!$('#b_terms').checked) { toast('Необходимо подтвердить условия заявки', 'bad'); return; }
  const cid = ROLE === 'admin' ? $('#b_carrier').value : (ME || 'C-101');
  const c = DB.carriers.find(x => x.id === cid);
  if (l.floor && rate < l.floor) { toast('Ставка ниже минимальной ставки Совета (' + money(l.floor) + '). Заявка помечена как <b>демпинговая</b> и направлена в арбитраж.', 'bad'); }
  l.bids = (l.bids || 0) + 1;
  if (ROLE === 'admin') {
    l.status = 'assigned'; l.carrierId = cid; l.rate = rate;
    c.metrics.completed += 1; c.metrics.onTime = Math.min(100, c.metrics.onTime + 0.2);
    DB.log.unshift({ at: todayISO(), text: 'Рейс ' + l.id + ' назначен: ' + c.name + ', ставка ' + money(rate) + '.' });
    sbPushBid(l, rate, cid, 'assign'); sbJournal('Рейс ' + l.id + ' назначен: ' + c.name + ', ставка ' + money(rate) + '.');
    toast('Рейс назначен на ' + esc(c.name), 'ok'); save(); closeModal(); render();
  } else {
    DB.log.unshift({ at: todayISO(), text: 'Перевозчик ' + c.name + ' подал ставку ' + money(rate) + ' по заявке ' + l.id + '.' });
    sbPushBid(l, rate, cid, 'bid'); sbJournal('Перевозчик ' + c.name + ' подал ставку ' + money(rate) + ' по заявке ' + l.id + '.');
    save(); closeModal(); render(); toast('Ставка подана. Заявка в разделе «Мои рейсы» кабинета.', 'ok');
  }
}
function loadForm() {
  const opts = CITIES.map(c => '<option>' + c[0] + '</option>').join('');
  openModal('Размещение заявки на перевозку', `
    <div class="note">Заявки размещают грузовладельцы, экспедиторы и агенты. Для юридической чистоты заявка содержит существенные условия будущего договора-перевозки.</div>
    <div class="grid g2" style="margin-top:12px">
      <div class="field"><label>Откуда</label><select id="n_from">${opts}</select></div>
      <div class="field"><label>Куда</label><select id="n_to">${opts}</select></div>
      <div class="field"><label>Тип контейнера</label><select id="n_type"><option>20′</option><option selected>40′HC</option><option>40′</option><option>45′HC</option><option>20′ (реф)</option><option>40′ (реф)</option></select></div>
      <div class="field"><label>Схема</label><select id="n_mode"><option value="импорт">Импорт</option><option value="экспорт">Экспорт</option><option value="внутрироссия">Внутрироссия</option><option value="транзит">Транзит</option></select></div>
      <div class="field"><label>Вес брутто, т</label><input type="number" id="n_weight" value="24"></div>
      <div class="field"><label>Дата погрузки</label><input type="date" id="n_date" value="${addDays(todayISO(), 7)}"></div>
      <div class="field"><label>Заказчик</label><input type="text" id="n_shipper" value="ООО «Новый клиент»"></div>
      <div class="field"><label>Описание груза</label><input type="text" id="n_cargo" value="Импорт: товары народного потребления"></div>
    </div>
    <div class="chk"><input type="checkbox" id="n_agree" checked><label for="n_agree" style="margin:0">Согласен с Правилами биржи грузов и подтверждаю достоверность сведений</label></div>
  `, '<button class="btn pri" onclick="loadCreate()">Опубликовать заявку</button><button class="btn" onclick="closeModal()">Отмена</button>');
}
function loadCreate() {
  if (!$('#n_agree').checked) { toast('Подтвердите согласие с Правилами биржи', 'bad'); return; }
  const l = {
    id: 'ГР-2026-' + (119 + DB.loads.filter(x => x.id.startsWith('ГР-2026-1')).length),
    from: $('#n_from').value, to: $('#n_to').value, type: $('#n_type').value, mode: $('#n_mode').value,
    weight: num($('#n_weight').value), date: $('#n_date').value, shipper: $('#n_shipper').value,
    cargo: $('#n_cargo').value, status: 'open', bids: 0, floor: 0
  };
  DB.loads.unshift(l);
  DB.log.unshift({ at: todayISO(), text: 'Размещена заявка ' + l.id + ': ' + l.from + ' → ' + l.to + ' (' + l.type + ').' });
  sbPushLoad(l); sbJournal('Размещена заявка ' + l.id + ': ' + l.from + ' → ' + l.to + ' (' + l.type + ').');
  save(); closeModal(); render(); toast('Заявка ' + l.id + ' опубликована на бирже', 'ok');
}
[loadCard, placeBid, loadForm, loadCreate].forEach(f => window[f.name] = f);
