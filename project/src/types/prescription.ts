export interface Medication {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionResult {
  prescription_id: string | null;
  medications: Medication[];
  additional_notes: string;
  warnings: string;
}

export type PrescriptionStatus =
  | 'idle'
  | 'generating'
  | 'generated'
  | 'sending'
  | 'sent'
  | 'error';