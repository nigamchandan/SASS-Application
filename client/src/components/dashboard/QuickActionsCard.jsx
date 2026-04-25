import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  CreditCard,
  MessageCircle,
  Plus,
  UserPlus,
  Zap,
} from 'lucide-react';

const ACTIONS = [
  {
    label: 'New Invoice',
    to: '/invoices/new',
    icon: Plus,
    tone: 'from-indigo-500 to-violet-500',
    shortcut: 'I',
  },
  {
    label: 'Add Customer',
    to: '/customers',
    icon: UserPlus,
    tone: 'from-sky-500 to-blue-500',
    shortcut: 'C',
  },
  {
    label: 'Record Payment',
    to: '/invoices?status=UNPAID',
    icon: CreditCard,
    tone: 'from-emerald-500 to-teal-500',
    shortcut: 'P',
  },
  {
    label: 'WhatsApp',
    to: '/whatsapp',
    icon: MessageCircle,
    tone: 'from-emerald-500 to-green-500',
    shortcut: 'W',
  },
  {
    label: 'View Reports',
    to: '/reports',
    icon: BarChart3,
    tone: 'from-fuchsia-500 to-purple-500',
    shortcut: 'R',
    full: true,
  },
];

function isTextInput(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export default function QuickActionsCard() {
  const navigate = useNavigate();

  const map = useMemo(() => {
    const m = new Map();
    for (const a of ACTIONS) {
      if (a.shortcut) m.set(a.shortcut.toLowerCase(), a.to);
    }
    return m;
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextInput(e.target)) return;
      const dest = map.get((e.key || '').toLowerCase());
      if (dest) {
        e.preventDefault();
        navigate(dest);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, navigate]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Quick Actions
            </h3>
            <p className="text-[11px] text-slate-500">
              Hit a shortcut key to jump in
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className={`group relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md ${
                a.full ? 'col-span-2' : ''
              }`}
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${a.tone} opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-25`}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${a.tone} text-white shadow-sm shadow-slate-900/10 transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    {a.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {a.shortcut && (
                    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-500 shadow-sm">
                      {a.shortcut}
                    </kbd>
                  )}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
