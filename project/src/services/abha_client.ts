import type { AbhaRecord } from '@/types/abha';

const MOCK_RECORDS: AbhaRecord[] = [
  { id: 'mock-condition-1', date: '2024-02-14', type: 'condition', title: 'Type 2 diabetes mellitus', details: 'Chronic condition recorded in ABHA health history', source: 'ABHA Mock' },
  { id: 'mock-condition-2', date: '2023-09-02', type: 'condition', title: 'Essential hypertension', details: 'Chronic condition recorded in ABHA health history', source: 'ABHA Mock' },
  { id: 'mock-medication-1', date: '2024-03-01', type: 'medication', title: 'Metformin 500 mg', details: 'Previous medication', source: 'ABHA Mock' },
  { id: 'mock-medication-2', date: '2024-03-01', type: 'medication', title: 'Amlodipine 5 mg', details: 'Previous medication', source: 'ABHA Mock' },
];

export function parseFhirBundle(bundle: unknown): AbhaRecord[] {
  if (!bundle || typeof bundle !== 'object' || !Array.isArray((bundle as { entry?: unknown }).entry)) return [];
  return (bundle as { entry: Array<{ resource?: Record<string, unknown> }> }).entry.flatMap((entry, index) => {
    const resource = entry.resource;
    if (!resource || typeof resource !== 'object') return [];
    const type = String(resource.resourceType || '').toLowerCase();
    const title = String(
      (resource.code as { text?: string } | undefined)?.text ||
      (resource.medicationCodeableConcept as { text?: string } | undefined)?.text ||
      resource.description ||
      resource.resourceType ||
      'Clinical record',
    );
    const date = String(resource.recordedDate || resource.authoredOn || resource.effectiveDateTime || '').slice(0, 10) || 'Unknown date';
    const recordType: AbhaRecord['type'] = type === 'medicationrequest' ? 'medication' : type === 'procedure' ? 'procedure' : type === 'condition' ? 'condition' : 'observation';
    return [{ id: String(resource.id || `abha-${index}`), date, type: recordType, title, details: 'FHIR clinical artifact imported from ABHA', source: 'ABHA Sandbox' as const }];
  });
}

export async function syncAbhaRecords(abhaId: string, otp?: string): Promise<{ records: AbhaRecord[]; mocked: boolean }> {
  try {
    const response = await fetch('/api/abha/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abha_id: abhaId, otp }),
    });
    if (!response.ok) throw new Error(`ABHA sync failed (${response.status})`);
    const payload = await response.json() as { bundle?: unknown; records?: AbhaRecord[]; mocked?: boolean };
    const records = payload.records || parseFhirBundle(payload.bundle);
    if (records.length > 0) return { records, mocked: payload.mocked === true };
  } catch (error) {
    console.warn('[ABHA] Falling back to mock records:', error);
  }
  return { records: MOCK_RECORDS, mocked: true };
}

