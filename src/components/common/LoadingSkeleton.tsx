import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'list' | 'table' | 'summary';
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'list', count = 3 }) => {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="w-16 h-5 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="w-3/4 h-4 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="w-1/2 h-6 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'summary') {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="w-1/3 h-5 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="w-24 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="w-2/3 h-8 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 w-3/4">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-1.5 w-full">
              <div className="w-2/3 h-3.5 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="w-1/3 h-2.5 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="w-20 h-5 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
        </div>
      ))}
    </div>
  );
};
export default LoadingSkeleton;
