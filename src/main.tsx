import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { applyTheme } from './theme';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

// Guarda o app no aparelho para funcionar offline e se atualiza sozinho.
registerSW({
  immediate: true,
  // procura versão nova ao abrir e sempre que o app volta para a tela
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => void reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    setInterval(check, 30 * 60 * 1000);
  },
});

// quando a versão nova assume, recarrega uma vez para mostrar as novidades
// (só em atualizações: na primeira instalação não há o que recarregar)
const hadController = !!navigator.serviceWorker?.controller;
let reloaded = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloaded || !hadController) return;
  reloaded = true;
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
