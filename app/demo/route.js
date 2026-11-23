import { NextResponse } from 'next/server';

// Só existe no modo demonstração (npm run demo): entra direto como assinante ou admin de teste.
const IDS = { admin: '11111111-1111-4111-8111-111111111111', assinante: '22222222-2222-4222-8222-222222222222' };
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export async function GET(req) {
  if (process.env.DEMO_MODE !== '1') return new Response('Não encontrado', { status: 404 });
  const url = new URL(req.url);
  const como = url.searchParams.get('como') === 'admin' ? 'admin' : 'assinante';
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: IDS[como], role: 'authenticated', aud: 'authenticated', exp })}.demo`;
  const sessao = { access_token: token, token_type: 'bearer', expires_in: 7 * 86400, expires_at: exp, refresh_token: `r.${IDS[como]}`, user: { id: IDS[como], aud: 'authenticated', role: 'authenticated' } };
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const res = NextResponse.redirect(new URL(como === 'admin' ? '/admin' : '/painel', url.origin));
  res.cookies.set(`sb-${ref}-auth-token`, 'base64-' + b64url(sessao), { path: '/', sameSite: 'lax', maxAge: 7 * 86400 });
  return res;
}
