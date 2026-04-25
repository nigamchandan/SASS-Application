import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { whatsappApi, extractApiError } from '@/lib/api';

const KIND_TABS = [
  { id: 'INVOICE', label: 'Send invoice' },
  { id: 'REMINDER', label: 'Send reminder' },
];

export default function SendWhatsAppDialog({
  open,
  onOpenChange,
  invoiceId,
  defaultPhone,
  initialKind = 'INVOICE',
  onSent,
}) {
  const [kind, setKind] = useState(initialKind);
  const [phone, setPhone] = useState(defaultPhone || '');
  const [templates, setTemplates] = useState({ INVOICE: '', REMINDER: '' });
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState('mock');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!open) {
      setEdited(false);
      return;
    }
    setKind(initialKind);
    setPhone(defaultPhone || '');
    setEdited(false);

    let active = true;
    setPreviewLoading(true);
    whatsappApi
      .preview(invoiceId)
      .then((res) => {
        if (!active) return;
        const t = res?.data?.templates || {};
        setTemplates({
          INVOICE: t.INVOICE || '',
          REMINDER: t.REMINDER || '',
        });
        setProvider(res?.data?.provider || 'mock');
        setMessage(t[initialKind] || '');
      })
      .catch((err) => {
        toast.error(extractApiError(err, 'Could not load template'));
      })
      .finally(() => active && setPreviewLoading(false));

    return () => {
      active = false;
    };
  }, [open, invoiceId, defaultPhone, initialKind]);

  const switchKind = (next) => {
    setKind(next);
    if (!edited) {
      setMessage(templates[next] || '');
    }
  };

  const handleEdit = (e) => {
    setMessage(e.target.value);
    setEdited(true);
  };

  const phoneOk = useMemo(() => {
    const cleaned = (phone || '').replace(/\D/g, '');
    return cleaned.length >= 8;
  }, [phone]);

  const handleSend = async () => {
    if (!phoneOk) {
      toast.error('Enter a valid phone number');
      return;
    }
    if (!message || !message.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    setSending(true);
    try {
      const fn =
        kind === 'REMINDER' ? whatsappApi.sendReminder : whatsappApi.sendInvoice;
      const res = await fn(invoiceId, {
        phone: phone || '',
        message: edited ? message : '',
      });
      toast.success(
        res?.message ||
          (kind === 'REMINDER'
            ? 'Reminder sent via WhatsApp'
            : 'Invoice sent via WhatsApp')
      );
      onOpenChange(false);
      onSent?.(res?.data?.message);
    } catch (err) {
      toast.error(extractApiError(err, 'Could not send message'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Send via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Provider:{' '}
            <span className="font-mono text-xs uppercase">{provider}</span>
            {provider === 'mock' && (
              <span className="ml-1 text-muted-foreground">
                (logged to server console - no real message will be sent)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="inline-flex rounded-md border bg-muted p-1 text-sm">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchKind(tab.id)}
                className={`rounded px-3 py-1 transition-colors ${
                  kind === tab.id
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="phone">To (phone)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
            {!phoneOk && phone && (
              <p className="text-xs text-destructive">
                Enter a valid phone number (with country code).
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              {edited && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(templates[kind] || '');
                    setEdited(false);
                  }}
                  className="text-xs text-primary underline"
                >
                  Reset to template
                </button>
              )}
            </div>
            <Textarea
              id="message"
              rows={9}
              value={previewLoading ? 'Loading template...' : message}
              onChange={handleEdit}
              disabled={previewLoading}
            />
            <p className="text-xs text-muted-foreground">
              {message.length} / 4096 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || previewLoading || !phoneOk}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
