import { ShieldCheck, X } from 'lucide-react';

interface ConsentModalProps {
  open: boolean;
  onSelect: (consent: boolean) => void;
  onClose: () => void;
}

export function ConsentModal({ open, onSelect, onClose }: ConsentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/40 px-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-100">
              <ShieldCheck className="h-5 w-5 text-accent-600" />
            </div>
            <div>
              <h2 id="consent-title" className="text-lg font-semibold text-secondary-900">Patient recording consent</h2>
              <p className="mt-2 text-sm leading-relaxed text-secondary-600">
                Does the patient consent to storing the audio recording in the database?
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close consent dialog" className="text-secondary-400 hover:text-secondary-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => onSelect(true)} className="rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-700">
            Yes, Consent Given
          </button>
          <button onClick={() => onSelect(false)} className="rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm font-semibold text-warning-800 transition hover:bg-warning-100">
            No, Temporary Only
          </button>
        </div>
        <p className="mt-4 text-xs text-secondary-500">
          Temporary recordings are removed after speech-to-text processing completes.
        </p>
      </div>
    </div>
  );
}

