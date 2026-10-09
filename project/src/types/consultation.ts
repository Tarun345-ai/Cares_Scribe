export interface CareAction {
  title: string;
  type: 'medication' | 'test' | 'referral' | 'review';
  due_days_from_today: number;
  depends_on: string | null;
}

export interface TranscriptionResult {
  language: string;
  transcription: string;
  clinical_note: string;
  actions: CareAction[];
}

export const ACTION_TYPE_META: Record<
  CareAction['type'],
  { label: string; icon: string; color: string; bgColor: string; borderColor: string; dotColor: string }
> = {
  medication: {
    label: 'Medication',
    icon: 'Pill',
    color: 'text-primary-700',
    bgColor: 'bg-primary-50',
    borderColor: 'border-primary-200',
    dotColor: 'bg-primary-500',
  },
  test: {
    label: 'Test',
    icon: 'FlaskConical',
    color: 'text-warning-700',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    dotColor: 'bg-warning-500',
  },
  referral: {
    label: 'Referral',
    icon: 'Stethoscope',
    color: 'text-accent-700',
    bgColor: 'bg-accent-50',
    borderColor: 'border-accent-200',
    dotColor: 'bg-accent-500',
  },
  review: {
    label: 'Review',
    icon: 'ClipboardList',
    color: 'text-secondary-700',
    bgColor: 'bg-secondary-100',
    borderColor: 'border-secondary-300',
    dotColor: 'bg-secondary-500',
  },
};