import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Link de confirmação de e-mail e de recuperação de senha
export async function GET(request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/painel';
  const destino = new URL(next.startsWith('/') ? next : '/painel', url.origin);
  const sb = await supabaseServer();
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  let error = null;
  if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
  else if (token_hash && type) ({ error } = await sb.auth.verifyOtp({ token_hash, type }));
  else error = new Error('Link inválido');
  if (error) return NextResponse.redirect(new URL('/login?erro=link', url.origin));
  return NextResponse.redirect(destino);
}
