import { Globe, FileText, ListChecks, CheckCircle2, Send } from 'lucide-react';
import type { TranscriptionResult, CareAction } from '@/types/consultation';
import { ActionCard } from './ActionCard';
import { DependencyGraph } from './DependencyGraph';
import { PrescriptionPanel } from './PrescriptionPanel';
import { Spinner } from './RecordControls';
import { ABHASync } from './ABHASync';
import type { AbhaRecord } from '@/types/abha';

interface ResultsPanelProps {
  result: TranscriptionResult | null;
  isSaving: boolean;
  emailSent: boolean;
  onSendEmail: () => void;
  onReset: () => void;
  consultationId?: string;
  patientName: string;
  patientEmail: string;
  onPatientNameChange: (name: string) => void;
  onPatientEmailChange: (email: string) => void;
  abhaRecords: AbhaRecord[];
  onAbhaRecordsChange: (records: AbhaRecord[]) => void;
}

export function ResultsPanel({
  result,
  isSaving,
  emailSent,
  onSendEmail,
  onReset,
  consultationId,
  patientName,
  patientEmail,
  onPatientNameChange,
  onPatientEmailChange,
  abhaRecords,
  onAbhaRecordsChange,
}: ResultsPanelProps) {
  if (!result) return null;

  const languageNames: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    hi: 'Hindi',
    zh: 'Chinese',
    ar: 'Arabic',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    ko: 'Korean',
    it: 'Italian',
    nl: 'Dutch',
    tr: 'Turkish',
    pl: 'Polish',
    id: 'Indonesian',
    vi: 'Vietnamese',
    th: 'Thai',
    sv: 'Swedish',
    no: 'Norwegian',
  };

  const languageDisplay = languageNames[result.language] || result.language || 'Unknown';

  const formatClinicalNote = (note: string) => {
    return note.split('\n').map((line) => line.trim()).filter(Boolean);
  };

  const noteLines = formatClinicalNote(result.clinical_note);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Section A: Detected Language */}
      <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
            <Globe className="h-4.5 w-4.5 text-primary-600" />
          </div>
          <h3 className="text-base font-semibold text-secondary-900">Detected Language</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-primary-700">{languageDisplay}</span>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
            Code: {result.language}
          </span>
        </div>
      </div>

      {/* Transcription preview (collapsible-like) */}
      <div className="rounded-2xl border border-secondary-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-100">
            <FileText className="h-4.5 w-4.5 text-secondary-600" />
          </div>
          <h3 className="text-base font-semibold text-secondary-900">Transcript</h3>
        </div>
        <p className="text-sm text-secondary-700 leading-relaxed whitespace-pre-wrap">
          {result.transcription}
        </p>
      </div>

      {/* Section B: Clinical Note */}
      <div className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-100">
            <FileText className="h-4.5 w-4.5 text-accent-600" />
          </div>
          <h3 className="text-base font-semibold text-secondary-900">Clinical Note</h3>
          <span className="ml-auto rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-medium text-accent-700">
            SOAP Format
          </span>
        </div>
        <div className="space-y-2">
          {noteLines.map((line, i) => {
            const isHeader = /^(Subjective|Objective|Assessment|Plan)[:\s]/i.test(line);
            return (
              <p
                key={i}
                className={`text-sm leading-relaxed ${
                  isHeader ? 'font-semibold text-accent-800 mt-3 first:mt-0' : 'text-secondary-700'
                }`}
              >
                {line}
              </p>
            );
          })}
        </div>
      </div>

      {/* AI Prescription Draft */}
      {result.clinical_note && (
        <PrescriptionPanel
          clinicalNote={result.clinical_note}
          transcription={result.transcription}
          patientId="00000000-0000-0000-0000-000000000001"
          consultationId={consultationId}
          patientName={patientName}
        />
      )}

      {/* Section C: Care Actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
            <ListChecks className="h-4.5 w-4.5 text-primary-600" />
          </div>
          <h3 className="text-base font-semibold text-secondary-900">
            Extracted Care Actions
          </h3>
          <span className="ml-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">
            {result.actions.length} {result.actions.length === 1 ? 'action' : 'actions'}
          </span>
        </div>

        {result.actions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {result.actions.map((action: CareAction, idx: number) => (
              <ActionCard key={idx} action={action} index={idx} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-secondary-300 bg-secondary-50 p-8 text-center">
            <p className="text-sm text-secondary-500">No care actions were extracted from this consultation.</p>
          </div>
        )}
      </div>

      {/* Dependency Graph */}
      {result.actions.length > 0 && (
        <DependencyGraph actions={result.actions} />
      )}

      {/* Actions Bar */}
      <ABHASync records={abhaRecords} onRecords={onAbhaRecordsChange} />
      <div className="flex items-center gap-3 pt-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <input
            value={patientName}
            onChange={(event) => onPatientNameChange(event.target.value)}
            placeholder="Patient name"
            aria-label="Patient name"
            className="rounded-xl border border-secondary-300 bg-white px-3 py-3 text-sm text-secondary-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <input
            type="email"
            value={patientEmail}
            onChange={(event) => onPatientEmailChange(event.target.value)}
            placeholder="patient@example.com"
            aria-label="Patient email"
            className="rounded-xl border border-secondary-300 bg-white px-3 py-3 text-sm text-secondary-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        {emailSent ? (
          <div className="flex items-center gap-2 rounded-xl bg-accent-50 border border-accent-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-accent-600" />
            <span className="text-sm font-medium text-accent-700">
              Patient summary & prescription sent via email successfully!
            </span>
          </div>
        ) : (
          <button
            onClick={onSendEmail}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Spinner className="text-white" />
                Sending Email...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email to Patient
              </>
            )}
          </button>
        )}

        <button
          onClick={onReset}
          disabled={isSaving}
          className="rounded-xl border border-secondary-300 bg-white px-5 py-3 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-50 hover:border-secondary-400 disabled:opacity-50"
        >
          New Recording
        </button>
      </div>
    </div>
  );
}
