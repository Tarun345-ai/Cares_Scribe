import express from 'express';
import { Resend } from 'resend';

const router = express.Router();
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/dispatch', async (req, res) => {
  try {
    const {
      patient_email = '',
      patient_name = 'Patient',
      clinical_note = '',
      actions = [],
    } = req.body;

    if (!resend) {
      return res.status(503).json({ error: 'Email service not configured. Set RESEND_API_KEY.' });
    }
    if (!EMAIL_PATTERN.test(String(patient_email).trim())) {
      return res.status(400).json({ error: 'A valid patient email address is required' });
    }
    if (!Array.isArray(actions)) {
      return res.status(400).json({ error: 'actions must be an array' });
    }

    const actionItems = actions
      .map((action) => `<li><strong>${escapeHtml(action.title || 'Care action')}</strong> (${escapeHtml(action.type || 'review')})</li>`)
      .join('');
    const emailResult = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: patient_email,
      subject: 'Your Care Loop consultation summary',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1e293b">
          <h1 style="color:#2563eb">Your consultation summary</h1>
          <p>Hello ${escapeHtml(patient_name)},</p>
          <h2>Summary</h2>
          <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(clinical_note || 'Your clinician did not provide a written summary.')}</p>
          <h2>Care actions</h2>
          <ul>${actionItems || '<li>No care actions were recorded.</li>'}</ul>
          <p style="color:#64748b;font-size:12px">Please follow your clinician’s instructions and contact them with any questions.</p>
        </div>
      `,
    });

    return res.json({ success: true, email_id: emailResult.id });
  } catch (error) {
    console.error('[summaries/dispatch] Email error:', error);
    return res.status(502).json({ error: 'Failed to send patient summary email', detail: error.message });
  }
});

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
