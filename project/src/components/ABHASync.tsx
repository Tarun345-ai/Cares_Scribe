import { useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { syncAbhaRecords } from '@/services/abha_client';
import type { AbhaRecord } from '@/types/abha';

interface ABHASyncProps {
  records: AbhaRecord[];
  onRecords: (records: AbhaRecord[]) => void;
}

export function ABHASync({ records, onRecords }: ABHASyncProps) {
  const [abhaId, setAbhaId] = useState('');
  const [otp, setOtp] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSync = async () => {
    if (!abhaId.trim()) {
      setMessage('Enter an ABHA Health ID to continue.');
      return;
    }
    setIsSyncing(true);
    setMessage('');
    try {
      const result = await syncAbhaRecords(abhaId.trim(), otp.trim() || undefined);
      onRecords(result.records);
      setMessage(result.mocked ? 'Sandbox unavailable — demo ABHA records loaded safely.' : `${result.records.length} ABHA records synced.`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary-600" />
        <h3 className="text-base font-semibold text-secondary-900">Patient Information & ABHA Records</h3>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <input value={abhaId} onChange={(event) => setAbhaId(event.target.value)} placeholder="12-3456-7890-1234 or username@abdm" aria-label="ABHA Health ID" className="rounded-xl border border-secondary-300 bg-white px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" placeholder="OTP (optional)" aria-label="ABHA OTP" className="rounded-xl border border-secondary-300 bg-white px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        <button onClick={handleSync} disabled={isSyncing} className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Verify & Sync
        </button>
      </div>
      {message && <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}
      {records.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {records.map((record) => <div key={record.id} className="rounded-xl border border-secondary-200 bg-white px-3 py-2"><p className="text-sm font-semibold text-secondary-800">{record.title}</p><p className="text-xs text-secondary-500">{record.date} · {record.details}</p></div>)}
        </div>
      )}
    </section>
  );
}

