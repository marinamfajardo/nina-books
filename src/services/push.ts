import { db } from '../db';

/** Chave pública das notificações (a privada fica só no GitHub, como segredo). */
export const VAPID_PUBLIC_KEY = 'BFik7fXYnp015AeTOH4r-to6jpmnVlcpEHw0X4gHiEeeeZ-fFAYdtg48DaxmoZgo7w1HeTdmkrNyW77wYRA57MM';

const DEVICE_KEY = 'nina.deviceId';
export const deviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** No iPhone/iPad as notificações só funcionam com o app aberto pela tela de início. */
export const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const toBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export interface PushPrefs { manha: boolean; noite: boolean }

export async function getPushPrefs(): Promise<(PushPrefs & { on: boolean }) | null> {
  const p = await db.prefs.get(`push:${deviceId()}`);
  if (!p) return null;
  return { on: !!p.subscription, manha: p.manha !== false, noite: p.noite !== false };
}

/** Pede permissão e registra este aparelho para receber as notificações diárias. */
export async function enablePush(prefs: PushPrefs) {
  if (!pushSupported()) throw new Error('Este navegador não aceita notificações. No iPhone/iPad, atualize o iOS (16.4 ou mais novo) e abra o app pela tela de início.');
  if (isIOS() && !isInstalled()) throw new Error('No iPhone/iPad, as notificações só funcionam com o app instalado: Safari › Compartilhar ⬆️ › “Adicionar à Tela de Início”, e abra pelo ícone.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notificações bloqueadas. Libere em Ajustes do iPhone/iPad › Notificações › Nina Book’s.');
  const reg = await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) }));
  } catch {
    throw new Error('Não foi possível registrar as notificações neste aparelho. Confira se as notificações do Nina Book’s estão permitidas nos Ajustes do aparelho e tente de novo.');
  }
  await db.prefs.put({ id: `push:${deviceId()}`, subscription: sub.toJSON(), ...prefs, updatedAt: new Date().toISOString(), device: navigator.userAgent.slice(0, 120) });
}

export async function updatePushPrefs(prefs: PushPrefs) {
  const p = await db.prefs.get(`push:${deviceId()}`);
  if (p) await db.prefs.put({ ...p, ...prefs, updatedAt: new Date().toISOString() });
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch { /* ignora */ }
  await db.prefs.delete(`push:${deviceId()}`);
}

/** Mostra agora uma notificação de teste (sem depender do servidor). */
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("Nina Book's", { body: 'Tudo certo! As notificações estão funcionando 📚✨', icon: `${reg.scope}icon-192.png` });
}
