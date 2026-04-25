import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

/**
 * Compact export dropdown with two options: CSV and PDF.
 *
 * Props:
 *   - onExport(format)  → async (format: 'csv' | 'pdf') => void
 *   - disabled          → disable the trigger
 *   - className         → optional extra classes for the trigger
 *   - label             → trigger label (defaults to "Export")
 */
export default function ExportMenu({
  onExport,
  disabled = false,
  className = '',
  label = 'Export',
}) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handleSelect = async (format) => {
    if (busyFormat) return;
    setBusyFormat(format);
    setOpen(false);
    try {
      await onExport(format);
    } finally {
      setBusyFormat(null);
    }
  };

  const busy = !!busyFormat;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 ${className}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {busy ? `Exporting ${busyFormat?.toUpperCase()}...` : label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('csv')}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <div className="flex-1">
              <div className="font-medium">Export as CSV</div>
              <div className="text-[11px] text-slate-500">For Excel / Sheets</div>
            </div>
          </button>
          <div className="h-px bg-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('pdf')}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-rose-600" />
            <div className="flex-1">
              <div className="font-medium">Export as PDF</div>
              <div className="text-[11px] text-slate-500">Print-ready report</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
