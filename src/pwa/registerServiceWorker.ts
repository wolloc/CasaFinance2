export type UpdateHandler = () => void;

export function registerServiceWorker(onUpdate: UpdateHandler): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate();
        });
      });
    }).catch((error: unknown) => console.error('Falha ao registrar o modo instalável.', error));
  });
}

export function activateWaitingServiceWorker(): void {
  void navigator.serviceWorker.getRegistration().then((registration) => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }));
}
