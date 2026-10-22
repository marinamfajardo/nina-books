// Envia a notificação diária para os aparelhos inscritos (roda no GitHub Actions).
// O segredo NINA_PUSH (configurado no GitHub) é um JSON: {"privateKey": "...", "secret": "..."}
import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://dghztcgapzaidjnkfopl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hKsa9b7SFsZbN3pC1k_8nQ_TwHFYX12';
const VAPID_PUBLIC = 'BFik7fXYnp015AeTOH4r-to6jpmnVlcpEHw0X4gHiEeeeZ-fFAYdtg48DaxmoZgo7w1HeTdmkrNyW77wYRA57MM';
const tipo = process.env.TIPO === 'manha' ? 'manha' : 'noite';

if (!process.env.NINA_PUSH) {
  console.error('Falta o segredo NINA_PUSH no GitHub (Settings › Secrets and variables › Actions).');
  process.exit(1);
}
const { privateKey, secret } = JSON.parse(process.env.NINA_PUSH);
webpush.setVapidDetails('mailto:nina-books@users.noreply.github.com', VAPID_PUBLIC, privateKey);

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nina_push_targets`, {
  method: 'POST',
  headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ secret }),
});
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
