// Envia a notificação diária para os aparelhos inscritos (roda no GitHub Actions).
// O segredo NINA_PUSH (configurado no GitHub) é um JSON: {"privateKey": "...", "secret": "..."}
import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://dghztcgapzaidjnkfopl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hKsa9b7SFsZbN3pC1k_8nQ_TwHFYX12';
const VAPID_PUBLIC = 'BFik7fXYnp015AeTOH4r-to6jpmnVlcpEHw0X4gHiEeeeZ-fFAYdtg48DaxmoZgo7w1HeTdmkrNyW77wYRA57MM';
// Envio manual (TIPO definido) ignora o horário. No agendado, decide pelo horário de Brasília (UTC−3).
const manual = process.env.TIPO === 'manha' || process.env.TIPO === 'noite';
const now = new Date(Date.now() - 3 * 3600 * 1000);
const hour = now.getUTCHours();
const tipo = manual ? process.env.TIPO : hour >= 9 && hour < 11 ? 'manha' : hour >= 21 && hour < 23 ? 'noite' : null;
const day = now.toISOString().slice(0, 10);

if (!tipo) {
  console.log(`Fora do horário dos avisos (${hour}h em Brasília): nada a enviar.`);
  process.exit(0);
}
if (!process.env.NINA_PUSH) {
  // sem o segredo não dá para enviar, mas não marca a tarefa como erro
  console.log('Notificações ainda não configuradas: falta o segredo NINA_PUSH no GitHub (Settings › Secrets and variables › Actions).');
  process.exit(0);
}
let privateKey, secret;
try {
  ({ privateKey, secret } = JSON.parse(process.env.NINA_PUSH));
} catch {
  console.error('O segredo NINA_PUSH não está no formato certo. Ele deve ser exatamente a linha {"privateKey":"…","secret":"…"}.');
  process.exit(1);
}
webpush.setVapidDetails('mailto:nina-books@users.noreply.github.com', VAPID_PUBLIC, privateKey);

const rpc = (name, body) =>
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// garante um aviso de cada tipo por dia (as tentativas seguintes da janela não reenviam)
if (!manual) {
  const c = await rpc('nina_push_claim', { secret, kind: tipo, day });
  if (!c.ok) {
    console.error('Erro ao registrar o envio no Supabase (rodou o supabase/push.sql completo?):', c.status, await c.text());
    process.exit(1);
  }
  if ((await c.json()) !== true) {
    console.log(`Aviso "${tipo}" de ${day} já enviado (ou segredo inválido): nada a fazer.`);
    process.exit(0);
  }
}

const res = await rpc('nina_push_targets', { secret });
if (!res.ok) {
  console.error('Erro ao buscar aparelhos:', res.status, await res.text());
  process.exit(1);
}
const targets = await res.json();
let sent = 0;
for (const t of targets) {
  if (t.data?.[tipo] === false) continue; // a leitora desligou este aviso
  try {
    await webpush.sendNotification(t.data.subscription, JSON.stringify({ type: tipo }), { TTL: 3 * 3600, urgency: 'normal' });
    sent++;
  } catch (e) {
    console.warn(`Falha em ${t.id}: ${e.statusCode ?? ''} ${e.body ?? e.message}`);
  }
}
console.log(`Notificação "${tipo}" enviada para ${sent} de ${targets.length} aparelho(s).`);
