// =====================================================================
// MODO DEMONSTRAÇÃO — só para testar no computador, nunca em produção.
// Imita, num único processo local, o que o sistema usa de fora:
//   • Supabase (banco Postgres via PGlite + REST estilo PostgREST + Auth)
//   • Evolution API (WhatsApp): QR Code falso e mensagens mostradas no terminal
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { semear, USUARIOS_DEMO } from './dados.mjs';

const ident = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const jwt = (claims) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ ...claims, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })}.demo`;
export const CODIGO_DEMO = '123456';

const PASTA_MIG = new URL('../../supabase/migrations/', import.meta.url);
async function aplicarMigracoes(db) {
  await db.exec(`create table if not exists public._demo_migracoes (nome text primary key)`);
  const feitas = new Set((await db.query(`select nome from public._demo_migracoes`)).rows.map((r) => r.nome));
  // bancos criados antes deste controle já tinham a 0001
  if (!feitas.size && (await db.query(`select to_regclass('public.plans') t`)).rows[0].t) { await db.query(`insert into public._demo_migracoes values ('0001_schema.sql')`); feitas.add('0001_schema.sql'); }
  const novas = [];
  for (const arq of fs.readdirSync(PASTA_MIG).filter((x) => x.endsWith('.sql')).sort()) {
    if (feitas.has(arq)) continue;
    await db.exec(fs.readFileSync(new URL(arq, PASTA_MIG), 'utf8'));
    await db.query(`insert into public._demo_migracoes values ($1)`, [arq]);
    novas.push(arq);
  }
  return novas;
}

export async function iniciarServidor({ porta = 54321, pasta = '.demo-data', log = console.log } = {}) {
  const nova = !fs.existsSync(path.join(pasta, 'PG_VERSION'));
  const db = new PGlite(pasta, {
    parsers: { 1082: (v) => v, 1184: (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(), 1114: (v) => v, 1700: (v) => Number(v) },
  });
  await db.waitReady;
  if (nova) {
    log('• Criando o banco de demonstração (só na primeira vez)…');
    await db.exec(`
      create role authenticated; create role anon; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, phone text unique, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`);
    await aplicarMigracoes(db);
    await db.exec(`grant usage on schema public to authenticated, anon;
      grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
      grant execute on all functions in schema public to authenticated, anon;`);
    try { await semear(db); } catch (e) {
      await db.close(); fs.rmSync(pasta, { recursive: true, force: true });
      throw e;
    }
    log('• Dados de exemplo criados.');
  } else {
    // banco de uma versão anterior da demonstração: aplica só as migrações novas
    const novas = await aplicarMigracoes(db);
    if (novas.length) {
      await db.exec(`grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant execute on all functions in schema public to authenticated, anon;`);
      log(`• Banco atualizado: ${novas.join(', ')}`);
    }
  }

  // ------------------------------------------------------------ utilidades
  let fila = Promise.resolve();
  const serial = (fn) => (fila = fila.then(fn, fn));
  const claimsDe = (req) => {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url')); } catch { return {}; }
  };
  const uidDe = (req) => { const c = claimsDe(req); return c.role === 'service_role' ? 'service' : c.sub || null; };
  const comoUsuario = (uid, fn) => serial(() => db.transaction(async (tx) => {
    if (uid !== 'service') {
      await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
      await tx.query(`select set_config('request.uid', $1, true)`, [uid || '']);
    }
    return fn(tx);
  }));
  const responder = (res, status, dados, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...extra });
    res.end(dados === undefined ? '' : JSON.stringify(dados));
  };

  // ------------------------------------------------------------ Auth (imita o GoTrue)
  const usuarioJson = (u) => ({
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, phone: u.phone || '',
    user_metadata: u.raw_user_meta_data || {}, app_metadata: { provider: u.email ? 'email' : 'phone' },
    identities: [{ provider: u.email ? 'email' : 'phone' }], created_at: u.created_at, email_confirmed_at: u.created_at, confirmed_at: u.created_at,
  });
  const sessao = (u) => ({
    access_token: jwt({ sub: u.id, role: 'authenticated', email: u.email, aud: 'authenticated' }),
    token_type: 'bearer', expires_in: 7 * 86400, expires_at: Math.floor(Date.now() / 1000) + 7 * 86400,
    refresh_token: `r.${u.id}`, user: usuarioJson(u),
  });
  const buscar = (campo, valor) => serial(() => db.query(`select * from auth.users where ${campo} = $1`, [valor]).then((r) => r.rows[0]));
  const criar = (dados) => serial(() => db.query(`insert into auth.users (email, phone, raw_user_meta_data) values ($1, $2, $3) returning *`, [dados.email || null, dados.phone || null, JSON.stringify(dados.meta || {})]).then((r) => r.rows[0]));
  const erroAuth = (res, status, msg, code) => responder(res, status, { code: status, error_code: code, msg });

  async function auth(req, res, url, corpo) {
    const rota = url.pathname.replace('/auth/v1', '');
    const b = corpo ? JSON.parse(corpo) : {};
    if (rota === '/token' && url.searchParams.get('grant_type') === 'password') {
      const u = await buscar('email', String(b.email || '').toLowerCase());
      if (!u) return erroAuth(res, 400, 'Invalid login credentials', 'invalid_credentials');
      return responder(res, 200, sessao(u)); // na demonstração, qualquer senha serve
    }
    if (rota === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const u = await buscar('id', String(b.refresh_token || '').replace(/^r\./, ''));
      return u ? responder(res, 200, sessao(u)) : erroAuth(res, 400, 'Invalid Refresh Token', 'refresh_token_not_found');
    }
    if (rota === '/signup') {
      const email = String(b.email || '').toLowerCase();
      if (await buscar('email', email)) return erroAuth(res, 422, 'User already registered', 'user_already_exists');
      const u = await criar({ email, meta: b.data });
      log(`• Nova conta criada: ${email}`);
      return responder(res, 200, sessao(u));
    }
    if (rota === '/otp') {
      const phone = String(b.phone || '').replace(/\D/g, '');
      if (!b.create_user && !(await buscar('phone', phone))) return erroAuth(res, 422, 'Signups not allowed for otp', 'otp_disabled');
      pendentes.set(phone, b.data || {});
      log(`\n📱 [Login por telefone] Código para +${phone}: ${CODIGO_DEMO}\n`);
      return responder(res, 200, {});
    }
    if (rota === '/verify') {
      const phone = String(b.phone || '').replace(/\D/g, '');
      if (String(b.token) !== CODIGO_DEMO) return erroAuth(res, 403, 'Token has expired or is invalid', 'otp_expired');
      const u = (await buscar('phone', phone)) || (await criar({ phone, meta: pendentes.get(phone) }));
      return responder(res, 200, sessao(u));
    }
    if (rota === '/user') {
      const uid = uidDe(req);
      const u = uid && uid !== 'service' ? await buscar('id', uid) : null;
      if (!u) return erroAuth(res, 401, 'Invalid JWT', 'bad_jwt');
      return responder(res, 200, usuarioJson(u)); // GET e PUT (troca de senha) devolvem o usuário
    }
    if (rota === '/logout') return responder(res, 204);
    if (rota === '/recover') return responder(res, 200, {});
    return responder(res, 404, { msg: 'rota de auth não simulada' });
  }
  const pendentes = new Map();

  // ------------------------------------------------------------ REST (imita o PostgREST)
  function filtros(params, vals) {
    const w = [];
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const [op, ...r] = v.split('.'); const val = r.join('.'); const col = 't.' + ident(k);
      const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
      if (ops[op]) { vals.push(val); w.push(`${col} ${ops[op]} $${vals.length}`); }
      else if (op === 'in') { vals.push(val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))); w.push(`${col}::text = any($${vals.length})`); }
      else if (op === 'is') w.push(`${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`);
      else if (op === 'ilike' || op === 'like') { vals.push(val.replace(/\*/g, '%')); w.push(`${col} ${op} $${vals.length}`); }
    }
    return w.length ? ' where ' + w.join(' and ') : '';
  }
  async function colunasSelect(tx, tabela, sel) {
    const partes = []; let prof = 0, atual = '';
    for (const ch of sel || '*') { if (ch === '(') prof++; if (ch === ')') prof--; if (ch === ',' && !prof) { partes.push(atual.trim()); atual = ''; } else atual += ch; }
    if (atual.trim()) partes.push(atual.trim());
    const cols = [];
    for (const p of partes) {
      const m = p.match(/^(\w+)\((.*)\)$/);
      if (!m) { cols.push(p === '*' ? 't.*' : 't.' + ident(p)); continue; }
      const fk = await tx.query(`select a.attname col from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype = 'f' and c.conrelid = $1::regclass and c.confrelid = $2::regclass`, [`public.${tabela}`, `public.${m[1]}`]);
      const sub = m[2] === '*' ? 'to_json(x)' : `json_build_object(${m[2].split(',').map((c) => `'${c.trim()}', x.${ident(c.trim())}`).join(',')})`;
      cols.push(`(select ${sub} from public.${ident(m[1])} x where x.id = t.${ident(fk.rows[0].col)}) as ${ident(m[1])}`);
    }
    return cols.join(', ');
  }
  async function rest(req, res, url, corpo) {
    const uid = uidDe(req);
    const partes = url.pathname.replace('/rest/v1/', '').split('/');
    const unico = (req.headers.accept || '').includes('vnd.pgrst.object');
    const prefer = req.headers.prefer || '';
    const params = [...url.searchParams];
    try {
      const out = await comoUsuario(uid, async (tx) => {
        if (partes[0] === 'rpc') {
          const fn = partes[1]; const args = corpo ? JSON.parse(corpo) : {}; const ks = Object.keys(args);
          const info = await tx.query(`select proretset, prorettype::regtype::text t from pg_proc where proname = $1`, [fn]);
          const r = await tx.query(`select * from public.${ident(fn)}(${ks.map((k, i) => `${ident(k)} => $${i + 1}`).join(',')})`, ks.map((k) => args[k]));
          if (!info.rows[0].proretset && info.rows[0].t !== 'record') return { escalar: r.rows[0]?.[fn] ?? null };
          return r.rows;
        }
        const tabela = partes[0]; const vals = [];
        if (req.method === 'GET' || req.method === 'HEAD') {
          let sql = `select ${await colunasSelect(tx, tabela, url.searchParams.get('select'))} from public.${ident(tabela)} t` + filtros(params, vals);
          const ord = url.searchParams.get('order');
          if (ord) sql += ' order by ' + ord.split(',').map((o) => { const [c, d, n] = o.split('.'); return `t.${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}${n === 'nullsfirst' ? ' nulls first' : n === 'nullslast' ? ' nulls last' : ''}`; }).join(', ');
          let lim = url.searchParams.get('limit'), off = url.searchParams.get('offset');
          if (req.headers.range) { const [a, z] = req.headers.range.split('-').map(Number); off = a; lim = z - a + 1; }
          if (lim) sql += ` limit ${Number(lim)}`;
          if (off) sql += ` offset ${Number(off)}`;
          return (await tx.query(sql, vals)).rows;
        }
        if (req.method === 'POST') {
          const linhas = [].concat(JSON.parse(corpo)); const cols = [...new Set(linhas.flatMap(Object.keys))];
          const v = [];
          const tuplas = linhas.map((l) => '(' + cols.map((c) => { const x = l[c]; v.push(x === undefined ? null : x !== null && typeof x === 'object' ? JSON.stringify(x) : x); return `$${v.length}`; }).join(',') + ')');
          let sql = `insert into public.${ident(tabela)} (${cols.map(ident).join(',')}) values ${tuplas.join(',')}`;
          if (prefer.includes('merge-duplicates')) {
            const pk = (await tx.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = $1::regclass and i.indisprimary`, [`public.${tabela}`])).rows.map((r) => r.attname);
            const conf = url.searchParams.get('on_conflict')?.split(',') || pk;
            sql += ` on conflict (${conf.map(ident).join(',')}) do update set ${cols.filter((c) => !conf.includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`).join(',')}`;
          }
          return (await tx.query(sql + ' returning *', v)).rows;
        }
        if (req.method === 'PATCH') {
          const d = JSON.parse(corpo); const sets = Object.keys(d).map((c) => { vals.push(d[c] !== null && typeof d[c] === 'object' ? JSON.stringify(d[c]) : d[c]); return `${ident(c)} = $${vals.length}`; });
          return (await tx.query(`update public.${ident(tabela)} t set ${sets.join(',')}` + filtros(params, vals) + ' returning *', vals)).rows;
        }
        if (req.method === 'DELETE') return (await tx.query(`delete from public.${ident(tabela)} t` + filtros(params, vals) + ' returning *', vals)).rows;
        return [];
      });
      if (out && out.escalar !== undefined) return responder(res, 200, out.escalar);
      if (unico) {
        if (out.length !== 1) return responder(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${out.length} rows`, hint: null });
        return responder(res, 200, out[0]);
      }
      if (req.method !== 'GET' && partes[0] !== 'rpc' && !prefer.includes('return=representation')) return responder(res, 201);
      responder(res, 200, out, { 'content-range': `0-${Math.max(0, out.length - 1)}/*` });
    } catch (e) {
      responder(res, 400, { code: e.code || 'P0001', message: e.message, hint: e.hint || null, details: e.detail || null });
    }
  }

  // ------------------------------------------------------------ Evolution API (WhatsApp simulado)
  const instancias = {};
  const qrFalso = () => {
    const n = 25; let d = '';
    const finder = (x, y) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const emFinder = (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16);
      if (!emFinder && Math.random() < 0.45) d += `M${x} ${y}h1v1h-1z`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 29 29"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><path fill-rule="evenodd" d="${finder(0, 0)}${finder(18, 0)}${finder(0, 18)}${d}" fill="#111"/></svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  };
  function evolution(req, res, url, corpo) {
    if (req.headers.apikey !== process.env.EVOLUTION_API_KEY) return responder(res, 401, { message: 'Unauthorized' });
    const p = url.pathname.replace('/evo', '');
    const nome = decodeURIComponent(p.split('/').pop());
    if (p.startsWith('/instance/connectionState')) {
      const i = instancias[nome];
      if (!i) return responder(res, 404, { status: 404, message: 'instance not found' });
      // simula a leitura do QR Code: conecta alguns segundos depois de gerar
      if (i.state === 'connecting' && Date.now() - i.desde > 6000) { i.state = 'open'; log(`\n✅ [WhatsApp simulado] Instância ${nome} conectada (como se o QR Code tivesse sido lido).\n`); }
      return responder(res, 200, { instance: { instanceName: nome, state: i.state } });
    }
    if (p.startsWith('/instance/create')) {
      const n = JSON.parse(corpo).instanceName; instancias[n] = { state: 'connecting', desde: Date.now() };
      return responder(res, 201, { instance: { instanceName: n, status: 'created' }, qrcode: { base64: qrFalso() } });
    }
    if (p.startsWith('/instance/connect')) { instancias[nome] = { state: 'connecting', desde: Date.now() }; return responder(res, 200, { base64: qrFalso() }); }
    if (p.startsWith('/instance/fetchInstances')) {
      const n = url.searchParams.get('instanceName') || '';
      return responder(res, 200, [{ name: n, ownerJid: (n === (process.env.EVOLUTION_SYSTEM_INSTANCE || 'rr-sistema') ? '5585900000000' : '5585988887777') + '@s.whatsapp.net', profileName: 'WhatsApp de teste' }]);
    }
    if (p.startsWith('/instance/logout')) { if (instancias[nome]) instancias[nome].state = 'close'; return responder(res, 200, { status: 'SUCCESS' }); }
    if (p.startsWith('/message/sendText')) {
      if (instancias[nome]?.state !== 'open') return responder(res, 400, { message: 'Connection Closed' });
      const b = JSON.parse(corpo);
      log(`\n💬 [WhatsApp simulado] ${nome} → +${b.number}\n${b.text.split('\n').map((l) => '   ' + l).join('\n')}\n`);
      return responder(res, 201, { key: { id: 'DEMO' + Date.now() }, status: 'PENDING' });
    }
    return responder(res, 404, { message: 'rota não simulada' });
  }

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'); let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      res.setHeader('access-control-allow-origin', req.headers.origin || '*');
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
      res.setHeader('access-control-expose-headers', 'content-range');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const p = url.pathname;
      if (p.startsWith('/evo')) return evolution(req, res, url, corpo);
      if (p.startsWith('/auth/v1')) return auth(req, res, url, corpo).catch((e) => responder(res, 500, { msg: e.message }));
      if (p.startsWith('/rest/v1/')) return rest(req, res, url, corpo);
      responder(res, 404, {});
    });
  });
  await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(porta, '127.0.0.1', ok); });
  return { servidor, db, usuarios: USUARIOS_DEMO };
}
