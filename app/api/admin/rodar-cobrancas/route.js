import { exigirLogin, json } from '@/lib/servidor';
import { rodarCobrancas } from '@/lib/rodarCobrancas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Botão "Rodar cobranças agora" do administrador (mesma rotina do cron diário)
export async function POST() {
  const s = await exigirLogin({ admin: true }); if (s.resposta) return s.resposta;
  return json(await rodarCobrancas(process.env.DEMO_MODE === '1' ? { intervaloMs: [150, 300] } : undefined));
}
