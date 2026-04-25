import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi, extractApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const TABS = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'invoice', label: 'Invoice', icon: CreditCard },
  { id: 'security', label: 'Security', icon: KeyRound },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'];

function Field({ label, hint, error, children, required, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </label>
  );
}

function TextInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  );
}

function TextAreaInput({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${className}`}
    />
  );
}

function ToggleRow({ label, description, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        aria-pressed={value}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          value ? 'bg-indigo-600' : 'bg-slate-300'
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function PrimaryButton({ children, loading, disabled, ...props }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      {...props}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-500/30 transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {children}
    </button>
  );
}

function SectionCard({ title, description, children, footer }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, refresh: refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('business');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.get();
      setProfile(res?.data?.profile ?? null);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not load settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Customize your business profile, invoice defaults, and account security.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-900/[0.02] lg:flex-col">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6">
          {activeTab === 'business' && (
            <BusinessTab
              profile={profile}
              onProfileUpdated={(p) => {
                setProfile(p);
                refreshUser?.();
              }}
            />
          )}
          {activeTab === 'invoice' && (
            <InvoiceTab
              profile={profile}
              onProfileUpdated={(p) => setProfile(p)}
            />
          )}
          {activeTab === 'security' && <SecurityTab user={user} />}
        </div>
      </div>
    </div>
  );
}

function BusinessTab({ profile, onProfileUpdated }) {
  const [form, setForm] = useState(() => buildBusinessForm(profile));
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm(buildBusinessForm(profile));
  }, [profile]);

  const setField = (name, value) =>
    setForm((s) => ({ ...s, [name]: value }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsApi.updateProfile({
        businessName: form.businessName || '',
        address: form.address || '',
        phone: form.phone || '',
        email: form.email || '',
        gstNumber: form.gstNumber || '',
        currency: form.currency || 'INR',
        whatsappReminderEnabled: form.whatsappReminderEnabled,
        emailNotifications: form.emailNotifications,
      });
      onProfileUpdated(res?.data?.profile ?? null);
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save profile'));
    } finally {
      setSaving(false);
    }
  };

  const onLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large (max 2 MB)');
      e.target.value = '';
      return;
    }
    setLogoBusy(true);
    try {
      const res = await settingsApi.uploadLogo(file);
      onProfileUpdated(res?.data?.profile ?? null);
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(extractApiError(err, 'Logo upload failed'));
    } finally {
      setLogoBusy(false);
      e.target.value = '';
    }
  };

  const onRemoveLogo = async () => {
    setLogoBusy(true);
    try {
      const res = await settingsApi.removeLogo();
      onProfileUpdated(res?.data?.profile ?? null);
      toast.success('Logo removed');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not remove logo'));
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-6">
      <SectionCard
        title="Brand"
        description="Logo shown on invoices and PDFs."
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {profile?.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt="Business logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoBusy}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {logoBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {profile?.logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {profile?.logoUrl && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  disabled={logoBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              PNG, JPG, WEBP or SVG up to 2 MB. Square images look best.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={onLogoSelect}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Business information"
        description="Used on invoices, PDFs and WhatsApp messages."
        footer={
          <PrimaryButton loading={saving}>Save changes</PrimaryButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required className="sm:col-span-2">
            <TextInput
              value={form.businessName}
              onChange={(e) => setField('businessName', e.target.value)}
              placeholder="Acme Studio LLP"
              maxLength={120}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="hello@acme.com"
              maxLength={160}
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={30}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <TextAreaInput
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Street, City, State, ZIP"
              maxLength={500}
            />
          </Field>
          <Field label="GST / Tax ID">
            <TextInput
              value={form.gstNumber}
              onChange={(e) => setField('gstNumber', e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={40}
            />
          </Field>
          <Field label="Currency">
            <select
              value={form.currency}
              onChange={(e) => setField('currency', e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Control how this business communicates with customers."
      >
        <div className="space-y-3">
          <ToggleRow
            label="Send WhatsApp reminders"
            description="Allow sending invoice and reminder messages via WhatsApp."
            value={!!form.whatsappReminderEnabled}
            onChange={(v) => setField('whatsappReminderEnabled', v)}
          />
          <ToggleRow
            label="Email notifications"
            description="Receive activity summaries and payment alerts by email."
            value={!!form.emailNotifications}
            onChange={(v) => setField('emailNotifications', v)}
          />
        </div>
      </SectionCard>
    </form>
  );
}

function buildBusinessForm(profile) {
  return {
    businessName: profile?.businessName || '',
    address: profile?.address || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    gstNumber: profile?.gstNumber || '',
    currency: profile?.currency || 'INR',
    whatsappReminderEnabled: profile?.whatsappReminderEnabled ?? true,
    emailNotifications: profile?.emailNotifications ?? true,
  };
}

function InvoiceTab({ profile, onProfileUpdated }) {
  const [form, setForm] = useState(() => buildInvoiceForm(profile));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildInvoiceForm(profile));
  }, [profile]);

  const setField = (name, value) =>
    setForm((s) => ({ ...s, [name]: value }));

  const previewNumber = (() => {
    const year = new Date().getFullYear();
    const prefix = form.invoicePrefix?.trim() || 'INV';
    return `${prefix}-${year}-0001`;
  })();

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsApi.updateInvoice({
        invoicePrefix: form.invoicePrefix?.trim() || 'INV',
        defaultTaxRate: Number(form.defaultTaxRate) || 0,
        defaultDueDays: Number(form.defaultDueDays) || 0,
        invoiceFooterNote: form.invoiceFooterNote || '',
        currency: form.currency || 'INR',
      });
      onProfileUpdated(res?.data?.profile ?? null);
      toast.success('Invoice settings saved');
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save invoice settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-6">
      <SectionCard
        title="Numbering"
        description="Prefix used when generating new invoice numbers."
        footer={
          <PrimaryButton loading={saving}>Save changes</PrimaryButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice prefix"
            hint="Letters, numbers, dashes or underscores. Example: ACME"
            required
          >
            <TextInput
              value={form.invoicePrefix}
              onChange={(e) =>
                setField(
                  'invoicePrefix',
                  e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20)
                )
              }
              placeholder="INV"
              maxLength={20}
            />
          </Field>
          <Field label="Next invoice will look like">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 text-sm font-mono text-indigo-700">
              <CheckCircle2 className="h-4 w-4" />
              {previewNumber}
            </div>
          </Field>
          <Field label="Currency">
            <select
              value={form.currency}
              onChange={(e) => setField('currency', e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Default due in (days)"
            hint="Auto-fill due date when creating an invoice. 0 = no due date."
          >
            <TextInput
              type="number"
              min="0"
              max="365"
              value={form.defaultDueDays}
              onChange={(e) => setField('defaultDueDays', e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Tax & footer"
        description="Defaults applied to new invoice line items."
        footer={
          <PrimaryButton loading={saving}>Save changes</PrimaryButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Default tax rate (%)"
            hint="Used when an item has no tax specified."
          >
            <TextInput
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.defaultTaxRate}
              onChange={(e) => setField('defaultTaxRate', e.target.value)}
            />
          </Field>
          <Field label="Invoice footer note" className="sm:col-span-2">
            <TextAreaInput
              value={form.invoiceFooterNote}
              onChange={(e) =>
                setField('invoiceFooterNote', e.target.value)
              }
              placeholder="Thank you for your business! Payments via UPI to bizname@upi"
              maxLength={500}
            />
          </Field>
        </div>
      </SectionCard>
    </form>
  );
}

function buildInvoiceForm(profile) {
  return {
    invoicePrefix: profile?.invoicePrefix || 'INV',
    defaultTaxRate: profile?.defaultTaxRate ?? 0,
    defaultDueDays: profile?.defaultDueDays ?? 0,
    invoiceFooterNote: profile?.invoiceFooterNote || '',
    currency: profile?.currency || 'INR',
  };
}

function SecurityTab({ user }) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const setField = (name, value) =>
    setForm((s) => ({ ...s, [name]: value }));

  const passwordsMatch =
    form.newPassword.length === 0 ||
    form.newPassword === form.confirmPassword;
  const tooShort = form.newPassword.length > 0 && form.newPassword.length < 8;
  const sameAsCurrent =
    form.newPassword.length > 0 && form.newPassword === form.currentPassword;

  const canSubmit =
    form.currentPassword &&
    form.newPassword &&
    form.confirmPassword &&
    passwordsMatch &&
    !tooShort &&
    !sameAsCurrent;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await settingsApi.changePassword(form);
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(extractApiError(err, 'Could not change password'));
    } finally {
      setSaving(false);
    }
  };

  const PasswordField = ({ label, name, showKey }) => (
    <Field label={label} required>
      <div className="relative">
        <TextInput
          type={show[showKey] ? 'text' : 'password'}
          value={form[name]}
          onChange={(e) => setField(name, e.target.value)}
          autoComplete={
            name === 'currentPassword' ? 'current-password' : 'new-password'
          }
        />
        <button
          type="button"
          onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={show[showKey] ? 'Hide password' : 'Show password'}
        >
          {show[showKey] ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <SectionCard
        title="Account"
        description="Read-only summary of the signed-in user."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={user?.name || ''} disabled />
          </Field>
          <Field label="Email">
            <TextInput value={user?.email || ''} disabled />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Change password"
        description="Use at least 8 characters. We never store passwords in plain text."
        footer={
          <PrimaryButton loading={saving} disabled={!canSubmit}>
            Update password
          </PrimaryButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label="Current password"
            name="currentPassword"
            showKey="current"
          />
          <span className="hidden sm:block" />
          <PasswordField
            label="New password"
            name="newPassword"
            showKey="next"
          />
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            showKey="confirm"
          />
          <div className="sm:col-span-2 space-y-1 text-xs">
            {tooShort && (
              <p className="inline-flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                Must be at least 8 characters
              </p>
            )}
            {!passwordsMatch && (
              <p className="inline-flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                Passwords do not match
              </p>
            )}
            {sameAsCurrent && (
              <p className="inline-flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                New password must be different from current
              </p>
            )}
          </div>
        </div>
      </SectionCard>
    </form>
  );
}
