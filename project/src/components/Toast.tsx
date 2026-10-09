import { CheckCircle2, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  variant: 'success' | 'warning';
  onDismiss: () => void;
}

export function Toast({ message, variant, onDismiss }: ToastProps) {
  const isSuccess = variant === 'success';
  return (
    <div className={`fixed right-4 top-20 z-40 flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
      isSuccess ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-warning-200 bg-warning-50 text-warning-800'
    }`} role="status">
      {isSuccess ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" /> : <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
    </div>
  );
}

