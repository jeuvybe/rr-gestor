'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, Power, RefreshCw, Send, Smartphone, CheckCircle2 } from 'lucide-react';
import { Btn, Campo, Badge, useToast } from '@/components/ui';
import { fmtTelefone } from '@/lib/format';

/** Conexão do WhatsApp por QR Code (Evolution API). escopo="sistema" = instância do admin para códigos de login. */
export default function ConexaoWhatsApp({ escopo = '', bloqueado = false, aoMudar }) {
  const toast = useToast();
  const q = escopo ? `?escopo=${escopo}` : '';
  const [st, setSt] = useState({ status: 'carregando' });
  const [qr, setQr] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [teste, setTeste] = useState('');
  const timer = useRef(null);

  const ler = useCallback(async () => {
    const r = await fetch(`/api/whatsapp/status${q}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setSt({ status: 'erro', erro: j.erro }); return 'erro'; }
    setSt(j); if (j.status === 'conectado') setQr(null);
    return j.status;
  }, [q]);

  useEffect(() => { ler(); return () => clearInterval(timer.current); }, [ler]);
  useEffect(() => { aoMudar?.(st.status); }, [st.status, aoMudar]);

  async function conectar() {
    setOcupado(true);
    const r = await fetch(`/api/whatsapp/conectar${q}`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return toast(j.erro || 'Falha ao gerar QR Code.', false);
    if (j.status === 'conectado') { toast('WhatsApp já está conectado.'); return ler(); }
    setQr(j.qr); setSt((s) => ({ ...s, status: 'conectando' }));
    clearInterval(timer.current);
    let n = 0;
    timer.current = setInterval(async () => {
      n++;
      const s = await ler();
      if (s === 'conectado') { clearInterval(timer.current); toast('WhatsApp conectado!'); }
      else if (n % 10 === 0) { // QR expira ~40s: renova
        const r2 = await fetch(`/api/whatsapp/conectar${q}`, { method: 'POST' }); const j2 = await r2.json().catch(() => ({}));
        if (j2.qr) setQr(j2.qr);
      }
      if (n > 60) { clearInterval(timer.current); setQr(null); ler(); }
    }, 3000);
  }
  async function sair() {
    setOcupado(true);
    const r = await fetch(`/api/whatsapp/desconectar${q}`, { method: 'POST' });
    setOcupado(false);
    if (!r.ok) return toast('Falha ao desconectar.', false);
    toast('WhatsApp desconectado.'); ler();
  }
  async function enviarTeste(e) {
    e.preventDefault(); setOcupado(true);
    const r = await fetch(`/api/whatsapp/teste${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: teste }) });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    toast(r.ok ? 'Mensagem de teste enviada.' : j.erro || 'Falha no envio.', r.ok);
  }

  const conectado = st.status === 'conectado';
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {st.status === 'carregando' ? <Badge>verificando…</Badge>
            : conectado ? <Badge tom="verde"><CheckCircle2 className="h-3 w-3" />Conectado</Badge>
              : st.status === 'conectando' ? <Badge tom="ambar">Aguardando leitura do QR Code</Badge>
                : st.status === 'erro' ? <Badge tom="vermelho">Servidor indisponível</Badge> : <Badge tom="vermelho">Desconectado</Badge>}
          {conectado && st.numero && <span className="text-sm font-semibold">{fmtTelefone(st.numero)}{st.perfil ? ` · ${st.perfil}` : ''}</span>}
        </div>
        {st.status === 'erro' && <p className="mt-2 text-sm text-rose-600">{st.erro}</p>}
        {!conectado && (
          <ol className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>1. Clique em <b>Gerar QR Code</b>.</li>
            <li>2. No celular, abra o WhatsApp › <b>Aparelhos conectados</b> › <b>Conectar aparelho</b>.</li>
            <li>3. Aponte a câmera para o código ao lado.</li>
          </ol>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {conectado ? (
            <><Btn onClick={ler}><RefreshCw className="h-4 w-4" />Atualizar</Btn><Btn variante="fantasma" onClick={sair} carregando={ocupado}><Power className="h-4 w-4" />Desconectar</Btn></>
          ) : (
            <Btn variante="primario" onClick={conectar} carregando={ocupado} disabled={bloqueado}><QrCode className="h-4 w-4" />{qr ? 'Gerar novo QR Code' : 'Gerar QR Code'}</Btn>
          )}
        </div>
        {conectado && (
          <form onSubmit={enviarTeste} className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4 dark:border-night-line">
            <Campo rotulo="Enviar mensagem de teste para" type="tel" placeholder="(85) 99999-9999" value={teste} onChange={(e) => setTeste(e.target.value)} className="min-w-[220px] flex-1" required />
            <Btn type="submit" carregando={ocupado}><Send className="h-4 w-4" />Testar</Btn>
          </form>
        )}
      </div>
      <div className="grid h-[248px] w-[248px] place-items-center justify-self-center rounded-2xl border border-line bg-white p-3 dark:border-night-line">
        {qr ? <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code para conectar o WhatsApp" className="h-full w-full" />
          : conectado ? <div className="text-center text-emerald-600"><Smartphone className="mx-auto h-12 w-12" /><div className="mt-2 text-sm font-semibold">Aparelho conectado</div></div>
            : <div className="text-center text-slate-400"><QrCode className="mx-auto h-12 w-12" /><div className="mt-2 text-xs">O QR Code aparece aqui</div></div>}
      </div>
    </div>
  );
}
