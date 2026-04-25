import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  paid: '#10b981',
  pending: '#f59e0b',
  overdue: '#ef4444',
  draft: '#94a3b8',
};

const LABELS = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  draft: 'Draft',
};

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const name = item?.payload?.name;
  const value = item?.value ?? 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-md">
      <div className="font-medium text-slate-900">{name}</div>
      <div className="text-slate-500">
        {value} {value === 1 ? 'invoice' : 'invoices'}
      </div>
    </div>
  );
}

export default function InvoiceStatusDonut({ breakdown }) {
  const safe = breakdown || {};
  const order = ['paid', 'pending', 'overdue', 'draft'];
  const data = order
    .filter((key) => key in safe)
    .map((key) => ({
      key,
      name: LABELS[key],
      value: Number(safe[key]) || 0,
      color: COLORS[key],
    }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">
        No invoices yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-[180px] w-[180px] flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={84}
              startAngle={90}
              endAngle={-270}
              stroke="#fff"
              strokeWidth={3}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {total}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Total
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2.5">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span>{d.name}</span>
              </div>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="font-semibold text-slate-900">{d.value}</span>
                <span className="text-xs text-slate-400">({pct}%)</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
