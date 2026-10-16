/* Эмулятор Supabase в СТРОГОМ режиме: RLS + вход куратора */
const http = require('http');
const CURATOR = { email: 'admin@ks.ru', password: 'Sovet2026!', jwt: 'curator-jwt', uid: 'u-1' };
const DB = {
  tariff: [{ id: 1, version: 'в. 2.3', approved: '2026-08-20', approved_by: 'Решение ТАР-2026-02',
    val: { fuelPrice: 86.72, fuelConsLoaded: 33, fuelConsEmpty: 26, platon: 3.53, platonShare: 85, leasing: 14, driverKm: 9,
           perDiem: 1800, repair: 5.5, tires: 1.9, insurance: 2.4, overheadPct: 14, marginBase: 14, marginMin: 4,
           detentionFree: 4, detentionRate: 1500, marketPerKm: 88, seasonK: 6, urgencyK: 10, emptyReturnK: 35 } }],
  council_members: Array.from({ length: 9 }, (_, i) => ({ id: 'M-' + (i + 1), name: 'Член Совета ' + (i + 1), company: 'ООО «К-' + i + '»',
    city: 'Город', district: 'ЮФО', committee: 'Тарифный комитет', until: '2027-04-01', elected_by: 100 + i, chair: i === 0 })),
  carriers: [], applications: [], loads: [], bids: [], votes: [], vote_ballots: [], decisions: [], journal: [],
  settings: [{ key: 'council', val: { demoCouncil: false, electionThreshold: 50, elections: null } }],
  curators: [{ user_id: CURATOR.uid, email: CURATOR.email, role: 'admin' }]
};
const PUBLIC_INSERT = ['carriers', 'applications', 'loads', 'bids', 'journal'];
const LOG = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    const auth = String(req.headers.authorization || '');
    const isCurator = auth === 'Bearer ' + CURATOR.jwt;
    const role = isCurator ? 'curator' : 'anon';
    LOG.push(`${req.method} ${url.pathname}${url.search} [${role}]`);
    res.setHeader('Content-Type', 'application/json');
    const json = (code, data) => { res.statusCode = code; res.end(JSON.stringify(data)); };

    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = JSON.parse(body || '{}');
      if (String(email).trim() !== CURATOR.email || password !== CURATOR.password) return json(400, { error_description: 'Invalid login credentials' });
      return json(200, { access_token: CURATOR.jwt, refresh_token: 'refresh-1', expires_in: 3600, token_type: 'bearer', user: { id: CURATOR.uid, email: CURATOR.email } });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      return json(200, { access_token: CURATOR.jwt, refresh_token: 'refresh-1', expires_in: 3600, user: { id: CURATOR.uid, email: CURATOR.email } });
    }
    if (url.pathname === '/auth/v1/logout') { res.statusCode = 204; return res.end(); }

    const table = url.pathname.replace('/rest/v1/', '');
    if (!DB[table]) return json(404, []);
    if (req.method === 'GET') {
      if (table === 'applications' && role !== 'curator') return json(200, []);
      if (table === 'curators') return json(200, isCurator ? DB.curators : []);
      let rows = DB[table].slice();
      const idEq = url.searchParams.get('id');
      if (idEq && idEq.startsWith('eq.')) rows = rows.filter(r => String(r.id) === idEq.slice(3));
      return json(200, rows);
    }
    if (req.method === 'POST') {
      if (role !== 'curator' && !PUBLIC_INSERT.includes(table)) return json(401, { message: 'new row violates row-level security policy for table "' + table + '"' });
      const rows = [].concat(JSON.parse(body || '[]'));
      for (const row of rows) {
        if (table === 'carriers' && role !== 'curator' && (row.status !== 'pending' || row.demo === true))
          return json(401, { message: 'new row violates row-level security policy for table "carriers"' });
        const key = (url.searchParams.get('on_conflict') || 'id').split(',');
        const i = DB[table].findIndex(r => key.every(k => String(r[k]) === String(row[k])));
        if (i >= 0) DB[table][i] = { ...DB[table][i], ...row }; else DB[table].push({ id: DB[table].length + 1, ...row });
      }
      res.statusCode = 201; return res.end('');
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (role !== 'curator') return json(401, { message: 'permission denied for table ' + table });
      const patch = JSON.parse(body || '{}');
      const idEq = url.searchParams.get('id');
      DB[table] = DB[table].map(r => (idEq && idEq.startsWith('eq.') && String(r.id) !== idEq.slice(3)) ? r : { ...r, ...patch });
      return res.end('');
    }
    if (req.method === 'DELETE') {
      if (role !== 'curator') return json(401, { message: 'permission denied for table ' + table });
      return res.end('');
    }
    json(405, {});
  });
});
module.exports = { server, DB, LOG, CURATOR };
