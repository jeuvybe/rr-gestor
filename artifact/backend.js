// "Servidor" da demonstração, rodando dentro da própria página:
// Postgres (PGlite em WebAssembly) + rotas simuladas do Supabase, da Evolution API e das rotas /api do app.
import { PGlite } from '@electric-sql/pglite';
import { prepararBanco, criarNucleo, PARSERS } from '../scripts/demo/nucleo.mjs';
import m0001 from '../supabase/migrations/0001_schema.sql';
import m0002 from '../supabase/migrations/0002_servidores_modelos_area_cliente.sql';
import m0003 from '../supabase/migrations/0003_conta_desativada.sql';
import * as rotaWhatsapp from '../app/api/whatsapp/[acao]/route.js';
import * as rotaCobrar from '../app/api/cobrar/route.js';
import * as rotaRodar from '../app/api/admin/rodar-cobrancas/route.js';

const BASE = 'https://demo.local';
const STATUS_SEM_CORPO = new Set([101, 204, 205, 304]);

export async function iniciarBackend({ progresso = () => {}, aoEnviar = () => {} } = {}) {
  progresso('Baixando o banco de dados…');
  // arquivos do banco compactados (gzip) e em base64, porque a página só serve tipos de texto/wasm
  const baixar = async (f) => {
    const r = await fetch(f); if (!r.ok) throw new Error(`Falha ao carregar ${f}`);
    const bin = atob((await r.text()).trim()); const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  };
  const [wasm, initdb, dados] = await Promise.all([baixar('./pglite-wasm.gz.b64.txt'), baixar('./initdb-wasm.gz.b64.txt'), baixar('./pglite-data.gz.b64.txt')]);
  const [pgliteWasmModule, initdbWasmModule] = await Promise.all([WebAssembly.compile(wasm), WebAssembly.compile(initdb)]);
  const fsBundle = new Blob([dados]);
  progresso('Ligando o banco…');
  const db = await PGlite.create({ pgliteWasmModule, initdbWasmModule, fsBundle, parsers: PARSERS });
  progresso('Criando tabelas e dados de exemplo…');
  const log = (m) => console.log('[demo]', m);
  await prepararBanco(db, { migracoes: [{ nome: '0001_schema.sql', sql: m0001 }, { nome: '0002_servidores_modelos_area_cliente.sql', sql: m0002 }, { nome: '0003_conta_desativada.sql', sql: m0003 }], nova: true, log });
  const nucleo = criarNucleo(db, { log, evoKey: 'demo', sistema: 'rr-sistema', aoEnviar });

  const original = window.fetch.bind(window);
  window.fetch = async (entrada, init = {}) => {
    const href = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const interno = href.startsWith(BASE) ? href.slice(BASE.length) : href.startsWith('/api/') ? href : null;
    if (interno === null) return original(entrada, init);
    const metodo = (init.method || (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();
    const cab = {}; new Headers(init.headers || (entrada instanceof Request ? entrada.headers : undefined)).forEach((v, k) => { cab[k] = v; });
    const corpo = init.body ?? (entrada instanceof Request && metodo !== 'GET' ? await entrada.text() : undefined);
    const caminho = new URL(interno, BASE).pathname;

    // rotas /api do próprio app (os mesmos arquivos de app/api/*)
    if (caminho.startsWith('/api/')) {
      const req = new Request(BASE + interno, { method: metodo, headers: cab, body: metodo === 'GET' || metodo === 'HEAD' ? undefined : corpo });
      const wa = caminho.match(/^\/api\/whatsapp\/([^/]+)$/);
      const ctx = { params: Promise.resolve({ acao: wa?.[1] }) };
      if (wa) return (metodo === 'GET' ? rotaWhatsapp.GET : rotaWhatsapp.POST)(req, ctx);
      if (caminho === '/api/cobrar') return rotaCobrar.POST(req);
      if (caminho === '/api/admin/rodar-cobrancas') return rotaRodar.POST(req);
      return Response.json({ erro: 'rota não disponível na demonstração' }, { status: 404 });
    }

    // Supabase e Evolution simulados
    return new Promise((resolver) => {
      let status = 200; const cabecalhos = {};
      const res = {
        setHeader: (k, v) => { cabecalhos[k] = v; },
        writeHead: (s, h = {}) => { status = s; Object.assign(cabecalhos, h); },
        end: (b) => resolver(new Response(STATUS_SEM_CORPO.has(status) ? null : (b ?? ''), { status, headers: cabecalhos })),
      };
      nucleo.despachar({ method: metodo, url: interno, headers: cab }, res, typeof corpo === 'string' ? corpo : corpo ? String(corpo) : '');
    });
  };
  return { db };
}
