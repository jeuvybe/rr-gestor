import Link from 'next/link';
export default function NotFound() {
  return <div className="grid min-h-screen place-items-center p-6 text-center"><div><div className="font-display text-5xl font-bold">404</div><p className="mt-2 text-slate-500">Página não encontrada.</p><Link href="/" className="mt-4 inline-block font-semibold text-[#007F98]">Voltar ao início</Link></div></div>;
}
