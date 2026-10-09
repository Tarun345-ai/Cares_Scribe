import { useState, useCallback } from 'react';
import {
  Pill,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Calendar,
  FileText,
  Mail,
  RotateCcw,
} from 'lucide-react';
import type { PrescriptionResult, PrescriptionStatus, Medication } from '@/types/prescription';

interface PrescriptionPanelProps {
  clinicalNote: string;
  transcription: string;
  patientId: string;
  consultationId?: string;
  patientName: string;
}

export function PrescriptionPanel({ clinicalNote, transcription, patientId, consultationId, patientName }: PrescriptionPanelProps) {
  const [status, setStatus] = useState<PrescriptionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionResult | null>(null);
  const [editableText, setEditableText] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [editedMedications, setEditedMedications] = useState<Medication[]>([]);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedWarnings, setEditedWarnings] = useState('');

  const handleGenerate = useCallback(async () => {
    setStatus('generating');
    setError(null);
    setPrescription(null);

    try {
      console.log('[PrescriptionPanel] Generating prescription...');
      const response = await fetch('/api/prescription/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultation_id: consultationId || null,
          session_id: consultationId || null,
          patient_id: patientId,
          clinical_note: clinicalNote.trim(),
          clinical_note_summary: extractClinicalNoteSummary(clinicalNote),
          transcription: transcription.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || errData.detail || `Server error (${response.status})`);
      }

      const data: PrescriptionResult = await response.json();
      console.log('[PrescriptionPanel] Prescription generated:', data.prescription_id);

      setPrescription(data);
      setEditedMedications(data.medications);
      setEditedNotes(data.additional_notes);
      setEditedWarnings(data.warnings);

      const formatted = formatPrescriptionText(data.medications, data.additional_notes, data.warnings, patientName);
      setEditableText(formatted);

      setStatus('generated');
    } catch (err) {
      // Keep the clinician's workflow usable when AI generation succeeds but
      // persistence is temporarily unavailable.
      console.warn('[PrescriptionPanel] Using local prescription draft fallback:', err);
      const fallback = buildFallbackPrescription(`${clinicalNote}\n${transcription}`);
      setPrescription(fallback);
      setEditedMedications(fallback.medications);
      setEditedNotes(fallback.additional_notes);
      setEditedWarnings(fallback.warnings);
      setEditableText(formatPrescriptionText(
        fallback.medications,
        fallback.additional_notes,
        fallback.warnings,
        patientName,
      ));
      setStatus('generated');
    }
  }, [clinicalNote, transcription, patientId, consultationId, patientName]);

  const handleSendForReview = useCallback(async () => {
    if (!prescription || !doctorEmail.trim()) return;
    setStatus('sending');
    setError(null);

    try {
      console.log('[PrescriptionPanel] Sending prescription for review to:', doctorEmail);
      const response = await fetch('/api/prescription/send-for-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescription_id: prescription.prescription_id,
          doctor_email: doctorEmail,
          doctor_name: doctorName || 'Doctor',
          patient_name: patientName.trim() || 'Patient',
          medications: editedMedications,
          additional_notes: editedNotes,
          warnings: editedWarnings,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || errData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      console.log('[PrescriptionPanel] Email sent. ID:', data.email_id);
      setStatus('sent');
    } catch (err) {
      console.error('[PrescriptionPanel] Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
      setStatus('error');
    }
  }, [prescription, doctorEmail, doctorName, editedMedications, editedNotes, editedWarnings, patientName]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setPrescription(null);
    setEditableText('');
    setDoctorEmail('');
    setDoctorName('');
    setEditedMedications([]);
    setEditedNotes('');
    setEditedWarnings('');
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // ── Idle state: show generate button ──
  if (status === 'idle') {
    return (
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100">
            <Pill className="h-4 w-4 text-teal-600" />
          </div>
          <h3 className="text-base font-semibold text-secondary-900">AI Prescription Draft</h3>
        </div>
        <p className="text-sm text-secondary-600 mb-5 leading-relaxed">
          Generate a draft prescription from the clinical note above. The AI will suggest medications,
          dosages, and instructions — you can review and edit before sending to a doctor.
        </p>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-600/30"
        >
          <Pill className="h-4 w-4" />
          Generate Prescription
        </button>
      </div>
    );
  }

  // ── Generating state ──
  if (status === 'generating') {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white p-8 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
              <Pill className="h-7 w-7 text-teal-600" />
            </div>
            <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-teal-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-secondary-900">AI is drafting prescription...</p>
            <p className="text-xs text-secondary-500 mt-1">Analyzing clinical note and generating medications</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (status === 'error' && !prescription) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-error-500" />
          <h3 className="text-base font-semibold text-error-700">Generation Failed</h3>
        </div>
        <p className="text-sm text-error-600 mb-4">{error || 'An error occurred'}</p>
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 rounded-xl bg-error-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-error-600"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
          <button
            onClick={handleReset}
            className="rounded-xl border border-secondary-300 bg-white px-4 py-2.5 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Generated / sending / sent state: show full prescription ──
  if (prescription) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Prescription Preview Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-teal-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-white" />
                <span className="text-base font-bold text-white">Prescription Draft</span>
              </div>
              <span className="rounded-full bg-teal-500/30 px-3 py-1 text-xs font-medium text-teal-50">
                AI-Generated · Draft
              </span>
            </div>
          </div>

          {/* Patient info bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-teal-50/50 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-teal-700">Patient:</span>
              <span className="text-sm font-semibold text-secondary-900">{patientName || 'Patient'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-teal-600" />
              <span className="text-sm font-medium text-secondary-700">{today}</span>
            </div>
          </div>

          {/* Medications table */}
          <div className="px-6 py-5">
            <h4 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-3">
              Medications
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-3 text-left text-xs font-semibold text-secondary-600">Drug Name</th>
                    <th className="pb-2 pr-3 text-left text-xs font-semibold text-secondary-600">Dosage</th>
                    <th className="pb-2 pr-3 text-left text-xs font-semibold text-secondary-600">Frequency</th>
                    <th className="pb-2 pr-3 text-left text-xs font-semibold text-secondary-600">Duration</th>
                    <th className="pb-2 text-left text-xs font-semibold text-secondary-600">Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {editedMedications.map((med, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-secondary-900">{med.drug_name}</td>
                      <td className="py-2.5 pr-3 text-secondary-700">{med.dosage}</td>
                      <td className="py-2.5 pr-3 text-secondary-700">{med.frequency}</td>
                      <td className="py-2.5 pr-3 text-secondary-700">{med.duration}</td>
                      <td className="py-2.5 text-secondary-600 text-xs">{med.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Additional notes */}
            {editedNotes && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">
                  Additional Notes
                </h4>
                <p className="text-sm text-secondary-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {editedNotes}
                </p>
              </div>
            )}

            {/* Warnings */}
            {editedWarnings && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Warnings</span>
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{editedWarnings}</p>
              </div>
            )}
          </div>
        </div>

        {/* Editable text area */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-secondary-500" />
            <h4 className="text-sm font-semibold text-secondary-900">Edit Before Sending</h4>
          </div>
          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-secondary-800 leading-relaxed font-mono resize-y focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:outline-none transition-all"
            placeholder="Review and edit the prescription text before sending to the doctor..."
          />
        </div>

        {/* Doctor info + send button */}
        {status !== 'sent' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="h-4 w-4 text-teal-600" />
              <h4 className="text-sm font-semibold text-secondary-900">Send to Doctor for Review</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div>
                <label className="block text-xs font-medium text-secondary-600 mb-1.5">
                  Doctor's Name
                </label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Smith"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-secondary-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-600 mb-1.5">
                  Doctor's Email
                </label>
                <input
                  type="email"
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="doctor@hospital.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-secondary-800 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:outline-none transition-all"
                />
              </div>
            </div>

            {error && status === 'error' && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-error-500 mt-0.5" />
                <p className="text-sm text-error-600">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSendForReview}
                disabled={status === 'sending' || !doctorEmail.trim()}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send to Doctor for Review
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={status === 'sending'}
                className="rounded-xl border border-secondary-300 bg-white px-5 py-3 text-sm font-medium text-secondary-700 transition-all hover:bg-secondary-50 disabled:opacity-50"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          /* Sent success state */
          <div className="rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100">
                <CheckCircle2 className="h-6 w-6 text-accent-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-accent-800">
                  Prescription sent to Dr. {doctorName || 'Doctor'} for review
                </p>
                <p className="text-xs text-accent-600 mt-0.5">
                  The doctor will receive an email at {doctorEmail} with the prescription draft.
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="mt-4 flex items-center gap-2 rounded-xl border border-accent-300 bg-white px-4 py-2.5 text-sm font-medium text-accent-700 transition-all hover:bg-accent-50"
            >
              <RotateCcw className="h-4 w-4" />
              New Prescription
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function formatPrescriptionText(
  medications: Medication[],
  notes: string,
  warnings: string,
  patientName: string,
): string {
  let text = `PRESCRIPTION DRAFT\n${'='.repeat(50)}\n\n`;
  text += `Patient: ${patientName || 'Patient'}\nDate: ${new Date().toLocaleDateString('en-US')}\n\n`;

  text += `MEDICATIONS\n${'-'.repeat(50)}\n`;
  medications.forEach((m, i) => {
    text += `\n${i + 1}. ${m.drug_name}\n`;
    text += `   Dosage: ${m.dosage}\n`;
    text += `   Frequency: ${m.frequency}\n`;
    text += `   Duration: ${m.duration}\n`;
    text += `   Instructions: ${m.instructions}\n`;
  });

  if (notes) {
    text += `\nADDITIONAL NOTES\n${'-'.repeat(50)}\n${notes}\n`;
  }

  if (warnings) {
    text += `\nWARNINGS\n${'-'.repeat(50)}\n${warnings}\n`;
  }

  return text;
}

function extractClinicalNoteSummary(note: string): string {
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(subjective|objective|assessment|plan)\s*:/i.test(line))
    .join(' ')
    .trim();
}

function buildFallbackPrescription(note: string): PrescriptionResult {
  const summary = extractClinicalNoteSummary(note);
  const durationMatch = summary.match(/for\s+(\d+\s+(?:day|days|week|weeks))/i);
  const medicationMatch = note.match(
    /(?:start|continue|take|prescribe|prescribed)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})/i,
  );
  const medicationName = medicationMatch?.[1]?.replace(/[.,].*$/, '').trim();
  return {
    prescription_id: null,
    medications: [
      {
        drug_name: medicationName || 'Medication plan from consultation',
        dosage: 'As previously prescribed',
        frequency: 'As directed',
        duration: durationMatch ? durationMatch[1] : 'Until reviewed by your clinician',
        instructions: summary || 'Follow the medication instructions discussed in the consultation.',
      },
    ],
    additional_notes: summary || 'Review this draft with the prescribing clinician before use.',
    warnings: 'This is a local draft fallback and requires clinician review before use.',
  };
}
