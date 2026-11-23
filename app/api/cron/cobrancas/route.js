import { rodarCobrancas } from '@/lib/rodarCobrancas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Roda 1x por dia (vercel.json). A Vercel envia "Authorization: Bearer CRON_SECRET".
export async function GET(req) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return Response.json(await rodarCobrancas());
}
