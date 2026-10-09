import { useState, useCallback } from 'react';
import { Activity, HeartPulse, ShieldCheck, Clock } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import type { TranscriptionResult } from '@/types/consultation';
import { RecordButton, ProcessingStep, ErrorBanner } from '@/components/RecordControls';
import { ResultsPanel } from '@/components/ResultsPanel';
import { ConsentModal } from '@/components/ConsentModal';
import { Toast } from '@/components/Toast';
import type { AbhaRecord } from '@/types/abha';

const STEPS = [
  'Transcribing audio with Groq Whisper',
  'Detecting spoken language',
  'Generating clinical note (LLM)',
  'Extracting care actions',
];

export default function VoiceConsultationPage() {
  const { status, error, recordingTime, startRecording, stopRecording, setStatus, setError, reset: resetRecorder } = useVoiceRecorder();
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('patient@example.com');
  const [consultationId, setConsultationId] = useState<string | undefined>(undefined);
  const [consentOpen, setConsentOpen] = useState(false);
  const [patientConsentStorage, setPatientConsentStorage] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'warning' } | null>(null);
  const [abhaRecords, setAbhaRecords] = useState<AbhaRecord[]>([]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStop = useCallback(async () => {
    setStatus('processing');
    setError(null);
    setActiveStep(0);
    setCompletedSteps([]);

    try {
      const blob = await stopRecording();
      if (!blob) {
        setError('No audio was captured. Please try again.');
        setStatus('idle');
        return;
      }

      const formData = new FormData();
      const ext = blob.type.includes('webm') ? 'webm' : 'wav';
      formData.append('audio', blob, `recording.${ext}`);
      formData.append('patient_consent_storage', String(patientConsentStorage === true));

      // Simulate step progression for visual feedback
      const stepTimers: ReturnType<typeof setTimeout>[] = [];
      stepTimers.push(setTimeout(() => { setActiveStep(1); setCompletedSteps([0]); }, 2000));
      stepTimers.push(setTimeout(() => { setActiveStep(2); setCompletedSteps([0, 1]); }, 5000));
      stepTimers.push(setTimeout(() => { setActiveStep(3); setCompletedSteps([0, 1, 2]); }, 9000));

      console.log('[VoiceConsultation] Submitting audio to /api/consultation/transcribe...');

      const response = await fetch('/api/consultation/transcribe', {
        method: 'POST',
        body: formData,
      });

      stepTimers.forEach(clearTimeout);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.detail || errData.error || `Server error (${response.status})`);
      }

      const data: TranscriptionResult = await response.json();
      console.log('[VoiceConsultation] Response received:', { language: data.language, actions: data.actions.length });

      setCompletedSteps([0, 1, 2, 3]);
      setActiveStep(-1);
      setPatientName(extractPatientName(data.transcription) || '');
      setResult(data);
      setStatus('idle');
    } catch (err) {
      console.error('[VoiceConsultation] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setStatus('idle');
      setActiveStep(-1);
    }
  }, [patientConsentStorage, stopRecording, setStatus, setError]);

  const handleStart = useCallback(() => {
    setConsentOpen(true);
  }, []);

  const handleConsent = useCallback(async (consent: boolean) => {
    setConsentOpen(false);
    setPatientConsentStorage(consent);
    setToast({
      variant: consent ? 'success' : 'warning',
      message: consent
        ? 'Patient consent confirmed. Audio recording will be archived securely.'
        : 'Notice: Patient consent denied for storage. Audio will be processed in-memory for STT/Extraction and immediately deleted.',
    });
    try {
      const response = await fetch('/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_consent_storage: consent }),
      });
      if (!response.ok) throw new Error(`Unable to create recording session (${response.status})`);
      const session = await response.json() as { id?: string };
      setConsultationId(session.id);
      await startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start recording session');
    }
  }, [setError, startRecording]);

  const handleSendEmail = useCallback(async () => {
    if (!result) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/summaries/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_email: patientEmail.trim() || 'patient@example.com',
          patient_name: patientName.trim() || 'Patient',
          transcription: result.transcription,
          clinical_note: result.clinical_note,
          actions: result.actions,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Email dispatch failed' }));
        throw new Error(errData.detail || errData.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      console.log('[VoiceConsultation] Patient summary email sent:', data.email_id);
      setEmailSent(true);
    } catch (err) {
      console.error('[VoiceConsultation] Email dispatch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send patient summary email');
    } finally {
      setIsSaving(false);
    }
  }, [result, patientEmail, patientName, setError]);

  const handleReset = useCallback(() => {
    setResult(null);
    setEmailSent(false);
    setPatientName('');
    setPatientEmail('patient@example.com');
    setConsultationId(undefined);
    setPatientConsentStorage(null);
    setAbhaRecords([]);
    setError(null);
    setActiveStep(-1);
    setCompletedSteps([]);
    resetRecorder();
  }, [resetRecorder, setError]);

  const isProcessing = status === 'processing';
  const showSteps = isProcessing || completedSteps.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 shadow-md shadow-primary-600/20">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-secondary-900 tracking-tight">Care Loop</span>
              <span className="ml-2 hidden sm:inline text-xs font-medium text-secondary-400">
                Multilingual Voice Consultation
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-secondary-500">
            <span className="hidden sm:flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-accent-500" />
              HIPAA-aware
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-primary-500" />
              AI-powered
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" />
            Voice Consultation
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 tracking-tight">
            Record. Analyze. Act.
          </h1>
          <p className="mt-3 text-secondary-600 text-base max-w-xl mx-auto">
            Capture a doctor-patient conversation in any language. Our AI transcribes it,
            generates a SOAP clinical note, and extracts care actions with smart dependencies.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {!result && (
          <>
            {/* Recorder Card */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-8 sm:p-12">
              <RecordButton
                status={status}
                onStart={handleStart}
                onStop={handleStop}
              />

              {status === 'recording' && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-mono text-secondary-600">
                  <Clock className="h-4 w-4 text-error-500" />
                  {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* Processing Steps */}
            {showSteps && (
              <div className="mt-6 rounded-2xl border border-primary-200 bg-white p-6 animate-fade-in">
                <h3 className="text-sm font-semibold text-secondary-900 mb-1">
                  Processing Pipeline
                </h3>
                <p className="text-xs text-secondary-400 mb-3">
                  Your audio is being analyzed step by step
                </p>
                <div className="divide-y divide-secondary-100">
                  {STEPS.map((step, i) => (
                    <ProcessingStep
                      key={i}
                      step={step}
                      isDone={completedSteps.includes(i)}
                      isActive={activeStep === i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Feature highlights (only when idle and no result) */}
            {status === 'idle' && !showSteps && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: 'Globe', title: 'Multilingual', desc: 'Auto-detects 50+ languages via Whisper' },
                  { icon: 'FileText', title: 'SOAP Notes', desc: 'Structured clinical notes in seconds' },
                  { icon: 'ListChecks', title: 'Smart Actions', desc: 'Extracted with dependency tracking' },
                ].map((f) => {
                  const Icon = { Globe: Activity, FileText: Activity, ListChecks: Activity }[f.icon] || Activity;
                  return (
                    <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md">
                      <Icon className="h-5 w-5 text-primary-500 mb-2" />
                      <h4 className="text-sm font-semibold text-secondary-900">{f.title}</h4>
                      <p className="text-xs text-secondary-500 mt-1">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Results */}
        {result && (
          <ResultsPanel
            result={result}
            isSaving={isSaving}
            emailSent={emailSent}
            onSendEmail={handleSendEmail}
            patientName={patientName}
            patientEmail={patientEmail}
            onPatientNameChange={setPatientName}
            onPatientEmailChange={setPatientEmail}
            onReset={handleReset}
            consultationId={consultationId}
            abhaRecords={abhaRecords}
            onAbhaRecordsChange={setAbhaRecords}
          />
        )}
      </main>

      <ConsentModal open={consentOpen} onSelect={handleConsent} onClose={() => setConsentOpen(false)} />
      {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}

      <footer className="border-t border-slate-200 py-6">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <p className="text-xs text-secondary-400">
            Care Loop — AI-assisted clinical documentation. Always review AI-generated notes before use.
          </p>
        </div>
      </footer>
    </div>
  );
}

function extractPatientName(transcription: string): string | null {
  const patterns = [
    /(?:my name is|i am|i'm|this is)\s+([a-z]+(?:\s+[a-z]+){1,2})/i,
    /(?:patient(?:'s)? name is|patient is|patient:)\s+([a-z]+(?:\s+[a-z]+){1,2})/i,
    /(?:mr\.?|mrs\.?|ms\.?|miss)\s+([a-z]+(?:\s+[a-z]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = transcription.match(pattern);
    if (match?.[1]) {
      return match[1]
        .trim()
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}
