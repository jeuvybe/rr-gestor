// MODO DEMONSTRAÇÃO no computador: sobe o núcleo simulado num servidor HTTP local.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { prepararBanco, criarNucleo, PARSERS, USUARIOS_DEMO } from './nucleo.mjs';

export { jwt, CODIGO_DEMO } from './nucleo.mjs';

const PASTA_MIG = new URL('../../supabase/migrations/', import.meta.url);
const migracoes = () => fs.readdirSync(PASTA_MIG).filter((x) => x.endsWith('.sql')).sort().map((nome) => ({ nome, sql: fs.readFileSync(new URL(nome, PASTA_MIG), 'utf8') }));

export async function iniciarServidor({ porta = 54321, pasta = '.demo-data', log = console.log } = {}) {
  const nova = !fs.existsSync(path.join(pasta, 'PG_VERSION'));
  const db = new PGlite(pasta, { parsers: PARSERS });
  await db.waitReady;
  try { await prepararBanco(db, { migracoes: migracoes(), nova, log }); } catch (e) {
    if (nova) { await db.close(); fs.rmSync(pasta, { recursive: true, force: true }); }
    throw e;
  }
  const { despachar } = criarNucleo(db, { log, evoKey: process.env.EVOLUTION_API_KEY || 'demo', sistema: process.env.EVOLUTION_SYSTEM_INSTANCE || 'rr-sistema' });

  const servidor = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      res.setHeader('access-control-allow-origin', req.headers.origin || '*');
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
      res.setHeader('access-control-expose-headers', 'content-range');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      despachar(req, res, corpo);
    });
  });
  await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(porta, '127.0.0.1', ok); });
  return { servidor, db, usuarios: USUARIOS_DEMO };
}
