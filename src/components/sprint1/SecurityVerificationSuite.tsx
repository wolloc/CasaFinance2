import React, { useState } from 'react';
import { ApiService, SecuritySuiteResult } from '../../services/api.js';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export const SecurityVerificationSuite: React.FC = () => {
  const [results, setResults] = useState<SecuritySuiteResult | null>(null);
  const [running, setRunning] = useState(false);

  const runSuite = async () => {
    try {
      setRunning(true);
      const res = await ApiService.runSecuritySuite();
      setResults(res);
    } catch (err) {
      console.error('Erro ao rodar suite de segurança', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Validador de RLS & Segurança Multi-Tenant</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Garante que dados de Wallace e Guilherme fiquem 100% isolados</p>
          </div>
        </div>

        <button
          onClick={runSuite}
          disabled={running}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
        >
          {running ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Executar Testes RLS
            </>
          )}
        </button>
      </div>

      {results ? (
        <div className="space-y-2.5 pt-1">
          <div
            className={`p-3 rounded-xl flex items-center justify-between text-xs font-semibold ${
              results.all_passed
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {results.all_passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4 text-rose-500" />}
              <span>
                {results.passed_count} de {results.total_tests} Testes de Segurança Aprovados
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-wider bg-white/70 dark:bg-slate-900/70 px-2 py-0.5 rounded-md">
              {results.all_passed ? '100% Seguro' : 'Falha Detectada'}
            </span>
          </div>

          <div className="space-y-2">
            {results.results.map((t) => (
              <div
                key={t.test_id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs"
              >
                {t.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t.test_id}: {t.description}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.passed
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {t.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-dashed border-slate-300 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clique no botão acima para rodar a suíte de verificação de permissões e RLS em tempo real.
          </p>
        </div>
      )}
    </div>
  );
};
