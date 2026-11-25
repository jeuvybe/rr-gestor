import Link from 'next/link';
import Logo from '@/components/Logo';
import { ToastProvider, BotaoTema } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

export default function AuthLayout({ children }) {
  return (
    <ToastProvider>
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-brand-navy p-12 text-white lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3"><Logo claro className="h-8 w-auto" /><span className="font-display text-lg font-bold">RR Gestor</span></Link>
          <div className="my-auto max-w-md">
            <h1 className="font-display text-[40px] font-bold leading-[1.08]">Clientes, cobranças e WhatsApp num só lugar.</h1>
            <ul className="mt-8 space-y-3 text-cyan-50/90">
              {['Cobrança automática antes, no dia e depois do vencimento', 'Financeiro com ganhos, gastos e saldo do mês', 'Painel com indicadores e relatórios em PDF e CSV'].map((t) => (
                <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan" />{t}</li>
              ))}
            </ul>
          </div>
          <svg className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 opacity-[0.12]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#00B8D9" strokeWidth="8" /><circle cx="50" cy="50" r="24" fill="#00B8D9" /></svg>
          <p className="text-sm text-cyan-50/60">RR Tecnologia</p>
        </aside>
        <main className="flex flex-col px-5 py-6 sm:px-10">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 lg:invisible"><Logo className="h-7 w-auto" /><span className="font-display font-bold">RR Gestor</span></Link>
            <BotaoTema />
          </div>
          <div className="mx-auto my-auto w-full max-w-[420px] py-10">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
