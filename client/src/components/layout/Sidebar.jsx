import { NavLink } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Rocket,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">BizAutomate</p>
          <p className="text-[11px] text-slate-500">Local Business SaaS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-indigo-600" />
            <p className="text-sm font-semibold text-slate-900">
              Upgrade your plan
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Unlock more features and grow your business faster.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition-colors hover:bg-indigo-50"
          >
            Upgrade now
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-3">
        <p className="text-xs font-medium text-slate-700">BizAutomate v1.0.0</p>
        <p className="text-[10px] text-slate-400">
          &copy; {new Date().getFullYear()} All rights reserved
        </p>
      </div>
    </aside>
  );
}
