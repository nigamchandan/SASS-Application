import { ArrowRight, MessageCircle, Smartphone } from 'lucide-react';

export default function PromoCard({ onSendReminders }) {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-lg shadow-indigo-500/20">
      <div
        aria-hidden="true"
        className="absolute -top-12 -left-10 h-44 w-44 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-fuchsia-400/20 blur-2xl"
      />

      <div className="relative flex h-full flex-col justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold leading-tight">
            Get paid faster!
          </h3>
          <p className="mt-2 text-sm text-indigo-100/85">
            Send payment reminders via WhatsApp and improve your cash flow.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <Smartphone className="h-4 w-4" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSendReminders}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md shadow-black/10 transition-all hover:bg-indigo-50 hover:shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          Send Reminders
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
