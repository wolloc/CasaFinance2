import React, { type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react';

type Tone = 'neutral' | 'action' | 'income' | 'expense' | 'forecast' | 'success' | 'warning' | 'error' | 'memberOne' | 'memberTwo';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-slate-700 bg-slate-800 text-slate-200', action: 'border-blue-700 bg-blue-950 text-blue-200',
  income: 'border-emerald-700 bg-emerald-950 text-emerald-200', expense: 'border-rose-700 bg-rose-950 text-rose-200',
  forecast: 'border-sky-700 bg-sky-950 text-sky-200', success: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  warning: 'border-amber-700 bg-amber-950 text-amber-100', error: 'border-rose-700 bg-rose-950 text-rose-100',
  memberOne: 'border-violet-700 bg-violet-950 text-violet-200', memberTwo: 'border-cyan-700 bg-cyan-950 text-cyan-100'
};

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-3xl border border-slate-800 bg-slate-900 shadow-xl ${className}`} {...props} />;
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-semibold ${toneClasses[tone]}`}>{children}</span>;
}

export function Field({ label, hint, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-200">{label}<input id={id} aria-describedby={hintId} className={`mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-white placeholder:text-slate-500 ${className}`} {...props} />{hint && <span id={hintId} className="mt-1.5 block text-xs font-normal text-slate-400">{hint}</span>}</label>;
}

const alertIcons: Record<'info' | 'success' | 'warning' | 'error', LucideIcon> = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };
export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'error'; title: string; children?: ReactNode }) {
  const Icon = alertIcons[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border p-3.5 ${toneClasses[tone]}`}><Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true"/><div><strong className="text-sm">{title}</strong>{children && <div className="mt-1 text-xs leading-relaxed opacity-90">{children}</div>}</div></div>;
}

export function LoadingFeedback({ label = 'Carregando' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex min-h-11 items-center gap-2 text-sm text-slate-300"><LoaderCircle className="size-5 animate-spin text-blue-400" aria-hidden="true"/><span>{label}</span></div>;
}
