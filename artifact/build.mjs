// Gera a versão de demonstração em uma página: npm run build:artifact  →  dist-artifact/
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { jwt } from '../scripts/demo/nucleo.mjs';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const saida = path.join(raiz, 'dist-artifact');
fs.rmSync(saida, { recursive: true, force: true }); fs.mkdirSync(saida, { recursive: true });
const shim = (f) => path.join(raiz, 'artifact/shims', f);

const env = {
  NODE_ENV: 'production', NEXT_PUBLIC_DEMO: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://demo.local', NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }), SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role' }),
  NEXT_PUBLIC_SITE_URL: 'https://demo.local', EVOLUTION_API_URL: 'https://demo.local/evo', EVOLUTION_API_KEY: 'demo', EVOLUTION_SYSTEM_INSTANCE: 'rr-sistema', DEMO_MODE: '1',
};

const apelidos = {
  name: 'apelidos',
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: shim('link.jsx') }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: shim('navigation.js') }));
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: shim('vazio.js') }));
    b.onResolve({ filter: /supabase\/client(\.js)?$/ }, () => ({ path: shim('supabase-client.js') }));
    b.onResolve({ filter: /supabase\/server(\.js)?$/ }, () => ({ path: shim('supabase-server.js') }));
    b.onResolve({ filter: /supabase\/admin(\.js)?$/ }, () => ({ path: shim('supabase-admin.js') }));
    b.onResolve({ filter: /^@\// }, async (a) => b.resolve('./' + a.path.slice(2), { resolveDir: raiz, kind: a.kind }));
    // módulos de Node que o PGlite só usa fora do navegador
    b.onResolve({ filter: /^(fs|path|url|crypto|module|node:.*)$/ }, () => ({ path: shim('vazio.js') }));
  },
};

await build({
  entryPoints: [path.join(raiz, 'artifact/main.jsx')],
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
  outfile: path.join(saida, 'app.js'), jsx: 'automatic', loader: { '.sql': 'text', '.js': 'jsx' },
  banner: { js: `globalThis.process={env:${JSON.stringify(env)}};` },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [apelidos], logLevel: 'warning',
});

fs.writeFileSync(path.join(saida, 'tailwind.config.cjs'), `const base = require(${JSON.stringify(path.join(raiz, 'tailwind.config.js'))});
module.exports = { ...base, content: ${JSON.stringify([path.join(raiz, 'app/**/*.{js,jsx}'), path.join(raiz, 'components/**/*.{js,jsx}'), path.join(raiz, 'artifact/**/*.{js,jsx}')])} };`);
execSync(`npx tailwindcss -c ${path.join(saida, 'tailwind.config.cjs')} -i ${path.join(raiz, 'app/globals.css')} -o ${path.join(saida, 'app.css')} --minify`, { cwd: raiz, stdio: 'ignore' });
fs.rmSync(path.join(saida, 'tailwind.config.cjs'));

const pg = path.join(raiz, 'node_modules/@electric-sql/pglite/dist');
for (const [f, nome] of [['pglite.wasm', 'pglite-wasm'], ['pglite.data', 'pglite-data'], ['initdb.wasm', 'initdb-wasm']]) {
  fs.writeFileSync(path.join(saida, `${nome}.gz.b64.txt`), zlib.gzipSync(fs.readFileSync(path.join(pg, f)), { level: 9 }).toString('base64'));
}

fs.writeFileSync(path.join(saida, 'index.html'), `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>RR Gestor · demonstração</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%201080%201080%22%3E%3Crect%20width%3D%221080%22%20height%3D%221080%22%20rx%3D%22220%22%20fill%3D%22%230B1F3A%22/%3E%3Cg%20fill%3D%22%23F3F7FC%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M194%20284H377.5A147.5%20147.5%200%200%201%20377.5%20579H273V755H194ZM273%20363V500H377.5A68.5%2068.5%200%200%200%20377.5%20363Z%22/%3E%3Cpath%20d%3D%22M345.5%20594H437.5L531%20755H439Z%22/%3E%3Cpath%20d%3D%22M554%20284H737.5A147.5%20147.5%200%200%201%20737.5%20579H633V755H554ZM633%20363V500H737.5A68.5%2068.5%200%200%200%20737.5%20363Z%22/%3E%3C/g%3E%3Cpath%20d%3D%22M705.5%20594H797.5L891%20755H799Z%22%20fill%3D%22%2300B8D9%22/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./app.css">
</head>
<body>
<div id="root"></div>
<script type="module" src="./app.js"></script>
</body>
</html>
`);
for (const f of fs.readdirSync(saida)) console.log(f, (fs.statSync(path.join(saida, f)).size / 1048576).toFixed(2) + ' MB');
