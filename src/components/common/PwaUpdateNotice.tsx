import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { activateWaitingServiceWorker, registerServiceWorker } from '../../pwa/registerServiceWorker.js';

export function PwaUpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => { registerServiceWorker(() => setAvailable(true)); }, []);
  useEffect(() => {
    const reload = () => window.location.reload();
    navigator.serviceWorker?.addEventListener('controllerchange', reload);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', reload);
  }, []);
  if (!available) return null;
  return <div role="status" aria-live="polite" className="fixed inset-x-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-700 bg-slate-900 p-3 text-white shadow-2xl" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}><RefreshCw className="size-5 shrink-0 text-blue-400" aria-hidden="true"/><p className="flex-1 text-xs"><strong className="block text-sm">Nova versão disponível</strong>Atualize quando for conveniente.</p><button type="button" onClick={activateWaitingServiceWorker} className="min-h-11 rounded-xl bg-blue-600 px-3 text-xs font-bold hover:bg-blue-500">Atualizar</button><button type="button" onClick={() => setAvailable(false)} aria-label="Dispensar aviso de atualização" className="flex size-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><X className="size-5"/></button></div>;
}
