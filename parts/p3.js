/* ============================================================
   Часть 2/3: интерфейс — Калькулятор, Перевозчики, Грузы
   ============================================================ */

/* ---------- toast / modal ---------- */
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = msg;
  el.title = 'Нажмите, чтобы убрать';
  el.addEventListener('click', () => el.remove());
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
  ['about', 'О платформе', 'Что это, зачем и как устроено', '⚓'],
  ['calc', 'Калькулятор ставки', 'Расчёт по тарифной сетке', '🧮'],
  ['carriers', 'Перевозчики и рейтинг', 'Реестр, поиск, карточки', '📋'],
  ['loads', 'Грузы', 'Биржа заявок и ставки', '📦'],
  ['council', 'Совет перевозчиков', 'Голосования и решения', '🗳️'],
  ['docs', 'Документы платформы', 'Устав, Правила, регламенты', '📄'],
  ['cabinet', 'Кабинет', 'Регистрация, заявки, рейтинг', '👤']
];
let TAB = 'about';
let MENU_OPEN = false;

/* Значки у разделов: сколько открытых голосований и заявок ждёт проверки */
function menuBadges(id) {
  let h = '';
  if (id === 'council' && realOpenVotes()) h += ' <span class="badge b-gold">' + realOpenVotes() + '</span>';
  if (id === 'cabinet' && ROLE === 'admin') {
    const pend = DB.applications.filter(a => a.status === 'pending').length;
    if (pend) h += ' <span class="badge b-info">' + pend + '</span>';
  }
  return h;
}

function renderTabs() {
  const list = $('#menuList');
  if (list) list.innerHTML = TABS.map(([id, l, d, ic]) =>
    '<button class="nav-item' + (TAB === id ? ' active' : '') + '" onclick="showTab(\'' + id + '\')" title="' + l + '">' +
    '<span class="ic">' + ic + '</span><span class="tx">' + l + (d ? '<span class="ds">' + d + '</span>' : '') + '</span>' +
    menuBadges(id) + '</button>').join('');
  const cur = TABS.find(x => x[0] === TAB), lbl = $('#menuBtnLabel');
  if (lbl && cur) lbl.textContent = cur[1];
  const mb = $('#menuBtn'); if (mb) mb.classList.toggle('on', MENU_OPEN);
  return '';
}
function renderMenuOldPlaceholder() {   /* заменяет старую отрисовку строки вкладок; оставлено пустым */
  return '';
}
function openVotesCount() { return DB.votes.filter(v => v.status === 'voting').length; }
/* Сколько РЕАЛЬНЫХ открытых вопросов (примеры для ознакомления не считаются,
   пока не включён учебный режим) */
function realOpenVotes() {
  const demo = !!(DB.settings && DB.settings.demoCouncil);
  return DB.votes.filter(v => v.status === 'voting' && (demo || !v.demo)).length;
}
window.realOpenVotes = realOpenVotes;
function openMenu() {
  const d = $('#drawer'), b = $('#drawerBg'), m = $('#menuBtn'); if (!d) return;
  renderTabs();
  d.classList.add('open'); if (b) b.classList.add('open'); if (m) m.classList.add('on');
  if (document.body) document.body.style.overflow = 'hidden';
  MENU_OPEN = true;
}
function closeMenu() {
  const d = $('#drawer'), b = $('#drawerBg'), m = $('#menuBtn'); if (!d) return;
  d.classList.remove('open'); if (b) b.classList.remove('open'); if (m) m.classList.remove('on');
  if (document.body) document.body.style.overflow = '';
  MENU_OPEN = false;
}
function toggleMenu() { if (MENU_OPEN) closeMenu(); else openMenu(); }
window.openMenu = openMenu; window.closeMenu = closeMenu; window.toggleMenu = toggleMenu;

function showTab(id) {
  closeMenu();
  TAB = id; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showTab = showTab;

function render() {
  renderTabs();
  const v = $('#view');
  v.innerHTML = ({ about: viewAbout, calc: viewCalc, carriers: viewCarriers, loads: viewLoads, council: viewCouncil, docs: viewDocs, cabinet: viewCabinet }[TAB])();
  if (TAB === 'calc') calcAfterRender();
  renderTabs();
  renderTicker();
  if (v.classList) { v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); }
  decorateView();
}


/* ============================================================
   ВКЛАДКА 0. О ПЛАТФОРМЕ
   ============================================================ */
/* Рисунок контейнеровоза для главного экрана: палуба с контейнерами, надстройка, волны */
function heroShipSvg() {
  const cols = ['#ff9f1c', '#3ea6ff', '#2fbf71', '#ef5350', '#9b8cff', '#e9c31c', '#ffb347'];
  let boxes = '', k = 0;
  [[80, 9, 26], [68, 8, 38], [56, 5, 56]].forEach(([y, n, x0], ri) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 30;
      const c = cols[(k * 3 + ri * 2) % cols.length]; k++;
      boxes += '<rect x="' + x + '" y="' + y + '" width="28" height="11" rx="1.6" fill="' + c + '" opacity=".95"/>' +
               '<rect x="' + x + '" y="' + y + '" width="28" height="11" rx="1.6" fill="url(#hRib)" opacity=".5"/>';
    }
  });
  return '<svg viewBox="0 0 360 140" role="img" aria-label="Контейнеровоз «Контейнерный Союз»">' +
    '<defs>' +
    '<linearGradient id="hHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d6b93"/><stop offset="1" stop-color="#1a2c45"/></linearGradient>' +
    '<linearGradient id="hSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3a5c"/><stop offset="1" stop-color="#0c1828"/></linearGradient>' +
    '<pattern id="hRib" width="7" height="11" patternUnits="userSpaceOnUse"><rect width="1.4" height="11" fill="#000"/></pattern>' +
    '</defs>' +
    '<rect x="0" y="100" width="360" height="40" fill="url(#hSea)"/>' +
    '<g class="hero-bob">' + boxes +
    '<rect x="286" y="52" width="26" height="48" rx="2" fill="#dbe6f5" opacity=".92"/>' +
    '<rect x="290" y="58" width="18" height="4" rx="1" fill="#37506f" opacity=".75"/>' +
    '<rect x="290" y="66" width="18" height="4" rx="1" fill="#37506f" opacity=".75"/>' +
    '<rect x="290" y="74" width="18" height="4" rx="1" fill="#37506f" opacity=".75"/>' +
    '<rect x="294" y="38" width="10" height="16" rx="2" fill="#ff6a00"/>' +
    '<path d="M14 100 H292 L332 122 H34 Z" fill="url(#hHull)"/>' +
    '<rect x="14" y="98" width="278" height="4" fill="#ff9f1c" opacity=".85"/>' +
    '</g>' +
    '<path class="sea-line" d="M-60 112q14-6 28 0t28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0 28 0" fill="none" stroke="#3ea6ff" stroke-opacity=".45" stroke-width="1.6"/>' +
    '<path class="sea-line" style="animation-duration:13s" d="M-100 127q16-5 32 0t32 0 32 0 32 0 32 0 32 0 32 0 32 0 32 0 32 0 32 0 32 0 32 0" fill="none" stroke="#3ea6ff" stroke-opacity=".28" stroke-width="1.4"/>' +
    '</svg>';
}
window.heroShipSvg = heroShipSvg;

function viewAbout() {
  const pr = electionProgress();
  const phase = councilPhase();
  return `
  <div class="hero card" style="padding:20px">
    <div class="row between" style="align-items:flex-start;gap:18px">
      <div style="flex:1 1 560px;max-width:680px">
        <h2 style="font-size:26px">Контейнерный Союз</h2>
        <div class="sub" style="font-size:14.5px">Открытая отраслевая платформа контейнерных автоперевозок России: экономически обоснованная ставка, рейтинг добросовестности, биржа заявок и отраслевое саморегулирование через Совет перевозчиков.</div>
        <div class="chips" style="margin-top:14px">
          <button class="chip" onclick="showTab('calc')">🧮 Рассчитать ставку</button>
          <button class="chip" onclick="showTab('carriers')">📋 Реестр и рейтинг</button>
          <button class="chip" onclick="showTab('loads')">📦 Биржа заявок</button>
          <button class="chip" onclick="showTab('council')">🗳️ Совет перевозчиков</button>
          <button class="chip" onclick="showTab('docs')">📄 Документы</button>
        </div>
        <div class="row" style="margin-top:14px">
          <span class="link-copy">🌐 cont-union.ru <button class="copy" onclick="copyLink('https://cont-union.ru','Адрес сайта скопирован')">копировать</button></span>
          <span class="link-copy">🔗 tinyurl.com/cont-union <button class="copy" onclick="copyLink('https://tinyurl.com/cont-union','Короткая ссылка скопирована')">копировать</button></span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">${heroShipSvg()}</div>
    </div>
    <hr>
    <div class="row between" style="gap:14px">
      <div style="flex:1 1 320px;min-width:220px">
        <div class="row between" style="margin-bottom:6px">
          <span class="mini">Путь к выборам Совета: реестр наполняется реальными перевозчиками</span>
          <span class="mini mono"><b style="color:var(--acc2)">${pr.n}</b> / ${pr.need}</span>
        </div>
        <div class="bar" style="height:9px"><i style="width:${Math.min(100, Math.round(pr.n / pr.need * 100))}%"></i></div>
        <div class="mini" style="margin-top:6px">${phase === 'formation' ? 'Переходный период: тарифную сетку ведёт Администрация, проекты решений идут в открытые обсуждения.' : 'Выборы Совета: сроки и кандидаты — во вкладке «Совет перевозчиков».'}</div>
      </div>
      <div style="text-align:right;min-width:170px">
        <span class="badge ${PHASE_TEXT[phase][1]}">${PHASE_TEXT[phase][0]}</span>
        <div class="mini" style="margin-top:8px">Порог формирования Совета — ${pr.need} перевозчиков</div>
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
        <p class="mini">Разделы платформы вынесены в меню слева: нажмите кнопку <b>☰</b> в левом верхнем углу — панель выедет поверх страницы и не отнимает место у содержимого. Название текущего раздела видно на самой кнопке.</p>
        <p class="mini" style="margin-top:8px">Логотип <b>КС</b> нарисован как контейнеровоз: из буквы <b>К</b> разворачивается «онтейнерный», из буквы <b>С</b> — «оюз», и получается полное название. Наведите курсор (или коснитесь логотипа) — увидите. Логотип есть только в шапке.</p>
        <p class="mini" style="margin-top:8px">Режима просмотра нет: платформа сама знает, кто вы. Перевозчик заходит в свой кабинет и подаёт ставки, член Совета голосует лично, администратор управляет платформой и назначает роли — всё определяется аккаунтом.</p>
        <p class="mini" style="margin-top:8px">Разделы переключаются клавишами <b>←</b> и <b>→</b>, на телефоне — свайпом влево/вправо по экрану. Меню закрывается клавишей <b>Esc</b>, кнопкой <b>✕</b>, кликом по затемнению или свайпом влево. Кнопка <b>↑</b> в правом нижнем углу возвращает наверх.</p>
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
            <div class="mini" style="margin:2px 0 6px">Частые плечи — в один клик:</div>
            <div class="chips" style="margin-bottom:10px">
              <button class="chip" onclick="calcPreset('Новороссийск','Москва')">Новороссийск → Москва</button>
              <button class="chip" onclick="calcPreset('Новороссийск','Екатеринбург')">Новороссийск → Екатеринбург</button>
              <button class="chip" onclick="calcPreset('Санкт-Петербург','Казань')">Санкт-Петербург → Казань</button>
              <button class="chip" onclick="calcPreset('Москва','Владивосток')">Москва → Владивосток</button>
            </div>
            <button class="btn sm" onclick="calcDistance()">↔ Рассчитать расстояние</button>
            <div class="fnote">Расстояние определяется справочно по дорожной сети (коэффициент извилистости); при необходимости укажите фактическое значение вручную — оно имеет приоритет.
            <b>Расчёт обновляется сам</b> при изменении любого поля — нажимать «Рассчитать ставку» не обязательно.</div>
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
      <div id="calcOut"><div class="result"><div class="mini">Здесь появится расчёт ставки</div><div class="big">— ₽</div><div class="mini">Заполните поля слева — ставка посчитается сама. Пресеты плеч ускоряют работу.</div></div></div>
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
function calcDistance(silent) {
  const km = roadKm($('#c_from').value, $('#c_to').value);
  if (!km) { if (!silent) toast('Не удалось определить маршрут', 'bad'); return; }
  $('#c_km').value = km; $('#c_empty').value = km;
  if (!silent) toast('Расстояние ' + $('#c_from').value + ' → ' + $('#c_to').value + ': <b>' + fmt(km) + ' км</b> (справочно)');
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
    ${rows.length ? `<div class="row" style="padding:14px 16px 0;gap:12px">
      <input id="cf_q" class="search" style="max-width:340px" placeholder="Поиск: название, город, регион или ИНН" oninput="carrierSearch(this.value)">
      <span class="mini counter" id="cf_count">всего ${rows.length}</span>
      <span class="mini">начните печатать — таблица отфильтруется сразу</span>
    </div>` : ''}
    <div class="row between" style="padding:14px 16px;gap:10px">
      <div class="row">
        <div><label class="mini">Федеральный округ</label><select id="f_region" style="width:auto" onchange="setFilter('region',this.value)"><option value="">Все</option>${regions.map(r => '<option ' + (FILTER.region === r ? 'selected' : '') + '>' + r + '</option>').join('')}</select></div>
        <div><label class="mini">Статус</label><select id="f_status" style="width:auto" onchange="setFilter('status',this.value)"><option value="">Любой</option>${Object.entries(STATUS_LABEL).map(([k, v]) => '<option value="' + k + '" ' + (FILTER.status === k ? 'selected' : '') + '>' + v[0] + '</option>').join('')}</select></div>
        <div><label class="mini">Сортировка</label><select style="width:auto" onchange="setFilter('sort',this.value)"><option value="rating" ${FILTER.sort === 'rating' ? 'selected' : ''}>По рейтингу</option><option value="fleet" ${FILTER.sort === 'fleet' ? 'selected' : ''}>По размеру парка</option><option value="name" ${FILTER.sort === 'name' ? 'selected' : ''}>По наименованию</option></select></div>
      </div>
      <button class="btn" onclick="showTab('cabinet')">Регистрация перевозчика</button>
    </div>
    <div class="tbl-scroll"><table>
      <thead><tr><th>Место</th><th>Перевозчик</th><th>Регион</th><th>Парк</th><th class="col-hide-sm">Контейнеры</th><th>Рейтинг</th><th class="col-hide-sm">Уровень</th><th>Статус</th><th></th></tr></thead>
      <tbody id="carrierRows">
      ${!rows.length ? '<tr><td colspan="9" style="text-align:center;padding:26px"><div class="mini">В реестре пока нет перевозчиков.<br>Станьте первым — регистрация занимает несколько минут и бесплатна.</div><div style="margin-top:10px"><button class="btn pri" onclick="showTab(\'cabinet\')">Зарегистрировать компанию</button></div></td></tr>' : ''}
      ${rows.map((c, i) => `<tr data-s="${esc((c.name + ' ' + c.city + ' ' + c.region + ' ' + c.inn + ' ' + (c.form || '')).toLowerCase())}">
        <td class="mono"><b>${i + 1}</b></td>
        <td><b>${esc(c.name)}</b> ${c.demo ? '<span class="badge b-mut">демо</span>' : ''}<div class="mini">${c.form === 'ИП' ? 'ИП' : 'ООО'}, ИНН ${esc(c.inn)} · на платформе с ${dt(c.joined)}</div></td>
        <td>${esc(c.city)}<div class="mini">${esc(c.region)}</div></td>
        <td class="mono">${c.fleet}</td>
        <td class="mono col-hide-sm">${c.containers}<div class="mini">${c.types.join(', ')}</div></td>
        <td><b class="mono">${c.r.score}</b><div class="mini">${starsHtml(c.r.stars)}</div></td>
        <td class="col-hide-sm"><span class="badge ${c.r.cls}">${c.r.level}</span></td>
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
      <tbody>${!DB.loads.length ? '<tr><td colspan="9" style="text-align:center;padding:26px"><div class="mini">Заявок пока нет. Первую заявку может разместить грузовладелец или экспедитор — расчёт ставки появится автоматически.</div><div style="margin-top:10px"><button class="btn pri" onclick="loadForm()">Разместить заявку</button></div></td></tr>' : ''}
      ${DB.loads.map(l => {
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
  if (ROLE === 'admin' && !needCurator('назначение рейса')) return;
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
  sbPushLoad(l, 'insert'); sbJournal('Размещена заявка ' + l.id + ': ' + l.from + ' → ' + l.to + ' (' + l.type + ').');
  save(); closeModal(); render(); toast('Заявка ' + l.id + ' опубликована на бирже', 'ok');
}
[loadCard, placeBid, loadForm, loadCreate].forEach(f => window[f.name] = f);

/* ============================================================
   ЖИВОЙ ИНТЕРФЕЙС: лента событий, свайпы, горячие клавиши, отклик
   ============================================================ */
/* ---------- строка показателей под шапкой ----------
   Только актуальные цифры, без событий и подсказок; строка статичная, не бежит.
   Источник значений: тарифная сетка платформы (ДТ, «Платон», рыночный ориентир) и
   официальные курсы валют, которые ведёт Администрация (DB.settings.indicators). */
function renderIndicators() {
  const el = $('#indicIn'); if (!el || !DB || !DB.tariff) return;
  const t = DB.tariff.val || {};
  const ind = (DB.settings && DB.settings.indicators) || {};
  const asOf = ind.asOf ? dt(ind.asOf) : '';
  const src = ind.src || 'ЦБ РФ';
  const rows = [
    { l: 'ДТ', v: fmt2(t.fuelPrice) + ' ₽/л', s: 'Росстат, средняя по РФ', cls: '' },
    { l: '«Платон»', v: fmt2(t.platon) + ' ₽/км', s: 'ПП РФ № 843', cls: '' },
    { l: 'Рыночный ориентир', v: fmt2(t.marketPerKm) + ' ₽/км', s: DB.settings && DB.settings.demoCouncil ? 'ведёт Администрация (переходный период)' : 'решение Совета / Администрации', cls: '' },
    num(ind.usd) ? { l: 'USD', v: fmt2(num(ind.usd)) + ' ₽', s: src, note: (src.split(' ')[0] || 'ЦБ') + (asOf ? ', ' + asOf : ''), cls: 'cur' } : null,
    num(ind.cny) ? { l: 'CNY', v: fmt2(num(ind.cny)) + ' ₽', s: src, note: '', cls: 'cur' } : null,
    num(ind.eur) ? { l: 'EUR', v: fmt2(num(ind.eur)) + ' ₽', s: src, note: '', cls: 'cur' } : null
  ].filter(Boolean);
  const html = rows.map(r =>
    '<span class="i ' + r.cls + '" title="' + esc(r.s) + '">' + esc(r.l) + ' <b>' + r.v + '</b>' +
    (r.note ? '<em>' + esc(r.note) + '</em>' : '') + '</span>').join('') +
    '<span class="i src">сетка <b>' + esc(DB.tariff.version) + '</b>' +
    (DB.tariff.approved ? ', утв. ' + dt(DB.tariff.approved) : '') +
    (DB.tariff.approvedBy ? ' · ' + esc(DB.tariff.approvedBy) : '') + '</span>';
  if (el.innerHTML !== html) el.innerHTML = html;
}
const renderTicker = renderIndicators;   // прежнее имя — для совместимости
[renderIndicators, renderTicker].forEach(f => window[f.name] = f);

/* ---------- появление карточек и подсказки в широких таблицах ---------- */
let IO_REVEAL = null;
function decorateView() {
  const v = $('#view'); if (!v || !v.querySelectorAll) return;
  if ('IntersectionObserver' in window) {
    if (!IO_REVEAL) IO_REVEAL = new IntersectionObserver(list => {
      list.forEach(x => { if (x.isIntersecting) { x.target.classList.add('on'); IO_REVEAL.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    v.querySelectorAll('.card,.kpi,.member,.vote-box,.hero').forEach((n, i) => {
      if (n.classList.contains('rv')) return;
      n.classList.add('rv');
      n.style.transitionDelay = Math.min(i, 8) * 30 + 'ms';
      IO_REVEAL.observe(n);
    });
  }
  v.querySelectorAll('.tbl-scroll').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 8 && !el.querySelector('.scroll-hint')) {
      const h = document.createElement('div');
      h.className = 'scroll-hint';
      h.innerHTML = '↔ таблица прокручивается вбок — на телефоне ведите пальцем';
      el.insertBefore(h, el.firstChild);
      el.addEventListener('scroll', () => { if (el.scrollLeft > 8) h.remove(); }, { once: true });
    }
  });
}
window.decorateView = decorateView;

/* ---------- калькулятор: пресеты плеч и автоматический пересчёт ---------- */
let CALC_TIMER = null;
function calcPulse() {
  const out = $('#calcOut'); if (!out || !out.classList) return;
  out.classList.remove('pulse'); void out.offsetWidth; out.classList.add('pulse');
}
function calcLive() {
  if (TAB !== 'calc') return;
  clearTimeout(CALC_TIMER);
  CALC_TIMER = setTimeout(() => { if (TAB !== 'calc') return; calcRun(true); calcPulse(); }, 240);
}
function calcPreset(from, to) {
  const f = $('#c_from'), t = $('#c_to'); if (!f || !t) return;
  f.value = from; t.value = to;
  calcDistance(true); calcRun(true); calcPulse();
  toast('Плечо подставлено: <b>' + esc(from) + ' → ' + esc(to) + '</b> — ставка пересчитана', 'ok');
}
window.calcPreset = calcPreset;

/* ---------- реестр: живой поиск по таблице ---------- */
function carrierSearch(q) {
  q = String(q || '').trim().toLowerCase();
  const body = $('#carrierRows'); if (!body) return;
  const rows = body.querySelectorAll('tr[data-s]');
  let shown = 0;
  rows.forEach(tr => {
    const hit = !q || (tr.getAttribute('data-s') || '').indexOf(q) >= 0;
    tr.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const c = $('#cf_count'); if (c) c.textContent = q ? ('найдено ' + shown + ' из ' + rows.length) : ('всего ' + rows.length);
}
window.carrierSearch = carrierSearch;

/* ---------- переход между вкладками: клавиши и свайпы ---------- */
function currentTabIndex() { return TABS.findIndex(t => t[0] === TAB); }
function shiftTab(step) {
  const i = currentTabIndex(); if (i < 0) return;
  showTab(TABS[(i + step + TABS.length) % TABS.length][0]);
}
window.shiftTab = shiftTab;

/* ---------- копирование ссылки ---------- */
function copyLink(text, okMsg) {
  const done = () => toast((okMsg || 'Скопировано') + ': <b>' + esc(text) + '</b>', 'ok');
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    } catch (e) {
      openModal('Ссылка на сайт', '<div class="note">Скопируйте адрес вручную:<br><b>' + esc(text) + '</b></div>', '<button class="btn" onclick="closeModal()">Закрыть</button>');
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); return; }
  } catch (e) {}
  fallback();
}
window.copyLink = copyLink;

/* ---------- инициализация отклика интерфейса ---------- */
(function initLive() {
  /* рябь по кнопкам */
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('.btn,.chip');
    if (!b || !b.getBoundingClientRect) return;
    const r = b.getBoundingClientRect();
    if (!r.width) return;
    const d = Math.max(r.width, r.height), s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }, true);

  /* логотип: клик/касание разворачивает название (для планшетов и телефонов) */
  document.addEventListener('click', e => {
    const el = e.target && e.target.closest && e.target.closest('.ks-logo');
    if (!el || el.closest('.logo-tab') || (e.target.closest && e.target.closest('.copy'))) return;
    el.classList.toggle('open');
  });

  /* клавиши ← → и Esc */
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target || {};
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable) return;
    const mb = $('#modalBg');
    if (mb && mb.classList.contains('open')) { if (e.key === 'Escape') closeModal(); return; }
    if (MENU_OPEN) {
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') return;   /* пока меню открыто, разделы не листаем */
      return;
    }
    if (e.key === 'ArrowRight') shiftTab(1);
    else if (e.key === 'ArrowLeft') shiftTab(-1);
  });

  /* свайп влево по меню закрывает его */
  const dr = $('#drawer');
  if (dr && dr.addEventListener) {
    let mx = 0, my = 0;
    dr.addEventListener('touchstart', e => { if (e.touches.length === 1) { mx = e.touches[0].clientX; my = e.touches[0].clientY; } }, { passive: true });
    dr.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - mx, dy = e.changedTouches[0].clientY - my;
      if (dx < -60 && Math.abs(dy) < 60) closeMenu();
    }, { passive: true });
  }

  /* свайп по содержимому: следующий/предыдущий раздел */
  const v = $('#view');
  if (v && v.addEventListener) {
    let x0 = 0, y0 = 0, t0 = 0, armed = false;
    v.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { armed = false; return; }
      const tg = e.target;
      if (tg.closest && (tg.closest('.tbl-scroll') || tg.closest('input') || tg.closest('select') || tg.closest('textarea') || tg.closest('.chips'))) { armed = false; return; }
      armed = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    v.addEventListener('touchend', e => {
      if (!armed) return; armed = false;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Date.now() - t0 > 800 || Math.abs(dx) < 70 || Math.abs(dy) > 55) return;
      shiftTab(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* калькулятор: пересчёт при вводе и при смене плеча */
  document.addEventListener('input', e => { const id = (e.target && e.target.id) || ''; if (/^c_/.test(id)) calcLive(); });
  document.addEventListener('change', e => {
    const id = (e.target && e.target.id) || '';
    if (id === 'c_from' || id === 'c_to') { calcDistance(true); calcRun(true); calcPulse(); }
    else if (/^c_/.test(id)) calcLive();
  });

  /* полоса прогресса чтения и кнопка «наверх» */
  const pb = $('#progress'), tt = $('#toTop');
  const onScroll = () => {
    const h = document.documentElement || {};
    const max = (h.scrollHeight || 0) - (h.clientHeight || 0);
    const y = window.pageYOffset || h.scrollTop || 0;
    if (pb) pb.style.width = (max > 0 ? Math.min(100, y / max * 100) : 0) + '%';
    if (tt && tt.classList) tt.classList.toggle('show', y > 520);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  renderTicker();
})();
