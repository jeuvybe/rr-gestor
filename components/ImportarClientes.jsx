'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Btn, Modal, Interruptor, useToast } from '@/components/ui';
import { addMonths, fmtData, fmtTelefone, key, msgErro, norm, normalizaTelefone } from '@/lib/format';

// ---------------- importação de planilha (formato livre ou exportação do Gestor Lite)
const ALIAS = {
  nome: ['nome', 'cliente', 'nomecliente', 'nomedocliente', 'name', 'razaosocial'],
  whatsapp: ['whatsapp', 'telefone', 'celular', 'fone', 'phone', 'contato', 'numero', 'whats', 'telefonewhatsapp', 'telefonewhatsappcomddi'],
  email: ['email', 'emaildocliente', 'mail'],
  cidade: ['cidade', 'city', 'municipio'],
  plano: ['plano', 'produto', 'servico', 'pacote', 'categoria', 'idcategoria', 'iddacategoria', 'iddacategorianumero'],
  valor: ['valor', 'mensalidade', 'preco', 'valormensal'],
  vencimento: ['vencimento', 'datavencimento', 'proximovencimento', 'expira', 'expiraem', 'expiracao', 'validade'],
  notas: ['notas', 'observacao', 'obs', 'observacoes', 'qualquerinformacaodocliente'],
  senha: ['senha', 'senhadocliente', 'password'],
  externo: ['identificadorexterno', 'idexterno', 'mac', 'macouqualquercoisa'],
  usuario: ['usuario', 'login', 'user', 'username'],
  servidor: ['servidor', 'server', 'painel'],
  telas: ['telas', 'numerodetelas', 'qtdtelas', 'conexoes'],
};
function dataPlanilha(v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number' && v > 20000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = String(v || '').trim(); let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
const numPlanilha = (v) => { if (typeof v === 'number') return v; let s = String(v || '').replace(/[^\d.,-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Number(s) || 0; };
const txt = (v) => String(v ?? '').trim();
/** Nome do plano a partir do valor da coluna: códigos numéricos (Gestor Lite) viram "Categoria 9949"; 0 = sem plano. */
const nomePlano = (v) => { const s = txt(v); if (!s || s === '0') return ''; return /^\d+$/.test(s) ? `Categoria ${s}` : s; };

/** Acha a linha de cabeçalho (o Gestor Lite tem linhas de instrução antes dela). */
function lerTabela(ws) {
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const idx = linhas.slice(0, 20).findIndex((l) => { const ks = l.map(key); return ALIAS.nome.some((a) => ks.includes(a)) && ALIAS.whatsapp.some((a) => ks.includes(a)); });
  if (idx < 0) return null;
  const cab = linhas[idx].map((c) => key(c));
  const mapa = {};
  for (const [campo, nomes] of Object.entries(ALIAS)) { const i = cab.findIndex((c) => nomes.includes(c)); if (i >= 0) mapa[campo] = i; }
  const corpo = linhas.slice(idx + 1).filter((l) => l.some((c) => txt(c)));
  return { mapa, corpo };
}

export default function ImportarClientes({ onFechar, planos, servidores = [], existentes, sb, aoConcluir, hoje }) {
  const toast = useToast();
  const [linhas, setLinhas] = useState(null);
  const [info, setInfo] = useState(null);
  const [comSenha, setComSenha] = useState(true);
  const [prog, setProg] = useState(null);

  async function ler(file) {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const t = lerTabela(wb.Sheets[wb.SheetNames[0]]);
      if (!t) return toast('Não achei as colunas "nome" e "telefone/whatsapp" na planilha.', false);
      const { mapa, corpo } = t; const col = (r, c) => (mapa[c] !== undefined ? r[mapa[c]] : '');
      const jaTem = new Set((existentes || []).map((c) => c.whatsapp));
      const vistos = new Set(); let duplicados = 0, invalidos = 0;
      const lista = [];
      for (const r of corpo) {
        const nome = txt(col(r, 'nome')); const whatsapp = normalizaTelefone(col(r, 'whatsapp'));
        if (!nome || whatsapp.length < 10) { invalidos++; continue; }
        if (jaTem.has(whatsapp) || vistos.has(whatsapp)) { duplicados++; continue; }
        vistos.add(whatsapp);
        const emailBruto = txt(col(r, 'email'));
        // no Gestor Lite, a coluna "email" costuma trazer o nome do cliente e "nome" o login: usa os dois
        const apelido = emailBruto && !emailBruto.includes('@') ? emailBruto : '';
        const usuarioCol = txt(col(r, 'usuario'));
        lista.push({
          // Gestor Lite: "nome" é o login e "email" traz o nome do cliente
          nome: apelido || nome, usuario: usuarioCol || (apelido && norm(apelido) !== norm(nome) ? nome : '') || null, whatsapp,
          servidor: txt(col(r, 'servidor')), telas: Math.min(20, Math.max(1, parseInt(col(r, 'telas'), 10) || 1)), plano: nomePlano(col(r, 'plano')),
          email: emailBruto.includes('@') ? emailBruto : null,
          cidade: txt(col(r, 'cidade')) || null, valor: mapa.valor !== undefined ? numPlanilha(col(r, 'valor')) : null,
          vencimento: dataPlanilha(col(r, 'vencimento')) || addMonths(hoje, 1),
          notasOrig: txt(col(r, 'notas')), senha: txt(col(r, 'senha')), externo: txt(col(r, 'externo')),
        });
      }
      const existentesNomes = new Set(planos.map((p) => key(p.nome)));
      const novosPlanos = [...new Set(lista.map((l) => l.plano).filter((p) => p && !existentesNomes.has(key(p))))];
      const servNomes = new Set(servidores.map((x) => key(x.nome)));
      const novosServidores = [...new Set(lista.map((l) => l.servidor).filter((x) => x && !servNomes.has(key(x))))];
      setLinhas(lista); setInfo({ duplicados, invalidos, novosPlanos, novosServidores, temSenha: lista.some((l) => l.senha), gestorLite: mapa.senha !== undefined || mapa.externo !== undefined });
    } catch { toast('Não consegui ler esse arquivo.', false); }
  }

  async function importar() {
    setProg('preparando planos');
    // cria os planos que ainda não existem (valor 0: ajuste depois em Planos)
    const porNome = new Map(planos.map((p) => [key(p.nome), p]));
    for (const nome of info.novosPlanos) {
      const { data, error } = await sb.from('client_plans').insert({ nome, valor: 0, ciclo_meses: 1 }).select().single();
      if (error) { setProg(null); return toast(msgErro(error), false); }
      porNome.set(key(nome), data);
    }
    const porServ = new Map(servidores.map((x) => [key(x.nome), x]));
    for (const nome of info.novosServidores) {
      const { data, error } = await sb.from('servers').insert({ nome }).select().single();
      if (error) { setProg(null); return toast(msgErro(error), false); }
      porServ.set(key(nome), data);
    }
    let ok = 0, erro = null;
    for (let i = 0; i < linhas.length; i++) {
      setProg(`${i + 1} de ${linhas.length}`);
      const l = linhas[i]; const pl = l.plano ? porNome.get(key(l.plano)) : null;
      const sv = l.servidor ? porServ.get(key(l.servidor)) : null;
      const { error } = await sb.from('customers').insert({
        nome: l.nome, usuario: l.usuario, whatsapp: l.whatsapp, email: l.email, cidade: l.cidade, plano_id: pl?.id || null, servidor_id: sv?.id || null,
        valor: l.valor ?? Number(pl?.valor || 0), vencimento: l.vencimento, notas: l.notasOrig || null, telas: l.telas,
        senha_area: comSenha && l.senha ? l.senha : null, mac: l.externo || null,
      });
      if (error) { erro = msgErro(error); if (/limite|bloquead/i.test(erro)) break; } else ok++;
    }
    setProg(null); aoConcluir();
    toast(erro ? `${ok} clientes importados. Parou em: ${erro}` : `${ok} clientes importados.`, !erro);
    onFechar();
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Importar clientes" sub="Planilha Excel ou CSV (primeira aba). Aceita a exportação de clientes do Gestor Lite." largura="max-w-3xl"
      rodape={<><Btn onClick={onFechar}>Cancelar</Btn><Btn variante="primario" onClick={importar} disabled={!linhas?.length} carregando={!!prog}>{prog ? `Importando ${prog}` : `Importar ${linhas?.length || ''} clientes`}</Btn></>}>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && ler(e.target.files[0])} className="block w-full text-sm file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-brand-navy file:px-4 file:font-semibold file:text-white dark:file:bg-brand-cyan dark:file:text-brand-navy" />
      <p className="mt-3 text-xs text-slate-500">Colunas reconhecidas: <b>nome</b> e <b>telefone/whatsapp</b> (obrigatórias), usuário, e-mail, cidade, servidor, plano ou categoria, telas, valor, vencimento (dd/mm/aaaa), notas, senha e MAC/identificador externo. Sem vencimento, fica para daqui a 1 mês.</p>
      {info && (
        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-night-soft">
          <div><b>{linhas.length}</b> clientes prontos para importar{info.gestorLite && ' (formato Gestor Lite)'}.{info.duplicados > 0 && ` ${info.duplicados} já cadastrados ou repetidos serão pulados.`}{info.invalidos > 0 && ` ${info.invalidos} linhas sem nome ou telefone válido serão ignoradas.`}</div>
          {info.novosPlanos.length > 0 && <div>Planos que serão criados com valor R$ 0 (ajuste depois em <b>Planos</b>): {info.novosPlanos.join(', ')}.</div>}
          {info.novosServidores.length > 0 && <div>Servidores que serão criados: {info.novosServidores.join(', ')}.</div>}
          {info.temSenha && <Interruptor ligado={comSenha} onChange={setComSenha} rotulo="Importar as senhas para a área do cliente" desc="Cada cliente entra na área do cliente com o usuário e a senha da planilha." />}
        </div>
      )}
      {linhas && (
        <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-line dark:border-night-line">
          <table className="w-full text-xs"><thead><tr className="bg-slate-50 text-left dark:bg-night-soft"><th className="px-2 py-1.5">Nome</th><th className="px-2 py-1.5">Usuário</th><th className="px-2 py-1.5">WhatsApp</th><th className="px-2 py-1.5">Plano</th><th className="px-2 py-1.5">Vencimento</th></tr></thead>
            <tbody>{linhas.slice(0, 50).map((l, i) => <tr key={i} className="border-t border-line dark:border-night-line"><td className="px-2 py-1">{l.nome}</td><td className="px-2 py-1">{l.usuario || '—'}</td><td className="px-2 py-1">{fmtTelefone(l.whatsapp)}</td><td className="px-2 py-1">{l.plano || '—'}</td><td className="px-2 py-1">{fmtData(l.vencimento)}</td></tr>)}</tbody></table>
          {linhas.length > 50 && <p className="px-2 py-1.5 text-xs text-slate-500">… e mais {linhas.length - 50}</p>}
        </div>
      )}
    </Modal>
  );
}
