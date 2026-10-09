import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const GROQ_LLM_MODEL = process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';

console.log('[Care Loop] Backend route module loaded');
console.log('[Care Loop] GROQ_API_KEY configured:', !!GROQ_API_KEY);
console.log('[Care Loop] SUPABASE_URL:', SUPABASE_URL ? 'set' : 'missing');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// POST /api/consultation/transcribe
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('[transcribe] Error: no audio file received');
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const file = req.file;
    const mimeType = file.mimetype || 'audio/webm';
    const patientConsentStorage = req.body?.patient_consent_storage === 'true';
    console.log('[transcribe] Received audio file:', {
      originalname: file.originalname,
      mimetype: mimeType,
      size: file.size,
    });

    // ── Step 1: Send audio to Groq Whisper API ──
    console.log('[transcribe] Step 1: Sending audio to Groq Whisper (whisper-large-v3)...');

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'recording.webm',
      contentType: mimeType,
    });
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');

    let whisperResponse;
    try {
      whisperResponse = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 60000,
        }
      );
    } catch (err) {
      file.buffer.fill(0);
      console.error('[transcribe] Groq Whisper API error:', err.response?.data || err.message);
      return res.status(502).json({
        error: 'Transcription service failed',
        detail: err.response?.data?.error?.message || err.message,
      });
    }

    const transcription = whisperResponse.data.text || '';
    const languageDetected = whisperResponse.data.language || 'unknown';
    console.log('[transcribe] Step 1 complete. Language:', languageDetected);
    console.log('[transcribe] Transcription (first 200 chars):', transcription.substring(0, 200));

    if (!transcription.trim()) {
      file.buffer.fill(0);
      console.log('[transcribe] Warning: empty transcription');
      return res.status(422).json({ error: 'No speech detected in the recording' });
    }

    try {
      if (patientConsentStorage) {
        const recordingsDir = path.resolve(process.cwd(), 'backend', 'recordings');
        await fs.mkdir(recordingsDir, { recursive: true });
        const extension = mimeType.includes('webm') ? 'webm' : 'wav';
        await fs.writeFile(path.join(recordingsDir, `${Date.now()}-${file.originalname || `recording.${extension}`}`), file.buffer);
      }
    } finally {
      file.buffer.fill(0);
    }

    // ── Step 2: language already captured from metadata ──
    console.log('[transcribe] Step 2: Language detected from Whisper metadata:', languageDetected);

    // ── Step 3: Send transcription to Groq llama-3.3-70b-versatile ──
    console.log('[transcribe] Step 3: Sending transcription to Groq llama-3.3-70b-versatile...');

    const systemPrompt = `You are a clinical assistant. Given a doctor-patient consultation transcript, produce:
1. A structured clinical note (SOAP format: Subjective, Objective, Assessment, Plan)
2. A list of care actions as JSON array with fields: title, type (medication/test/referral/review), due_days_from_today, depends_on (title of action it depends on or null)
Return ONLY valid JSON: { clinical_note: string, actions: [...] }`;

    let llmResponse;
    try {
      llmResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: GROQ_LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcription },
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
      console.error('[transcribe] Groq LLM API error:', err.response?.data || err.message);
      return res.status(502).json({
        error: 'Clinical note generation failed',
        detail: err.response?.data?.error?.message || err.message,
      });
    }

    const rawContent = llmResponse.data.choices?.[0]?.message?.content || '';
    console.log('[transcribe] Step 3 complete. Raw LLM response (first 300 chars):', rawContent.substring(0, 300));

    // ── Step 4: Parse the JSON response ──
    console.log('[transcribe] Step 4: Parsing LLM JSON response...');

    let parsed;
    try {
      // Extract JSON from possible markdown code fences
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[transcribe] JSON parse error:', parseErr.message);
      console.error('[transcribe] Raw content:', rawContent);
      return res.status(500).json({
        error: 'Failed to parse AI clinical note response',
        raw: rawContent.substring(0, 500),
      });
    }

    const clinicalNote = parsed.clinical_note || 'No clinical note generated.';
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    console.log('[transcribe] Step 4 complete. Actions count:', actions.length);
    console.log('[transcribe] Actions:', actions.map(a => a.title));

    // ── Return full result ──
    return res.json({
      language: languageDetected,
      transcription,
      clinical_note: clinicalNote,
      actions,
    });
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// POST /api/consultation/save-actions
router.post('/save-actions', express.json(), async (req, res) => {
  try {
    const { patient_id, actions, consultation_id, language, transcription, clinical_note } = req.body;

    console.log('[save-actions] Received request');
    console.log('[save-actions] patient_id:', patient_id);
    console.log('[save-actions] actions count:', actions?.length || 0);

    if (!patient_id) {
      return res.status(400).json({ error: 'patient_id is required' });
    }
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'actions array is required and must not be empty' });
    }

    // ── Insert consultation record if metadata provided ──
    let consultationId = consultation_id;
    if (!consultationId) {
      console.log('[save-actions] Inserting consultation record...');
      const { data: consultData, error: consultErr } = await supabase
        .from('consultations')
        .insert({
          patient_id,
          language_detected: language || null,
          transcription: transcription || null,
          clinical_note: clinical_note || null,
        })
        .select('id')
        .single();

      if (consultErr) {
        console.error('[save-actions] Consultation insert error:', consultErr);
        return res.status(500).json({ error: 'Failed to save consultation', detail: consultErr.message });
      }
      consultationId = consultData.id;
      console.log('[save-actions] Consultation created:', consultationId);
    }

    // ── Insert care actions ──
    console.log('[save-actions] Inserting care actions...');
    const today = new Date();

    const actionRows = actions.map((a) => {
      const dueDays = typeof a.due_days_from_today === 'number' ? a.due_days_from_today : 7;
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + dueDays);
      return {
        consultation_id: consultationId,
        patient_id,
        title: a.title || 'Untitled action',
        type: a.type || 'review',
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
      };
    });

    const { data: insertedActions, error: actionsErr } = await supabase
      .from('care_actions')
      .insert(actionRows)
      .select('id, title');

    if (actionsErr) {
      console.error('[save-actions] Care actions insert error:', actionsErr);
      return res.status(500).json({ error: 'Failed to save care actions', detail: actionsErr.message });
    }

    console.log('[save-actions] Inserted', insertedActions.length, 'care actions');

    // ── Build dependency links ──
    const titleToId = {};
    insertedActions.forEach((a) => { titleToId[a.title] = a.id; });

    const depRows = [];
    actions.forEach((ai) => {
      const actionId = titleToId[ai.title];
      if (ai.depends_on && titleToId[ai.depends_on]) {
        const dependsOnId = titleToId[ai.depends_on];
        depRows.push({ action_id: actionId, depends_on_id: dependsOnId });
      }
    });

    if (depRows.length > 0) {
      console.log('[save-actions] Inserting', depRows.length, 'dependency links...');
      const { error: depErr } = await supabase
        .from('action_dependencies')
        .insert(depRows);

      if (depErr) {
        console.error('[save-actions] Dependency insert error:', depErr);
        // Non-fatal — actions were saved successfully
      } else {
        console.log('[save-actions] Dependencies inserted successfully');
      }
    }

    console.log('[save-actions] Done. Inserted count:', insertedActions.length);
    return res.json({ success: true, inserted_count: insertedActions.length, consultation_id: consultationId });
  } catch (err) {
    console.error('[save-actions] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
