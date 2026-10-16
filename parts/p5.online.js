/* ============================================================
   Онлайн-слой: Supabase (PostgREST) без внешних библиотек.
   Работает только если в config.js заданы supabaseUrl и supabaseAnonKey.
   Если их нет — платформа полностью работает в локальном демо-режиме.
   ============================================================ */
const CFG = window.KONTREIT_CONFIG || {};
const ONLINE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/ВСТАВЬТЕ|PASTE/i.test(String(CFG.supabaseUrl) + String(CFG.supabaseAnonKey)));
const SBBASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '') + '/rest/v1/';
const AUTH = {
  session: null,
  load() { try { const s = JSON.parse(localStorage.getItem('ks_session') || 'null'); if (s && s.access_token) AUTH.session = s; } catch (e) { } },
  save(s) { AUTH.session = s; try { localStorage.setItem('ks_session', JSON.stringify(s)); } catch (e) { } },
  clear() { AUTH.session = null; try { localStorage.removeItem('ks_session'); } catch (e) { } },
  get token() { return AUTH.session && AUTH.session.access_token; },
  get email() { return (AUTH.session && AUTH.session.user && AUTH.session.user.email) || ''; },
  get name() { return AUTH.email || 'куратор'; }
};
AUTH.load();
const CURATOR = { checked: false, ok: false };

/* Заголовки запросов: apikey — публикуемый ключ проекта, Authorization — вход куратора, если он выполнен */
const sbHead = () => ({ 'apikey': CFG.supabaseAnonKey, 'Authorization': 'Bearer ' + (AUTH.token || CFG.supabaseAnonKey), 'Content-Type': 'application/json' });

const SB = {
  async select(t, q) {
    const r = await fetch(SBBASE + t + (q ? '?' + q : ''), { headers: sbHead() });
    if (!r.ok) throw new Error(t + ' → HTTP ' + r.status);
    return r.json();
  },
  /* Необязательные таблицы (новые в схеме): их отсутствие не должно ломать загрузку */
  async selectOpt(t, q) {
    try { return await SB.select(t, q); } catch (e) { console.warn('[Контейнерный Союз/Supabase] нет таблицы ' + t + ' — пропускаем'); return []; }
  },
  /* Обычная вставка новой строки — доступна всем участникам (регистрация, заявки, ставки, журнал) */
  async insert(t, rows) {
    const r = await fetch(SBBASE + t, { method: 'POST', headers: { ...sbHead(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error(t + ' → HTTP ' + r.status + ': ' + (await r.text()).slice(0, 180));
    return true;
  },
  async upsert(t, rows, onConflict) {
    const r = await fetch(SBBASE + t + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : ''), {
      method: 'POST', headers: { ...sbHead(), 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows)
    });
    if (!r.ok) throw new Error(t + ' → HTTP ' + r.status + ': ' + (await r.text()).slice(0, 180));
    return true;
  },
  async patch(t, q, row) {
    const r = await fetch(SBBASE + t + '?' + q, { method: 'PATCH', headers: { ...sbHead(), 'Prefer': 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) throw new Error(t + ' → HTTP ' + r.status);
    return true;
  }
};

/* ---------- преобразование записей «база ↔ приложение» ---------- */
const sbCarrier    = c => ({ id: c.id, name: c.name, form: c.form, inn: c.inn, city: c.city, region: c.region, fleet: c.fleet || 0, containers: c.containers || 0, types: c.types || [], status: c.status, joined: c.joined, docs: c.docs || {}, metrics: c.metrics || {}, demo: !!c.demo });
const dbCarrier    = r => ({ id: r.id, name: r.name, form: r.form, inn: r.inn, city: r.city, region: r.region, fleet: r.fleet || 0, containers: r.containers || 0, types: r.types || [], status: r.status, joined: r.joined, docs: r.docs || {}, metrics: r.metrics || {}, demo: !!r.demo });
const sbApplication = a => ({ id: a.id, name: a.name, city: a.city, inn: a.inn, fleet: a.fleet || 0, containers: a.containers || 0, submitted: a.submitted, status: a.status, docs: !!a.docs });
const dbApplication = r => ({ id: r.id, name: r.name, city: r.city, inn: r.inn, fleet: r.fleet, containers: r.containers, submitted: r.submitted, status: r.status, docs: r.docs });
const sbLoad       = l => ({ id: l.id, from_city: l.from, to_city: l.to, type: l.type, cargo: l.cargo, weight: l.weight, pickup: l.date, shipper: l.shipper, status: l.status, mode: l.mode, bids: l.bids || 0, floor: l.floor || 0, carrier_id: l.carrierId || null, rate: l.rate || null });
const dbLoad       = r => ({ id: r.id, from: r.from_city, to: r.to_city, type: r.type, cargo: r.cargo, weight: r.weight, date: r.pickup, shipper: r.shipper, status: r.status, mode: r.mode, bids: r.bids || 0, floor: r.floor || 0, carrierId: r.carrier_id || undefined, rate: r.rate || undefined });
const sbMember     = m => ({ id: m.id, name: m.name, company: m.company, city: m.city, district: m.district, committee: m.committee, until: m.until, elected_by: m.electedBy, chair: !!m.chair });
const dbMember     = r => ({ id: r.id, name: r.name, company: r.company, city: r.city, district: r.district, committee: r.committee, until: r.until, electedBy: r.elected_by, chair: r.chair, role: r.chair ? 'Председатель Совета' : 'Член Совета' });
const sbVote       = v => ({ id: v.id, kind: v.kind, title: v.title, summary: v.summary, author: v.author, created: v.created, deadline: v.deadline, payload: v.payload || {}, status: v.status, result: v.result || null });
const dbVote       = r => ({ id: r.id, kind: r.kind, title: r.title, summary: r.summary, author: r.author, created: r.created, deadline: r.deadline, payload: r.payload || {}, status: r.status, result: r.result || undefined, votes: {} });
const sbDecision   = d => ({ id: d.id, title: d.title, kind: d.kind, at: d.at, result: d.result, effect: d.effect });
const dbDecision   = r => ({ id: r.id, title: r.title, kind: r.kind, at: r.at, result: r.result, effect: r.effect });

/* ---------- служебное ---------- */
let SB_STATE = ONLINE ? 'connecting' : 'local';
function sbSafe(promise) {
  return Promise.resolve(promise)
    .then(() => { SB_STATE = 'ok'; sbBadge(); return true; })
    .catch(e => {
      const msg = String(e && e.message || e);
      if (/HTTP 401|HTTP 403/.test(msg) && !AUTH.token) {
        // Изменение отклонила сама база: у гостя нет прав на запись.
        console.warn('[Контейнерный Союз/Supabase] доступ отклонён:', msg);
        toast('База отклонила изменение: для этого действия нужен вход куратора. Нажмите «Вход» в шапке.', 'bad');
        openLogin();
        return false;
      }
      if (/HTTP 401|HTTP 403/.test(msg)) {
        toast('База отклонила изменение: у аккаунта <b>' + esc(AUTH.name) + '</b> нет прав куратора (нет записи в таблице curators).', 'bad');
        CURATOR.ok = false; renderAuthBox();
        return false;
      }
      SB_STATE = 'error'; sbBadge();
      console.warn('[Контейнерный Союз/Supabase]', e);
      toast('Нет связи с базой (' + esc(msg) + '). Данные сохранены локально.', 'bad');
      return false;
    });
}
function sbBadge() {
  const el = $('#storeTag'); if (!el) return;
  const map = {
    local: ['хранилище: локальный демо-режим', 'b-mut'],
    connecting: ['база: подключение…', 'b-warn'],
    ok: ['база: Supabase · онлайн', 'b-ok'],
    error: ['база: нет связи (локальный режим)', 'b-bad']
  };
  const [txt, cls] = map[SB_STATE] || map.local;
  el.textContent = txt; el.className = 'tag badge ' + cls;
}
function sbJournal(text) { if (ONLINE) sbSafe(SB.upsert('journal', [{ at: todayISO(), text }])); }

/* ---------- чтение всей базы ---------- */
async function sbLoadAll(quiet) {
  SB_STATE = 'connecting'; sbBadge();
  const [tar, car, app, loa, mem, vot, bal, dec, jou, set] = await Promise.all([
    SB.select('tariff', 'select=*&id=eq.1'),
    SB.select('carriers', 'select=*&order=fleet.desc'),
    SB.select('applications', 'select=*&order=submitted.desc'),
    SB.select('loads', 'select=*&order=created_at.desc'),
    SB.select('council_members', 'select=*&order=id.asc'),
    SB.select('votes', 'select=*&order=created.desc'),
    SB.select('vote_ballots', 'select=*'),
    SB.select('decisions', 'select=*&order=at.desc'),
    SB.selectOpt('journal', 'select=*&order=created_at.desc&limit=50'),
    SB.selectOpt('settings', 'select=*')
  ]);
  // Демонстрационные вопросы и записи реестра держим отдельно — они нужны только
  // для «учебного режима» и всегда помечены как примеры.
  const demoVotes = (DB.votes || []).filter(v => v.demo).map(v => JSON.parse(JSON.stringify(v)));
  const demoDecisions = (DB.decisions || []).filter(d => d.demo).map(d => JSON.parse(JSON.stringify(d)));

  if (tar.length) DB.tariff = { version: tar[0].version, approved: tar[0].approved, approvedBy: tar[0].approved_by, val: tar[0].val };
  if (mem.length) DB.members = mem.map(dbMember);            // пусто до выборов — остаются демо-члены для учебного режима
  DB.carriers = car.map(dbCarrier);                          // реальные данные: пусто = пусто, демо-профили не подставляем
  DB.applications = app.map(dbApplication);
  DB.loads = loa.map(dbLoad);
  DB.votes = vot.map(dbVote).concat(demoVotes);
  bal.forEach(b => { const v = DB.votes.find(x => x.id === b.vote_id); if (v) v.votes[b.member_id] = b.choice; });
  DB.decisions = dec.map(dbDecision).concat(demoDecisions);
  DB.log = jou.map(j => ({ at: j.at, text: j.text }));
  if (set.length) { DB.settings = DB.settings || {}; set.forEach(s => { DB.settings[s.key === 'council' ? 'demoCouncil' : s.key] = (s.val && typeof s.val === 'object' && 'demoCouncil' in s.val) ? s.val.demoCouncil : s.val; if (s.key === 'council' && s.val) DB.settings = { ...s.val, demoCouncil: !!s.val.demoCouncil }; }); }
  SB_STATE = 'ok'; sbBadge(); save(); render();
  if (!quiet) toast('Данные загружены из базы: ' + DB.carriers.length + ' перевозчиков, ' + DB.loads.length + ' заявок, ' + DB.votes.length + ' вопросов Совета', 'ok');
}
function sbRefresh() { sbSafe(sbLoadAll()); }
window.sbRefresh = sbRefresh;

/* ---------- запись (вызывается из действий платформы) ---------- */
/* mode: 'insert' — новая запись (доступно всем); 'upsert' — изменение (только куратор) */
function sbPushCarrier(c, mode)     { if (ONLINE) sbSafe(mode === 'insert' ? SB.insert('carriers', [sbCarrier(c)]) : SB.upsert('carriers', [sbCarrier(c)])); }
function sbPushApplication(a, mode) { if (ONLINE) sbSafe(mode === 'insert' ? SB.insert('applications', [sbApplication(a)]) : SB.upsert('applications', [sbApplication(a)])); }
function sbPushLoad(l, mode)        { if (ONLINE) sbSafe(mode === 'insert' ? SB.insert('loads', [sbLoad(l)]) : SB.upsert('loads', [sbLoad(l)])); }
function sbPushBid(l, rate, cid, kind) {
  if (!ONLINE) return;
  sbSafe(SB.insert('bids', [{ load_id: l.id, carrier_id: cid, rate: rate, days: null, kind: kind || 'bid' }]));
  if (kind === 'assign') sbPushLoad(l, 'upsert');      // назначение рейса — действие куратора
}
function sbPushBallot(voteId, memberId, choice) { if (ONLINE) sbSafe(SB.upsert('vote_ballots', [{ vote_id: voteId, member_id: memberId, choice: choice || 'none' }], 'vote_id,member_id')); }
function sbPushVote(v) {
  if (!ONLINE) return;
  sbSafe(SB.upsert('votes', [sbVote(v)]));
  sbSafe(SB.upsert('decisions', DB.decisions.slice(0, 20).map(sbDecision)));
}
function sbPushSettings() {
  if (!ONLINE) return;
  sbSafe(SB.upsert('settings', [{ key: 'council', val: { demoCouncil: !!DB.settings.demoCouncil, electionThreshold: DB.settings.electionThreshold || 50, elections: DB.settings.elections || null } }], 'key'));
}
function sbPushTariff() {
  if (!ONLINE) return;
  sbSafe(SB.patch('tariff', 'id=eq.1', { version: DB.tariff.version, approved: DB.tariff.approved, approved_by: DB.tariff.approvedBy, val: DB.tariff.val }));
}

/* ============================================================
   Вход куратора (Администрация платформы и члены Совета)
   Пароль вводится в браузере участника и в файлах не хранится.
   ============================================================ */
const sbAuthUrl = p => String(CFG.supabaseUrl || '').replace(/\/+$/, '') + '/auth/v1/' + p;

async function sbSignIn(email, password) {
  const r = await fetch(sbAuthUrl('token?grant_type=password'), {
    method: 'POST', headers: { 'apikey': CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email).trim(), password: password })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || d.message || ('HTTP ' + r.status));
  AUTH.save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: d.user });
  await sbCheckCurator();
  renderAuthBox();
  return d.user || {};
}
async function sbAuthRefresh() {
  if (!AUTH.session || !AUTH.session.refresh_token) return false;
  try {
    const r = await fetch(sbAuthUrl('token?grant_type=refresh_token'), {
      method: 'POST', headers: { 'apikey': CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: AUTH.session.refresh_token })
    });
    if (!r.ok) throw new Error('refresh HTTP ' + r.status);
    const d = await r.json();
    AUTH.save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: d.user || AUTH.session.user });
    return true;
  } catch (e) { AUTH.clear(); return false; }
}
async function sbSignOut() {
  try {
    if (AUTH.token) await fetch(sbAuthUrl('logout'), { method: 'POST', headers: { 'apikey': CFG.supabaseAnonKey, 'Authorization': 'Bearer ' + AUTH.token } });
  } catch (e) { }
  AUTH.clear(); CURATOR.checked = false; CURATOR.ok = false;
  renderAuthBox(); render();
  toast('Вы вышли. Действия Администрации снова недоступны.', 'ok');
}
/* Проверка, что вошедший действительно в списке кураторов (таблица curators закрыта правилами доступа) */
async function sbCheckCurator() {
  CURATOR.checked = true; CURATOR.ok = false;
  if (!AUTH.token) return false;
  try {
    const r = await fetch(SBBASE + 'curators?select=user_id', { headers: sbHead() });
    const d = await r.json();
    CURATOR.ok = Array.isArray(d) && d.length > 0;
  } catch (e) { CURATOR.ok = false; }
  renderAuthBox();
  return CURATOR.ok;
}
/* Разрешение на действия Администрации: локальный режим — свободно, онлайн — только после входа куратора */
function needCurator(what) {
  if (!ONLINE) return true;
  if (AUTH.token) return true;
  toast('Действие «' + (what || 'действие Администрации') + '» доступно только куратору. Нажмите «Вход» в шапке.', 'bad');
  openLogin();
  return false;
}
function openLogin() {
  if (!ONLINE) { toast('Локальный демо-режим: вход не нужен, все функции доступны.', 'ok'); return; }
  openModal('Вход для Администрации и Совета', `
    <div class="note">Вход нужен только для действий Администрации: верификация перевозчиков, утверждение тарифа, назначение и публикация выборов Совета. Обычным участникам вход не требуется — регистрация, заявки и ставки работают без него.</div>
    <div class="grid g2" style="margin-top:12px">
      <div class="field"><label>E-mail куратора</label><input type="email" id="lg_email" value="${esc(AUTH.email)}" autocomplete="username"></div>
      <div class="field"><label>Пароль</label><input type="password" id="lg_pass" autocomplete="current-password"></div>
    </div>
    <div class="mini">Аккаунт создаётся в Supabase: Authentication → Users → Add user. Права выдаются записью в таблице <b>curators</b> (инструкция — в файле supabase/security.sql).</div>
  `, '<button class="btn pri" onclick="doLogin()">Войти</button><button class="btn" onclick="closeModal()">Отмена</button>');
  setTimeout(() => { const el = $('#lg_pass'); if (el) el.focus(); }, 60);
}
async function doLogin() {
  const e = $('#lg_email').value, p = $('#lg_pass').value;
  if (!e || !p) { toast('Укажите e-mail и пароль', 'bad'); return; }
  try {
    const u = await sbSignIn(e, p);
    closeModal();
    const rights = CURATOR.ok ? 'права куратора подтверждены' : 'вход выполнен, но записи в таблице curators нет — права не выданы';
    toast('Вход выполнен: <b>' + esc(u.email || e) + '</b> — ' + rights, CURATOR.ok ? 'ok' : 'bad');
    sbSafe(sbLoadAll(true));
    render();
  } catch (err) { toast('Не удалось войти: ' + esc(err.message), 'bad'); }
}
function renderAuthBox() {
  const el = $('#authBox'); if (!el) return;
  if (!ONLINE) { el.innerHTML = '<span class="tag">локальный демо-режим</span>'; return; }
  if (!AUTH.token) { el.innerHTML = '<button class="btn sm" onclick="openLogin()">Вход для Администрации</button>'; return; }
  el.innerHTML = '<span class="tag badge ' + (CURATOR.ok ? 'b-ok' : 'b-warn') + '" title="' + (CURATOR.ok ? 'Права куратора подтверждены' : 'Нет записи в таблице curators') + '">' +
    (CURATOR.ok ? 'куратор: ' : 'вошли: ') + esc(AUTH.name) + '</span> <button class="btn sm" onclick="sbSignOut()">Выйти</button>';
}
[openLogin, doLogin, sbSignOut].forEach(f => window[f.name] = f);
window.renderAuthBox = renderAuthBox;

/* ---------- запуск ---------- */
if (ONLINE) {
  sbBadge();
  renderAuthBox();
  (async () => {
    if (AUTH.session && (!AUTH.session.expires_at || AUTH.session.expires_at - Date.now() < 120000)) await sbAuthRefresh();
    await sbCheckCurator();
    sbLoadAll(true).catch(e => { SB_STATE = 'error'; sbBadge(); toast('База недоступна, работаем в локальном режиме. ' + e.message, 'bad'); });
  })();
} else {
  sbBadge();
  renderAuthBox();
}
