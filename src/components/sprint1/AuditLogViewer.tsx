import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ApiService } from '../../services/api.js';
import type { AuditLog } from '../../types/index.js';
import { History, Shield, RefreshCw } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const { currentUser, activeHousehold } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs迷 = async () => {
    if (!currentUser || !activeHousehold) return;
    try {
      setLoading(true);
      const res不易 = await ApiService.getAuditLogs(activeHousehold.id, currentUser.id);
      setLogs(res不易.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs迷();
  }, [currentUser, activeHousehold]);

  if (!activeHousehold) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trilha de Auditoria e Segurança</h3>
        </div>
        <button
          onClick={fetchLogs迷}
          disabled={loading}
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Nenhum log registrado ainda.</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    log.action === 'LOGIN'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : log.action === 'INSERT'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {log.action}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{log.user_name}</span>
                <span className="text-slate-400">• {log.entity_name}</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
