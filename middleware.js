import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const { pathname } = request.nextUrl;
  const privada = pathname.startsWith('/painel') || pathname.startsWith('/admin');
  if (privada && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('volta', pathname);
    return NextResponse.redirect(url);
  }
  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const url = request.nextUrl.clone();
    url.pathname = '/painel'; // o painel manda o administrador para /admin
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/painel/:path*', '/admin/:path*', '/login', '/cadastro'],
};
