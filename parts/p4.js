/* ============================================================
   Часть 3/3: Совет перевозчиков, Документы, Кабинет, запуск
   ============================================================ */

/* ============================================================
   ВКЛАДКА 4. СОВЕТ ПЕРЕВОЗЧИКОВ
   ============================================================ */
let VOTE_AS = 'M-1';
/* ---------- состояние Совета: формирование → выборы → работа ---------- */
function realVerified() { return DB.carriers.filter(c => c.status === 'verified' && !c.demo); }
function electionProgress() {
  const need = (DB.settings && DB.settings.electionThreshold) || 50;
  const n = realVerified().length;
  return { n, need, pct: Math.min(100, Math.round(n / need * 100)), ready: n >= need, demoCount: DB.carriers.filter(c => c.demo).length };
}
function councilPhase() {
  if (DB.settings && DB.settings.elections && DB.settings.elections.completed) return 'elected';
  if (DB.settings && DB.settings.elections) return 'campaign';
  if (DB.settings && DB.settings.demoCouncil) return 'demo';
  return 'formation';
}
const PHASE_TEXT = {
  formation: ['Переходный период: Совет формируется', 'b-warn'],
  campaign: ['Избирательная кампания', 'b-info'],
  elected: ['Совет избран', 'b-ok'],
  demo: ['Учебный режим механики голосования', 'b-mut']
};

function viewCouncil() {
  const pr = electionProgress();
  const phase = councilPhase();
  const demo = phase === 'demo' || !!DB.settings.demoCouncil;
  const camp = DB.settings.elections;
  const canVote = (ROLE === 'council' || ROLE === 'admin') && demo;
  const canPropose = ROLE === 'council' || ROLE === 'admin';
  const voting = DB.votes.filter(v => v.status === 'voting');
  const votingReal = voting.filter(v => !v.demo);
  const votingDemo = voting.filter(v => v.demo);
  const candidates = realVerified();

  const statusCard = `
  <div class="card">
    <div class="row between">
      <div>
        <div class="row" style="gap:8px;margin-bottom:6px">
          <span class="badge ${PHASE_TEXT[phase][1]}">${PHASE_TEXT[phase][0]}</span>
          ${demo ? '<span class="badge b-mut">УЧЕБНЫЙ РЕЖИМ</span>' : ''}
          ${DB.settings.demoCouncil ? '' : ''}
        </div>
        <h2 style="margin:0">Совет перевозчиков ${phase === 'elected' ? '— избран и работает' : '— формируется'}</h2>
        <div class="sub" style="margin:6px 0 0">
          ${phase === 'elected'
            ? 'Состав сформирован по итогам выборов участников. Решения принимаются голосованием: тарифы — 6 из 9, работа платформы — 5 из 9, Устав — 7 из 9, кворум — 7 членов.'
            : 'Выборы назначаются, когда в реестре будет <b>' + pr.need + '</b> реальных верифицированных перевозчиков. ' +
              'До избрания Совета действуют <b>Переходные положения Устава</b>: тарифную сетку ведёт Администрация строго по методике, проекты решений публикуются как открытые обсуждения.'}
        </div>
      </div>
      <div style="text-align:right;min-width:160px">
        <div style="font-size:30px;font-weight:900;color:var(--acc)">${pr.n} / ${pr.need}</div>
        <div class="mini">реальных перевозчиков в реестре</div>
      </div>
    </div>
    <div class="bar" style="margin-top:12px"><i style="width:${pr.pct}%"></i></div>
    <div class="row between" style="margin-top:6px">
      <span class="mini">готовность к выборам: <b>${pr.pct}%</b></span>
      <span class="mini">демонстрационных профилей в реестре: ${pr.demoCount} — в счёт не идут</span>
    </div>
    ${camp ? `
      <hr>
      <div class="smallcaps" style="margin-bottom:6px">Избирательная кампания</div>
      <div class="row" style="gap:18px">
        <div class="pill">назначены: ${dt(camp.announced)}</div>
        <div class="pill">выдвижение кандидатов до: ${dt(camp.candidatesDeadline)}</div>
        <div class="pill">голосование участников до: ${dt(camp.voteDeadline)}</div>
        <div class="pill">кандидатов: ${candidates.length} (нужно ≥ 9)</div>
      </div>
      ${candidates.length >= 9 ? '<button class="btn pri" style="margin-top:12px" onclick="publishCouncil()">Опубликовать избранный состав (9 мест)</button>' : '<p class="mini" style="margin-top:10px">После выдвижения минимум 9 кандидатов появится кнопка публикации состава. Кандидаты формируются из реальных верифицированных перевозчиков, прошедших отбор.</p>'}
    ` : (pr.ready
      ? `<button class="btn pri" style="margin-top:12px" onclick="scheduleElections()">Назначить выборы Совета</button>`
      : `<p class="mini" style="margin-top:10px">Порог ${pr.need} перевозчиков ещё не достигнут — выборы будут назначены автоматически по достижении порога (кнопка появится в кабинете Администрации).</p>`)}
  </div>`;

  const transitionCard = `
  <div class="card" style="margin-top:16px">
    <h3>Переходные положения: как управляется платформа до выборов</h3>
    <ol class="tl" style="margin-top:8px">
      <li><b>Тарифная сетка.</b> Ведётся Администрацией строго по Регламенту расчёта: источники — Росстат (цена ДТ), ПП РФ № 843 («Платон»), данные участников, рыночные бенчмарки. Каждое изменение публикуется с расчётом «до/после» и попадает в реестр как «решение переходного периода».</li>
      <li><b>Проекты решений.</b> Любой перевозчик-участник вправе опубликовать предложение; оно идёт в открытое обсуждение (не менее 7 дней), замечания собираются в карточке вопроса.</li>
      <li><b>Утверждение.</b> В переходный период тарифные решения утверждает Администрация; после избрания Совета — Совет голосованием (6/5/7 из 9).</li>
      <li><b>Выборы.</b> Назначаются при достижении <b>${pr.need}</b> реальных верифицированных перевозчиков: выдвижение — 20 дней, голосование участников — 15 дней, кумулятивное голосование, квоты по федеральным округам.</li>
      <li><b>Для первых выборов требования к кандидату мягче:</b> статус «Верифицирован», отсутствие применённых санкций, заявка от компании. Требование рейтинга ≥ 80 и стажа 12 месяцев применяется начиная со второго цикла — чтобы первые выборы не блокировались отсутствием истории.</li>
    </ol>
  </div>`;

  const demoSwitch = ['admin', 'council'].includes(ROLE) ? `
  <div class="card" style="margin-top:16px">
    <div class="row between">
      <div><h3 style="margin:0">Учебный режим</h3>
      <div class="mini">Показать механику голосования на девяти демонстрационных членах Совета: пороги, кворум, поименные голоса, авто-применение решения к тарифной сетке. Данные вымышленные и в реестр решений попадают только как демонстрация.</div></div>
      <button class="btn ${demo ? 'bad' : 'pri'}" onclick="toggleDemoCouncil()">${demo ? 'Выключить учебный режим' : 'Включить учебный режим'}</button>
    </div>
  </div>` : '';

  if (demo) {
    return `
    ${statusCard}
    <div class="note warn" style="margin-top:12px"><b>Учебный режим включён.</b> Состав Совета, вопросы и голоса ниже — демонстрационные (показывают, как будет работать Совет после выборов). Они не являются решениями платформы.</div>
    <div class="grid g4" style="margin:16px 0">
      <div class="kpi"><div class="k">9</div><div class="l">мест в Совете</div><div class="n">квоты по федеральным округам</div></div>
      <div class="kpi"><div class="k">${voting.length}</div><div class="l">вопросов на голосовании</div><div class="n">кворум — ${COUNCIL_RULES.quorum} членов</div></div>
      <div class="kpi"><div class="k">6 / 5 / 7</div><div class="l">пороги: тариф / платформа / Устав</div><div class="n">из 9 голосов «за»</div></div>
      <div class="kpi"><div class="k">${DB.decisions.length}</div><div class="l">записей в реестре решений</div><div class="n">включая принятые в переходный период</div></div>
    </div>
    <div class="grid g23">
      <div>
        <div class="card">
          <div class="row between"><h2 style="margin:0">Вопросы на голосовании <span class="badge b-mut">ДЕМО</span></h2>${canPropose ? '<button class="btn sm" onclick="proposeForm()">＋ Внести предложение</button>' : ''}</div>
          <div class="sub">Голосование — ${COUNCIL_RULES.voteDays} календарных дней. Решение принято, если «за» подано не менее порога и собрано ${COUNCIL_RULES.quorum} голосов.</div>
          ${voting.length ? voting.map(v => voteCard(v, canVote)).join('') : '<p class="mini">Открытых голосований нет.</p>'}
        </div>
        <div class="card" style="margin-top:16px">
          <h2>Реестр решений</h2>
          <div class="sub">Принятые акты. Значения из тарифных решений автоматически переносятся в тарифную сетку калькулятора.</div>
          ${DB.decisions.map(decisionRow).join('')}
        </div>
      </div>
      <div>
        <div class="card">
          <h2>Состав Совета <span class="badge b-warn">ДЕМО</span></h2>
          <div class="sub">9 членов, выдвигаются участниками, избираются кумулятивным голосованием с квотами по округам. Ниже — демонстрационные профили для показа механики.</div>
          ${DB.members.map(memberRow).join('')}
          <div class="note">Председатель избирается Советом на ${COUNCIL_RULES.chairTermMonths} месяцев, ведёт заседания и подписывает реестр решений; при равенстве голосов его голос — решающий (кроме вопросов Устава, где нужно ${COUNCIL_RULES.thresholds.charter} голосов).</div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2>Порядок принятия решений</h2>
          <ol class="tl" style="margin-top:8px">
            <li><b>Инициатива.</b> Член Совета, комитет, участник через кабинет или Администрация.</li>
            <li><b>Публикация.</b> Проект, обоснование и расчёт — в открытом доступе 7 дней.</li>
            <li><b>Обсуждение.</b> Замечания собираются в карточке вопроса; профильный комитет готовит заключение.</li>
            <li><b>Голосование.</b> Открытое, персональное: тариф 6/9, платформа 5/9, Устав 7/9, кворум 7.</li>
            <li><b>Опубликование.</b> Реестр решений, тарифная сетка и регламенты обновляются в течение 3 рабочих дней.</li>
            <li><b>Обжалование.</b> Согласительная комиссия и Арбитраж (Устав, ст. 12).</li>
          </ol>
        </div>
        <div class="card" style="margin-top:16px">
          <h2>Журнал платформы</h2>
          <div class="tbl-scroll" style="max-height:240px"><table><tbody>
            ${DB.log.slice(0, 12).map(x => '<tr><td class="mini" style="white-space:nowrap">' + dt(x.at) + '</td><td class="mini">' + esc(x.text) + '</td></tr>').join('')}
          </tbody></table></div>
        </div>
      </div>
    </div>
    ${demoSwitch}`;
  }

  return `
  ${statusCard}
  <div class="grid g23" style="margin-top:16px">
    <div>
      <div class="card">
        <div class="row between"><h2 style="margin:0">Открытые обсуждения</h2>${canPropose ? '<button class="btn sm" onclick="proposeForm()">＋ Внести предложение</button>' : ''}</div>
        <div class="sub">До избрания Совета проекты решений публикуются для открытого обсуждения. По тарифам решение утверждает Администрация строго по расчёту; после выборов все проекты передаются Совету.</div>
        ${votingReal.length ? votingReal.map(v => transitionVoteCard(v)).join('') : '<p class="mini">Открытых обсуждений нет. Первое предложение может внести любой участник — кнопка «Внести предложение» выше.</p>'}
        ${votingDemo.length ? `<details class="acc" style="margin-top:10px"><summary>Примеры вопросов для будущего Совета (${votingDemo.length}) — демонстрация, в работу не идут</summary>
          ${votingDemo.map(v => transitionVoteCard(v, true)).join('')}
        </details>` : ''}
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Реестр решений</h2>
        <div class="sub">Каждая запись содержит основание, результат и эффект: что именно изменилось в тарифной сетке или правилах. Записи с пометкой «пример для ознакомления» — демонстрационные и не являются действующими актами.</div>
        ${DB.decisions.filter(d => !d.demo).map(decisionRow).join('') || '<p class="mini">Решений переходного периода пока нет. Первое появится после утверждения тарифного проекта.</p>'}
        ${DB.decisions.filter(d => d.demo).length ? '<details class="acc" style="margin-top:10px"><summary>Примеры записей реестра (' + DB.decisions.filter(d => d.demo).length + ')</summary>' + DB.decisions.filter(d => d.demo).map(decisionRow).join('') + '</details>' : ''}
      </div>
    </div>
    <div>
      ${transitionCard}
      <div class="card" style="margin-top:16px">
        <h2>Места в Совете</h2>
        <div class="sub">После выборов здесь появятся карточки девяти избранных членов: компания, округ, комитет, дата избрания и число голосов.</div>
        <div class="grid g2" style="gap:8px">
          ${Array.from({ length: 9 }).map((_, i) => '<div class="member" style="opacity:.75"><div class="row" style="gap:10px"><div class="avatar">?</div><div><div class="mini">Место ' + (i + 1) + '</div><div class="mini">вакантно до выборов</div></div></div></div>').join('')}
        </div>
        <div class="note" style="margin-top:12px">Кандидат для первых выборов: статус «Верифицирован», отсутствие применённых санкций, заявка от компании. Квоты: ЮФО/СКФО — 2, СЗФО — 2, ЦФО — 1, ПФО — 1, УФО/СФО — 2, ДФО — 1.</div>
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Журнал платформы</h2>
        <div class="tbl-scroll" style="max-height:240px"><table><tbody>
          ${DB.log.slice(0, 12).map(x => '<tr><td class="mini" style="white-space:nowrap">' + dt(x.at) + '</td><td class="mini">' + esc(x.text) + '</td></tr>').join('')}
        </tbody></table></div>
      </div>
    </div>
  </div>
  ${demoSwitch}`;
}

function memberRow(m) {
  return `<div class="member" style="margin-bottom:8px">
    <div class="row" style="gap:10px;align-items:flex-start">
      <div class="avatar">${m.name.split(' ')[0][0] + (m.name.split(' ')[1] || '')[0]}</div>
      <div style="flex:1">
        <div class="row between"><b>${esc(m.name)}</b>${m.chair ? '<span class="badge b-gold">Председатель</span>' : ''}</div>
        <div class="mini">${esc(m.company)} · ${esc(m.city)} (${esc(m.district)})</div>
        <div class="mini">${esc(m.committee)} · выдвинут ${fmt(m.electedBy)} голосами · полномочия до ${dt(m.until)}</div>
      </div>
    </div>
  </div>`;
}
function decisionRow(d) {
  return `<div class="member" style="margin-bottom:8px">
    <div class="row between"><b>${esc(d.title)}</b><span class="row" style="gap:6px">${d.demo ? '<span class="badge b-mut">пример для ознакомления</span>' : ''}<span class="badge ${/Принято|Утверждено|избран/i.test(d.result || '') ? 'b-ok' : 'b-bad'}">${esc(d.result)}</span></span></div>
    <div class="mini" style="margin-top:4px">${d.id} · ${esc(COUNCIL_RULES.kinds[d.kind] || 'решение')} · ${dt(d.at)}</div>
    <div class="mini" style="margin-top:4px">${esc(d.effect)}</div>
  </div>`;
}
function payloadText(v) {
  return Object.entries(v.payload || {}).map(([k, val]) => {
    if (k === 'floor') return 'минимальная ставка: <b>' + money(val) + '</b>';
    if (k === 'floorRoute') return 'плечо: <b>' + esc(val) + '</b>';
    if (k === 'floorType') return 'тип: <b>' + esc(val) + '</b>';
    if (k === 'requireOsgop') return 'обязательный ОСГОП: <b>да</b>';
    if (k === 'effective') return 'с даты: <b>' + dt(val) + '</b>';
    const meta = TARIFF_META.find(x => x[0] === k);
    return (meta ? meta[1] : k) + ': <b>' + (typeof val === 'number' ? fmt2(val) : esc(String(val))) + '</b>';
  }).join(' · ');
}
function transitionVoteCard(v, isExample) {
  const t = tally(v);
  const canApprove = !isExample && !v.demo && ROLE === 'admin' && v.kind === 'tariff' && v.status === 'voting';
  return `<div class="vote-box" style="margin-bottom:12px">
    <div class="row between">
      <div><span class="badge ${v.kind === 'tariff' ? 'b-gold' : v.kind === 'charter' ? 'b-bad' : 'b-info'}">${esc(COUNCIL_RULES.kinds[v.kind])}</span>
        <span class="mini"> · ${v.id} · внесено ${dt(v.created)} · ${esc(v.author)}</span></div>
      <span class="badge ${t.passed ? 'b-ok' : 'b-warn'}">${t.passed ? 'решение утверждено' : 'обсуждение до ' + dt(v.deadline)}</span>
    </div>
    <div style="margin:10px 0 6px;font-weight:700">${esc(v.title)}</div>
    <div class="mini" style="margin-bottom:8px">${esc(v.summary)}</div>
    ${v.payload && Object.keys(v.payload).length ? '<div class="mini" style="margin-bottom:10px">Предмет решения: ' + payloadText(v) + '</div>' : ''}
    <div class="mini" style="margin-bottom:10px">${isExample || v.demo ? 'Демонстрационный вопрос: показывает форму карточки и пороги. В работу не идёт.' : 'Для утверждения нужен Совет: порог ' + t.need + ' из ' + COUNCIL_RULES.seats + ', кворум ' + COUNCIL_RULES.quorum + '. После выборов вопрос передаётся Совету автоматически.'}</div>
    ${v.status === 'voting'
      ? (canApprove
        ? '<button class="btn pri" onclick="approveTransition(\'' + v.id + '\')">Утвердить в переходный период (Администрация)</button>'
        : '<span class="badge b-mut">ожидает решения</span>')
      : '<span class="badge b-ok">в реестре решений</span>'}
  </div>`;
}
function approveTransition(id) {
  const v = DB.votes.find(x => x.id === id);
  if (!v || v.status !== 'voting') return;
  v.status = 'passed';
  v.result = { for: 0, against: 0, abstain: 0, decision: 'Утверждено Администрацией (переходный период)', at: todayISO() };
  applyDecision(v, 'Утверждено Администрацией · переходный период');
  DB.log.unshift({ at: todayISO(), text: 'Переходный период: утверждено решение ' + v.id + ' — ' + v.title + '.' });
  sbPushVote(v); sbPushTariff();
  save(); render();
  toast('Решение ' + v.id + ' утверждено в переходный период. Тарифная сетка обновлена, запись добавлена в реестр решений.', 'ok');
}
function scheduleElections() {
  const pr = electionProgress();
  if (!pr.ready) { toast('Выборы назначаются при ' + pr.need + ' реальных верифицированных перевозчиках. Сейчас: ' + pr.n + '.', 'bad'); return; }
  DB.settings.elections = { announced: todayISO(), candidatesDeadline: addDays(todayISO(), 20), voteDeadline: addDays(todayISO(), 35) };
  DB.log.unshift({ at: todayISO(), text: 'Назначены выборы Совета перевозчиков: выдвижение до ' + dt(DB.settings.elections.candidatesDeadline) + ', голосование до ' + dt(DB.settings.elections.voteDeadline) + '.' });
  sbPushSettings();
  save(); render();
  toast('Выборы назначены. Выдвижение кандидатов — 20 дней, голосование участников — 15 дней.', 'ok');
}
function publishCouncil() {
  const cands = realVerified().slice(0, 9);
  if (cands.length < 9) { toast('Для публикации состава нужно минимум 9 кандидатов. Сейчас: ' + cands.length + '.', 'bad'); return; }
  DB.members = cands.map((c, i) => ({
    id: 'M-' + (i + 1), name: c.name, company: c.name, city: c.city, district: c.region, committee: ['Тарифный комитет', 'Комитет по качеству', 'Комитет по цифровизации'][i % 3],
    until: addDays(todayISO(), COUNCIL_RULES.termMonths * 30), electedBy: 0, chair: i === 0, role: i === 0 ? 'Председатель Совета' : 'Член Совета'
  }));
  DB.settings.elections.completed = todayISO();
  DB.settings.demoCouncil = false;
  DB.log.unshift({ at: todayISO(), text: 'Опубликован избранный состав Совета перевозчиков (' + DB.members.length + ' членов). Переходный период завершён.' });
  sbPushSettings();
  save(); render();
  toast('Состав Совета опубликован. Переходный период завершён — решения принимаются голосованием.', 'ok');
}
function toggleDemoCouncil() {
  DB.settings.demoCouncil = !DB.settings.demoCouncil;
  if (DB.settings.demoCouncil && ROLE !== 'council' && ROLE !== 'admin') { ROLE = 'council'; Store.set('ks_role', ROLE); $('#roleSel').value = 'council'; }
  sbPushSettings();
  save(); render();
  toast(DB.settings.demoCouncil ? 'Учебный режим включён: показана механика голосования.' : 'Учебный режим выключен.', 'ok');
}
window.realVerified = realVerified;
window.approveTransition = approveTransition;
[scheduleElections, publishCouncil, toggleDemoCouncil].forEach(f => window[f.name] = f);

function roster(v) {
  const cls = { 'for': 'b-ok', 'against': 'b-bad', 'abstain': 'b-mut', 'none': 'b-warn' };
  const lbl = { 'for': 'За', 'against': 'Против', 'abstain': 'Воздерж.', 'none': 'Не голосовал' };
  return DB.members.map(m => '<span class="badge ' + cls[v.votes[m.id] || 'none'] + '" title="' + esc(m.name) + '">' + m.name.split(' ')[0] + ': ' + lbl[v.votes[m.id] || 'none'] + '</span>').join(' ');
}
function voteCard(v, canVote) {
  const t = tally(v);
  const pct = n => Math.round(n / COUNCIL_RULES.seats * 100);
  const my = v.votes[VOTE_AS] || 'none';
  return `<div class="vote-box" style="margin-bottom:12px">
    <div class="row between"><div><span class="badge ${v.kind === 'tariff' ? 'b-gold' : v.kind === 'charter' ? 'b-bad' : 'b-info'}">${esc(COUNCIL_RULES.kinds[v.kind])}</span>
      <span class="mini"> · ${v.id} · внесено ${dt(v.created)} · ${esc(v.author)} · до ${dt(v.deadline)} (${daysLeft(v.deadline)} дн.)</span></div>
      ${t.passed ? '<span class="badge b-ok">порог набран</span>' : t.expired ? '<span class="badge b-bad">срок истёк</span>' : '<span class="badge b-warn">голосование идёт</span>'}</div>
    <div style="margin:10px 0 6px;font-weight:700">${esc(v.title)}</div>
    <div class="mini" style="margin-bottom:8px">${esc(v.summary)}</div>
    ${v.payload && Object.keys(v.payload).length ? '<div class="mini" style="margin-bottom:10px">Предмет решения: ' + payloadText(v) + '</div>' : ''}
    <div class="vote-bar">
      <i style="width:${pct(t['for'])}%;background:#2fbf71">${t['for'] ? 'За ' + t['for'] : ''}</i>
      <i style="width:${pct(t['against'])}%;background:#ef5350">${t['against'] ? 'Против ' + t['against'] : ''}</i>
      <i style="width:${pct(t.abstain)}%;background:#93a7c2">${t.abstain ? 'Возд. ' + t.abstain : ''}</i>
    </div>
    <div class="mini" style="margin-top:6px">Нужно «за»: <b>${t.need} из ${COUNCIL_RULES.seats}</b> · Проголосовало: <b>${t.cast}</b>${t.quorum ? ' (кворум собран)' : ' (кворум не собран)'}</div>
    <div style="margin-top:10px">${roster(v)}</div>
    ${canVote && v.status === 'voting' ? `<hr>
      <div class="row">
        <span class="mini">Голосовать от имени:</span>
        <select style="width:auto" onchange="setVoteAs(this.value)">${DB.members.map(m => '<option value="' + m.id + '" ' + (VOTE_AS === m.id ? 'selected' : '') + '>' + esc(m.name) + '</option>').join('')}</select>
        <button class="btn sm ${my === 'for' ? 'ok' : ''}" onclick="castVote('${v.id}','for')">За</button>
        <button class="btn sm ${my === 'against' ? 'bad' : ''}" onclick="castVote('${v.id}','against')">Против</button>
        <button class="btn sm" onclick="castVote('${v.id}','abstain')">Воздержаться</button>
      </div>` : ''}
  </div>`;
}
function setVoteAs(id) { VOTE_AS = id; toast('Голосование от имени: <b>' + esc(DB.members.find(m => m.id === id).name) + '</b>'); render(); }
window.setVoteAs = setVoteAs;
function castVote(id, choice) {
  const v = DB.votes.find(x => x.id === id);
  v.votes[VOTE_AS] = choice === v.votes[VOTE_AS] ? 'none' : choice;
  if (v.votes[VOTE_AS] === 'none') delete v.votes[VOTE_AS];
  const t = tally(v);
  const m = DB.members.find(x => x.id === VOTE_AS);
  DB.log.unshift({ at: todayISO(), text: 'Голос по ' + v.id + ': ' + m.name + ' — «' + choice + '».' });
  if (!v.demo) { sbPushBallot(id, VOTE_AS, v.votes[VOTE_AS]); sbPushVote(v); }   // учебные голосования в базу не пишем
  if (t.quorum && t.passed && v.status === 'voting') {
    v.status = 'passed'; v.result = { for: t['for'], against: t['against'], abstain: t.abstain, decision: 'Принято', at: todayISO() };
    if (v.demo) {
      /* Учебный режим: показываем механику, но реальные данные (тариф, база) не трогаем. */
      const p = v.payload || {};
      const what = ('fuelPrice' in p ? 'цена ДТ → ' + fmt2(p.fuelPrice) + ' ₽/л' : '') +
                   ('marginBase' in p ? (('fuelPrice' in p) ? ', ' : '') + 'маржа → ' + fmt2(p.marginBase) + '%' : '');
      DB.decisions.unshift({
        demo: true, id: v.id, title: v.title, kind: v.kind, at: todayISO(),
        result: 'Учебное голосование (не применяется)',
        effect: 'Демонстрация механики: порог ' + t.need + ' из ' + COUNCIL_RULES.seats + ' набран. После избрания Совета такое решение изменило бы: ' + (what || 'тарифную сетку платформы') + '. Реальные данные не изменены.'
      });
      toast('<b>Учебное голосование:</b> порог набран (' + t['for'] + '/' + COUNCIL_RULES.seats + '). Это демонстрация — тарифная сетка и база не изменяются.', 'ok');
    } else {
      applyDecision(v);
      sbPushVote(v); sbPushTariff();
      toast('<b>Решение ' + v.id + ' принято</b> (' + t['for'] + '/' + COUNCIL_RULES.seats + '). Тарифная сетка и реестр решений обновлены.', 'ok');
      if (v.payload && (v.payload.fuelPrice || v.payload.marginBase)) toast('Калькулятор пересчитан по новой сетке: ДТ ' + fmt2(v.payload.fuelPrice || DB.tariff.val.fuelPrice) + ' ₽/л, маржа ' + fmt2(v.payload.marginBase || DB.tariff.val.marginBase) + '%.');
    }
  } else {
    toast('Голос учтён: ' + (choice === 'for' ? 'за' : choice === 'against' ? 'против' : 'воздержался') + '. Осталось «за» до порога: ' + Math.max(0, t.need - t['for']));
  }
  save(); render();
}
function proposeForm() {
  openModal('Внесение предложения', `
    <div class="note">${councilPhase() === 'demo' || DB.settings.demoCouncil
      ? '<b>Учебный режим включён:</b> предложение будет помечено как демонстрационное, в базу не запишется и реальную тарифную сетку не изменит.'
      : 'До избрания Совета предложение публикуется как открытое обсуждение. Тарифные решения в переходный период утверждает Администрация строго по расчёту; после выборов вопрос передаётся Совету.'}</div>
    <div class="grid g2" style="margin-top:12px">
      <div class="field"><label>Категория вопроса</label><select id="np_kind" onchange="proposeKinds()">
        <option value="tariff">Тарифное регулирование (порог 6/9)</option>
        <option value="org">Работа платформы (порог 5/9)</option>
        <option value="charter">Изменение Устава (порог 7/9)</option>
      </select></div>
      <div class="field"><label>Срок обсуждения до</label><input type="date" id="np_deadline" value="${addDays(todayISO(), COUNCIL_RULES.voteDays)}"></div>
    </div>
    <div class="field"><label>Название (формулировка решения)</label><input type="text" id="np_title" value=""></div>
    <div class="field"><label>Обоснование</label><textarea id="np_summary" rows="3"></textarea></div>
    <div id="np_tariff" class="grid g2">
      <div class="field"><label>Цена ДТ, ₽/л</label><input type="number" id="np_fuel" value="${DB.tariff.val.fuelPrice}" step="0.01"></div>
      <div class="field"><label>Базовая маржа, %</label><input type="number" id="np_margin" value="${DB.tariff.val.marginBase}" step="0.5"></div>
      <div class="field"><label>Минимальная ставка по плечу (необязательно)</label><input type="number" id="np_floor" value="0"></div>
      <div class="field"><label>Плечо и тип</label><input type="text" id="np_route" value="" placeholder="Новороссийск→Москва, 40′HC"></div>
    </div>
  `, '<button class="btn pri" onclick="proposeCreate()">Опубликовать предложение</button><button class="btn" onclick="closeModal()">Отмена</button>');
  proposeKinds();
}
function proposeKinds() { const k = $('#np_kind').value; $('#np_tariff').style.display = k === 'tariff' ? '' : 'none'; }
function proposeCreate() {
  const kind = $('#np_kind').value;
  const title = $('#np_title').value.trim();
  if (title.length < 10) { toast('Сформулируйте название проекта решения', 'bad'); return; }
  const payload = {};
  if (kind === 'tariff') {
    payload.fuelPrice = num($('#np_fuel').value); payload.marginBase = num($('#np_margin').value);
    const fl = num($('#np_floor').value);
    if (fl > 0) { const r = $('#np_route').value.split(','); payload.floorRoute = (r[0] || '').trim(); payload.floorType = (r[1] || '').trim(); payload.floor = fl; }
  }
  const ids = DB.votes.map(v => parseInt(String(v.id).replace(/\D+/g, '').slice(-2), 10) || 10);
  const v = {
    id: (kind === 'tariff' ? 'ТАР' : kind === 'charter' ? 'УСТ' : 'ОРГ') + '-2026-' + String(Math.max(10, ...ids) + 1),
    kind, title, summary: $('#np_summary').value.trim() || 'Обоснование прилагается отдельным расчётом.',
    author: ROLE === 'admin' ? 'Администрация платформы' : (DB.members.find(m => m.id === VOTE_AS) || { name: 'Участник' }).name,
    created: todayISO(), deadline: $('#np_deadline').value, payload, status: 'voting', votes: {},
    demo: !!DB.settings.demoCouncil
  };
  DB.votes.unshift(v);
  DB.log.unshift({ at: todayISO(), text: 'Внесено предложение ' + v.id + ': ' + v.title + '.' });
  if (!v.demo) sbPushVote(v);                                    // учебные предложения в базу не пишем
  save(); closeModal(); render();
  toast('Предложение ' + v.id + ' опубликовано' + (v.demo ? ' в учебном режиме (в базу не записывается)' : DB.settings.demoCouncil ? ' для голосования' : ' как открытое обсуждение'), 'ok');
}
[castVote, proposeForm, proposeKinds, proposeCreate].forEach(f => window[f.name] = f);

/* ============================================================
   ВКЛАДКА 5. ДОКУМЕНТЫ
   ============================================================ */
const DOCS = [
  {
    id: 'charter', name: 'Устав платформы «Контейнерный Союз»', ver: 'ред. 1.0, 15.10.2026', status: 'Проект к принятию Советом',
    about: 'Основной документ: статус платформы, права и обязанности участников, органы управления, порядок нормотворчества.',
    points: [
      'Платформа — добровольное некоммерческое объединение перевозчиков; не является регулятором и стороной договоров перевозки.',
      'Цели: прозрачная и экономически обоснованная цена, защита от демпинга, единые регламенты, цифровой документооборот.',
      'Участники: перевозчики (полные права после верификации), грузовладельцы (доступ к реестру и бирже), наблюдатели.',
      'Органы: Общее собрание участников (высший), Совет перевозчиков из 9 членов (исполнительно-нормотворческий), профильные комитеты, Ревизионная комиссия, Арбитраж, Администрация платформы.',
      'Тарифная сетка — расчётный ориентир, утверждается решениями Совета; принудительное применение цен к третьим лицам недопустимо (ст. 10 Закона № 135-ФЗ).',
      'Поправки в Устав — 7 из 9 голосов членов Совета и обязательная публикация на 7 дней.',
      'Выход участника свободный; имущество не распределяется, платформа финансируется из взносов и сервисов по решению Совета.'
    ]
  },
  {
    id: 'rules', name: 'Правила платформы', ver: 'ред. 1.0', status: 'Проект к принятию', about: 'Повседневные правила работы: регистрация, верификация, поведение, ответственность.',
    points: [
      'Регистрация: ИП/ЮЛ, ИНН, сведения о парке; статусы «Ожидает верификации» → «Верифицирован» → «Приостановлен».',
      'Верификация: ЕГРЮЛ/ЕГРИП, ОСГОП, лицензии и допуски, отсутствие налоговой задолженности, готовность к ЭТрН.',
      'Запрещено: фальсификация сведений, рейсы без обязательного страхования, «серые» схемы оплаты труда, перекредитовка чужих ставок.',
      'Общение и споры — только через платформу; уведомление о неисполнении рейса в течение 2 часов.',
      'Меры воздействия: предупреждение, снижение рейтинга, ограничение доступа к заявкам, приостановка, исключение.',
      'Конфликт интересов: член Совета не голосует по вопросу, затрагивающему его компанию (абстенция обязательна).'
    ]
  },
  {
    id: 'council', name: 'Положение о Совете перевозчиков', ver: 'ред. 1.0', status: 'Проект к принятию', about: 'Состав, избрание, пороги голосования, комитеты.',
    points: [
      '9 членов; избираются Общим собранием на 24 месяца методом куммулятивного голосования, с территориальными квотами (ЮФО/СКФО — 2, СЗФО — 2, ЦФО — 1, ПФО — 1, УФО/СФО — 2, ДФО — 1).',
      'Кандидат: рейтинг не ниже 80, стаж на платформе не менее 12 мес., отсутствие применённых санкций.',
      'Кворум — 7 членов. Пороги: тарифные решения — 6, вопросы платформы — 5, Устав — 7.',
      'Комитеты: Тарифный (сетка и минимальные ставки), по качеству и арбитражу, по цифровизации и документам.',
      'Ротация: переизбрание не более 6 из 9 мест в один цикл; Председатель — на 6 месяцев.',
      'Решения обязательны для участников только в части внутренних правил платформы и использования сервисов.'
    ]
  },
  {
    id: 'tariff', name: 'Регламент расчёта тарифной сетки и минимальной ставки', ver: 'ред. 2.3', status: 'Действует', about: 'Методика калькулятора: какие данные берутся и как меняются значения.',
    points: [
      'Источники: Росстат (средняя цена ДТ), ПП РФ № 843 (тариф «Платон»), фактические данные перевозчиков платформы (расход, ремонт, простои), отраслевые бенчмарки ставок.',
      'Пересмотр — не чаще одного раза в месяц и не реже одного раза в квартал; внеочередной — при изменении ДТ более чем на 3% или «Платона».',
      'Каждая строка сетки имеет версию, дату, основание (номер решения Совета) и визуальную историю изменений.',
      'Минимальная ставка по плечу рассчитывается как себестоимость + минимальная маржа и публикуется в реестре решений.',
      'Сетка носит рекомендательный характер; участник вправе применить свой расчёт, если он обоснован в карточке рейса.'
    ]
  },
  {
    id: 'rating', name: 'Регламент рейтинга и арбитража', ver: 'ред. 1.1', status: 'Действует', about: 'Формула рейтинга, уровни, санкции, порядок споров.',
    points: [
      'Формула: 7 показателей (сроки 28%, срывы 18%, отзывы 14%, стаж 10%, дисциплина 12%, прозрачность 10%, объём 8%).',
      'Пересчёт — после каждого закрытого рейса; спорный рейтинг замораживается до решения Арбитража.',
      'Уровни: Платина 90+, Золото 80+, Серебро 70+, Бронза 60+, ниже 60 — «Наблюдение».',
      'Арбитраж из 3 членов Совета (не коммерческих сторон спора); срок рассмотрения — 10 рабочих дней, решение публикуется обезличенно.',
      'Крупные споры (свыше 500 000 ₽) — с обязательным привлечением третейского органа.'
    ]
  },
  {
    id: 'reg', name: 'Регламент участника: регистрация и верификация', ver: 'ред. 1.0', status: 'Действует', about: 'Пошаговый чек-лист входа на платформу.',
    points: [
      'Шаг 1: заявка (ИНН, форма, парк, контейнерные площадки, допуски).',
      'Шаг 2: автопроверка ИНН и выписки, ручная проверка документов администрацией (до 3 рабочих дней).',
      'Шаг 3: подписание электронного согласия с Уставом и Правилами, стаж-балл «прозрачности».',
      'Шаг 4: доступ к бирже (со статусом «Верифицирован»), стартовый уровень рейтинга — «Бронза» при отсутствии истории.',
      'Шаг 5: первый рейс под наблюдением куратора из профильного комитета.'
    ]
  },
  {
    id: 'contract', name: 'Типовой договор-перевозки и оферта биржи грузов', ver: 'шаблон', status: 'Проект', about: 'Юридическая форма рейсов, совершаемых через платформу.',
    points: [
      'Платформа — информационный посредник: договор заключается напрямую между грузовладельцем и перевозчиком.',
      'Существенные условия: маршрут, тип контейнера, вес, срок, ставка, норма простоя (4 ч) и плата за сверхнормативный простой (1 500 ₽/ч), порядок оплаты.',
      'Обязательна ЭТрН; первичные документы — по Правилам платформы.',
      'Ответственность перевозчика — в пределах, установленных УАТ и ГК РФ; страхование ОСГОП обязательно.',
      'Акцепт оферты — подача ставки или назначение рейса; все изменения условий — только письменно в карточке рейса.'
    ]
  },
  {
    id: 'ethics', name: 'Кодекс добросовестной конкуренции', ver: 'ред. 1.0', status: 'Проект', about: 'Демпинг, сговор, честность данных.',
    points: [
      'Запрет на согласованные действия по ценам, разделу рынка и бойкотированию участников (ст. 11 Закона № 135-ФЗ).',
      'Демпингом признаётся ставка ниже минимальной ставки платформы, обоснованной по методике калькулятора.',
      'Демпинговые заявки помечаются, направляются в арбитраж и учитываются в показателе «дисциплина» рейтинга.',
      'Поощряется раскрытие данных о себестоимости в обезличенном виде — это влияет на «прозрачность» и на качество тарифной сетки.'
    ]
  },
  {
    id: 'privacy', name: 'Политика конфиденциальности и обработки данных', ver: 'ред. 1.0', status: 'Проект', about: '152-ФЗ, режим персональных и коммерческих данных.',
    points: [
      'Обрабатываются данные, необходимые для участия: реквизиты, контакты, сведения о рейсах, персональные данные представителей.',
      'Коммерческие данные (ставки, себестоимость) раскрываются только в обезличенном и агрегированном виде.',
      'Данные обрабатываются на серверах в РФ; согласие — электронное, отзывается в кабинете.',
      'Публикация реестра перевозчиков осуществляется в объёме, указанном при регистрации.'
    ]
  },
  {
    id: 'roadmap', name: 'Дорожная карта запуска (бесплатный хостинг)', ver: '15.10.2026', status: 'Черновик', about: 'Как проект публикуется без вложений и развивается онлайн.',
    points: [
      'Этап 1 (готово в прототипе): интерфейс, калькулятор, реестр, биржа, Совет, документы — в одном HTML-файле, работает без сервера.',
      'Этап 2 (бесплатно): размещение статической версии на GitHub Pages / Cloudflare Pages, поддомен вида kontsovet.pages.dev или container-union.pages.dev.',
      'Этап 3 (бесплатно): коллективное хранилище и аккаунты — Supabase Free (Postgres, авторизация, бесплатный тариф), либо Google-таблица как быстрый бэкенд.',
      'Этап 4: Telegram-бот и канал для уведомлений о голосованиях и заявках (бесплатно).',
      'Этап 5: юридическая оболочка — протокол о создании объединения, ЭДО, публикация реестра решений.'
    ]
  }
];
function viewDocs() {
  return `
  <div class="note">Пакет документов — <b>проекты</b>. До их принятия Советом платформа работает в переходном периоде. Полные тексты подготовлены отдельным файлом «Документы_Контейнерный_Союз.md» — его можно править онлайн и публиковать вместе с платформой.</div>
  <div class="note warn" style="margin-top:12px"><b>Текущий статус управления:</b> ${councilPhase() === 'elected' ? 'работает избранный Совет перевозчиков.' : 'переходный период — Совет формируется. Тарифную сетку ведёт Администрация строго по методике (Регламент расчёта), тарифные решения утверждаются с публикацией расчёта «до/после». Выборы назначаются при ' + electionProgress().need + ' реальных верифицированных перевозчиках (сейчас ' + electionProgress().n + ').'}</div>
  <div class="grid g2" style="margin-top:16px">
    ${DOCS.map(d => `<div class="card">
      <div class="row between"><h3 style="margin:0">${esc(d.name)}</h3><span class="badge ${d.status === 'Действует' ? 'b-ok' : d.status === 'Проект к принятию' || d.status === 'Проект к принятию Советом' ? 'b-warn' : 'b-mut'}">${esc(d.status)}</span></div>
      <div class="mini" style="margin:6px 0 10px">${esc(d.about)} · ${esc(d.ver)}</div>
      <details class="acc"><summary>Ключевые положения</summary><ul>${d.points.map(p => '<li>' + esc(p) + '</li>').join('')}</ul></details>
      <button class="btn sm" onclick="docFull('${d.id}')">Полный текст (краткая редакция на экране)</button>
    </div>`).join('')}
  </div>
  <div class="card" style="margin-top:16px">
    <h3>Правовая рамка проекта — что можно и чего нельзя</h3>
    <div class="grid g2">
      <div>
        <p class="mini"><b>Можно:</b></p>
        <ul style="padding-left:20px" class="mini">
          <li>рассчитывать и публиковать методику экономически обоснованной ставки;</li>
          <li>вести рейтинг добросовестности и реестр участников — с их согласия;</li>
          <li>разрабатывать и принимать внутренние правила участия (Устав, Правила, регламенты);</li>
          <li>публиковать рекомендованные (индикативные) ставки и помечать демпинг;</li>
          <li>использовать типовой договор-перевозки между грузовладельцем и перевозчиком.</li>
        </ul>
      </div>
      <div>
        <p class="mini"><b>Нельзя (без изменения законодательства):</b></p>
        <ul style="padding-left:20px" class="mini">
          <li>обязывать перевозчиков применять определённые цены — это нарушает свободу договора и антимонопольные запреты;</li>
          <li>координировать экономическую деятельность участников (ст. 11 Закона № 135-ФЗ);</li>
          <li>ограничивать доступ к рынку иначе как внутренними правилами собственной платформы;</li>
          <li>выступать в качестве регулятора или органа власти.</li>
        </ul>
      </div>
    </div>
    <div class="note warn" style="margin-top:12px">Поэтому модель платформы — «саморегулирование по факту»: наиболее полное регулирование возможно внутри собственной платформы (правила участия, доступ к заявкам, рейтинг, раскрытие данных), а не в отношении всего рынка. Именно так работают многие отраслевые ассоциации и цифровые биржи.</div>
  </div>`;
}
function docFull(id) {
  const d = DOCS.find(x => x.id === id);
  openModal(esc(d.name), `<div class="mini" style="margin-bottom:10px">${esc(d.ver)} · статус: ${esc(d.status)}</div>
    <p class="mini">${esc(d.about)}</p><hr>
    <ul style="padding-left:20px">${d.points.map(p => '<li style="margin:6px 0" class="mini">' + esc(p) + '</li>').join('')}</ul>
    <div class="note" style="margin-top:12px">Полная редакция документа входит в пакет «Документы_Контейнерный_Союз.md». Любую формулировку можно изменить решением Совета: создайте предложение во вкладке «Совет перевозчиков» с категорией «Изменение Устава» (порог 7/9).</div>`,
    '<button class="btn" onclick="closeModal()">Закрыть</button>');
}
window.docFull = docFull;

/* ============================================================
   ВКЛАДКА 6. КАБИНЕТ
   ============================================================ */
function viewCabinet() {
  if (ROLE === 'guest' || ROLE === 'admin') return `<div class="grid g23">
    <div class="card">
      <h2>Регистрация перевозчика на платформе</h2>
      <div class="sub">Участие бесплатное. После верификации открываются реестр, калькулятор, биржа грузов и право выдвижения в Совет.</div>
      <div class="grid g2">
        <div class="field"><label>Наименование или ФИО</label><input type="text" id="r_name" value="ООО «Мой Контейнер-Логистик»"></div>
        <div class="field"><label>Форма</label><select id="r_form"><option>ООО</option><option>ИП</option></select></div>
        <div class="field"><label>ИНН</label><input type="text" id="r_inn" value="2317999888"></div>
        <div class="field"><label>Город</label><select id="r_city">${CITIES.map(c => '<option>' + c[0] + '</option>').join('')}</select></div>
        <div class="field"><label>Федеральный округ</label><select id="r_region"><option>ЮФО</option><option>СКФО</option><option>СЗФО</option><option>ЦФО</option><option>ПФО</option><option>УФО</option><option>СФО</option><option>ДФО</option></select></div>
        <div class="field"><label>Контакт (телефон или e-mail)</label><input type="text" id="r_contact" value="+7 900 000-00-00"></div>
        <div class="field"><label>Единиц техники</label><input type="number" id="r_fleet" value="8"></div>
        <div class="field"><label>Контейнерных площадок</label><input type="number" id="r_cont" value="6"></div>
      </div>
      <div class="smallcaps" style="margin:8px 0 4px">Типы контейнеров</div>
      <div class="row" style="gap:14px">
        ${['20′', '40′', '40′HC', '45′HC', 'реф'].map((t, i) => '<label class="mini"><input type="checkbox" id="r_t' + i + '" ' + (i < 3 ? 'checked' : '') + '> ' + t + '</label>').join('')}
      </div>
      <hr>
      <div class="chk"><input type="checkbox" id="r_c1"><label for="r_c1" style="margin:0">Прочитал(а) и принимаю Устав и Правила платформы</label></div>
      <div class="chk"><input type="checkbox" id="r_c2"><label for="r_c2" style="margin:0">Согласен(на) на обработку данных и публикацию карточки в реестре перевозчиков</label></div>
      <div class="chk"><input type="checkbox" id="r_c3"><label for="r_c3" style="margin:0">Подтверждаю наличие полиса ОСГОП и готовность работать через ЭТрН</label></div>
      <button class="btn pri" onclick="register()">Отправить заявку на верификацию</button>
    </div>
    <div>
      <div class="card">
        <h3>Что даёт регистрация</h3>
        <ul class="mini" style="padding-left:20px">
          <li>калькулятор ставки с ежемесячно обновляемой тарифной сеткой — без ограничений;</li>
          <li>рейтинг: отзывы, сроки, срывы и прозрачность формируют ваш уровень;</li>
          <li>доступ к заявкам и подача ставок на бирже грузов;</li>
          <li>право выдвижения в Совет перевозчиков при рейтинге 80+ и стаже от 12 месяцев;</li>
          <li>участие в голосованиях через представителей и в публичных обсуждениях проектов решений.</li>
        </ul>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Пошаговый вход</h3>
        <ol class="tl" style="margin-top:6px">
          <li>Заявка на платформе (эта форма)</li>
          <li>Верификация администрацией: ИНН, ОСГОП, допуски — до 3 рабочих дней</li>
          <li>Присвоение статуса и стартового рейтинга</li>
          <li>Первый рейс с куратором профильного комитета</li>
          <li>Полный доступ к бирже и голосованиям</li>
        </ol>
      </div>
    </div>
  </div>${ROLE === 'admin' ? adminPanel() : ''}`;

  if (ROLE === 'carrier') {
    const c = DB.carriers.find(x => x.id === (ME || 'C-101'));
    const r = rating(c);
    const eligible = r.score >= 80 && c.metrics.tenureMonths >= 12;
    const myBids = DB.loads.filter(l => l.carrierId === c.id);
    return `<div class="grid g23">
      <div>
        <div class="card">
          <div class="row between"><div><h2 style="margin:0">${esc(c.name)}</h2><div class="mini">${c.form}, ИНН ${esc(c.inn)} · ${esc(c.city)} · статус: <span class="badge ${STATUS_LABEL[c.status][1]}">${STATUS_LABEL[c.status][0]}</span></div></div>
            <div style="text-align:right"><div style="font-size:30px;font-weight:900;color:var(--acc)">${r.score}</div><div class="mini">${starsHtml(r.stars)} ${r.level}</div></div></div>
          <hr>
          <div class="grid g3">
            <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.fleet}</div><div class="l">единиц техники</div></div>
            <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.metrics.completed}</div><div class="l">рейсов выполнено</div></div>
            <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${c.metrics.onTime}%</div><div class="l">доставка в срок</div></div>
          </div>
          <h3 style="margin-top:14px">Как поднять рейтинг</h3>
          <table><tbody>
            ${Object.entries(c.docs).map(([k, v]) => '<tr><td>' + ({ egrul: 'Выписка ЕГРЮЛ/ЕГРИП', osgop: 'Полис ОСГОП', ports: 'Допуск в порты', etrn: 'ЭТрН', taxes: 'Налоговая отчётность' })[k] + '</td><td style="text-align:right">' + (v ? '<span class="badge b-ok">ок</span>' : '<span class="badge b-warn">загрузить в кабинет</span>') + '</td></tr>').join('')}
          </tbody></table>
          <div class="note" style="margin-top:12px"><b>Выдвижение в Совет:</b> ${eligible ? 'условия выполнены — можно подать заявку в Совет перевозчиков (рейтинг ≥ 80, стаж ≥ 12 мес.).' : 'требуется рейтинг не ниже 80 (сейчас ' + r.score + ') и стаж от 12 месяцев (сейчас ' + c.metrics.tenureMonths + ' мес.).'}</div>
          <button class="btn" style="margin-top:12px" ${eligible ? '' : 'disabled'} onclick="toast('Заявка на выдвижение подана. Сбор подписей участников — 20 дней.','ok')">Подать заявку в Совет перевозчиков</button>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>Мои рейсы и ставки</h3>
          ${myBids.length ? '<table><tbody>' + myBids.map(l => '<tr><td>' + l.id + '<div class="mini">' + l.from + ' → ' + l.to + '</div></td><td class="mono">' + money(l.rate || 0) + '</td><td><span class="badge b-info">' + l.status + '</span></td></tr>').join('') + '</tbody></table>' : '<p class="mini">Пока нет назначенных рейсов. Откройте вкладку «Грузы», чтобы подать ставку.</p>'}
        </div>
      </div>
      <div>
        <div class="card">
          <h3>История расчётов</h3>
          ${DB.calcs.length ? '<table><tbody>' + DB.calcs.slice().reverse().map(x => '<tr><td>' + esc(x.route) + '<div class="mini">' + dt(x.at) + ' · ' + esc(x.type) + ' · ' + x.km + ' км</div></td><td class="mono" style="text-align:right"><b>' + money(x.base) + '</b><div class="mini">' + fmt2(x.perKm) + ' ₽/км</div></td></tr>').join('') + '</tbody></table>' : '<p class="mini">Сохраните расчёт в калькуляторе — он появится здесь.</p>'}
        </div>
        <div class="card" style="margin-top:16px">
          <h3>Документы участника</h3>
          <ul class="mini" style="padding-left:20px">
            <li><a href="#" onclick="docFull('contract');return false">Типовой договор-перевозки</a></li>
            <li><a href="#" onclick="docFull('reg');return false">Регламент регистрации и верификации</a></li>
            <li><a href="#" onclick="docFull('rating');return false">Регламент рейтинга и арбитража</a></li>
            <li><a href="#" onclick="docFull('tariff');return false">Регламент расчёта тарифной сетки</a></li>
          </ul>
        </div>
      </div>
    </div>`;
  }
  // council
  const phase = councilPhase();
  if (!DB.settings.demoCouncil && phase !== 'elected') {
    const pr = electionProgress();
    return `<div class="grid g23">
      <div class="card">
        <h2>Совет перевозчиков ещё не избран</h2>
        <div class="sub">Платформа работает в переходном периоде: тарифная сетка ведётся Администрацией строго по методике, проекты решений публикуются как открытые обсуждения. Выборы будут назначены при достижении <b>${pr.need}</b> реальных верифицированных перевозчиков — сейчас <b>${pr.n}</b>.</div>
        <div class="bar" style="margin:12px 0 6px"><i style="width:${pr.pct}%"></i></div>
        <div class="mini">готовность к выборам: <b>${pr.pct}%</b></div>
        <div class="row" style="margin-top:14px">
          <button class="btn" onclick="showTab('council')">Переходные положения и обсуждения</button>
          <button class="btn pri" onclick="toggleDemoCouncil()">Включить учебный режим (механика голосования)</button>
        </div>
        <div class="note" style="margin-top:12px">Учебный режим показывает, как Совет будет голосовать после выборов: 9 демонстрационных членов, пороги 6/5/7 и кворум 7. Реальные решения при этом не принимаются.</div>
      </div>
      <div class="card">
        <h3>Что нужно для выборов</h3>
        <ol class="tl" style="margin-top:8px">
          <li>${pr.need} реальных верифицированных перевозчиков в реестре (сейчас ${pr.n})</li>
          <li>Назначение выборов Администрацией: выдвижение кандидатов — 20 дней</li>
          <li>Кумулятивное голосование участников — 15 дней, квоты по федеральным округам</li>
          <li>Публикация избранного состава — переход к решениям голосованием</li>
        </ol>
        <div class="note" style="margin-top:12px">Кандидат для первых выборов: статус «Верифицирован», отсутствие санкций, заявка от компании. Требование рейтинга 80+ и стажа 12 месяцев применяется со второго цикла.</div>
      </div>
    </div>`;
  }
  const m = DB.members.find(x => x.id === VOTE_AS) || DB.members[0];
  const waiting = DB.votes.filter(v => v.status === 'voting' && !v.votes[m.id]);
  return `<div class="grid g23">
    <div class="card">
      <h2>Кабинет члена Совета ${DB.settings.demoCouncil ? '<span class="badge b-mut">УЧЕБНЫЙ РЕЖИМ</span>' : ''}</h2>
      <div class="sub">${esc(m.name)} · ${esc(m.company)} · ${esc(m.committee)} · полномочия до ${dt(m.until)}</div>
      <div class="grid g3">
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${waiting.length}</div><div class="l">вопросов ждут вашего голоса</div></div>
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${Object.keys(DB.votes.reduce((a, v) => { if (v.votes[m.id]) a[v.id] = 1; return a; }, {})).length}</div><div class="l">голосований, где вы участвовали</div></div>
        <div class="kpi" style="padding:10px"><div class="k" style="font-size:18px">${DB.decisions.length}</div><div class="l">решений в реестре</div></div>
      </div>
      ${waiting.length ? '<h3 style="margin-top:14px">Ждут вашего голоса</h3>' + waiting.map(v => '<div class="member" style="margin-bottom:8px"><b>' + esc(v.title) + '</b><div class="mini">' + v.id + ' · до ' + dt(v.deadline) + '</div><button class="btn sm" style="margin-top:6px" onclick="showTab(\'council\')">Перейти к голосованию</button></div>').join('') : '<p class="mini" style="margin-top:12px">Все открытые вопросы рассмотрены.</p>'}
    </div>
    <div>
      <div class="card">
        <h3>Полномочия члена Совета</h3>
        <ul class="mini" style="padding-left:20px">
          <li>вносить проекты решений по тарифам, правилам и работе платформы;</li>
          <li>голосовать лично, открыто и персонально (голос публикуется);</li>
          <li>работать в комитетах: тарифном, по качеству и арбитражу, по цифровизации;</li>
          <li>обязанность: не голосовать по вопросам, затрагивающим собственную компанию.</li>
        </ul>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Ограничения</h3>
        <p class="mini">Решения Совета не могут устанавливать обязательные цены для рынка. Максимум — правила доступа к сервисам платформы, рекомендованные ставки и внутренние санкции (см. «Документы платформы»).</p>
      </div>
    </div>
  </div>`;
}
function adminPanel() {
  const apps = DB.applications.filter(a => a.status === 'pending');
  const pend = DB.carriers.filter(c => c.status === 'pending');
  return `<div class="card" style="margin-top:16px">
    <h2>Администрирование (режим демонстрации)</h2>
    <div class="sub">Администрация ведёт реестр, проверяет документы, публикует решения Совета и следит за работоспособностью платформы.</div>
    <h3>Заявки на верификацию</h3>
    ${(apps.length || pend.length) ? '<table><tbody>' +
      apps.map(a => `<tr><td><b>${esc(a.name)}</b><div class="mini">${esc(a.city)} · ИНН ${esc(a.inn)} · ${a.fleet} ед. техники · подана ${dt(a.submitted)}</div></td><td>${a.docs ? '<span class="badge b-ok">документы полные</span>' : '<span class="badge b-warn">нужны документы</span>'}</td>
        <td style="text-align:right"><button class="btn sm ok" onclick="approveApp('${a.id}')">Верифицировать</button> <button class="btn sm bad" onclick="rejectApp('${a.id}')">Отклонить</button></td></tr>`).join('') +
      pend.map(c => `<tr><td><b>${esc(c.name)}</b><div class="mini">${esc(c.city)} · ИНН ${esc(c.inn)} · ${c.fleet} ед.</div></td><td><span class="badge b-warn">ожидает проверки</span></td>
        <td style="text-align:right"><button class="btn sm ok" onclick="verifyCarrier('${c.id}')">Верифицировать</button> <button class="btn sm bad" onclick="suspendCarrier('${c.id}')">Отклонить</button></td></tr>`).join('') +
      '</tbody></table>' : '<p class="mini">Новых заявок нет.</p>'}
    <hr>
    <div class="row between">
      <div><h3 style="margin:0">Демонстрационные данные</h3><div class="mini">Сброс вернёт реестр, тарифную сетку и голосования к исходному состоянию.</div></div>
      <button class="btn" onclick="sbRefresh()">⟳ Обновить данные из базы</button><button class="btn bad" onclick="resetDemo()">Сбросить демо-данные</button>
    </div>
  </div>`;
}
function register() {
  if (!$('#r_c1').checked || !$('#r_c2').checked || !$('#r_c3').checked) { toast('Для регистрации необходимо принять Устав, Правила и подтвердить документы', 'bad'); return; }
  const types = ['20′', '40′', '40′HC', '45′HC', 'реф'].filter((t, i) => $('#r_t' + i).checked);
  const c = {
    id: 'C-' + (200 + DB.carriers.length), name: $('#r_name').value.trim() || 'Новый перевозчик',
    form: $('#r_form').value, inn: $('#r_inn').value, city: $('#r_city').value, region: $('#r_region').value,
    fleet: num($('#r_fleet').value), containers: num($('#r_cont').value), types: types.length ? types : ['40′HC'],
    status: 'pending', joined: todayISO(), demo: false,
    docs: { egrul: true, osgop: true, ports: false, etrn: true, taxes: true },
    metrics: { completed: 0, onTime: 100, failures: 0, reviews: 0, tenureMonths: 0, discipline: 80, transparency: 55 }
  };
  DB.carriers.push(c); ME = c.id; Store.set('ks_me', ME);
  DB.applications.unshift({ id: 'З-2026-' + (8 + DB.applications.length), name: c.name, city: c.city, inn: c.inn, fleet: c.fleet, containers: c.containers, submitted: todayISO(), status: 'pending', docs: true });
  DB.log.unshift({ at: todayISO(), text: 'Новая заявка на верификацию: ' + c.name + ' (' + c.city + ').' });
  sbPushCarrier(c); sbPushApplication(DB.applications[0]); sbJournal('Новая заявка на верификацию: ' + c.name + ' (' + c.city + ').');
  save();
  toast('Заявка отправлена. Статус «Ожидает верификации», проверка — до 3 рабочих дней. Включён демо-режим перевозчика.', 'ok');
  ROLE = 'carrier'; Store.set('ks_role', ROLE); $('#roleSel').value = 'carrier'; render();
}
function approveApp(id) {
  const a = DB.applications.find(x => x.id === id); a.status = 'verified';
  const c = DB.carriers.find(x => x.inn === a.inn || x.name === a.name);
  if (c) { c.status = 'verified'; c.metrics.transparency = Math.min(100, c.metrics.transparency + 25); c.docs.osgop = true; }
  sbPushApplication(a); if (c) sbPushCarrier(c);
  DB.log.unshift({ at: todayISO(), text: 'Верифицирован участник: ' + a.name + '.' });
  save(); render(); toast(a.name + ' верифицирован(а) и добавлен(а) в реестр', 'ok');
}
function rejectApp(id) { const a = DB.applications.find(x => x.id === id); a.status = 'rejected'; sbPushApplication(a); save(); render(); toast('Заявка отклонена, заявителю направлены замечания'); }
function verifyCarrier(id) { const c = DB.carriers.find(x => x.id === id); c.status = 'verified'; c.metrics.transparency = Math.min(100, c.metrics.transparency + 30); sbPushCarrier(c); DB.log.unshift({ at: todayISO(), text: 'Верифицирован перевозчик ' + c.name + '.' }); save(); render(); toast(c.name + ' — статус «Верифицирован»', 'ok'); }
function suspendCarrier(id) { const c = DB.carriers.find(x => x.id === id); c.status = 'suspended'; sbPushCarrier(c); DB.log.unshift({ at: todayISO(), text: 'Приостановлен статус перевозчика ' + c.name + ' до устранения замечаний.' }); save(); render(); toast(c.name + ': доступ ограничен до устранения замечаний', 'bad'); }
function resetDemo() { Store.reset(); DB = seed(); save(); CALC = null; render(); toast('Демонстрационные данные восстановлены'); }
[register, approveApp, rejectApp, verifyCarrier, suspendCarrier, resetDemo].forEach(f => window[f.name] = f);

/* ============================================================
   Запуск
   ============================================================ */
$('#roleSel').value = ROLE;
$('#roleSel').addEventListener('change', e => {
  ROLE = e.target.value; Store.set('ks_role', ROLE);
  if (ROLE === 'carrier' && !ME) { ME = 'C-101'; Store.set('ks_me', ME); }
  if (ROLE === 'council') VOTE_AS = 'M-1';
  $('#storeTag').textContent = 'режим: ' + e.target.selectedOptions[0].textContent;
  toast('Режим просмотра: <b>' + e.target.selectedOptions[0].textContent + '</b>');
  render();
});
$('#storeTag').textContent = 'хранилище: ' + (Store.ls ? 'локальное (браузер)' : 'сессионное (память)');
render();
