import express from 'express';
import axios from 'axios';

const router = express.Router();
const ABHA_BASE_URL = process.env.ABHA_SANDBOX_URL || 'https://dev.abdm.gov.in';
const ABHA_TOKEN = process.env.ABHA_SANDBOX_TOKEN || '';

const MOCK_BUNDLE = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    { resource: { resourceType: 'Condition', id: 'mock-condition-1', recordedDate: '2024-02-14', code: { text: 'Type 2 diabetes mellitus' } } },
    { resource: { resourceType: 'Condition', id: 'mock-condition-2', recordedDate: '2023-09-02', code: { text: 'Essential hypertension' } } },
    { resource: { resourceType: 'MedicationRequest', id: 'mock-medication-1', authoredOn: '2024-03-01', medicationCodeableConcept: { text: 'Metformin 500 mg' } } },
    { resource: { resourceType: 'MedicationRequest', id: 'mock-medication-2', authoredOn: '2024-03-01', medicationCodeableConcept: { text: 'Amlodipine 5 mg' } } },
  ],
};

router.post('/sync', async (req, res) => {
  const { abha_id: abhaId, otp } = req.body || {};
  if (typeof abhaId !== 'string' || !abhaId.trim()) return res.status(400).json({ error: 'abha_id is required' });

  if (!ABHA_TOKEN) return res.json({ bundle: MOCK_BUNDLE, mocked: true });

  try {
    const headers = { Authorization: `Bearer ${ABHA_TOKEN}`, 'Content-Type': 'application/json' };
    const init = await axios.post(`${ABHA_BASE_URL}/v1/auth/init`, { abhaId: abhaId.trim() }, { headers, timeout: 15000 });
    if (!otp) return res.json({ otp_required: true, transaction_id: init.data?.transactionId, mocked: false });
    const confirmation = await axios.post(`${ABHA_BASE_URL}/v1/auth/confirmWithAadhaarOtp`, { transactionId: init.data?.transactionId, otp }, { headers, timeout: 15000 });
    const consent = await axios.post(`${ABHA_BASE_URL}/v1/consents/hip/notify`, { abhaId: abhaId.trim() }, { headers: { ...headers, Authorization: `Bearer ${confirmation.data?.token || ABHA_TOKEN}` }, timeout: 15000 });
    const fetched = await axios.post(`${ABHA_BASE_URL}/v1/health-information/fetch`, { consentId: consent.data?.consentId }, { headers, timeout: 15000 });
    return res.json({ bundle: fetched.data, mocked: false });
  } catch (error) {
    console.warn('[ABHA] Sandbox request failed; returning demo records:', error.response?.data || error.message);
    return res.json({ bundle: MOCK_BUNDLE, mocked: true });
  }
});

export default router;

