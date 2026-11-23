# RR Gestor

Sistema de gestão de clientes e cobranças pelo WhatsApp da **RR Tecnologia**. Funciona como um SaaS: cada assinante tem a própria conta, e o que muda de um plano para outro é o limite de clientes.

**O que tem:**

- **Login e cadastro** por e-mail e senha, ou por telefone com código de 6 dígitos enviado pelo WhatsApp.
- **Painel do assinante:**
  - Dashboard com cards e variação contra o mês anterior, gráficos, filtros, tema claro/escuro, exportação CSV e PDF.
  - Clientes: cadastro, abas de situação, importação e exportação, registro de pagamento com renovação do vencimento e cobrança manual.
  - Financeiro, planos próprios, conexão do WhatsApp por QR Code e mensagens automáticas editáveis.
- **Cobrança automática** todo dia às 9h, horário de Brasília: lembrete X dias antes, no dia e X dias depois do vencimento. Cada cliente recebe no máximo uma mensagem por dia, e a mesma cobrança nunca sai duas vezes.
- **Painel administrador:**
  - Assinantes, receita mensal, contas vencendo e WhatsApp conectado.
  - Liberação manual de pagamento: escolhe o plano e os meses.
  - Bloqueio de contas e edição dos planos do sistema.
  - Configurações: Pix, WhatsApp de suporte e o WhatsApp que envia os códigos de login.
- **Página inicial pública** com os planos e preços lidos do banco.

**Tecnologias:**

- Next.js 15 (App Router), React 19, Tailwind, Recharts e Lucide.
- Supabase: Postgres com RLS e Auth.
- Evolution API v2 para o WhatsApp.
- Vercel com Cron.

---

## Regras de negócio

| Regra | Como funciona |
|---|---|
| Limite do plano | Conta só clientes **ativos**. Desativados não entram. O bloqueio é feito no banco (trigger `checa_limite_clientes`), então não dá para burlar pelo navegador. |
| Plano vencido | Se a validade de um plano pago passa, a conta volta a ter o limite do **plano padrão** (o Grátis). Os clientes já cadastrados continuam, mas não dá para cadastrar novos acima do limite. |
| Conta bloqueada | O assinante consulta os dados, mas não cadastra clientes e não envia cobranças. |
| Pagamento do assinante | Manual, em **Admin › Assinantes › Registrar pagamento**. A validade soma os meses a partir da validade atual, ou de hoje se o plano mudou ou já tinha vencido. |
| Primeiro cadastro | O **primeiro usuário** que se cadastra no sistema vira administrador. Crie a sua conta logo depois de publicar. |
| Segurança | Cada assinante só enxerga os próprios dados (Row Level Security). O assinante não consegue mudar o próprio plano, a validade, o status ou virar admin (trigger `protege_perfil`). |

Planos iniciais (editáveis em **Admin › Planos do sistema**): Grátis com 5 clientes (R$ 0), Profissional com 50 clientes (R$ 29,90) e Ilimitado (R$ 89,90).

---

## Instalação passo a passo

### 1. Supabase (banco e login)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole todo o arquivo `supabase/migrations/0001_schema.sql` e clique em **Run**.
3. Em **Project Settings › API**, copie a `Project URL`, a chave `anon public` e a chave `service_role`. A `service_role` é secreta.
4. Em **Authentication › URL Configuration**:
   - **Site URL**: `https://seu-dominio.com.br`
   - **Redirect URLs**: `https://seu-dominio.com.br/auth/callback`
5. Em **Authentication › Sign In / Providers**, deixe **Email** ativo. Se quiser que a conta já entre sem confirmar o e-mail, desligue "Confirm email".

### 2. Evolution API (servidor do WhatsApp)

A Evolution API precisa ficar ligada 24 horas. Por isso ela **não roda na Vercel**: use uma VPS com Docker. Uma de 2 GB de RAM basta para começar.

1. Siga a instalação com Docker Compose da documentação oficial: <https://doc.evolution-api.com>. Ela sobe a Evolution API com Postgres e Redis.
2. No `.env` da Evolution, defina `AUTHENTICATION_API_KEY` com um texto longo e aleatório. Esse é o valor do `EVOLUTION_API_KEY` deste projeto.
3. Coloque um domínio com HTTPS na frente (Nginx, Caddy ou o proxy do seu painel de VPS), por exemplo `https://evolution.seu-dominio.com.br`.
4. Teste no navegador: `https://evolution.seu-dominio.com.br` deve responder com uma mensagem de boas-vindas da API.

Não é preciso criar instâncias à mão. O sistema cria uma por assinante (`rr_<id>`) quando ele clica em **Gerar QR Code**, e a do sistema (`rr-sistema`) quando o admin conecta em **Configurações**.

> ⚠️ A conexão por QR Code (Baileys) **não é a API oficial** do WhatsApp. O número pode ser banido se enviar em massa para quem não conhece. O sistema já espaça os envios (2,5 a 5 segundos entre mensagens) e manda no máximo uma mensagem por cliente por dia. Mesmo assim, oriente os assinantes a usar só com clientes que já conversam com eles.

### 3. Vercel (publicação)

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `jeuvybe/rr-gestor`.
2. Em **Environment Variables**, cadastre as variáveis do `.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` |
| `NEXT_PUBLIC_SITE_URL` | `https://seu-dominio.com.br` |
| `EVOLUTION_API_URL` | `https://evolution.seu-dominio.com.br` |
| `EVOLUTION_API_KEY` | o `AUTHENTICATION_API_KEY` da Evolution |
| `EVOLUTION_SYSTEM_INSTANCE` | `rr-sistema` |
| `CRON_SECRET` | um texto longo e aleatório |
| `SEND_SMS_HOOK_SECRET` | gerado no passo 4 (pode deixar para depois) |

3. Clique em **Deploy** e depois aponte seu domínio em **Settings › Domains**.
4. O cron de cobrança já está no `vercel.json` (`0 12 * * *` = 9h de Brasília). A Vercel envia o `CRON_SECRET` sozinha.

### 4. Login por telefone (código no WhatsApp)

O Supabase manda o código de login por SMS, que é pago. Aqui o envio é trocado pelo WhatsApp com um **Send SMS Hook**:

1. No Supabase, em **Authentication › Sign In / Providers › Phone**, ative o login por telefone.
2. Em **Authentication › Hooks**, adicione o **Send SMS hook**:
   - tipo **HTTPS**;
   - URL `https://seu-dominio.com.br/api/hooks/enviar-codigo`;
   - clique em **Generate secret**.
3. Copie o segredo (formato `v1,whsec_...`) para a variável `SEND_SMS_HOOK_SECRET` na Vercel e faça um novo deploy.
4. Entre no sistema como admin e vá em **Configurações › WhatsApp do sistema**. Leia o QR Code com um número da RR, de preferência separado do número de cobranças.

Enquanto isso não estiver configurado, o login por e-mail funciona normalmente.

### 5. Primeiro acesso

1. Abra o site, clique em **Teste grátis** e crie a **sua** conta. Ela vira administradora.
2. Em **Admin › Configurações**, preencha a chave Pix e o WhatsApp de suporte. Eles aparecem para quem clicar em "Assinar".
3. Em **Admin › Planos do sistema**, ajuste nomes, limites e preços se precisar.

---

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

Para testar o cron localmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/cobrancas
```

## Estrutura

```
app/
  page.jsx                  página inicial com planos
  (auth)/login, cadastro, recuperar-senha, redefinir-senha
  painel/                   área do assinante (dashboard, clientes, financeiro, planos, whatsapp, conta)
  admin/                    área do administrador (assinantes, planos, configurações)
  api/whatsapp/[acao]       status, conectar (QR), desconectar, teste
  api/cobrar                envio manual de cobrança
  api/cron/cobrancas        cobrança automática diária
  api/hooks/enviar-codigo   código de login pelo WhatsApp (Send SMS Hook)
components/                 AppShell, Dashboard, ConexaoWhatsApp, AuthForm, ui
lib/                        supabase, evolution, cobranca, envios, format, dados
supabase/migrations/        esquema do banco, RLS, triggers e funções
```

## Próximos passos sugeridos

- Pagamento automático das assinaturas (Mercado Pago ou Asaas) liberando o plano por webhook.
- Área do cliente final, com link para ver e pagar a mensalidade.
- Opção de usar a API oficial do WhatsApp (Cloud API) para quem quiser mais estabilidade.
