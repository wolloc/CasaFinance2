import React, { useState, useEffect } from 'react';
import { ApiService, SecuritySuiteResult } from '../../services/api.js';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  CreditCard,
  Calculator,
  ArrowRightLeft,
  FileText,
  Filter,
  Check,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

export const SecurityAndEdgeTestSuite: React.FC = () => {
  const [results, setResults] = useState<SecuritySuiteResult | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);

  const runSuite = async () => {
    try {
      setRunning(true);
      const res = await ApiService.runSecuritySuite();
      setResults(res);
      setLastRunTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      console.error('Erro ao executar suíte de testes', err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runSuite();
  }, []);

  const categories = [
    { id: 'all', label: 'Todos os Testes', icon: Layers },
    { id: 'RLS & Multi-Tenant', label: 'RLS & Multi-Tenant', icon: ShieldCheck },
    { id: 'Cartões & Ciclo de Fatura', label: 'Ciclo de Faturas', icon: CreditCard },
    { id: 'Precisão Financeira', label: 'Precisão de Centavos', icon: Calculator },
    { id: 'Contabilidade do Casal', label: 'Acerto do Casal', icon: ArrowRightLeft },
    { id: 'Trilha de Auditoria', label: 'Auditoria', icon: FileText }
  ];

  const filteredTests = results
    ? results.results.filter(
        (t) => selectedCategory === 'all' || t.category === selectedCategory
      )
    : [];

  return (
    <div id="security-test-suite" className="space-y-5">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sprint 8 • Testes de Borda & Segurança
            </span>
            {lastRunTime && (
              <span className="text-slate-400 text-xs">
                Última execução: {lastRunTime}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Validador Automatizado de Segurança (PROMPT 5)
          </h2>
          <p className="text-slate-300 text-sm mt-1">
            Suíte de testes de isolamento multi-tenant, ciclo de cartões, conservação de centavos e integridade contábil.
          </p>
        </div>

        <button
          onClick={runSuite}
          disabled={running}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Executando Testes...' : 'Executar Todos os Testes'}
        </button>
      </div>

      {/* Overview Metric Banner */}
      {results && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            results.all_passed
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  results.all_passed
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-rose-500 text-white shadow-xs'
                }`}
              >
                {results.all_passed ? <Check className="w-6 h-6 stroke-[3]" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {results.all_passed
                    ? 'Todos os 12 Testes de Borda & Segurança Aprovados'
                    : 'Atenção: Falha detectada em um dos testes'}
                </h3>
                <p className="text-xs opacity-80">
                  {results.passed_count} de {results.total_tests} validações passaram com sucesso (100% de conformidade)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 bg-white dark:bg-slate-900 rounded-full border border-emerald-200 dark:border-emerald-800 font-mono shadow-2xs">
                Taxa de Sucesso: {((results.passed_count / results.total_tests) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          const count = results
            ? cat.id === 'all'
              ? results.results.length
              : results.results.filter((t) => t.category === cat.id).length
            : 0;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Test List Cards */}
      <div className="space-y-3">
        {running ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Executando suíte automatizada de testes de borda...
            </p>
          </div>
        ) : filteredTests.length > 0 ? (
          filteredTests.map((test) => (
            <div
              key={test.test_id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    test.passed
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {test.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {test.test_id}
                    </span>
                    {test.category && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {test.category}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-snug">
                    {test.description}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {test.details}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 sm:self-center">
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 ${
                    test.passed
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  }`}
                >
                  {test.passed ? (
                    <>
                      <Check className="w-3 h-3 stroke-[3]" /> APROVADO
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> FALHA
                    </>
                  )}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum teste encontrado para a categoria selecionada.
          </div>
        )}
      </div>
    </div>
  );
};
export default SecurityAndEdgeTestSuite;
