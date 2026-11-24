// ---------- datas (sempre ISO yyyy-mm-dd, em UTC) ----------
export const toD = (s) => new Date(s + 'T00:00:00Z');
export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const monthStart = (s) => s.slice(0, 8) + '01';
export const monthEnd = (s) => { const d = toD(s); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); };
export const addMonths = (s, n) => {
  const d = toD(s); const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last)); return iso(t);
};
export const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
export const todayISO = () => { const d = new Date(); return iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const fmtData = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
export const fmtDiaMes = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fmtMesAno = (s) => `${MESES_LONGOS[+s.slice(5, 7) - 1]} de ${s.slice(0, 4)}`;

// ---------- números ----------
const fBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fBRLc = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const fInt = new Intl.NumberFormat('pt-BR');
export const brl = (v) => fBRL.format(v || 0);
export const brlC = (v) => (Math.abs(v) < 1000 ? fBRL.format(v || 0).replace(/,00$/, '') : fBRLc.format(v));
export const int = (v) => fInt.format(v || 0);
export const pct = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d).replace('.', ',')}%`);
export const variacao = (atual, anterior) => (anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : atual ? null : 0);

// ---------- texto ----------
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const key = (s) => norm(s).replace(/[^a-z0-9]/g, '');

// ---------- telefone ----------
/** Só dígitos, com DDI. Números brasileiros sem DDI (10–11 dígitos) ganham o 55. */
export function normalizaTelefone(v, ddi = '55') {
  const bruto = String(v ?? '').trim();
  let d = bruto.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) return d.slice(2);
  if (bruto.startsWith('+')) return d;
  if (ddi === '55' && (d.length === 10 || d.length === 11)) d = '55' + d;
  return d;
}
export function fmtTelefone(d) {
  d = String(d ?? '').replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  return d ? `+${d}` : '—';
}

// ---------- erros do banco em português ----------
export function msgErro(e) {
  const m = e?.message || String(e || '');
  if (m.includes('LIMITE_PLANO')) return e.hint || 'Você atingiu o limite de clientes do seu plano. Faça upgrade para cadastrar mais.';
  if (m.includes('CONTA_BLOQUEADA')) return 'Sua conta está desativada. Renove a assinatura para voltar a usar.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail.';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Token has expired or is invalid/i.test(m)) return 'Código inválido ou expirado. Peça um novo.';
  if (/Signups not allowed for otp|User not found/i.test(m)) return 'Não encontramos conta com este telefone. Faça seu cadastro.';
  if (/rate limit|security purposes/i.test(m)) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (/duplicate key/i.test(m)) return 'Este registro já existe.';
  return m || 'Algo deu errado. Tente novamente.';
}
