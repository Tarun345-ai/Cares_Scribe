import express from 'express';
import crypto from 'node:crypto';

const router = express.Router();

router.post('/', (req, res) => {
  if (typeof req.body?.patient_consent_storage !== 'boolean') {
    return res.status(400).json({ error: 'patient_consent_storage must be a boolean' });
  }
  return res.status(201).json({
    id: crypto.randomUUID(),
    patient_consent_storage: req.body.patient_consent_storage,
    created_at: new Date().toISOString(),
  });
});

export default router;

