import { Webhook } from 'standardwebhooks';
import { enviarTexto } from '@/lib/evolution';

// Supabase Auth > Hooks > "Send SMS hook" (HTTPS) aponta para esta rota.
// Em vez de SMS, o código de login vai pelo WhatsApp da instância do sistema.
export const runtime = 'nodejs';

const erro = (status, message) => Response.json({ error: { http_code: status, message } }, { status });

export async function POST(req) {
  const corpo = await req.text();
  const segredo = (process.env.SEND_SMS_HOOK_SECRET || '').replace(/^v1,whsec_/, '');
  if (!segredo) return erro(500, 'SEND_SMS_HOOK_SECRET não configurado');
  let dados;
  try {
    dados = new Webhook(segredo).verify(corpo, Object.fromEntries(req.headers));
  } catch {
    return erro(401, 'Assinatura inválida');
  }
  const telefone = String(dados?.user?.phone || '').replace(/\D/g, '');
  const codigo = dados?.sms?.otp;
  if (!telefone || !codigo) return erro(400, 'Telefone ou código ausente');
  const instancia = process.env.EVOLUTION_SYSTEM_INSTANCE || 'rr-sistema';
  try {
    await enviarTexto(instancia, telefone, `Seu código de acesso ao RR Gestor é *${codigo}*.\n\nEle expira em alguns minutos. Não compartilhe este código com ninguém.`);
    return Response.json({});
  } catch (e) {
    console.error('Falha ao enviar código por WhatsApp', e);
    return erro(500, 'Não foi possível enviar o código pelo WhatsApp agora. Tente entrar com e-mail.');
  }
}
