// npm run demo  →  sobe o RR Gestor no seu computador com banco, login e WhatsApp simulados.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { iniciarServidor, jwt, CODIGO_DEMO } from './demo/servidor.mjs';

const PORTA_API = 54321;
const PORTA_APP = Number(process.env.PORT || 3000);
const PASTA = '.demo-data';

if (process.argv.includes('--reset')) { fs.rmSync(PASTA, { recursive: true, force: true }); console.log('• Dados de demonstração apagados.'); }

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_API}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }),
  SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role' }),
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORTA_APP}`,
  EVOLUTION_API_URL: `http://127.0.0.1:${PORTA_API}/evo`,
  EVOLUTION_API_KEY: 'demo',
  EVOLUTION_SYSTEM_INSTANCE: 'rr-sistema',
  CRON_SECRET: 'demo',
  DEMO_MODE: '1',
  NEXT_PUBLIC_DEMO: '1',
};
Object.assign(process.env, { EVOLUTION_API_KEY: 'demo', EVOLUTION_SYSTEM_INSTANCE: 'rr-sistema' });

try {
  await iniciarServidor({ porta: PORTA_API, pasta: PASTA });
} catch (e) {
  if (e.code === 'EADDRINUSE') console.error(`\n✖ A porta ${PORTA_API} já está em uso. Feche outra demonstração aberta e tente de novo.\n`);
  else console.error(e);
  process.exit(1);
}

console.log(`
──────────────────────────────────────────────────────────────
  RR Gestor — MODO DEMONSTRAÇÃO
  Abra:  http://localhost:${PORTA_APP}/login
  • Entrar como assinante: assinante@demo.com (qualquer senha)
  • Entrar como admin:     admin@demo.com     (qualquer senha)
  • Login por telefone: o código é sempre ${CODIGO_DEMO}
  • Mensagens de WhatsApp aparecem aqui no terminal.
  Para parar: Ctrl + C   ·   Zerar os dados: npm run demo:reset
──────────────────────────────────────────────────────────────
`);

const require = createRequire(import.meta.url);
const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-p', String(PORTA_APP)], { env, stdio: 'inherit' });
const sair = () => { next.kill(); process.exit(0); };
process.on('SIGINT', sair); process.on('SIGTERM', sair);
next.on('exit', (c) => process.exit(c ?? 0));
