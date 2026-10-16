/* Эмулятор Supabase для новой модели ролей: profiles (admin/council/carrier), регистрация, RLS.
   Роли: главный администратор защищён от понижения и удаления. */
const http = require('http');

const users = [
  { id: 'u-admin', email: 'admin@ks.ru', password: 'Sovet2026!', jwt: 'jwt-admin' }
];
const DB = {
  profiles: [{ id: 'u-admin', email: 'admin@ks.ru', role: 'admin', is_primary: true, created_at: '2026-10-01T00:00:00Z' }],
  tariff: [{ id: 1, version: 'в. 2.3', approved: '2026-08-20', approved_by: 'Решение ТАР-2026-02',
    val: { fuelPrice: 86.72, fuelConsLoaded: 33, fuelConsEmpty: 26, platon: 3.53, platonShare: 85, leasing: 14, driverKm: 9,
           perDiem: 1800, repair: 5.5, tires: 1.9, insurance: 2.4, overheadPct: 14, marginBase: 14, marginMin: 4,
           detentionFree: 4, detentionRate: 1500, marketPerKm: 88, seasonK: 6, urgencyK: 10, emptyReturnK: 35 } }],
  council_members: Array.from({ length: 9 }, (_, i) => ({ id: 'M-' + (i + 1), name: 'Член Совета ' + (i + 1), company: 'ООО «К-' + i + '»',
    city: 'Город', district: 'ЮФО', committee: 'Тарифный комитет', until: '2027-04-01', elected_by: 100 + i, chair: i === 0,
    user_id: i === 0 ? 'u-council' : null })),
  carriers: [], applications: [], loads: [], bids: [], votes: [], vote_ballots: [], decisions: [], journal: [],
  settings: [{ key: 'council', val: { demoCouncil: false, electionThreshold: 50, elections: null } }]
};
const PUBLIC_INSERT = ['carriers', 'applications', 'loads', 'bids', 'journal'];
const LOG = [];
let seq = 0;

const roleOf = jwt => {
  if (!jwt) return 'anon';
  const u = users.find(x => x.jwt === jwt);
  if (!u) return 'anon';
  const p = DB.profiles.find(x => x.id === u.id);
  return p ? p.role : 'norole';
};
const uidOf = jwt => (users.find(x => x.jwt === jwt) || {}).id || null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    const auth = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const role = roleOf(auth === 'publishable-key' ? '' : auth);
    const uid = uidOf(auth === 'publishable-key' ? '' : auth);
    LOG.push(`${req.method} ${url.pathname}${url.search} [${role}]`);
    res.setHeader('Content-Type', 'application/json');
    const json = (code, data) => { res.statusCode = code; res.end(JSON.stringify(data)); };
    const empty = code => { res.statusCode = code; res.end(''); };

    /* ---------- Auth ---------- */
    if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = JSON.parse(body || '{}');
      if (!email || !password) return json(400, { msg: 'email and password required' });
      if (users.some(u => u.email === email)) return json(422, { msg: 'User already registered' });
      const u = { id: 'u-' + (++seq), email, password, jwt: 'jwt-' + seq };
      users.push(u);
      DB.profiles.push({ id: u.id, email, role: 'carrier', is_primary: false, created_at: new Date().toISOString() }); // триггер базы
      return json(200, { access_token: u.jwt, refresh_token: 'r-' + seq, expires_in: 3600, user: { id: u.id, email } });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password' && req.method === 'POST') {
      const { email, password } = JSON.parse(body || '{}');
      const u = users.find(x => x.email === String(email).trim());
      if (!u || u.password !== password) return json(400, { error_description: 'Invalid login credentials' });
      return json(200, { access_token: u.jwt, refresh_token: 'r-' + u.id, expires_in: 3600, user: { id: u.id, email: u.email } });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token' && req.method === 'POST') {
      const u = users[0];
      return json(200, { access_token: u.jwt, refresh_token: 'r-' + u.id, expires_in: 3600, user: { id: u.id, email: u.email } });
    }
    if (url.pathname === '/auth/v1/logout') return empty(204);

    /* ---------- PostgREST ---------- */
    const table = url.pathname.replace('/rest/v1/', '');
    if (!DB[table]) return json(404, []);
    const isAdmin = role === 'admin';
    const isMember = role === 'admin' || role === 'council';
    const deny = () => json(401, { message: 'new row violates row-level security policy for table "' + table + '"' });

    if (req.method === 'GET') {
      if (table === 'applications' && !isAdmin) return json(200, []);
      if (table === 'profiles') return json(200, isAdmin ? DB.profiles : DB.profiles.filter(p => p.id === uid));
      return json(200, DB[table].slice());
    }

    if (req.method === 'POST') {
      const rows = [].concat(JSON.parse(body || '[]'));
      for (const row of rows) {
        if (table === 'profiles') { if (!isAdmin) return deny(); }
        else if (table === 'carriers') {
          const ok = isAdmin || (row.demo !== true && row.status === 'pending' && (!row.owner || row.owner === uid));
          if (!ok) return deny();
        } else if (['votes', 'vote_ballots'].includes(table)) {
          if (!isMember) return deny();
          if (table === 'vote_ballots') {
            const seat = DB.council_members.find(m => m.id === row.member_id);
            if (!isAdmin && !(seat && seat.user_id === uid)) return deny();
          }
        } else if (!PUBLIC_INSERT.includes(table)) {
          if (!isAdmin) return deny();
        }
        const key = (url.searchParams.get('on_conflict') || 'id').split(',');
        const i = DB[table].findIndex(r => key.every(k => String(r[k]) === String(row[k])));
        if (i >= 0) DB[table][i] = { ...DB[table][i], ...row }; else DB[table].push({ id: DB[table].length + 1, ...row });
      }
      return empty(201);
    }

    if (req.method === 'PATCH') {
      const patch = JSON.parse(body || '{}');
      const idEq = url.searchParams.get('id');
      const keyEq = url.searchParams.get('key');
      let idxs = DB[table].map((r, i) => [r, i]).filter(([r]) => {
        if (idEq && idEq.startsWith('eq.') && String(r.id) !== idEq.slice(3)) return false;
        if (keyEq && keyEq.startsWith('eq.') && String(r.key) !== keyEq.slice(3)) return false;
        return true;
      });
      if (!idxs.length && table === 'tariff') return empty(204);   // несуществующая строка: PostgREST отвечает 204
      if (table === 'profiles') {
        if (!isAdmin) return deny();
        for (const [row] of idxs) {
          if (row.is_primary && patch.role && patch.role !== 'admin') return json(403, { message: 'Главного администратора платформы нельзя понизить в правах' });
        }
      } else if (table === 'carriers') {
        // как в политике own_carrier_update: только своя карточка, только пока не проверена
        const own = isAdmin || idxs.every(([r]) =>
          r.owner && r.owner === uid && ['pending', 'suspended'].includes(r.status) &&
          (patch.owner === undefined || patch.owner === uid) &&
          (patch.status === undefined || ['pending', 'suspended'].includes(patch.status)));
        if (!own) return deny();
      } else if (table === 'vote_ballots' || table === 'votes') {
        if (!isMember && !isAdmin) return deny();
      } else if (!isAdmin) return deny();
      for (const [row, i] of idxs) DB[table][i] = { ...row, ...patch };
      if (String(req.headers.prefer || '').includes('representation')) return json(200, idxs.map(([r, i]) => DB[table][i]));
      return empty(204);
    }

    if (req.method === 'DELETE') {
      const idEq2 = url.searchParams.get('id');
      const targets = DB[table].filter(r => idEq2 && idEq2.startsWith('eq.') && String(r.id) === idEq2.slice(3));
      if (table === 'profiles') {
        if (!isAdmin) return deny();
        for (const row of targets) {
          if (row.is_primary) return json(403, { message: 'Главного администратора платформы нельзя удалить' });
        }
        DB.profiles = DB.profiles.filter(r => !targets.includes(r));
      } else if (!isAdmin) return deny();
      return empty(204);
    }
    return json(405, {});
  });
});

module.exports = { server, DB, LOG, users, CURATOR: { email: 'admin@ks.ru', password: 'Sovet2026!' } };
