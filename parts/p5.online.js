/* ============================================================
   Онлайн-слой: Supabase (PostgREST) без внешних библиотек.
   Работает только если в config.js заданы supabaseUrl и supabaseAnonKey.
   Если их нет — платформа полностью работает в локальном демо-режиме.
   ============================================================ */
const CFG = window.KONTREIT_CONFIG || {};
const ONLINE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/ВСТАВЬТЕ|PASTE/i.test(String(CFG.supabaseUrl) + String(CFG.supabaseAnonKey)));
const SBBASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '') + '/rest/v1/';
const sbHead = () => ({ 'apikey': CFG.supabaseAnonKey, 'Authorization': 'Bearer ' + CFG.supabaseAnonKey, 'Content-Type': 'application/json' });

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
    .catch(e => { SB_STATE = 'error'; sbBadge(); console.warn('[Контейнерный Союз/Supabase]', e); toast('Нет связи с базой (' + e.message + '). Данные сохранены локально.', 'bad'); return false; });
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
  if (tar.length) DB.tariff = { version: tar[0].version, approved: tar[0].approved, approvedBy: tar[0].approved_by, val: tar[0].val };
  if (mem.length) DB.members = mem.map(dbMember);
  if (car.length) DB.carriers = car.map(dbCarrier);
  if (app.length) DB.applications = app.map(dbApplication);
  if (loa.length) DB.loads = loa.map(dbLoad);
  if (vot.length) { DB.votes = vot.map(dbVote); bal.forEach(b => { const v = DB.votes.find(x => x.id === b.vote_id); if (v) v.votes[b.member_id] = b.choice; }); }
  if (dec.length) DB.decisions = dec.map(dbDecision);
  if (jou.length) DB.log = jou.map(j => ({ at: j.at, text: j.text }));
  if (set.length) { DB.settings = DB.settings || {}; set.forEach(s => { DB.settings[s.key === 'council' ? 'demoCouncil' : s.key] = (s.val && typeof s.val === 'object' && 'demoCouncil' in s.val) ? s.val.demoCouncil : s.val; if (s.key === 'council' && s.val) DB.settings = { ...s.val, demoCouncil: !!s.val.demoCouncil }; }); }
  SB_STATE = 'ok'; sbBadge(); save(); render();
  if (!quiet) toast('Данные загружены из базы: ' + DB.carriers.length + ' перевозчиков, ' + DB.loads.length + ' заявок, ' + DB.votes.length + ' вопросов Совета', 'ok');
}
function sbRefresh() { sbSafe(sbLoadAll()); }
window.sbRefresh = sbRefresh;

/* ---------- запись (вызывается из действий платформы) ---------- */
function sbPushCarrier(c)     { if (ONLINE) sbSafe(SB.upsert('carriers', [sbCarrier(c)])); }
function sbPushApplication(a) { if (ONLINE) sbSafe(SB.upsert('applications', [sbApplication(a)])); }
function sbPushLoad(l)        { if (ONLINE) sbSafe(SB.upsert('loads', [sbLoad(l)])); }
function sbPushBid(l, rate, cid, kind) {
  if (!ONLINE) return;
  sbSafe(SB.upsert('bids', [{ load_id: l.id, carrier_id: cid, rate: rate, days: null, kind: kind || 'bid' }]));
  sbPushLoad(l);
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

/* ---------- запуск ---------- */
if (ONLINE) {
  sbBadge();
  sbLoadAll(true).catch(e => { SB_STATE = 'error'; sbBadge(); toast('База недоступна, работаем в локальном режиме. ' + e.message, 'bad'); });
} else {
  sbBadge();
}
