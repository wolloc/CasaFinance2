import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/api.js';
import { AuditLog } from '../../types/index.js';
import {
  FileText,
  Search,
  Filter,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PlusCircle,
  Edit,
  Trash2,
  Database,
  CheckCircle2
} from 'lucide-react';
import { EmptyState } from '../common/EmptyState.js';
import { LoadingSkeleton } from '../common/LoadingSkeleton.js';

interface AuditLogExplorerProps {
  householdId: string;
  userId: string;
}

export const AuditLogExplorer: React.FC<AuditLogExplorerProps> = ({ householdId, userId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ApiService.getAuditLogs(householdId, userId);
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar trilha de auditoria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [householdId, userId]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
            <PlusCircle className="w-3 h-3" /> INSERT
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold text-[10px] flex items-center gap-1 border border-sky-300 dark:border-sky-800">
            <Edit className="w-3 h-3" /> UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-[10px] flex items-center gap-1 border border-rose-300 dark:border-rose-800">
            <Trash2 className="w-3 h-3" /> DELETE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
            {action}
          </span>
        );
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      searchTerm === '' ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user_name && log.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.record_id && log.record_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const matchTable = tableFilter === 'all' || log.table_name === tableFilter;

    return matchSearch && matchAction && matchTable;
  });

  const availableTables = Array.from(new Set(logs.map((l) => l.table_name)));

  return (
    <div id="audit-log-explorer" className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Trilha de Auditoria Imutável
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {logs.length} eventos
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log estruturado de todas as criações, alterações e exclusões com autor e timestamp.
              </p>
            </div>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por tabela, usuário, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 dark:text-slate-200"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 dark:text-slate-200"
          >
            <option value="all">Todas as Ações (INSERT, UPDATE, DELETE)</option>
            <option value="INSERT">Somente INSERT</option>
            <option value="UPDATE">Somente UPDATE</option>
            <option value="DELETE">Somente DELETE</option>
          </select>

          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 dark:text-slate-200"
          >
            <option value="all">Todas as Tabelas</option>
            {availableTables.map((tbl) => (
              <option key={tbl} value={tbl}>
                Tabela: {tbl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <LoadingSkeleton type="list" count={4} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Nenhum log de auditoria encontrado"
          description="Nenhuma ação corresponde aos filtros selecionados. Novos eventos de criação e edição aparecerão aqui instantaneamente."
        />
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getActionBadge(log.action)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                          {log.table_name}
                        </span>
                        {log.record_id && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            #{log.record_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <User className="w-3 h-3 text-slate-400" />
                          {log.user_name || 'Sistema'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimestamp(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400">
                    <span className="text-[10px] font-mono">Ver Payload</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs font-mono space-y-3">
                    {log.old_data && (
                      <div>
                        <div className="text-rose-400 text-[11px] font-bold mb-1">
                          Estado Anterior (old_data):
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] overflow-x-auto border border-slate-800">
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.new_data && (
                      <div>
                        <div className="text-emerald-400 text-[11px] font-bold mb-1">
                          Novo Estado (new_data):
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] overflow-x-auto border border-slate-800">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default AuditLogExplorer;
