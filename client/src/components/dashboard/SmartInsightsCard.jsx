import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

const ICON_MAP = {
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  alert: AlertTriangle,
  check: CheckCircle2,
  sparkle: Sparkles,
};

const TONES = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  neutral: 'bg-slate-50 text-slate-700 border-slate-100',
};

export default function SmartInsightsCard({ insights, topCustomer, loading }) {
  const list = Array.isArray(insights) ? insights : [];
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Smart Insights
          </h3>
          <p className="text-[11px] text-slate-500">
            Highlights from your business
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading && list.length === 0 ? (
          <>
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </>
        ) : list.length === 0 ? (
          <p className="text-xs text-slate-500">
            Insights will appear once you have some activity.
          </p>
        ) : (
          list.map((it, idx) => {
            const Icon = ICON_MAP[it.icon] || Sparkles;
            const tone = TONES[it.kind] || TONES.neutral;
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone}`}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="font-medium leading-snug">{it.label}</span>
              </div>
            );
          })
        )}

        {topCustomer ? (
          <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 text-xs text-indigo-700 backdrop-blur">
            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-500" />
            <span className="font-medium leading-snug">
              Top customer:{' '}
              <span className="font-semibold text-slate-900">
                {topCustomer.name}
              </span>{' '}
              <span className="text-slate-500">
                · {formatCurrency(topCustomer.paid)}
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
