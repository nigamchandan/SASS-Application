import {
  BarChart3,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Receipt,
    title: 'Invoice & billing automation',
    desc: 'Generate, send, and track GST-ready invoices in seconds.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp reminders',
    desc: 'Friendly nudges that get your bills paid faster.',
  },
  {
    icon: BarChart3,
    title: 'Real-time analytics',
    desc: 'Revenue, outstanding, and top customers at a glance.',
  },
];

function BrandingPanel() {
  return (
    <aside className="relative col-span-2 hidden overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-700 lg:flex">
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative z-10 flex w-full flex-col justify-between px-12 py-14 text-white">
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              BizAutomate
            </span>
          </div>
        </div>

        <div
          className="max-w-md animate-fade-in-up"
          style={{ animationDelay: '120ms' }}
        >
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Simplify your business operations with smart automation
          </h2>
          <p className="mt-4 text-base text-indigo-100/80">
            One workspace for invoicing, payments, reminders, and analytics -
            built for local businesses that move fast.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature, idx) => (
              <li
                key={feature.title}
                className="flex items-start gap-4 animate-fade-in-up"
                style={{ animationDelay: `${200 + idx * 100}ms` }}
              >
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{feature.title}</p>
                  <p className="text-sm text-indigo-100/70">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex items-center gap-2 text-xs text-indigo-100/70 animate-fade-in"
          style={{ animationDelay: '600ms' }}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Encrypted, tenant-isolated, JWT-secured by default.</span>
        </div>
      </div>
    </aside>
  );
}

export default function AuthSplitLayout({
  title,
  description,
  children,
  footer,
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-50 font-sans text-slate-900 antialiased lg:grid-cols-5">
      <BrandingPanel />

      <section className="col-span-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:col-span-3 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              BizAutomate
            </span>
          </div>

          <div
            className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5 animate-fade-in-up"
          >
            <header className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-slate-500">{description}</p>
              ) : null}
            </header>
            {children}
          </div>

          {footer ? (
            <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
