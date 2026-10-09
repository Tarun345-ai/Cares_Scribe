export interface AbhaRecord {
  id: string;
  date: string;
  type: 'condition' | 'procedure' | 'medication' | 'observation';
  title: string;
  details: string;
  source: 'ABHA Sandbox' | 'ABHA Mock';
}

