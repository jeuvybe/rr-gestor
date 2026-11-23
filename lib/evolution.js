import 'server-only';
// Cliente mínimo da Evolution API v2 (https://doc.evolution-api.com)

const base = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');

async function evo(caminho, { method = 'GET', body } = {}) {
  if (!base() || !process.env.EVOLUTION_API_KEY) throw new Error('Evolution API não configurada (EVOLUTION_API_URL e EVOLUTION_API_KEY).');
  const r = await fetch(base() + caminho, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const txt = await r.text();
  let json; try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
  if (!r.ok) {
    const msg = json?.response?.message || json?.message || json?.error || txt || `HTTP ${r.status}`;
    const e = new Error(Array.isArray(msg) ? msg.join(' ') : String(msg)); e.status = r.status; e.body = json; throw e;
  }
  return json;
}

export const nomeInstancia = (userId) => `rr_${String(userId).replace(/-/g, '').slice(0, 20)}`;

export async function criarInstancia(nome) {
  return evo('/instance/create', { method: 'POST', body: { instanceName: nome, qrcode: true, integration: 'WHATSAPP-BAILEYS' } });
}
export async function qrCode(nome) {
  return evo(`/instance/connect/${encodeURIComponent(nome)}`);
}
export async function estado(nome) {
  const r = await evo(`/instance/connectionState/${encodeURIComponent(nome)}`);
  return r?.instance?.state || r?.state || 'close'; // open | connecting | close
}
export async function detalhes(nome) {
  const r = await evo(`/instance/fetchInstances?instanceName=${encodeURIComponent(nome)}`);
  const i = Array.isArray(r) ? r[0] : r;
  const jid = i?.ownerJid || i?.instance?.owner || i?.owner || '';
  return { numero: String(jid).split('@')[0].replace(/\D/g, '') || null, perfil: i?.profileName || i?.instance?.profileName || null };
}
export async function desconectar(nome) {
  return evo(`/instance/logout/${encodeURIComponent(nome)}`, { method: 'DELETE' });
}
export async function enviarTexto(nome, numero, texto) {
  return evo(`/message/sendText/${encodeURIComponent(nome)}`, { method: 'POST', body: { number: String(numero).replace(/\D/g, ''), text: texto } });
}

/** Garante que a instância existe e devolve { estado, qr } */
export async function conectarOuQr(nome) {
  let st = 'close';
  try { st = await estado(nome); } catch (e) {
    if (e.status === 404) {
      const c = await criarInstancia(nome);
      const qr = c?.qrcode?.base64 || null;
      if (qr) return { estado: 'connecting', qr };
    } else throw e;
  }
  if (st === 'open') return { estado: 'open', qr: null };
  const q = await qrCode(nome);
  return { estado: 'connecting', qr: q?.base64 || null, codigo: q?.pairingCode || null };
}
