import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || 'careloop@resend.dev';
const GROQ_LLM_MODEL = process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';

console.log('[Prescription] Backend route module loaded');
console.log('[Prescription] GROQ_API_KEY configured:', !!GROQ_API_KEY);
console.log('[Prescription] RESEND_API_KEY configured:', !!RESEND_API_KEY);
console.log('[Prescription] RESEND_FROM_EMAIL:', RESEND_FROM_EMAIL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// POST /api/prescription/generate
router.post('/generate', async (req, res) => {
  try {
    const {
      consultation_id,
      session_id,
      patient_id,
      clinical_note,
      clinical_note_summary,
      transcription,
    } = req.body;
    const noteText = String(clinical_note || '').trim();
    const summaryText = String(clinical_note_summary || noteText).trim();
    const conversationText = String(transcription || '').trim();
    let consultationId = consultation_id || session_id || null;

    console.log('[prescription/generate] Received request');
    console.log('[prescription/generate] consultation_id:', consultation_id);
    console.log('[prescription/generate] patient_id:', patient_id);
    console.log('[prescription/generate] clinical_note length:', noteText.length);

    if (!patient_id) {
      return res.status(400).json({ error: 'patient_id is required' });
    }
    if (!noteText && !conversationText) {
      return res.status(400).json({ error: 'clinical_note is required' });
    }

    // A draft can be generated before the user saves care actions. Create the
    // parent consultation so the prescription is not left with a null session.
    if (!consultationId) {
      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({ patient_id, clinical_note: noteText || conversationText })
        .select('id')
        .single();

      if (consultationError) {
        console.warn('[prescription/generate] Could not create consultation session:', consultationError.message);
      } else {
        consultationId = consultation.id;
      }
    }

    // ── Call Groq llama-3.3-70b-versatile ──
    console.log('[prescription/generate] Calling Groq llama-3.3-70b-versatile...');

    const systemPrompt = `You are a clinical prescription assistant. Based on the clinical note provided, draft a prescription.
Return ONLY valid JSON:
{
  "medications": [
    { "drug_name": string, "dosage": string, "frequency": string, "duration": string, "instructions": string }
  ],
  "additional_notes": string,
  "warnings": string
}
Do not include any explanation. Only return the JSON.`;

    let llmResponse;
    try {
      llmResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: GROQ_LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Clinical note:\n${noteText}\n\nClinical note summary:\n${summaryText}\n\nOriginal conversation:\n${conversationText}`,
            },
          ],
          max_completion_tokens: 4096,
          reasoning_effort: 'low',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          timeout: 60000,
        }
      );
    } catch (err) {
      console.error('[prescription/generate] Groq API error:', err.response?.data || err.message);
      return res.status(502).json({
        error: 'AI generation failed, please retry',
        detail: err.response?.data?.error?.message || err.message,
      });
    }

    const rawContent = llmResponse.data.choices?.[0]?.message?.content || '';
    console.log('[prescription/generate] Raw LLM response (first 300 chars):', rawContent.substring(0, 300));

    // ── Parse JSON response ──
    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[prescription/generate] JSON parse error:', parseErr.message);
      console.error('[prescription/generate] Raw content:', rawContent);
      return res.status(400).json({ error: 'AI generation failed, please retry' });
    }

    const medications = Array.isArray(parsed.medications) ? parsed.medications : [];
    const additionalNotes = parsed.additional_notes || '';
    const warnings = parsed.warnings || '';

    console.log('[prescription/generate] Parsed. Medications count:', medications.length);
    console.log('[prescription/generate] Medications:', medications.map((m) => m.drug_name));

    // ── Save draft to Supabase ──
    console.log('[prescription/generate] Saving draft to Supabase prescriptions table...');

    const { data: insertData, error: insertErr } = await supabase
      .from('prescriptions')
      .insert({
        consultation_id: consultationId,
        patient_id,
        medications,
        additional_notes: additionalNotes,
        warnings,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[prescription/generate] Supabase insert error:', insertErr);
      // The generated draft is still useful to the clinician. Let the UI show
      // it and surface persistence as a warning instead of discarding it.
      return res.json({
        prescription_id: null,
        consultation_id: consultationId,
        medications,
        additional_notes: additionalNotes,
        warnings,
        persistence_warning: 'Draft generated but could not be saved yet.',
      });
    }

    console.log('[prescription/generate] Draft saved. Prescription ID:', insertData.id);

    return res.json({
      prescription_id: insertData.id,
      consultation_id: consultationId,
      medications,
      additional_notes: additionalNotes,
      warnings,
    });
  } catch (err) {
    console.error('[prescription/generate] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// POST /api/prescription/send-for-review
router.post('/send-for-review', async (req, res) => {
  try {
    const { prescription_id, doctor_email, doctor_name, patient_name, medications, additional_notes, warnings } = req.body;

    console.log('[prescription/send-for-review] Received request');
    console.log('[prescription/send-for-review] prescription_id:', prescription_id);
    console.log('[prescription/send-for-review] doctor_email:', doctor_email);
    console.log('[prescription/send-for-review] doctor_name:', doctor_name);

    if (!doctor_email) {
      return res.status(400).json({ error: 'doctor_email is required' });
    }
    if (!medications || !Array.isArray(medications)) {
      return res.status(400).json({ error: 'medications array is required' });
    }

    if (!resend) {
      console.error('[prescription/send-for-review] RESEND_API_KEY not configured');
      return res.status(500).json({ error: 'Email service not configured. Set RESEND_API_KEY.' });
    }

    // ── Build HTML email ──
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const medicationsRows = medications
      .map(
        (m) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b;">${escapeHtml(m.drug_name || '')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">${escapeHtml(m.dosage || '')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">${escapeHtml(m.frequency || '')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">${escapeHtml(m.duration || '')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;">${escapeHtml(m.instructions || '')}</td>
        </tr>`
      )
      .join('');

    const warningsSection = warnings
      ? `
      <div style="margin-top:24px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;">
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">⚠ Warnings</p>
        <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">${escapeHtml(warnings)}</p>
      </div>`
      : '';

    const notesSection = additional_notes
      ? `
      <div style="margin-top:20px;">
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Additional Notes</p>
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;background:#f8fafc;border-radius:8px;padding:14px;border:1px solid #e2e8f0;">${escapeHtml(additional_notes)}</p>
      </div>`
      : '';

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
        <!-- Header -->
        <div style="background:#0D9488;border-radius:12px 12px 0 0;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Care Loop</h1>
          <p style="margin:4px 0 0 0;color:#ccfbf1;font-size:13px;">Prescription Review Required</p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <p style="margin:0 0 4px 0;font-size:14px;color:#64748b;">Dear Dr. ${escapeHtml(doctor_name || '')},</p>
          <p style="margin:0 0 24px 0;font-size:15px;color:#1e293b;line-height:1.6;">
            A prescription has been AI-drafted for <strong>${escapeHtml(patient_name || 'the patient')}</strong> and requires your review and approval.
          </p>

          <!-- Patient info bar -->
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="margin:0;font-size:12px;color:#0f766e;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Patient</p>
              <p style="margin:2px 0 0 0;font-size:16px;font-weight:600;color:#134e4a;">${escapeHtml(patient_name || 'Unknown')}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0;font-size:12px;color:#0f766e;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Date</p>
              <p style="margin:2px 0 0 0;font-size:14px;color:#134e4a;font-weight:500;">${today}</p>
            </div>
          </div>

          <!-- Medications table -->
          <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Prescribed Medications</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Drug Name</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Dosage</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Frequency</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Duration</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Instructions</th>
              </tr>
            </thead>
            <tbody>
              ${medicationsRows}
            </tbody>
          </table>

          ${notesSection}
          ${warningsSection}

          <!-- Action buttons -->
          <div style="margin-top:32px;display:flex;gap:12px;">
            <a href="#" style="display:inline-block;background:#0D9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Approve</a>
            <a href="#" style="display:inline-block;background:#ffffff;color:#475569;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;border:1px solid #cbd5e1;">Request Changes</a>
          </div>

          <!-- Footer -->
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;font-style:italic;">
              This prescription was AI-drafted and requires your review and approval before being issued to the patient.
            </p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;">
              Care Loop — AI-assisted clinical documentation platform
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>`;

    // ── Send email via Resend ──
    console.log('[prescription/send-for-review] Sending email via Resend to:', doctor_email);

    let emailResult;
    try {
      emailResult = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: doctor_email,
        subject: `Care Loop — Prescription Review Required: ${patient_name || 'Patient'}`,
        html: htmlBody,
      });
    } catch (err) {
      console.error('[prescription/send-for-review] Resend API error:', err);
      return res.status(502).json({
        error: 'Failed to send email',
        detail: err.message || 'Resend API error',
      });
    }

    console.log('[prescription/send-for-review] Email sent. ID:', emailResult.id);

    // ── Update Supabase: status → pending_review, sent_at → now() ──
    console.log('[prescription/send-for-review] Updating prescription status to pending_review...');

    if (prescription_id) {
      const { error: updateErr } = await supabase
        .from('prescriptions')
        .update({
          status: 'pending_review',
          sent_at: new Date().toISOString(),
        })
        .eq('id', prescription_id);

      if (updateErr) {
        console.error('[prescription/send-for-review] Supabase update error:', updateErr);
        // Email was sent, so we still return success but log the error
      } else {
        console.log('[prescription/send-for-review] Prescription status updated to pending_review');
      }
    }

    return res.json({ success: true, email_id: emailResult.id });
  } catch (err) {
    console.error('[prescription/send-for-review] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
